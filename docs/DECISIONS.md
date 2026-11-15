# Decision log

You asked to be consulted only on irreversible or ambiguous decisions. None came up that needed you: every decision below can be reversed by editing a file or re-running a script. They are grouped by area, each with the reason and how to change it.

## Data and privacy

| # | Decision | Why | To change it |
|---|---|---|---|
| D1 | All student, fee and result records are generated; no real record is used anywhere. | Your non-negotiable. Real records are personal data under the Nigeria Data Protection Act 2023. | Not to be changed for the prototype. Real exports with the same columns would replace the CSV files. |
| D2 | Every matric number has the form `EBSU/SIM/<year>/<7-digit serial>`. | EBSU's real format is `EBSU/<year>/<serial>`; the `SIM` makes a simulated record impossible to mistake for a real one. | `matric=` in `warehouse/generator/generate_data.py`, and the pattern in the ETL tests. |
| D3 | "Simulated" is stated on the login page, in the sidebar of every page, in a header label on every dashboard tab, on the How It Works page, in the comment on every star-schema table in MySQL, in the report, on every slide and in the Q&A sheet. | Your instruction to label it as simulated everywhere. | — |
| D4 | Real reference facts used: names of 9 faculties and 50 programmes (EBSU's 2025/2026 and 2026/2027 Post-UTME adverts), acceptance fees of ₦50,050 and ₦30,050, the five-point grading scale with 30% CA and 70% examination, payment in two instalments from 2023/2024, and the 10% tuition cut of 2024. | Realism where public facts exist. ebsu.edu.ng refused direct access from the build environment (HTTP 403), so the facts come from search extracts of its pages and are listed with sources in the generator. Your own faculty list was not provided. | `warehouse/generator/ebsu_reference.py` |
| D5 | Programmes left out: those whose current intake could not be confirmed (Food Science and Technology, Quantity Surveying, Urban and Regional Planning and others), the seven health programmes whose first intake is 2026/2027, teaching-only departments, and programmes that belong to the separate Ebonyi State University of ICT, Science and Technology. Engineering and Environmental Science programmes start in 2023/2024. | Only programmes that would have students in 2021/2022 to 2024/2025. | Add a `Department(...)` entry in `ebsu_reference.py`. |
| D6 | Tuition is estimated by fee band (₦85,000 to ₦250,000 for indigenes, plus ₦45,000 or ₦64,000 for non-indigenes, 10% lower from 2024/2025), with registration fees of ₦12,000 or ₦22,000. | No official tuition schedule for all programmes could be found; these follow the published patterns. The report says so. | `TUITION_INDIGENE` and related values in `ebsu_reference.py` |
| D7 | Grade E (40 to 44) is kept as a pass, so the pass mark is 40. | Third-party sources report E for EBSU; whether NUC's 45 pass mark is applied could not be confirmed. Stated as a limitation. | `GRADE_SCALE` and `PASS_MARK` in `warehouse/etl/etl.py` and the generator |
| D8 | Four sessions, 2021/2022 to 2024/2025, with intakes simulated from 2015/2016 so that every level is filled. | Enough history for trends; a five-year programme needs earlier cohorts. | `SESSIONS` and `FIRST_COHORT` in the generator |
| D9 | The simulated university is about one-fifth of EBSU's estimated size: 6,898 students, 151,326 results. | A full ETL run stays around five seconds on a laptop, which matters during a live demo. | `python warehouse/generator/generate_data.py --scale 2` (or any factor), then `npm run reset` |
| D10 | Names are Nigerian, drawn from lists for the main language groups of each state of origin, with about 72% of students from Ebonyi State. | Realistic for a state university in Abakaliki. | `warehouse/generator/names.py` |
| D11 | The generator injects realistic errors on purpose: messy matric numbers, session labels, dates, gender spellings, department aliases, amounts written with ₦, course codes, semesters, duplicate rows, impossible scores and levels, and payments for unknown students. | Gives the ETL real cleaning to do and turns the injected counts into a known-answer test (every one is caught). | `inject_*_issues` in the generator |

## Warehouse and ETL

| # | Decision | Why | To change it |
|---|---|---|---|
| D12 | A galaxy of three stars (enrolment, fee payment, result) sharing five conformed dimensions (student, course, department, faculty, session), with 13 foreign keys. | Matches the brief exactly and is the most implemented design in education warehouses. | `warehouse/sql/schema.sql` |
| D13 | Grains: a student in a session; a fee item billed to a student in a session (an invoice line, not each payment); a student's result in a course in a session. | The bursary export gives billed and paid-to-date per invoice, so instalments show as part-paid invoices. | Schema and `transform()` in `etl.py` |
| D14 | Faculty is its own dimension and is also copied into `dim_department`. | Keeps a true star (no department-to-faculty chain) and lets faculty filters use an indexed key on every fact table. | Schema |
| D15 | The session is the time dimension; payment dates stay in the fee fact. No calendar date dimension. | Enrolment and results happen per session; the monthly collections chart uses the payment date. Listed as further work. | Add `dim_date` |
| D16 | Slowly changing dimensions are type 1 (rebuilt on each load); a student's department is recorded on every fact row instead. | Simple and correct for four sessions of simulated data. Type 2 is listed as further work. | `transform()` |
| D17 | Rows for unknown students are rejected and logged rather than mapped to an "Unknown" dimension member. | Makes data quality visible; with simulated data every such row is an injected error. The Q&A sheet explains the production alternative. | `transform()` |
| D18 | Each ETL run fully reloads shadow tables (`*_next`), checks row counts and all 13 foreign keys, then swaps all eight tables in with one atomic `RENAME TABLE`. | The dashboard never sees a half-loaded warehouse, and a failed run changes nothing. It is also faster under XAMPP's defaults than deleting and re-inserting in a transaction (13.8 s before, about 5 s after). | `load()` in `etl.py` |
| D19 | Bulk loading uses `LOAD DATA LOCAL INFILE`, falling back to batched `INSERT` when the server refuses local files. | Fast where allowed, still works where not. | `load()` |
| D20 | On start, the runner raises MySQL's InnoDB buffer pool to 128 MB for the running server if it is smaller (XAMPP ships 16 MB). The change is not written to `my.ini`. | Keeps the ETL and the Academics tab fast on a default XAMPP install. | `scripts/start.mjs` |
| D21 | The database host is `127.0.0.1`, not `localhost`. | On Windows, `localhost` can resolve to IPv6 first, which XAMPP's MySQL does not listen on. | `.env.local` |
| D22 | The warehouse was tested on MariaDB 10.11 (XAMPP ships MariaDB; MySQL 8 works too) and the ETL on pandas 2.2 and 3.1. | Only features common to MySQL and MariaDB are used. | — |
| D23 | ETL progress reaches the dashboard as a stream of JSON events from the Python process. | The admin sees each stage and the rows loaded per source as they happen. | `src/app/api/etl/route.ts` |

## Dashboard and design

| # | Decision | Why | To change it |
|---|---|---|---|
| D24 | One admin login stored in MySQL (`app_admin`), password as a salted scrypt hash, session in an HMAC-signed, HTTP-only cookie that lasts ten hours. Default login: `admin` / `ebsu-dw-2025`. | The brief asked for a simple admin login in MySQL. | Set `ADMIN_PASSWORD` in `.env.local`, then `npm run reset-admin` |
| D25 | Light mode only, following the reference screen: warm off-white canvas, white cards, one red accent, a dark card for the key figure. | Your instruction to match the reference's language in light mode. | `src/app/globals.css` |
| D26 | The taste skill was installed and its universal rules applied (Geist font, Phosphor icons only, one accent colour, no em dashes in the interface). It excludes dashboards from its scope, so the layout follows the reference screen rather than the skill's landing-page patterns. The skill is recorded in `skills-lock.json` but not copied into the repository: its current version is 40 MB of third-party files with its own hooks. | Both of your instructions, reconciled. | `npx skills add Leonxlnx/taste-skill --skill design-taste-frontend` restores it |
| D27 | Every chart has a table view and an SQL view showing the exact query with the current filter values; charts do not animate. | Lets the panel check any figure and see the star joins; readable for screen readers and in print. | `src/components/ui/ChartCard.tsx` |
| D28 | The Finance tab drills down from faculties to departments when a faculty is selected. | Answers "which departments owe the most" without a separate page. | `src/lib/queries/finance.ts` |
| D29 | A "How It Works" page answers the panel's questions on screen: architecture, database or warehouse, why not Excel (with a live benchmark), and what in the data is real. The Star Schema page draws the schema from the live database. | You asked for a diagram or a screen for each panel question. | `src/app/(app)/about`, `src/app/(app)/schema` |
| D30 | Everything is served locally: fonts from the `geist` package, icons bundled, no CDN or Google Fonts. Confirmed by recording every network request while visiting each page. | Your second non-negotiable: the demo works with the network off. | — |
| D31 | One command: `start.bat` / `npm start` runs `scripts/start.mjs`, which needs nothing but Node.js to begin, so it works before `npm install` (it uses the project's own MySQL driver once npm has installed it). It creates `.env.local`, the Python virtual environment and the data, runs the ETL when needed, creates the login, and rebuilds the dashboard only when the code changes. | "Runs with one command after XAMPP is started." | `scripts/start.mjs` |

## Documents

| # | Decision | Why | To change it |
|---|---|---|---|
| D32 | The project report is a Word document (.docx, with a PDF copy) rather than a Claude Docs document. | Nigerian departments expect a Word file to edit, format and print offline. | — |
| D33 | Report format: A4, Times New Roman 12, 1.5 line spacing, 1.5-inch left margin, Roman page numbers for the preliminary pages, APA 7th edition references, five chapters with the usual Nigerian Computer Science headings, and the Kimball lifecycle as the methodology. No EBSU-specific manual was found, and your department's format was left blank, so this follows common Nigerian practice. | Defaults for the unfilled department-format placeholder. | Edit the .docx; your department's template overrides these |
| D34 | Nothing is invented in the report: interviews, usability test results, your name, matric number, supervisor and defence date are yellow-highlighted placeholders, and references that could not be fully verified are flagged. | Fabricated results or claimed interviews would not survive a panel. | Fill in each highlight |
| D35 | Reference list limited to the sources cited, all checked against publisher, library or index records during research; the few unconfirmed details carry a highlighted check note. | Accuracy. | — |
| D36 | The deck is a PowerPoint file (.pptx, with a PDF copy) with speaker notes, in the dashboard's colours and Arial. | It has to open on the defence laptop without internet, next to the app. Arial renders the same on any PowerPoint. | `docs/defense/EBSU_DW_Defense_Deck.pptx` |
| D37 | The Q&A sheet covers your five questions in depth (what to say first, detail, the screen to show) plus 32 further questions panels ask, a numbers-to-remember table and a seven-minute demo script. | Your list plus the research on typical panels. | `docs/defense/EBSU_DW_Defense_QA.docx` |

## What could not be produced, and what was used instead

| Item | Status | What was done instead |
|---|---|---|
| Images generated with ChatGPT in the browser | Not available from this environment | All assets were built here: one icon set (Phosphor, the same in the app, deck and diagrams), twelve diagrams drawn as SVG from code (`docs/diagrams/src/diagrams.html`), and real screenshots of the dashboard. |
| Photographs (campus, people) | Not produced | No screen needed one, and photos of people would sit badly with "no real records". The login page uses a star-schema motif instead. |
| EBSU crest or logo | Deliberately not used | A neutral "EBSU Analytics" wordmark, so nothing imitates the university's official identity. |
| Direct scrape of ebsu.edu.ng | Blocked (HTTP 403) from the build environment | Facts taken from search-engine extracts of EBSU's own pages and cross-checked; sources are in the generator. |
| An official tuition schedule for every programme | Not found | Estimated fee bands (D6), stated as a limitation. |
| Usability test results | Need real participants | The test plan, tasks and SUS questionnaire are in the report, with an empty results table to fill in. |
| Interviews with EBSU staff | Not done | Highlighted placeholder in Section 3.3; the existing-system description is marked for you to confirm. |
| Your name, matric number, supervisor, defence date, dedication, acknowledgements | Not provided | Highlighted placeholders in the report, deck and Q&A sheet. |
| Timings on your own laptop | Measured on the build machine (4-core 2.3 GHz Xeon, 15 GB, Linux) | Re-measure before the defence; the report and Q&A sheet say where to update them. |

## Before you submit or defend

1. Fill every yellow highlight in `docs/project/EBSU_DW_BI_Project_Draft.docx`, then update the table of contents (right-click it, **Update Field**).
2. Put your name, matric number and supervisor on slide 1 of the deck and at the top of the Q&A sheet.
3. Run the usability test (Section 4.7.5 and Appendix E) and add the results, or keep the honest "planned" wording.
4. Open every DOI and URL in the references once.
5. On the defence laptop: `npm run check`, then a full rehearsal with Wi-Fi off.
