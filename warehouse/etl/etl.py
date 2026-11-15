"""
ETL for the EBSU data warehouse (ALL DATA IS SIMULATED).

    python warehouse/etl/etl.py                 # text log
    python warehouse/etl/etl.py --json          # one JSON event per line (used by the dashboard)
    python warehouse/etl/etl.py --schema-only   # create the database and tables, then stop

Extract: reads the three source-system exports (admissions.csv, bursary.csv, exams.csv)
and the official department list. Transform: standardises identifiers, labels, dates and
amounts, conforms faculty and department names, removes duplicates, rejects rows that
cannot be trusted (each with a reason) and builds the five dimensions and three facts of
the star schema. Load: fills shadow tables, checks row counts and every foreign key, then
swaps the new tables in with one atomic RENAME TABLE. Every run is recorded in the
etl_run* audit tables and rejected rows in etl_reject.

Database settings come from environment variables, then .env, then .env.local
(DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import pymysql

ROOT = Path(__file__).resolve().parents[2]
WAREHOUSE = ROOT / "warehouse"
SOURCES = WAREHOUSE / "data" / "sources"
REFERENCE = WAREHOUSE / "data" / "reference"
SCHEMA_SQL = WAREHOUSE / "sql" / "schema.sql"

SOURCE_FILES = {
    "admissions": ("admissions.csv", "Admissions & Records"),
    "bursary": ("bursary.csv", "Bursary (fees)"),
    "exams": ("exams.csv", "Examinations & Records"),
}

# Five-point scale reported for EBSU: (lowest score, grade, grade point). E is kept as a pass.
GRADE_SCALE = [(70, "A", 5), (60, "B", 4), (50, "C", 3), (45, "D", 2), (40, "E", 1), (0, "F", 0)]
PASS_MARK = 40

STAR_TABLES_LOAD_ORDER = [
    "dim_faculty",
    "dim_department",
    "dim_session",
    "dim_student",
    "dim_course",
    "fact_enrolment",
    "fact_fee_payment",
    "fact_result",
]


class Reporter:
    """Prints progress as text, or as one JSON event per line for the dashboard."""

    def __init__(self, as_json: bool = False):
        self.as_json = as_json
        self.t0 = time.perf_counter()

    def ms(self) -> int:
        return int((time.perf_counter() - self.t0) * 1000)

    def emit(self, event: dict, text: str | None = None) -> None:
        if self.as_json:
            print(json.dumps({**event, "t": round(time.perf_counter() - self.t0, 3)}, default=str), flush=True)
        elif text is not None:
            print(text, flush=True)


# ---------------------------------------------------------------------------
# Configuration and database helpers
# ---------------------------------------------------------------------------
def read_env_files() -> dict:
    values: dict[str, str] = {}
    for name in (".env", ".env.local"):  # .env.local wins
        path = ROOT / name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def db_config() -> dict:
    files = read_env_files()

    def get(key: str, default: str) -> str:
        return os.environ.get(key) or files.get(key) or default

    return {
        "host": get("DB_HOST", "127.0.0.1"),
        "port": int(get("DB_PORT", "3306")),
        "user": get("DB_USER", "root"),
        "password": os.environ.get("DB_PASSWORD", files.get("DB_PASSWORD", "")),
        "database": get("DB_NAME", "ebsu_dw"),
    }


def connect(cfg: dict, with_db: bool = True, autocommit: bool = True):
    return pymysql.connect(host=cfg["host"], port=cfg["port"], user=cfg["user"], password=cfg["password"],
                           database=cfg["database"] if with_db else None, charset="utf8mb4",
                           autocommit=autocommit, connect_timeout=5)


def split_sql(script: str) -> list[str]:
    """Split a SQL script into statements, ignoring -- comment lines."""
    lines = [ln for ln in script.splitlines() if not ln.strip().startswith("--")]
    statements, current = [], []
    for ln in lines:
        current.append(ln)
        if ln.rstrip().endswith(";"):
            stmt = "\n".join(current).strip().rstrip(";").strip()
            if stmt:
                statements.append(stmt)
            current = []
    tail = "\n".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def ensure_schema(cfg: dict) -> None:
    with connect(cfg, with_db=False) as conn, conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{cfg['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    with connect(cfg) as conn, conn.cursor() as cur:
        for stmt in split_sql(SCHEMA_SQL.read_text(encoding="utf-8")):
            cur.execute(stmt)
        ensure_foreign_keys(cur, cfg["database"])


# ---------------------------------------------------------------------------
# Cleaning rules (each is small and unit-tested in warehouse/tests/test_etl.py)
# ---------------------------------------------------------------------------
def by_unique(s: pd.Series, fn) -> pd.Series:
    """Apply fn once per distinct value (much faster than once per row)."""
    uniques = pd.unique(s)
    mapping = {u: fn(u) for u in uniques}
    return s.map(mapping)


def tidy(v) -> str:
    return re.sub(r"\s+", " ", str(v)).strip()


def clean_frame(df: pd.DataFrame, id_cols: tuple[str, ...] = ()) -> pd.DataFrame:
    """Trim stray spaces in every text column except the identifiers, which have their own rules."""
    out = df.copy()
    for col in out.columns:
        if col not in id_cols:
            out[col] = by_unique(out[col].astype(str), tidy)
    return out


MATRIC_SEP = re.compile(r"\s*[/\-]\s*")


def matric_value(v: str) -> str:
    return re.sub(r"\s+", "", MATRIC_SEP.sub("/", str(v).upper().strip()))


def std_matric(s: pd.Series) -> pd.Series:
    return by_unique(s, matric_value)


SESSION_RE = re.compile(r"^\s*(\d{4})\s*[/\-]\s*(\d{2}|\d{4})\s*$")


def std_session(value: str) -> str | None:
    m = SESSION_RE.match(str(value))
    if not m:
        return None
    start = int(m.group(1))
    end_raw = m.group(2)
    end = int(end_raw) if len(end_raw) == 4 else (start // 100) * 100 + int(end_raw)
    if end != start + 1:
        return None
    return f"{start}/{end}"


def std_date(s: pd.Series) -> pd.Series:
    """Parse ISO dates and dd/mm/yyyy or dd-mm-yyyy dates into datetime64."""
    raw = s.astype(str).str.strip()
    iso = pd.to_datetime(raw.where(raw.str.match(r"^\d{4}-\d{2}-\d{2}$")), format="%Y-%m-%d", errors="coerce")
    dmy = raw.str.replace("-", "/", regex=False)
    dmy = pd.to_datetime(dmy.where(dmy.str.match(r"^\d{2}/\d{2}/\d{4}$")), format="%d/%m/%Y", errors="coerce")
    return iso.fillna(dmy)


def parse_naira(s: pd.Series) -> pd.Series:
    cleaned = s.astype(str).str.replace("₦", "", regex=False).str.replace("NGN", "", regex=False)
    cleaned = cleaned.str.replace(",", "", regex=False).str.strip()
    return pd.to_numeric(cleaned, errors="coerce")


def normalise_name(s: str) -> str:
    s = str(s).upper().replace("&", " AND ")
    s = re.sub(r"\b(DEPARTMENT|DEPT|FACULTY|OF|THE)\b\.?", " ", s)
    return re.sub(r"[^A-Z0-9]", "", s)


def grade_from_score(total: pd.Series) -> tuple[pd.Series, pd.Series]:
    grade = pd.Series("F", index=total.index, dtype=object)
    point = pd.Series(0, index=total.index, dtype="int64")
    for lo, g, gp in sorted(GRADE_SCALE, key=lambda x: x[0]):
        mask = total >= lo
        grade = grade.mask(mask, g)
        point = point.mask(mask, gp)
    return grade, point


def attach_registration(df: pd.DataFrame, reg: pd.DataFrame) -> pd.DataFrame:
    """Left-join the student's registration for the same session, keeping the source row index."""
    out = df.reset_index().merge(reg, on=["matric_no", "session_std"], how="left")
    return out.set_index("index")


