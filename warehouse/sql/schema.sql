-- =====================================================================
--  EBSU University Data Warehouse : star schema (galaxy / fact constellation)
--  Project: Design and Implementation of a Data Warehouse and Business
--           Intelligence Dashboard for University Administration
--
--  ALL DATA LOADED INTO THIS SCHEMA IS SIMULATED. It contains no real
--  student or staff records.
--
--  Target: MySQL 8 / MariaDB 10.4+ (XAMPP). Run by warehouse/etl/etl.py,
--  which creates the database if it does not exist.
--
--  Layout
--    Dimensions : dim_faculty, dim_department, dim_session, dim_student, dim_course
--    Facts      : fact_enrolment, fact_fee_payment, fact_result
--    ETL audit  : etl_run, etl_run_source, etl_run_table, etl_run_rule, etl_reject
--    App        : app_admin (dashboard login, password stored as a salted scrypt hash)
--
--  Every fact table joins to each of its dimensions in one hop (no chains
--  of joins), which is what makes it a star schema rather than a snowflake.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Dimension tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim_faculty (
  faculty_key      SMALLINT UNSIGNED NOT NULL,
  faculty_code     VARCHAR(10)  NOT NULL,
  faculty_name     VARCHAR(120) NOT NULL,
  PRIMARY KEY (faculty_key),
  UNIQUE KEY uq_faculty_code (faculty_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dimension: faculties. Simulated data warehouse.';

CREATE TABLE IF NOT EXISTS dim_department (
  department_key   SMALLINT UNSIGNED NOT NULL,
  department_code  VARCHAR(10)  NOT NULL,
  department_name  VARCHAR(120) NOT NULL,
  faculty_code     VARCHAR(10)  NOT NULL COMMENT 'Denormalised for convenience; facts also carry faculty_key',
  faculty_name     VARCHAR(120) NOT NULL,
  degree_awarded   VARCHAR(20)  NOT NULL,
  programme_years  TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (department_key),
  UNIQUE KEY uq_department_code (department_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dimension: academic departments (programmes of study). Simulated.';

CREATE TABLE IF NOT EXISTS dim_session (
  session_key      SMALLINT UNSIGNED NOT NULL,
  session_name     CHAR(9)      NOT NULL COMMENT 'e.g. 2023/2024',
  start_year       SMALLINT     NOT NULL,
  end_year         SMALLINT     NOT NULL,
  is_current       TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (session_key),
  UNIQUE KEY uq_session_name (session_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dimension: academic sessions (the time dimension of this warehouse). Simulated.';

CREATE TABLE IF NOT EXISTS dim_student (
  student_key       INT UNSIGNED NOT NULL,
  matric_no         VARCHAR(24)  NOT NULL COMMENT 'Natural (business) key from the admissions system',
  surname           VARCHAR(60)  NOT NULL,
  first_name        VARCHAR(60)  NOT NULL,
  middle_name       VARCHAR(60)  NULL,
  full_name         VARCHAR(190) NOT NULL,
  gender            VARCHAR(12)  NOT NULL,
  date_of_birth     DATE         NULL,
  state_of_origin   VARCHAR(40)  NOT NULL,
  entry_mode        VARCHAR(20)  NOT NULL COMMENT 'UTME or Direct Entry',
  admission_session CHAR(9)      NOT NULL,
  PRIMARY KEY (student_key),
  UNIQUE KEY uq_matric_no (matric_no),
  KEY ix_student_gender (gender)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dimension: students. SIMULATED people, not real students.';

CREATE TABLE IF NOT EXISTS dim_course (
  course_key        SMALLINT UNSIGNED NOT NULL,
  course_code       VARCHAR(10)  NOT NULL,
  course_title      VARCHAR(120) NOT NULL,
  credit_units      TINYINT UNSIGNED NOT NULL,
  course_level      SMALLINT UNSIGNED NOT NULL,
  semester          VARCHAR(6)   NOT NULL COMMENT 'First or Second',
  course_category   VARCHAR(20)  NOT NULL COMMENT 'General Studies, Faculty or Departmental',
  PRIMARY KEY (course_key),
  UNIQUE KEY uq_course_code (course_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dimension: courses (modules) from the exams system catalogue. Simulated.';

-- ---------------------------------------------------------------------
-- Fact tables
-- ---------------------------------------------------------------------
-- Grain: one row per student per academic session (a session registration).
CREATE TABLE IF NOT EXISTS fact_enrolment (
  enrolment_key     INT UNSIGNED NOT NULL,
  student_key       INT UNSIGNED NOT NULL,
  session_key       SMALLINT UNSIGNED NOT NULL,
  department_key    SMALLINT UNSIGNED NOT NULL,
  faculty_key       SMALLINT UNSIGNED NOT NULL,
  level             SMALLINT UNSIGNED NOT NULL COMMENT '100, 200, ... 600',
  is_new_entrant    TINYINT(1)   NOT NULL COMMENT '1 if admitted in this session',
  enrolment_count   TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Additive measure (always 1)',
  PRIMARY KEY (enrolment_key),
  UNIQUE KEY uq_enrolment (student_key, session_key),
  KEY ix_enrol_session_faculty (session_key, faculty_key),
  KEY ix_enrol_department (department_key),
  CONSTRAINT fk_enrol_student    FOREIGN KEY (student_key)    REFERENCES dim_student (student_key),
  CONSTRAINT fk_enrol_session    FOREIGN KEY (session_key)    REFERENCES dim_session (session_key),
  CONSTRAINT fk_enrol_department FOREIGN KEY (department_key) REFERENCES dim_department (department_key),
  CONSTRAINT fk_enrol_faculty    FOREIGN KEY (faculty_key)    REFERENCES dim_faculty (faculty_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Fact: enrolment. Grain = one student registered in one session. Simulated.';

-- Grain: one row per fee item billed to a student in a session (an invoice line).
CREATE TABLE IF NOT EXISTS fact_fee_payment (
  payment_key        INT UNSIGNED NOT NULL,
  student_key        INT UNSIGNED NOT NULL,
  session_key        SMALLINT UNSIGNED NOT NULL,
  department_key     SMALLINT UNSIGNED NOT NULL,
  faculty_key        SMALLINT UNSIGNED NOT NULL,
  invoice_no         VARCHAR(24)  NOT NULL COMMENT 'Degenerate dimension from the bursary system',
  fee_item           VARCHAR(40)  NOT NULL COMMENT 'Degenerate dimension: School Fees, Acceptance Fee, ...',
  amount_billed      DECIMAL(12,2) NOT NULL,
  amount_paid        DECIMAL(12,2) NOT NULL,
  amount_outstanding DECIMAL(12,2) NOT NULL COMMENT 'amount_billed - amount_paid, computed by the ETL',
  payment_status     VARCHAR(12)  NOT NULL COMMENT 'Paid, Part-paid or Unpaid',
  payment_channel    VARCHAR(30)  NULL,
  payment_date       DATE         NULL,
  PRIMARY KEY (payment_key),
  UNIQUE KEY uq_invoice_no (invoice_no),
  KEY ix_fee_session_faculty (session_key, faculty_key),
  KEY ix_fee_department (department_key),
  KEY ix_fee_student (student_key),
  CONSTRAINT fk_fee_student    FOREIGN KEY (student_key)    REFERENCES dim_student (student_key),
  CONSTRAINT fk_fee_session    FOREIGN KEY (session_key)    REFERENCES dim_session (session_key),
  CONSTRAINT fk_fee_department FOREIGN KEY (department_key) REFERENCES dim_department (department_key),
  CONSTRAINT fk_fee_faculty    FOREIGN KEY (faculty_key)    REFERENCES dim_faculty (faculty_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Fact: fee payments. Grain = one fee item billed to one student in one session. Simulated.';

-- Grain: one row per student per course per session (one examination result).
CREATE TABLE IF NOT EXISTS fact_result (
  result_key        INT UNSIGNED NOT NULL,
  student_key       INT UNSIGNED NOT NULL,
  course_key        SMALLINT UNSIGNED NOT NULL,
  session_key       SMALLINT UNSIGNED NOT NULL,
  department_key    SMALLINT UNSIGNED NOT NULL COMMENT 'Department of the student, not of the course',
  faculty_key       SMALLINT UNSIGNED NOT NULL,
  ca_score          TINYINT UNSIGNED NOT NULL COMMENT 'Continuous assessment, max 30',
  exam_score        TINYINT UNSIGNED NOT NULL COMMENT 'Examination, max 70',
  total_score       TINYINT UNSIGNED NOT NULL COMMENT 'ca_score + exam_score, 0 to 100',
  grade             CHAR(1)      NOT NULL,
  grade_point       TINYINT UNSIGNED NOT NULL COMMENT '5-point scale',
  credit_units      TINYINT UNSIGNED NOT NULL,
  quality_points    SMALLINT UNSIGNED NOT NULL COMMENT 'grade_point x credit_units',
  is_pass           TINYINT(1)   NOT NULL,
  PRIMARY KEY (result_key),
  UNIQUE KEY uq_result (student_key, course_key, session_key),
  KEY ix_result_session_faculty (session_key, faculty_key),
  KEY ix_result_department (department_key),
  KEY ix_result_course (course_key),
  CONSTRAINT fk_result_student    FOREIGN KEY (student_key)    REFERENCES dim_student (student_key),
  CONSTRAINT fk_result_course     FOREIGN KEY (course_key)     REFERENCES dim_course (course_key),
  CONSTRAINT fk_result_session    FOREIGN KEY (session_key)    REFERENCES dim_session (session_key),
  CONSTRAINT fk_result_department FOREIGN KEY (department_key) REFERENCES dim_department (department_key),
  CONSTRAINT fk_result_faculty    FOREIGN KEY (faculty_key)    REFERENCES dim_faculty (faculty_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Fact: examination results. Grain = one student, one course, one session. Simulated.';

-- ---------------------------------------------------------------------
-- ETL audit tables (written by etl.py on every run)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etl_run (
  run_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  started_at    DATETIME     NOT NULL,
  finished_at   DATETIME     NULL,
  status        VARCHAR(12)  NOT NULL COMMENT 'running, success or failed',
  duration_ms   INT UNSIGNED NULL,
  triggered_by  VARCHAR(60)  NOT NULL,
  message       TEXT         NULL,
  PRIMARY KEY (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ETL audit: one row per ETL run.';

CREATE TABLE IF NOT EXISTS etl_run_source (
  run_id          INT UNSIGNED NOT NULL,
  source_name     VARCHAR(20)  NOT NULL COMMENT 'admissions, bursary or exams',
  file_name       VARCHAR(80)  NOT NULL,
  rows_extracted  INT UNSIGNED NOT NULL,
  rows_duplicate  INT UNSIGNED NOT NULL,
  rows_rejected   INT UNSIGNED NOT NULL,
  rows_loaded     INT UNSIGNED NOT NULL,
  rows_cleaned    INT UNSIGNED NOT NULL COMMENT 'Rows where at least one value was standardised',
  PRIMARY KEY (run_id, source_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ETL audit: rows extracted, rejected and loaded per source system per run.';

CREATE TABLE IF NOT EXISTS etl_run_table (
  run_id       INT UNSIGNED NOT NULL,
  table_name   VARCHAR(40)  NOT NULL,
  rows_loaded  INT UNSIGNED NOT NULL,
  PRIMARY KEY (run_id, table_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ETL audit: rows loaded into each warehouse table per run.';

CREATE TABLE IF NOT EXISTS etl_run_rule (
  run_id         INT UNSIGNED NOT NULL,
  seq            SMALLINT UNSIGNED NOT NULL,
  source_name    VARCHAR(20)  NOT NULL,
  rule_text      VARCHAR(160) NOT NULL,
  rows_affected  INT UNSIGNED NOT NULL,
  PRIMARY KEY (run_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ETL audit: what each transform rule did in a run.';

CREATE TABLE IF NOT EXISTS etl_reject (
  reject_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id       INT UNSIGNED NOT NULL,
  source_name  VARCHAR(20)  NOT NULL,
  source_row   INT UNSIGNED NOT NULL COMMENT 'Line number in the CSV file (header = line 1)',
  reason       VARCHAR(120) NOT NULL,
  raw_record   TEXT         NOT NULL,
  PRIMARY KEY (reject_id),
  KEY ix_reject_run (run_id, source_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ETL audit: source rows rejected by data quality rules, with the reason.';

-- ---------------------------------------------------------------------
-- Application table: the single dashboard administrator
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_admin (
  admin_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(40)  NOT NULL,
  full_name      VARCHAR(120) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL COMMENT 'scrypt$N$r$p$salt$hash (never plain text)',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at  DATETIME     NULL,
  PRIMARY KEY (admin_id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dashboard login. Not part of the star schema.';
