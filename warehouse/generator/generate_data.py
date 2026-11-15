"""
Synthetic data generator for the EBSU data warehouse project.

    python warehouse/generator/generate_data.py            # writes the CSV files
    python warehouse/generator/generate_data.py --scale 0.5

ALL OUTPUT IS SIMULATED. Faculty and department names are real EBSU units (see
ebsu_reference.py for sources); every student, score and payment is invented by this
script. No real student or staff record is used. Matric numbers carry "SIM" so they can
never be mistaken for real ones.

It writes three CSV exports that stand in for three separate operational systems, each
with its own conventions and a few deliberate data quality problems for the ETL:

  warehouse/data/sources/admissions.csv   Admissions & Records: student biodata,
                                          one row per student per session registration
  warehouse/data/sources/bursary.csv      Bursary: one row per fee invoice line
  warehouse/data/sources/exams.csv        Examinations: one row per course result

and the official list of faculties and departments that the ETL conforms everything to:

  warehouse/data/reference/departments.csv

Only the Python standard library is used and the random seed is fixed, so the same
Python version always produces the same files.
"""

from __future__ import annotations

import argparse
import csv
import math
import random
import sys
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import ebsu_reference as ref  # noqa: E402
import names  # noqa: E402

SEED = 20250930
DATA_DIR = HERE.parent / "data"

SESSIONS = [2021, 2022, 2023, 2024]  # start years: 2021 means session 2021/2022
FIRST_COHORT = 2015  # earliest admission year, so 2021/2022 has students at every level
LAST_SESSION = SESSIONS[-1]
FIRST_SERIAL = 80_001  # matric serials run on across years, as EBSU's do

# Mild, simulated session effects. No real event is implied.
SESSION_SCORE_EFFECT = {2021: 0.0, 2022: -1.2, 2023: 0.6, 2024: 1.1}
INTAKE_GROWTH = {
    2015: 0.80, 2016: 0.83, 2017: 0.86, 2018: 0.90, 2019: 0.93,
    2020: 0.95, 2021: 1.00, 2022: 1.04, 2023: 0.98, 2024: 1.09,
}
FEMALE_DRIFT_PER_YEAR = 0.006

HARD_WORDS = (
    "Mathematics", "Calculus", "Algebra", "Statistic", "Thermodynamic", "Mechanics", "Physics",
    "Chemistry", "Pharmacology", "Anatomy", "Physiology", "Accounting", "Quantum", "Analysis",
    "Numerical", "Algorithm", "Econometric", "Taxation", "Pathology", "Biochemistry", "Structural",
    "Circuit", "Electromagnet", "Cost", "Audit", "Compiler", "Discrete", "Reaction", "Fluid",
)


def session_name(start_year: int) -> str:
    return f"{start_year}/{start_year + 1}"


@dataclass
class Course:
    code: str
    title: str
    units: int
    level: int
    semester: int
    kind: str  # G general studies, F faculty, D departmental
    difficulty: float = 0.0


@dataclass
class Student:
    matric: str
    surname: str
    first_name: str
    middle_name: str
    gender: str
    dob: date
    state: str
    entry_mode: str
    admission_year: int
    dept: ref.Department
    ability: float
    pay_propensity: float
    registrations: list[tuple[int, int, bool, bool]] = field(default_factory=list)  # (year, level, new, spill-over)

    @property
    def indigene(self) -> bool:
        return self.state == "Ebonyi"