ISO_DATE = r"^\d{4}-\d{2}-\d{2}$"
COURSE_RE = re.compile(r"^\s*([A-Za-z]{3})\s*(\d{3})\s*$")


def std_course_code(v: str) -> str:
    m = COURSE_RE.match(str(v))
    return f"{m.group(1).upper()} {m.group(2)}" if m else str(v).strip().upper()


class SourceStats:
    """What happened to one source file: rows extracted, cleaned, duplicate, rejected and loaded."""

    def __init__(self, name: str, file_name: str, extracted: int):
        self.name = name
        self.file_name = file_name
        self.extracted = extracted
        self.duplicates = 0
        self.rejected = 0
        self.loaded = 0
        self.cleaned_rows: set = set()
        self.rules: list[tuple[str, int]] = []
        self.rejects: list[dict] = []

    def rule(self, rep: Reporter, text: str, rows) -> None:
        rows = int(rows)
        self.rules.append((text, rows))
        rep.emit({"type": "rule", "source": self.name, "rule": text, "rows": rows}, f"  {self.name:<10} {text}: {rows:,}")

    def cleaned(self, mask: pd.Series) -> None:
        self.cleaned_rows.update(mask[mask].index.tolist())

    def reject(self, df: pd.DataFrame, mask: pd.Series, reason: str, raw: pd.DataFrame) -> pd.DataFrame:
        mask = mask.fillna(False).astype(bool)
        if mask.any():
            for idx in df.index[mask]:
                rec = raw.loc[idx]
                text = " ".join(f"{k}={(str(v) if str(v) != '' else '(empty)')}" for k, v in rec.items())
                self.rejects.append({"source_row": int(idx) + 2, "reason": reason, "raw": text[:2000]})
            self.rejected += int(mask.sum())
        return df[~mask]

    def dedupe(self, df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
        dup = df.duplicated(keys, keep="first")
        self.duplicates += int(dup.sum())
        return df[~dup]

    def as_dict(self) -> dict:
        return {"source": self.name, "file": self.file_name, "extracted": self.extracted, "duplicates": self.duplicates,
                "rejected": self.rejected, "loaded": self.loaded, "cleaned": len(self.cleaned_rows)}


# ---------------------------------------------------------------------------
# EXTRACT
# ---------------------------------------------------------------------------
def extract(rep: Reporter) -> tuple[dict[str, pd.DataFrame], pd.DataFrame]:
    rep.emit({"type": "phase", "phase": "extract"}, "EXTRACT")
    frames = {}
    for name, (file_name, system) in SOURCE_FILES.items():
        path = SOURCES / file_name
        if not path.exists():
            raise FileNotFoundError(
                f"Missing source file {path}. Run: python warehouse/generator/generate_data.py")
        df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8")
        frames[name] = df
        rep.emit({"type": "extract", "source": name, "system": system, "file": file_name,
                  "rows": len(df), "columns": list(df.columns), "bytes": path.stat().st_size},
                 f"  {name:<10} {file_name}: {len(df):,} rows, {len(df.columns)} columns")
    ref_path = REFERENCE / "departments.csv"
    departments = pd.read_csv(ref_path, dtype=str, keep_default_na=False, encoding="utf-8")
    rep.emit({"type": "extract", "source": "reference", "system": "Academic Planning (reference data)",
              "file": "departments.csv", "rows": len(departments), "columns": list(departments.columns),
              "bytes": ref_path.stat().st_size},
             f"  reference  departments.csv: {len(departments):,} rows")
    return frames, departments


# ---------------------------------------------------------------------------
# TRANSFORM
# ---------------------------------------------------------------------------
def transform(rep: Reporter, frames: dict[str, pd.DataFrame], departments: pd.DataFrame):
    rep.emit({"type": "phase", "phase": "transform"}, "TRANSFORM")
    deps = departments.copy()
    deps["programme_years"] = deps["programme_years"].astype(int)
    official = {}
    for r in deps.itertuples():
        official[normalise_name(r.department_name)] = r.department_code
        for alias in filter(None, str(r.aliases).split(";")):
            official[normalise_name(alias)] = r.department_code
    dep_name = dict(zip(deps["department_code"], deps["department_name"]))
    dep_fac = dict(zip(deps["department_code"], deps["faculty_code"]))
    dep_years = dict(zip(deps["department_code"], deps["programme_years"]))
    fac_name = dict(zip(deps["faculty_code"], deps["faculty_name"]))

    # ------------------------------------------------------------ admissions
    raw = frames["admissions"]
    st = SourceStats("admissions", SOURCE_FILES["admissions"][0], len(raw))
    a = clean_frame(raw, id_cols=("matric_no",))

    a["matric_no"] = std_matric(raw["matric_no"])
    diff = (a["matric_no"] != raw["matric_no"]) & (raw["matric_no"].str.strip() != "")
    st.cleaned(diff)
    st.rule(rep, "Matric numbers standardised (case, separators, spaces)", diff.sum())

    a["session_std"] = by_unique(raw["session"], std_session)
    diff = a["session_std"].notna() & (a["session_std"] != raw["session"])
    st.cleaned(diff)
    st.rule(rep, "Session labels standardised to YYYY/YYYY", diff.sum())
    a["admission_std"] = by_unique(raw["year_of_admission"], std_session)

    sex = a["sex"].str.strip()
    letter = sex.str[:1].str.upper()
    a["gender"] = letter.map({"M": "Male", "F": "Female"}).fillna("Unspecified")
    odd = ~sex.isin(["M", "F"])
    st.cleaned(odd)
    st.rule(rep, "Gender codes decoded (M and F to Male and Female)", len(a))
    st.rule(rep, "Gender spellings fixed (m, male, Female ...)", odd.sum())

    a["dob"] = std_date(a["date_of_birth"])
    diff = a["dob"].notna() & ~a["date_of_birth"].str.match(ISO_DATE)
    st.cleaned(diff)
    st.rule(rep, "Dates of birth converted from dd/mm/yyyy to ISO dates", diff.sum())

    a["department_code"] = by_unique(a["department"], lambda v: official.get(normalise_name(v)))
    mapped_name = a["department_code"].map(dep_name)
    diff = a["department_code"].notna() & (a["department"] != mapped_name)
    st.cleaned(diff)
    st.rule(rep, "Department names mapped to the official department list", diff.sum())

    a["faculty_code"] = a["department_code"].map(dep_fac)
    a["faculty_official"] = a["faculty_code"].map(fac_name)
    fac_diff = a["faculty_code"].notna() & (a["faculty"] != a["faculty_official"])
    st.cleaned(fac_diff)
    st.rule(rep, "Faculty names conformed to the official list", fac_diff.sum())

    a = st.reject(a, a["matric_no"] == "", "Missing matric number", raw)
    a = st.reject(a, a["session_std"].isna(), "Unrecognised session label", raw)
    a = st.reject(a, a["department_code"].isna(), "Department not in official list", raw)
    level = pd.to_numeric(a["level"], errors="coerce")
    years = a["department_code"].map(dep_years)
    bad_level = level.isna() | (level < 100) | (level % 100 != 0) | (level > years * 100)
    a = st.reject(a, bad_level, "Level outside the programme (e.g. 0 or 900)", raw)
    a = a.assign(level_num=pd.to_numeric(a["level"]).astype(int))

    before = len(a)
    a = st.dedupe(a, ["matric_no", "session_std"])
    st.rule(rep, "Duplicate registrations removed", before - len(a))

    # ------------------------------------------------------------ students (dimension from admissions)
    latest = a.sort_values(["matric_no", "session_std"]).drop_duplicates("matric_no", keep="last")
    students = pd.DataFrame({
        "matric_no": latest["matric_no"].values,
        "surname": latest["surname"].str.upper().values,
        "first_name": latest["first_name"].values,
        "middle_name": latest["middle_name"].replace("", None).values,
        "gender": latest["gender"].values,
        "date_of_birth": latest["dob"].values,
        "state_of_origin": latest["state_of_origin"].values,
        "entry_mode": latest["mode_of_entry"].values,
        "admission_session": latest["admission_std"].fillna(latest["session_std"]).values,
    }).sort_values("matric_no").reset_index(drop=True)
    students["full_name"] = (students["surname"] + ", " + students["first_name"]
                             + students["middle_name"].fillna("").map(lambda m: f" {m}" if m else ""))
    students.insert(0, "student_key", range(1, len(students) + 1))

    # ------------------------------------------------------------ bursary
    rawb = frames["bursary"]
    stb = SourceStats("bursary", SOURCE_FILES["bursary"][0], len(rawb))
    b = clean_frame(rawb, id_cols=("matric_number",))

    b["matric_no"] = std_matric(rawb["matric_number"])
    diff = b["matric_no"] != rawb["matric_number"]
    stb.cleaned(diff)
    stb.rule(rep, "Matric numbers standardised (case, separators, spaces)", diff.sum())

    b["session_std"] = by_unique(rawb["academic_session"], std_session)
    diff = b["session_std"].notna() & (b["session_std"] != rawb["academic_session"])
    stb.cleaned(diff)
    stb.rule(rep, "Session labels standardised to YYYY/YYYY", diff.sum())

    b["due"] = parse_naira(b["amount_due"])
    b["paid"] = parse_naira(b["amount_paid"].replace("", "0"))
    diff = b["amount_due"].str.contains("₦|,|NGN", regex=True) | b["amount_paid"].str.contains("₦|,|NGN", regex=True)
    stb.cleaned(diff)
    stb.rule(rep, "Naira amounts parsed (removed ₦ sign and commas)", diff.sum())

    b["pay_date"] = std_date(b["payment_date"])
    diff = b["pay_date"].notna() & ~b["payment_date"].str.match(ISO_DATE)
    stb.cleaned(diff)
    stb.rule(rep, "Payment dates converted from dd/mm/yyyy to ISO dates", diff.sum())

    b = stb.reject(b, b["session_std"].isna(), "Unrecognised session label", rawb)
    b = stb.reject(b, b["due"].isna() | (b["due"] <= 0), "Amount billed missing, negative or not a number", rawb)
    b = stb.reject(b, b["paid"] < 0, "Negative amount paid", rawb)
    before = len(b)
    b = stb.dedupe(b, ["invoice_no"])
    stb.rule(rep, "Duplicate invoices removed", before - len(b))
    b = stb.reject(b, ~b["matric_no"].isin(students["matric_no"]), "Unknown student (matric not in admissions)", rawb)

    # ------------------------------------------------------------ exams
    rawe = frames["exams"]
    ste = SourceStats("exams", SOURCE_FILES["exams"][0], len(rawe))
    e = clean_frame(rawe, id_cols=("matric_no",))

    e["matric_no"] = std_matric(rawe["matric_no"])
    diff = e["matric_no"] != rawe["matric_no"]
    ste.cleaned(diff)
    ste.rule(rep, "Matric numbers standardised (case, separators, spaces)", diff.sum())

    e["course_code"] = by_unique(rawe["course_code"], std_course_code)
    diff = e["course_code"] != rawe["course_code"]
    ste.cleaned(diff)
    ste.rule(rep, "Course codes standardised (e.g. csc301 to CSC 301)", diff.sum())

    sem_map = {"1st": "First", "2nd": "Second", "first": "First", "second": "Second"}
    e["semester_std"] = e["semester"].map(lambda v: sem_map.get(str(v).strip().lower(), str(v).strip().title()))
    diff = e["semester_std"] != rawe["semester"]
    ste.cleaned(diff)
    ste.rule(rep, "Semester labels standardised (1st to First)", diff.sum())

    e["session_std"] = by_unique(rawe["session"], std_session)
    e["ca"] = pd.to_numeric(e["ca_score"], errors="coerce")
    e["exam"] = pd.to_numeric(e["exam_score"], errors="coerce")
    e["units"] = pd.to_numeric(e["credit_unit"], errors="coerce")

    e = ste.reject(e, e["session_std"].isna(), "Unrecognised session label", rawe)
    e = ste.reject(e, e["ca"].isna() | e["exam"].isna(), "Missing CA or exam score", rawe)
    e = ste.reject(e, (e["ca"] < 0) | (e["ca"] > 30), "CA score outside 0 to 30", rawe)
    e = ste.reject(e, (e["exam"] < 0) | (e["exam"] > 70), "Exam score outside 0 to 70", rawe)
    e = ste.reject(e, ~e["course_code"].str.match(r"^[A-Z]{3} \d{3}$"), "Malformed course code", rawe)
    before = len(e)
    e = ste.dedupe(e, ["matric_no", "course_code", "session_std"])
    ste.rule(rep, "Duplicate results removed", before - len(e))
    e = ste.reject(e, ~e["matric_no"].isin(students["matric_no"]), "Unknown student (matric not in admissions)", rawe)

    # ------------------------------------------------------------ courses (dimension from the exam results)
    kinds = {"G": "General Studies", "F": "Faculty", "D": "Departmental"}
    grouped = e.groupby("course_code")
    courses = pd.DataFrame({
        "course_code": list(grouped.groups.keys()),
        "course_title": grouped["course_title"].agg(lambda s: s.mode().iat[0]).values,
        "credit_units": grouped["units"].agg(lambda s: s.mode().iat[0]).astype(int).values,
        "semester": grouped["semester_std"].agg(lambda s: s.mode().iat[0]).values,
        "course_category": grouped["course_type"].agg(lambda s: kinds.get(s.mode().iat[0], "Departmental")).values,
    })
    courses["course_level"] = courses["course_code"].str[4].astype(int) * 100
    courses = courses.sort_values("course_code").reset_index(drop=True)
    courses.insert(0, "course_key", range(1, len(courses) + 1))
    ste.rule(rep, "Course catalogue derived from results (course level read from the code)", len(courses))

    # ------------------------------------------------------------ conformed dimensions
    faculties = (deps[["faculty_code", "faculty_name"]].drop_duplicates().sort_values("faculty_code").reset_index(drop=True))
    faculties.insert(0, "faculty_key", range(1, len(faculties) + 1))
    fac_key = dict(zip(faculties["faculty_code"], faculties["faculty_key"]))

    dim_dep = deps.sort_values("department_code").reset_index(drop=True)
    dim_dep = pd.DataFrame({
        "department_key": range(1, len(dim_dep) + 1),
        "department_code": dim_dep["department_code"],
        "department_name": dim_dep["department_name"],
        "faculty_code": dim_dep["faculty_code"],
        "faculty_name": dim_dep["faculty_name"],
        "degree_awarded": dim_dep["degree_awarded"],
        "programme_years": dim_dep["programme_years"],
    })
    dep_key = dict(zip(dim_dep["department_code"], dim_dep["department_key"]))

    names = sorted(a["session_std"].unique())
    sessions = pd.DataFrame({
        "session_key": range(1, len(names) + 1),
        "session_name": names,
        "start_year": [int(n[:4]) for n in names],
        "end_year": [int(n[5:]) for n in names],
        "is_current": [1 if n == names[-1] else 0 for n in names],
    })
    ses_key = dict(zip(sessions["session_name"], sessions["session_key"]))
    stu_key = dict(zip(students["matric_no"], students["student_key"]))
    crs = courses.set_index("course_code")

    # ------------------------------------------------------------ fact_enrolment
    enrol = a.sort_values(["session_std", "matric_no"])
    fact_enrolment = pd.DataFrame({
        "student_key": enrol["matric_no"].map(stu_key).astype(int).values,
        "session_key": enrol["session_std"].map(ses_key).astype(int).values,
        "department_key": enrol["department_code"].map(dep_key).astype(int).values,
        "faculty_key": enrol["faculty_code"].map(fac_key).astype(int).values,
        "level": enrol["level_num"].values,
        "is_new_entrant": (enrol["admission_std"] == enrol["session_std"]).astype(int).values,
        "enrolment_count": 1,
    })
    fact_enrolment.insert(0, "enrolment_key", range(1, len(fact_enrolment) + 1))
    st.loaded = len(fact_enrolment)

    reg = a[["matric_no", "session_std", "department_code", "faculty_code"]].copy()

    # ------------------------------------------------------------ fact_fee_payment
    b = attach_registration(b, reg)
    b = stb.reject(b, b["department_code"].isna(), "No registration for this session", rawb)
    b = b.sort_values("invoice_no")
    paid, due = b["paid"].fillna(0).round(2), b["due"].round(2)
    status = pd.Series("Part-paid", index=b.index)
    status = status.mask(paid >= due, "Paid").mask(paid <= 0, "Unpaid")
    fees = pd.DataFrame({
        "student_key": b["matric_no"].map(stu_key).astype(int).values,
        "session_key": b["session_std"].map(ses_key).astype(int).values,
        "department_key": b["department_code"].map(dep_key).astype(int).values,
        "faculty_key": b["faculty_code"].map(fac_key).astype(int).values,
        "invoice_no": b["invoice_no"].values,
        "fee_item": b["fee_item"].values,
        "amount_billed": due.values,
        "amount_paid": paid.values,
        "amount_outstanding": (due - paid).round(2).values,
        "payment_status": status.values,
        "payment_channel": b["payment_channel"].replace("", None).values,
        "payment_date": b["pay_date"].values,
    })
    fees.insert(0, "payment_key", range(1, len(fees) + 1))
    stb.rule(rep, "Outstanding balance and payment status derived", len(fees))
    stb.loaded = len(fees)

    # ------------------------------------------------------------ fact_result
    e = attach_registration(e, reg)
    e = ste.reject(e, e["department_code"].isna(), "No registration for this session", rawe)
    e = e.sort_values(["session_std", "matric_no", "course_code"])
    total = (e["ca"] + e["exam"]).astype(int)
    grade, point = grade_from_score(total)
    units = e["course_code"].map(crs["credit_units"]).astype(int)
    results = pd.DataFrame({
        "student_key": e["matric_no"].map(stu_key).astype(int).values,
        "course_key": e["course_code"].map(crs["course_key"]).astype(int).values,
        "session_key": e["session_std"].map(ses_key).astype(int).values,
        "department_key": e["department_code"].map(dep_key).astype(int).values,
        "faculty_key": e["faculty_code"].map(fac_key).astype(int).values,
        "ca_score": e["ca"].astype(int).values,
        "exam_score": e["exam"].astype(int).values,
        "total_score": total.values,
        "grade": grade.values,
        "grade_point": point.astype(int).values,
        "credit_units": units.values,
        "quality_points": (point.astype(int) * units).values,
        "is_pass": (total >= PASS_MARK).astype(int).values,
    })
    results.insert(0, "result_key", range(1, len(results) + 1))
    ste.rule(rep, "Total score, grade, grade point and quality points derived (5-point scale)", len(results))
    ste.loaded = len(results)

    tables = {
        "dim_faculty": faculties[["faculty_key", "faculty_code", "faculty_name"]],
        "dim_department": dim_dep,
        "dim_session": sessions,
        "dim_student": students[["student_key", "matric_no", "surname", "first_name", "middle_name", "full_name", "gender",
                                 "date_of_birth", "state_of_origin", "entry_mode", "admission_session"]],
        "dim_course": courses[["course_key", "course_code", "course_title", "credit_units", "course_level", "semester",
                               "course_category"]],
        "fact_enrolment": fact_enrolment,
        "fact_fee_payment": fees,
        "fact_result": results,
    }
    stats = {"admissions": st, "bursary": stb, "exams": ste}
    for s in stats.values():
        rep.emit({"type": "source", **s.as_dict()},
                 f"  {s.name:<10} extracted {s.extracted:,}, duplicates {s.duplicates:,}, rejected {s.rejected:,}, loaded {s.loaded:,}")
    return tables, stats


# ---------------------------------------------------------------------------
# LOAD
# ---------------------------------------------------------------------------
def rows_for_insert(df: pd.DataFrame) -> list[list]:
    out = df.astype(object).where(pd.notna(df), None)
    return [[(v.date().isoformat() if isinstance(v, pd.Timestamp) else v) for v in row] for row in out.values.tolist()]


def write_tsv(df: pd.DataFrame, path: Path) -> None:
    def cell(v):
        if v is None or (not isinstance(v, str) and pd.isna(v)):
            return "\\N"
        if isinstance(v, pd.Timestamp):
            return v.date().isoformat()
        return str(v).replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n")

    with path.open("w", encoding="utf-8", newline="\n") as f:
        for row in df.astype(object).values.tolist():
            f.write("\t".join(cell(v) for v in row) + "\n")


def bulk_load_supported(cur) -> bool:
    try:
        cur.execute("SHOW VARIABLES LIKE 'local_infile'")
        row = cur.fetchone()
        return bool(row) and str(row[1]).upper() in ("ON", "1")
    except pymysql.MySQLError:
        return False


# (table, constraint, column, parent table, parent column)
FOREIGN_KEYS = [
    ("fact_enrolment", "fk_enrol_student", "student_key", "dim_student", "student_key"),
    ("fact_enrolment", "fk_enrol_session", "session_key", "dim_session", "session_key"),
    ("fact_enrolment", "fk_enrol_department", "department_key", "dim_department", "department_key"),
    ("fact_enrolment", "fk_enrol_faculty", "faculty_key", "dim_faculty", "faculty_key"),
    ("fact_fee_payment", "fk_fee_student", "student_key", "dim_student", "student_key"),
    ("fact_fee_payment", "fk_fee_session", "session_key", "dim_session", "session_key"),
    ("fact_fee_payment", "fk_fee_department", "department_key", "dim_department", "department_key"),
    ("fact_fee_payment", "fk_fee_faculty", "faculty_key", "dim_faculty", "faculty_key"),
    ("fact_result", "fk_result_student", "student_key", "dim_student", "student_key"),
    ("fact_result", "fk_result_course", "course_key", "dim_course", "course_key"),
    ("fact_result", "fk_result_session", "session_key", "dim_session", "session_key"),
    ("fact_result", "fk_result_department", "department_key", "dim_department", "department_key"),
    ("fact_result", "fk_result_faculty", "faculty_key", "dim_faculty", "faculty_key"),
]


def ensure_foreign_keys(cur, database: str) -> int:
    """Create any of the 13 foreign keys that are missing (CREATE TABLE ... LIKE does not copy them)."""
    cur.execute("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS "
                "WHERE TABLE_SCHEMA = %s AND CONSTRAINT_TYPE = 'FOREIGN KEY'", (database,))
    existing = {r[0] for r in cur.fetchall()}
    added = 0
    cur.execute("SET foreign_key_checks = 0")
    try:
        for table, name, col, parent, pcol in FOREIGN_KEYS:
            if name in existing:
                continue
            cur.execute(f"ALTER TABLE `{table}` ADD CONSTRAINT `{name}` FOREIGN KEY (`{col}`) REFERENCES `{parent}` (`{pcol}`)")
            added += 1
    finally:
        cur.execute("SET foreign_key_checks = 1")
    return added


def drop_shadow_tables(cur) -> None:
    cur.execute("SET foreign_key_checks = 0")
    try:
        for name in STAR_TABLES_LOAD_ORDER:
            cur.execute(f"DROP TABLE IF EXISTS `{name}_next`")
            cur.execute(f"DROP TABLE IF EXISTS `{name}_old`")
    finally:
        cur.execute("SET foreign_key_checks = 1")


def load(rep: Reporter, cfg: dict, tables: dict[str, pd.DataFrame]) -> dict[str, int]:
    """Load shadow tables, check them, then swap them in with one atomic RENAME TABLE.

    The dashboard keeps reading the old tables until the instant of the swap, so it never
    sees a half-loaded warehouse. If the run fails (or the power goes) before the swap,
    the live tables are untouched and the next run clears the leftovers.
    """
    rep.emit({"type": "phase", "phase": "load"}, "LOAD (shadow tables, then one atomic swap)")
    counts: dict[str, int] = {}
    conn = pymysql.connect(host=cfg["host"], port=cfg["port"], user=cfg["user"], password=cfg["password"],
                           database=cfg["database"], charset="utf8mb4", autocommit=True,
                           connect_timeout=5, local_infile=True)
    tmp_dir = Path(tempfile.mkdtemp(prefix="ebsu_etl_"))
    try:
        with conn.cursor() as cur:
            drop_shadow_tables(cur)
            fast = bulk_load_supported(cur)
            rep.emit({"type": "log", "phase": "load",
                      "message": "Bulk loader: LOAD DATA LOCAL INFILE" if fast else "Bulk loader: batched INSERT"},
                     "  Bulk loader: " + ("LOAD DATA LOCAL INFILE" if fast else "batched INSERT"))
            for name in STAR_TABLES_LOAD_ORDER:
                df = tables[name]
                shadow = f"{name}_next"
                cur.execute(f"CREATE TABLE `{shadow}` LIKE `{name}`")
                cols = ", ".join(f"`{c}`" for c in df.columns)
                loaded = False
                if fast:
                    path = tmp_dir / f"{name}.tsv"
                    write_tsv(df, path)
                    try:
                        cur.execute(
                            f"LOAD DATA LOCAL INFILE %s INTO TABLE `{shadow}` CHARACTER SET utf8mb4 "
                            f"FIELDS TERMINATED BY '\\t' LINES TERMINATED BY '\\n' ({cols})",
                            (path.as_posix(),))
                        loaded = True
                    except pymysql.err.OperationalError:
                        fast = False  # the server refused local files; use INSERT from here on
                if not loaded:
                    sql = f"INSERT INTO `{shadow}` ({cols}) VALUES ({', '.join(['%s'] * len(df.columns))})"
                    rows = rows_for_insert(df)
                    for i in range(0, len(rows), 5000):
                        cur.executemany(sql, rows[i:i + 5000])
                cur.execute(f"SELECT COUNT(*) FROM `{shadow}`")
                n = int(cur.fetchone()[0])
                if n != len(df):
                    raise RuntimeError(f"{name}: expected {len(df):,} rows, loaded {n:,}")
                counts[name] = n
                rep.emit({"type": "table", "table": name, "rows": n}, f"  {name:<18} {n:>9,} rows")

            # Referential integrity: every fact row must point at an existing dimension row.
            orphans = 0
            for table, _name, col, parent, pcol in FOREIGN_KEYS:
                cur.execute(f"SELECT COUNT(*) FROM `{table}_next` f LEFT JOIN `{parent}_next` d "
                            f"ON f.`{col}` = d.`{pcol}` WHERE d.`{pcol}` IS NULL")
                orphans += int(cur.fetchone()[0])
            if orphans:
                raise RuntimeError(f"Referential integrity check failed: {orphans} fact rows have no dimension row")
            rep.emit({"type": "log", "phase": "load",
                      "message": f"Referential integrity checked: {len(FOREIGN_KEYS)} foreign keys, 0 orphan rows"},
                     f"  Referential integrity checked: {len(FOREIGN_KEYS)} foreign keys, 0 orphan rows")

            # The swap: one statement, all eight tables, atomic.
            pairs = []
            for name in STAR_TABLES_LOAD_ORDER:
                pairs.append(f"`{name}` TO `{name}_old`")
                pairs.append(f"`{name}_next` TO `{name}`")
            cur.execute("RENAME TABLE " + ", ".join(pairs))
            rep.emit({"type": "log", "phase": "load", "message": "Swapped the new tables in (one atomic RENAME TABLE)"},
                     "  Swapped the new tables in (one atomic RENAME TABLE)")
            drop_shadow_tables(cur)
            ensure_foreign_keys(cur, cfg["database"])
    finally:
        conn.close()
        shutil.rmtree(tmp_dir, ignore_errors=True)
    return counts


def record_run_start(cfg: dict, triggered_by: str) -> int:
    with connect(cfg) as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO etl_run (started_at, status, triggered_by) VALUES (NOW(), 'running', %s)",
                    (triggered_by[:60],))
        return cur.lastrowid


