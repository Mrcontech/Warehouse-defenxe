"""
Tests for the ETL (standard library unittest, no extra packages).

    python -m unittest discover -s warehouse/tests -v

Unit tests check each cleaning rule on small inputs. The reconciliation tests run the
real transform on the simulated CSV files (no database needed) and check that every
source row is accounted for and that the facts obey their rules.
"""

import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "etl"))
import etl  # noqa: E402


class QuietReporter(etl.Reporter):
    def emit(self, event, text=None):  # keep test output clean
        pass


class CleaningRules(unittest.TestCase):
    def test_session_labels(self):
        self.assertEqual(etl.std_session("2021/2022"), "2021/2022")
        self.assertEqual(etl.std_session("2021-2022"), "2021/2022")
        self.assertEqual(etl.std_session("2021/22"), "2021/2022")
        self.assertEqual(etl.std_session(" 2021 / 2022 "), "2021/2022")
        self.assertIsNone(etl.std_session("2021/2023"))  # not consecutive years
        self.assertIsNone(etl.std_session("21/22"))
        self.assertIsNone(etl.std_session(""))

    def test_matric_numbers(self):
        canon = "EBSU/SIM/2021/0085947"
        for raw in ["ebsu/sim/2021/0085947", "EBSU-SIM-2021-0085947", " EBSU/SIM/2021/0085947 ", "EBSU / SIM / 2021 / 0085947"]:
            self.assertEqual(etl.matric_value(raw), canon, raw)

    def test_naira_amounts(self):
        s = pd.Series(["₦125,000.00", "125000.00", "N/A", "-5000", "NGN 2,500"])
        out = etl.parse_naira(s)
        self.assertEqual(out.iloc[0], 125000.0)
        self.assertEqual(out.iloc[1], 125000.0)
        self.assertTrue(pd.isna(out.iloc[2]))
        self.assertEqual(out.iloc[3], -5000.0)  # parsed; the negative check rejects it later
        self.assertEqual(out.iloc[4], 2500.0)

    def test_dates(self):
        out = etl.std_date(pd.Series(["2003-05-14", "14/05/2003", "14-05-2003", "not a date"]))
        self.assertEqual(str(out.iloc[0].date()), "2003-05-14")
        self.assertEqual(str(out.iloc[1].date()), "2003-05-14")
        self.assertEqual(str(out.iloc[2].date()), "2003-05-14")
        self.assertTrue(pd.isna(out.iloc[3]))

    def test_department_names(self):
        self.assertEqual(etl.normalise_name("Dept. of Computer Science"), etl.normalise_name("COMPUTER SCIENCE"))
        self.assertEqual(etl.normalise_name("Banking & Finance"), etl.normalise_name("Banking and Finance"))

    def test_grades_on_the_five_point_scale(self):
        scores = pd.Series([100, 70, 69, 60, 59, 50, 49, 45, 44, 40, 39, 0])
        grade, point = etl.grade_from_score(scores)
        self.assertEqual(list(grade), ["A", "A", "B", "B", "C", "C", "D", "D", "E", "E", "F", "F"])
        self.assertEqual(list(point), [5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0])

    def test_sql_splitter_ignores_comments(self):
        stmts = etl.split_sql("-- a comment\nCREATE TABLE a (x INT);\n\n-- another\nCREATE TABLE b (y INT);\n")
        self.assertEqual(len(stmts), 2)
        self.assertTrue(stmts[0].startswith("CREATE TABLE a"))


class Reconciliation(unittest.TestCase):
    """Runs the real transform on the simulated source files."""

    @classmethod
    def setUpClass(cls):
        rep = QuietReporter(as_json=True)
        frames, departments = etl.extract(rep)
        cls.frames = frames
        cls.tables, cls.stats = etl.transform(rep, frames, departments)

    def test_every_source_row_is_accounted_for(self):
        for name, s in self.stats.items():
            with self.subTest(source=name):
                self.assertEqual(s.extracted, len(self.frames[name]))
                self.assertEqual(s.extracted, s.loaded + s.duplicates + s.rejected)

    def test_loaded_rows_match_fact_tables(self):
        self.assertEqual(self.stats["admissions"].loaded, len(self.tables["fact_enrolment"]))
        self.assertEqual(self.stats["bursary"].loaded, len(self.tables["fact_fee_payment"]))
        self.assertEqual(self.stats["exams"].loaded, len(self.tables["fact_result"]))

    def test_grain_is_unique(self):
        self.assertFalse(self.tables["fact_enrolment"].duplicated(["student_key", "session_key"]).any())
        self.assertFalse(self.tables["fact_fee_payment"].duplicated(["invoice_no"]).any())
        self.assertFalse(self.tables["fact_result"].duplicated(["student_key", "course_key", "session_key"]).any())

    def test_every_foreign_key_finds_its_dimension(self):
        dims = {
            "student_key": set(self.tables["dim_student"]["student_key"]),
            "session_key": set(self.tables["dim_session"]["session_key"]),
            "department_key": set(self.tables["dim_department"]["department_key"]),
            "faculty_key": set(self.tables["dim_faculty"]["faculty_key"]),
            "course_key": set(self.tables["dim_course"]["course_key"]),
        }
        for fact in ("fact_enrolment", "fact_fee_payment", "fact_result"):
            df = self.tables[fact]
            for key, valid in dims.items():
                if key in df.columns:
                    with self.subTest(fact=fact, key=key):
                        self.assertTrue(df[key].isin(valid).all())

    def test_fee_measures_add_up(self):
        f = self.tables["fact_fee_payment"]
        self.assertTrue(((f["amount_billed"] - f["amount_paid"] - f["amount_outstanding"]).abs() < 0.01).all())
        self.assertTrue((f["amount_paid"] >= 0).all())
        self.assertTrue(set(f["payment_status"]) <= {"Paid", "Part-paid", "Unpaid"})

    def test_result_measures_follow_the_rules(self):
        r = self.tables["fact_result"]
        self.assertTrue(r["ca_score"].between(0, 30).all())
        self.assertTrue(r["exam_score"].between(0, 70).all())
        self.assertTrue((r["total_score"] == r["ca_score"] + r["exam_score"]).all())
        self.assertTrue((r["quality_points"] == r["grade_point"] * r["credit_units"]).all())
        self.assertTrue((r["is_pass"] == (r["total_score"] >= 40).astype(int)).all())

    def test_cgpa_stays_on_the_five_point_scale(self):
        r = self.tables["fact_result"]
        g = r.groupby("student_key")[["quality_points", "credit_units"]].sum()
        cgpa = g["quality_points"] / g["credit_units"]
        self.assertTrue(cgpa.between(0, 5).all())

    def test_one_student_per_matric_number(self):
        s = self.tables["dim_student"]
        self.assertFalse(s["matric_no"].duplicated().any())
        self.assertTrue(s["matric_no"].str.match(r"^EBSU/SIM/\d{4}/\d{7}$").all())
        self.assertTrue(set(s["gender"]) <= {"Male", "Female", "Unspecified"})


if __name__ == "__main__":
    unittest.main()