class Catalogue:
    """Every course offered, keyed by code. As at EBSU, the first digit of the number is the
    level, and an odd last digit means a first-semester course, an even one second semester."""

    def __init__(self, rng: random.Random):
        self.rng = rng
        self.courses: dict[str, Course] = {}

    def difficulty(self, title: str, kind: str) -> float:
        d = self.rng.gauss(0, 1.6)
        if any(w in title for w in HARD_WORDS):
            d += 6.0
        if kind == "G":
            d -= 3.5
        elif kind == "F":
            d += 1.0
        return d

    def add(self, code: str, title: str, units: int, kind: str) -> Course:
        if code not in self.courses:
            number = int(code.split()[1])
            self.courses[code] = Course(code, title, units, (number // 100) * 100, 1 if number % 2 else 2, kind,
                                        self.difficulty(title, kind))
        return self.courses[code]

    def new(self, prefix: str, level: int, semester: int, title: str, units: int) -> str:
        n = level + (1 if semester == 1 else 2)
        while f"{prefix} {n}" in self.courses:
            n += 2
        return self.add(f"{prefix} {n}", title, units, "D").code


ROMAN = ["I", "II", "III", "IV", "V", "VI"]


def build_curricula(cat: Catalogue) -> dict[str, dict[int, list[str]]]:
    """For each programme and level, the course codes a student registers for in one session."""
    gst = {lvl: [cat.add(c, t, u, "G").code for c, t, u, l in ref.GST_COURSES if l == lvl] for lvl in (100, 200, 300)}
    curricula: dict[str, dict[int, list[str]]] = {}
    for d in ref.DEPARTMENTS:
        title_rng = random.Random(f"{SEED}-{d.code}")  # titles do not depend on generation order
        used: dict[str, int] = {}
        pointer = 0

        def topic() -> str:
            nonlocal pointer
            t = d.topics[pointer % len(d.topics)]
            pointer += 1
            return t

        plan: dict[int, list[str]] = {}
        final = d.years * 100
        for level in range(100, final + 100, 100):
            fixed = [cat.add(c, t, u, "D") for c, t, u in d.fixed_courses.get(level, [])]
            siwes = d.siwes and level == 300
            if siwes and not any("SIWES" in c.title for c in fixed):
                fixed.append(cat.add(f"{d.prefix} 398", "Industrial Training (SIWES)", 6, "D"))
            if level == final and not any(c.title == d.project_title for c in fixed):
                fixed.append(cat.add(f"{d.prefix} {level + 98}", d.project_title, 6, "D"))
            codes = [c for c in gst.get(level, []) if not (siwes and cat.courses[c].semester == 2)]
            if level == 100:
                codes += [cat.add(c, t, u, "F").code for c, t, u in ref.FACULTY_COMMON.get(d.faculty_code, [])]
            codes += [c.code for c in fixed]
            per_semester = 2 if level == 100 else (3 if level == final else 5)
            n1 = sum(1 for c in fixed if c.semester == 1)
            n2 = sum(1 for c in fixed if c.semester == 2 and "SIWES" not in c.title)
            for _ in range(max(1, per_semester - max(n1, n2))):
                name = topic()
                k = used.get(name, 0)
                used[name] = k + 1
                units = title_rng.choice([2, 3, 3, 3, 3]) if d.code != "MBS" else title_rng.choice([3, 4, 4])
                codes.append(cat.new(d.prefix, level, 1, f"{name} {ROMAN[2 * k]}", units))
                if not siwes:
                    codes.append(cat.new(d.prefix, level, 2, f"{name} {ROMAN[2 * k + 1]}", units))
            plan[level] = codes
        curricula[d.code] = plan
    return curricula


STATE_NAMES = [s[0] for s in names.STATES]
STATE_WEIGHTS = [s[1] for s in names.STATES]
STATE_POOL = {s[0]: s[2] for s in names.STATES}


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def make_name(rng: random.Random, pool_key: str, gender: str) -> tuple[str, str, str]:
    pool = names.POOLS[pool_key]
    english = names.ENGLISH_MALE if gender == "Male" else names.ENGLISH_FEMALE
    native = pool["male"] if gender == "Male" else pool["female"]

    def first() -> str:
        return rng.choice(english) if rng.random() < names.ENGLISH_SHARE[pool_key] else rng.choice(native)

    surname = rng.choice(pool["surnames"])
    given = first()
    middle = first() if rng.random() < 0.8 else ""
    while middle and middle == given:
        middle = first()
    return surname, given, middle


# ---------------------------------------------------------------------------
# Students and their careers
# ---------------------------------------------------------------------------
def simulate_students(rng: random.Random, scale: float) -> list[Student]:
    students: list[Student] = []
    serial = FIRST_SERIAL
    for year in range(FIRST_COHORT, LAST_SESSION + 1):
        for d in ref.DEPARTMENTS:
            if year < d.first_intake:
                continue
            growth = INTAKE_GROWTH[year] if d.first_intake < 2021 else 1.0 + 0.08 * (year - d.first_intake)
            n = max(2, int(round(d.intake * scale * growth * rng.uniform(0.9, 1.1))))
            female_share = clamp(d.female_share + (year - 2019) * FEMALE_DRIFT_PER_YEAR, 0.05, 0.95)
            for _ in range(n):
                gender = "Female" if rng.random() < female_share else "Male"
                state = rng.choices(STATE_NAMES, weights=STATE_WEIGHTS, k=1)[0]
                surname, first, middle = make_name(rng, STATE_POOL[state], gender)
                entry = "Direct Entry" if (d.direct_entry and rng.random() < 0.09) else "UTME"
                age = rng.gauss(18.6, 1.2) if entry == "UTME" else rng.gauss(21.5, 1.8)
                dob = date(year, 9, 1) - timedelta(days=int(clamp(age, 15.5, 29) * 365.25) + rng.randint(-150, 150))
                students.append(Student(
                    matric=f"EBSU/SIM/{year}/{serial:07d}", surname=surname, first_name=first,
                    middle_name=middle, gender=gender, dob=dob, state=state, entry_mode=entry,
                    admission_year=year, dept=d, ability=rng.gauss(0, 1), pay_propensity=rng.gauss(0, 1),
                ))
                serial += 1
    return students


def simulate_progression(rng: random.Random, students: list[Student]) -> None:
    """Promote, spill over, withdraw or graduate each student, session by session."""
    for s in students:
        level = 200 if s.entry_mode == "Direct Entry" else 100
        final = s.dept.years * 100
        year, spill = s.admission_year, 0
        while year <= LAST_SESSION:
            s.registrations.append((year, level, year == s.admission_year, spill > 0))
            if level >= final:
                if spill < 2 and rng.random() < 0.05 + (0.22 if s.ability < -1.2 else 0.0):
                    spill += 1
                else:
                    break  # graduated
            else:
                if rng.random() < 0.018 + (0.09 if s.ability < -1.6 else 0.0):
                    break  # withdrew
                level += 100
            year += 1


# ---------------------------------------------------------------------------
# Source-system rows
# ---------------------------------------------------------------------------
def make_admissions(students: list[Student]) -> list[dict]:
    rows, seq = [], 0
    for s in students:
        for (year, level, _new, _spill) in s.registrations:
            if year not in SESSIONS:
                continue
            seq += 1
            rows.append({
                "reg_id": f"REG{year}{seq:06d}",
                "matric_no": s.matric,
                "surname": s.surname.upper(),
                "first_name": s.first_name,
                "middle_name": s.middle_name,
                "sex": "M" if s.gender == "Male" else "F",
                "date_of_birth": s.dob.isoformat(),
                "state_of_origin": s.state,
                "mode_of_entry": s.entry_mode,
                "year_of_admission": session_name(s.admission_year),
                "faculty": s.dept.faculty_name,
                "department": s.dept.name,
                "programme": f"{s.dept.degree} {s.dept.name}",
                "session": session_name(year),
                "level": level,
            })
    return rows


def payment_date(rng: random.Random, year: int) -> date:
    # A session runs roughly November to October. Payments peak at first-semester
    # registration (December, January) and second-semester registration (April, May).
    months = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    weights = [8, 18, 16, 9, 7, 12, 10, 6, 5, 4, 3, 2]
    m = rng.choices(months, weights=weights, k=1)[0]
    return date(year if m >= 11 else year + 1, m, rng.randint(1, 28))


def make_bursary(rng: random.Random, students: list[Student]) -> list[dict]:
    rows = []
    seq: dict[int, int] = {}
    faculty_effect = {code: rng.gauss(0, 0.18) for code in ref.FACULTY_NAMES}
    for s in students:
        for (year, level, is_new, _spill) in s.registrations:
            if year not in SESSIONS:
                continue
            items = [("School Fees", ref.school_fees(s.dept.fee_band, year, s.indigene)),
                     ("Registration Fee", ref.registration_fee(s.indigene))]
            if is_new:
                acc = ref.ACCEPTANCE_PROFESSIONAL if s.dept.code in ref.PROFESSIONAL_CODES else ref.ACCEPTANCE_OTHERS
                items.insert(0, ("Acceptance Fee", acc))
            final_year = level >= s.dept.years * 100
            for item, amount in items:
                seq[year] = seq.get(year, 0) + 1
                invoice = f"INV/{str(year)[2:]}{str(year + 1)[2:]}/{seq[year]:06d}"
                if item == "Acceptance Fee":
                    p_full, p_part = 0.995, 0.0
                else:
                    logit = (ref.PAYMENT_BASE_LOGIT[year] + 0.75 * s.pay_propensity
                             + (0.55 if final_year else 0.0) + faculty_effect[s.dept.faculty_code]
                             + (0.2 if s.indigene else 0.0) + (0.6 if item == "Registration Fee" else 0.0))
                    p_full = 1 / (1 + math.exp(-logit))
                    p_part = (1 - p_full) * (0.72 if year >= ref.INSTALMENTS_FROM else 0.55)
                r = rng.random()
                if r < p_full:
                    paid = amount
                elif r < p_full + p_part:
                    if year >= ref.INSTALMENTS_FROM and item == "School Fees" and rng.random() < 0.7:
                        paid = round(amount / 2 / 50) * 50  # first of two instalments
                    else:
                        paid = round(amount * rng.uniform(0.3, 0.8) / 500) * 500
                else:
                    paid = 0
                when = payment_date(rng, year) if paid > 0 else None
                rows.append({
                    "invoice_no": invoice,
                    "rrr": str(rng.randint(10**11, 10**12 - 1)),
                    "matric_number": s.matric,
                    "academic_session": session_name(year),
                    "fee_item": item,
                    "amount_due": f"{amount:.2f}",
                    "amount_paid": f"{paid:.2f}",
                    "payment_date": when.isoformat() if when else "",
                    "payment_channel": rng.choices(ref.PAYMENT_CHANNELS, weights=ref.PAYMENT_CHANNEL_WEIGHTS, k=1)[0]
                    if paid > 0 else "",
                })
    return rows


def make_results(rng: random.Random, students: list[Student], cat: Catalogue, curricula) -> list[dict]:
    rows = []
    dept_effect = {d.code: rng.gauss(0, 1.8) for d in ref.DEPARTMENTS}
    for s in students:
        for (year, level, _new, is_spill) in s.registrations:
            if year not in SESSIONS:
                continue
            plan = curricula[s.dept.code].get(level, [])
            if is_spill:  # spill-over students re-sit only a few final-year courses
                plan = rng.sample(plan, k=min(len(plan), rng.randint(2, 4)))
            for code in plan:
                c = cat.courses[code]
                mean = (55.5 + 9.0 * s.ability - c.difficulty + dept_effect[s.dept.code]
                        + SESSION_SCORE_EFFECT[year] + (level - 100) / 100 * 0.9)
                total = int(clamp(round(rng.gauss(mean, 10.5)), 4, 97))
                ca = min(30, int(round(total * rng.uniform(0.24, 0.36))))
                exam = total - ca
                if exam > 70:
                    ca = min(30, ca + exam - 70)
                    exam = total - ca
                rows.append({
                    "matric_no": s.matric,
                    "session": session_name(year),
                    "semester": "First" if c.semester == 1 else "Second",
                    "course_code": c.code,
                    "course_title": c.title,
                    "course_type": c.kind,
                    "credit_unit": c.units,
                    "ca_score": ca,
                    "exam_score": exam,
                })
    return rows


# ---------------------------------------------------------------------------
# Deliberate data quality problems, so the ETL has real work to do
# ---------------------------------------------------------------------------
def messy_matric(rng: random.Random, m: str) -> str:
    return rng.choice([m.lower(), m.replace("/", "-"), f" {m} ", m.replace("/", " / ")])


def messy_session(rng: random.Random, s: str) -> str:
    a, b = s.split("/")
    return rng.choice([f"{a}-{b}", f"{a}/{b[2:]}", f"{a} / {b}"])


def messy_date(rng: random.Random, iso: str) -> str:
    y, m, d = iso.split("-")
    return rng.choice([f"{d}/{m}/{y}", f"{d}-{m}-{y}"])


def naira(amount: str) -> str:
    return f"₦{float(amount):,.2f}"


def inject_admissions_issues(rng: random.Random, rows: list[dict]) -> list[dict]:
    for r in rows:
        x = rng.random()
        if x < 0.010:
            r["matric_no"] = messy_matric(rng, r["matric_no"])
        elif x < 0.018:
            r["sex"] = rng.choice(["Male", "male", "m"] if r["sex"] == "M" else ["Female", "female", "f"])
        elif x < 0.026:
            r["date_of_birth"] = messy_date(rng, r["date_of_birth"])
        elif x < 0.033:
            r["session"] = messy_session(rng, r["session"])
        elif x < 0.041:
            alias = ref.DEPARTMENT_ALIASES.get(r["department"])
            r["department"] = rng.choice(alias) if alias else r["department"].upper()
        elif x < 0.046:
            r["faculty"] = r["faculty"].upper()
    extra = [dict(r) for r in rng.sample(rows, k=int(len(rows) * 0.004))]  # re-exported duplicates
    for r in rng.sample(rows, k=9):
        b = dict(r); b["matric_no"] = ""; extra.append(b)
    for r in rng.sample(rows, k=6):
        b = dict(r); b["level"] = rng.choice([0, 700, 900]); extra.append(b)
    return rows + extra


def inject_bursary_issues(rng: random.Random, rows: list[dict]) -> list[dict]:
    for r in rows:
        x = rng.random()
        if x < 0.06:
            r["amount_due"] = naira(r["amount_due"])
            if float(r["amount_paid"]) > 0:
                r["amount_paid"] = naira(r["amount_paid"])
        elif x < 0.07:
            r["matric_number"] = messy_matric(rng, r["matric_number"])
        elif x < 0.08:
            r["academic_session"] = messy_session(rng, r["academic_session"])
        elif x < 0.09 and r["payment_date"]:
            r["payment_date"] = messy_date(rng, r["payment_date"])
    extra = [dict(r) for r in rng.sample(rows, k=int(len(rows) * 0.003))]
    for r in rng.sample(rows, k=14):  # payments for students the admissions system never admitted
        b = dict(r)
        b["matric_number"] = f"EBSU/SIM/{rng.randint(2016, 2024)}/{rng.randint(9_900_000, 9_999_999):07d}"
        b["invoice_no"] = b["invoice_no"].replace("INV/", "INX/")
        extra.append(b)
    for r in rng.sample(rows, k=5):  # unusable amounts
        b = dict(r)
        b["amount_due"] = rng.choice(["-" + b["amount_due"].lstrip("₦"), "N/A"])
        b["invoice_no"] = b["invoice_no"].replace("INV/", "INB/")
        extra.append(b)
    return rows + extra


def inject_exam_issues(rng: random.Random, rows: list[dict]) -> list[dict]:
    for r in rows:
        x = rng.random()
        if x < 0.008:
            r["course_code"] = rng.choice([r["course_code"].replace(" ", ""), r["course_code"].lower()])
        elif x < 0.013:
            r["matric_no"] = messy_matric(rng, r["matric_no"])
        elif x < 0.016:
            r["semester"] = "1st" if r["semester"] == "First" else "2nd"
    extra = [dict(r) for r in rng.sample(rows, k=int(len(rows) * 0.002))]
    for r in rng.sample(rows, k=40):
        b = dict(r)
        k = rng.randint(0, 2)
        if k == 0:
            b["ca_score"] = rng.choice([34, 41, 45])  # CA is out of 30
        elif k == 1:
            b["exam_score"] = rng.choice([78, 85, 96])  # exam is out of 70
        else:
            b["exam_score"] = ""
        extra.append(b)
    for r in rng.sample(rows, k=12):
        b = dict(r)
        b["matric_no"] = f"EBSU/SIM/{rng.randint(2016, 2024)}/{rng.randint(9_900_000, 9_999_999):07d}"
        extra.append(b)
    return rows + extra


def write_csv(path: Path, rows: list[dict], rng: random.Random | None = None) -> None:
    if rng is not None:
        rng.shuffle(rows)  # duplicates and bad rows end up scattered, as in a real export
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def write_reference(path: Path) -> None:
    """The official list of faculties and programmes, as Academic Planning would keep it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["faculty_code", "faculty_name", "department_code", "department_name", "degree_awarded",
                    "programme_years", "first_intake", "aliases"])
        for d in sorted(ref.DEPARTMENTS, key=lambda d: (d.faculty_code, d.code)):
            w.writerow([d.faculty_code, d.faculty_name, d.code, d.name, d.degree, d.years,
                        session_name(d.first_intake), ";".join(d.aliases)])


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Generate the SIMULATED source-system exports for the EBSU warehouse.")
    ap.add_argument("--scale", type=float, default=1.0, help="size relative to the default university (1.0)")
    ap.add_argument("--out", type=Path, default=DATA_DIR, help="output folder (default warehouse/data)")
    args = ap.parse_args(argv)

    rng = random.Random(SEED)
    cat = Catalogue(rng)
    curricula = build_curricula(cat)
    students = simulate_students(rng, args.scale)
    simulate_progression(rng, students)
    admissions = inject_admissions_issues(rng, make_admissions(students))
    bursary = inject_bursary_issues(rng, make_bursary(rng, students))
    results = inject_exam_issues(rng, make_results(rng, students, cat, curricula))

    src = args.out / "sources"
    write_csv(src / "admissions.csv", admissions, rng)
    write_csv(src / "bursary.csv", bursary, rng)
    write_csv(src / "exams.csv", results, rng)
    write_reference(args.out / "reference" / "departments.csv")

    active = sum(1 for s in students if any(y in SESSIONS for y, *_ in s.registrations))
    print(f"SIMULATED data written to {args.out} (seed {SEED}, scale {args.scale})")
    print(f"  students active in {session_name(SESSIONS[0])} to {session_name(LAST_SESSION)}: {active:,}")
    print(f"  admissions.csv   {len(admissions):>9,} rows")
    print(f"  bursary.csv      {len(bursary):>9,} rows")
    print(f"  exams.csv        {len(results):>9,} rows")
    print(f"  departments.csv  {len(ref.DEPARTMENTS):>9} programmes in {len(ref.FACULTY_NAMES)} faculties")


if __name__ == "__main__":
    main()