def record_run_end(cfg: dict, run_id: int, status: str, duration_ms: int, message: str,
                   stats: dict | None, counts: dict | None) -> None:
    with connect(cfg) as conn, conn.cursor() as cur:
        cur.execute("UPDATE etl_run SET finished_at = NOW(), status = %s, duration_ms = %s, message = %s WHERE run_id = %s",
                    (status, duration_ms, message[:2000], run_id))
        if stats:
            seq = 0
            for s in stats.values():
                cur.execute("INSERT INTO etl_run_source (run_id, source_name, file_name, rows_extracted, rows_duplicate, "
                            "rows_rejected, rows_loaded, rows_cleaned) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                            (run_id, s.name, s.file_name, s.extracted, s.duplicates, s.rejected, s.loaded, len(s.cleaned_rows)))
                for text, rows in s.rules:
                    seq += 1
                    cur.execute("INSERT INTO etl_run_rule (run_id, seq, source_name, rule_text, rows_affected) "
                                "VALUES (%s, %s, %s, %s, %s)", (run_id, seq, s.name, text[:160], rows))
                if s.rejects:
                    cur.executemany("INSERT INTO etl_reject (run_id, source_name, source_row, reason, raw_record) "
                                    "VALUES (%s, %s, %s, %s, %s)",
                                    [(run_id, s.name, r["source_row"], r["reason"][:120], r["raw"]) for r in s.rejects])
        if counts:
            cur.executemany("INSERT INTO etl_run_table (run_id, table_name, rows_loaded) VALUES (%s, %s, %s)",
                            [(run_id, k, v) for k, v in counts.items()])
        # Keep the rejected rows of the last 10 runs only.
        cur.execute("DELETE FROM etl_reject WHERE run_id NOT IN "
                    "(SELECT run_id FROM (SELECT run_id FROM etl_run ORDER BY run_id DESC LIMIT 10) AS recent)")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Run the EBSU data warehouse ETL (simulated data).")
    ap.add_argument("--json", action="store_true", help="Emit one JSON event per line")
    ap.add_argument("--triggered-by", default="command line")
    ap.add_argument("--schema-only", action="store_true", help="Create the database and tables, then stop")
    args = ap.parse_args(argv)

    rep = Reporter(args.json)
    cfg = db_config()
    run_id = None
    lock_conn = None
    stats = None
    counts = None
    try:
        ensure_schema(cfg)
        if args.schema_only:
            rep.emit({"type": "done", "status": "success", "message": "Schema ready"}, "Schema ready")
            return 0
        lock_conn = connect(cfg)
        with lock_conn.cursor() as cur:
            cur.execute("SELECT GET_LOCK('ebsu_dw_etl', 0)")
            if cur.fetchone()[0] != 1:
                rep.emit({"type": "error", "message": "Another ETL run is already in progress."},
                         "Another ETL run is already in progress.")
                return 2
        run_id = record_run_start(cfg, args.triggered_by)
        rep.emit({"type": "run", "run_id": run_id, "database": cfg["database"], "host": cfg["host"]},
                 f"ETL run #{run_id} on {cfg['host']}:{cfg['port']}/{cfg['database']}")
        frames, departments = extract(rep)
        tables, stats = transform(rep, frames, departments)
        counts = load(rep, cfg, tables)
        duration = rep.ms()
        record_run_end(cfg, run_id, "success", duration, "OK", stats, counts)
        rejects = []
        for s in stats.values():
            by_reason: dict[str, int] = {}
            for r in s.rejects:
                by_reason[r["reason"]] = by_reason.get(r["reason"], 0) + 1
            rejects += [{"source": s.name, "reason": k, "rows": v} for k, v in sorted(by_reason.items())]
        summary = {
            "type": "summary", "run_id": run_id, "status": "success", "duration_ms": duration,
            "sources": [s.as_dict() for s in stats.values()],
            "tables": [{"table": k, "rows": v} for k, v in counts.items()],
            "rejects": rejects,
        }
        text = [f"DONE in {duration / 1000:.1f}s"]
        for s in stats.values():
            text.append(f"  {s.name:<10} extracted {s.extracted:>8,}  duplicates {s.duplicates:>5,}  "
                        f"rejected {s.rejected:>4,}  loaded {s.loaded:>8,}")
        rep.emit(summary, "\n".join(text))
        return 0
    except pymysql.err.OperationalError as exc:
        msg = (f"Cannot reach MySQL at {cfg['host']}:{cfg['port']} as '{cfg['user']}'. "
               f"Start MySQL in the XAMPP Control Panel and try again. ({exc.args[-1] if exc.args else exc})")
        rep.emit({"type": "error", "message": msg}, msg)
        if run_id:
            try:
                record_run_end(cfg, run_id, "failed", rep.ms(), msg, None, None)
            except Exception:
                pass
        return 1
    except Exception as exc:  # report every other failure to the dashboard
        msg = f"{type(exc).__name__}: {exc}"
        rep.emit({"type": "error", "message": msg}, msg)
        if run_id:
            try:
                record_run_end(cfg, run_id, "failed", rep.ms(), msg, stats, None)
            except Exception:
                pass
        return 1
    finally:
        if lock_conn is not None:
            try:
                with lock_conn.cursor() as cur:
                    cur.execute("SELECT RELEASE_LOCK('ebsu_dw_etl')")
                lock_conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
