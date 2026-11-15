"""
Reference facts about Ebonyi State University (EBSU), Abakaliki, used to shape the
SIMULATED data. Faculty and programme names, acceptance fees, the grading scale and
the instalment and tuition-cut notices are EBSU's published values; everything about
individual students (and the tuition amounts, which EBSU does not publish for every
programme) is invented.

Sources (checked through search-engine extracts of ebsu.edu.ng, which refuses direct
access from the build environment):
  - 2025/2026 and 2026/2027 Post-UTME advertisements (faculties and programmes)
  - ebsu.edu.ng/admission-procedures (acceptance fees: N50,050 and N30,050)
  - 2023/2024 notice allowing school fees in two instalments
  - April 2024 announcement of a 10% tuition reduction
  - Department of Computer Science page (course codes, SIWES)
Left out on purpose: programmes whose current intake could not be confirmed (for
example Food Science and Technology, Quantity Surveying, Urban and Regional Planning,
Entrepreneurship, Library and Information Science, Film Production), the health
programmes first admitted in 2026/2027, teaching-only departments, and programmes of the
separate Ebonyi State University of ICT, Science and Technology.
"""

from __future__ import annotations

from dataclasses import dataclass, field

FACULTY_NAMES = {
    "FARM": "Faculty of Agriculture and Natural Resources Management",
    "FBMS": "Faculty of Basic Medical Sciences",
    "FEDU": "Faculty of Education",
    "FENG": "Faculty of Engineering and Environmental Science",
    "FHST": "Faculty of Health Sciences and Technology",
    "FLAW": "Faculty of Law",
    "FMS": "Faculty of Management Sciences",
    "FSC": "Faculty of Science",
    "FSSH": "Faculty of Social Sciences and Humanities",
}


@dataclass
class Department:
    code: str
    name: str
    faculty_code: str
    degree: str
    years: int
    prefix: str  # course-code prefix of the department's own courses
    intake: int  # simulated first-year intake per session at scale 1.0
    female_share: float
    fee_band: str  # MED, HLT, ENG, GEN or EDA (see TUITION_INDIGENE)
    topics: list[str]
    first_intake: int = 2015
    direct_entry: bool = True
    siwes: bool = False
    project_title: str = "Research Project"
    aliases: list[str] = field(default_factory=list)
    fixed_courses: dict[int, list[tuple[str, str, int]]] = field(default_factory=dict)

    @property
    def faculty_name(self) -> str:
        return FACULTY_NAMES[self.faculty_code]


D = Department
DEPARTMENTS: list[Department] = [
    # ---------------------------------------------------------------- Agriculture
    D("AEM", "Agricultural Economics, Management and Extension", "FARM", "B.Agric.", 5, "AEM", 16, 0.45, "EDA", [
        "Principles of Agricultural Economics", "Farm Management", "Agricultural Extension", "Rural Sociology",
        "Agricultural Marketing", "Agricultural Finance", "Production Economics", "Agricultural Policy",
        "Econometric Methods in Agriculture", "Rural Development", "Agribusiness Management", "Project Appraisal"],
      siwes=True, aliases=["Agric Economics, Management and Extension", "Agricultural Economics & Extension", "Agric. Economics"]),
    D("ANS", "Animal Science", "FARM", "B.Agric.", 5, "ANS", 13, 0.40, "EDA", [
        "Introduction to Animal Production", "Animal Nutrition", "Animal Physiology", "Livestock Management",
        "Poultry Production", "Animal Breeding and Genetics", "Ruminant Production", "Feed Technology",
        "Animal Health", "Pasture and Range Management", "Meat Science", "Biochemistry of Nutrition"],
      siwes=True, aliases=["Animal Sci."]),
    D("CSL", "Crop Science and Landscape Management", "FARM", "B.Agric.", 5, "CSL", 13, 0.42, "EDA", [
        "Principles of Crop Production", "Crop Physiology", "Plant Breeding", "Weed Science", "Crop Protection",
        "Landscape Design", "Horticulture", "Seed Technology", "Plant Pathology", "Agricultural Entomology",
        "Arable Crop Production", "Tree Crop Management"],
      siwes=True, aliases=["Crop Science", "Crop Science & Landscape Management"]),
    D("FAQ", "Fisheries and Aquaculture", "FARM", "B.Agric.", 5, "FAQ", 11, 0.38, "EDA", [
        "Introduction to Fisheries", "Fish Biology", "Aquaculture Systems", "Fish Nutrition", "Fish Processing",
        "Limnology", "Fisheries Management", "Fish Health", "Hatchery Management", "Fishing Technology",
        "Aquatic Ecology", "Fisheries Economics"],
      siwes=True, aliases=["Fisheries & Aquaculture"]),
    D("SEM", "Soil and Environmental Management", "FARM", "B.Agric.", 5, "SEM", 11, 0.40, "EDA", [
        "Introduction to Soil Science", "Soil Physics", "Soil Chemistry", "Soil Fertility", "Soil Survey and Classification",
        "Soil and Water Conservation", "Environmental Pollution", "Land Evaluation", "Soil Microbiology",
        "Irrigation and Drainage", "Remote Sensing in Agriculture", "Fertilizer Technology"],
      siwes=True, aliases=["Soil Science", "Soil & Environmental Management"]),
    # ---------------------------------------------------------------- Basic Medical Sciences
    D("MBS", "Medicine and Surgery", "FBMS", "MBBS", 6, "MBS", 34, 0.48, "MED", [
        "Gross Anatomy", "Medical Biochemistry", "Physiology", "Histology", "Pathology", "Pharmacology",
        "Medical Microbiology", "Community Medicine", "Internal Medicine", "Surgery", "Paediatrics",
        "Obstetrics and Gynaecology", "Psychiatry", "Clinical Methods"],
      project_title="Community Health Project", aliases=["Medicine & Surgery", "MBBS"]),
    D("ANA", "Anatomy", "FBMS", "B.Sc.", 4, "ANA", 22, 0.55, "GEN", [
        "Gross Anatomy", "Histology", "Embryology", "Neuroanatomy", "Cell Biology", "Genetics",
        "Anatomical Techniques", "Radiological Anatomy", "Developmental Biology", "Comparative Anatomy",
        "Forensic Anatomy", "Histochemistry"],
      aliases=["Human Anatomy"]),
    D("PHS", "Physiology", "FBMS", "B.Sc.", 4, "PHS", 22, 0.55, "GEN", [
        "General Physiology", "Cardiovascular Physiology", "Respiratory Physiology", "Renal Physiology",
        "Neurophysiology", "Endocrinology", "Gastrointestinal Physiology", "Exercise Physiology",
        "Reproductive Physiology", "Cell Physiology", "Biophysics", "Experimental Physiology"],
      aliases=["Human Physiology"]),
    # ---------------------------------------------------------------- Education
    D("ASE", "Arts and Social Science Education", "FEDU", "B.A.(Ed.)", 4, "ASE", 22, 0.66, "EDA", [
        "Curriculum Studies", "Methods of Teaching Social Studies", "Methods of Teaching English",
        "Educational Technology", "Teaching Practice", "Civic Education", "Literature in Education",
        "Peace Education", "Instructional Materials", "Classroom Management", "Language Education", "Citizenship Education"],
      aliases=["Arts & Social Science Education"]),
    D("SED", "Science Education", "FEDU", "B.Sc.(Ed.)", 4, "SED", 25, 0.55, "EDA", [
        "Methods of Teaching Mathematics", "Methods of Teaching Biology", "Methods of Teaching Chemistry",
        "Methods of Teaching Physics", "Science Curriculum", "Laboratory Management", "Teaching Practice",
        "Measurement and Evaluation", "Educational Statistics", "Integrated Science", "Computer Education", "Science Teaching Models"],
      aliases=["Sci. Education"]),
    D("VTE", "Vocational and Technical Education", "FEDU", "B.Sc.(Ed.)", 4, "VTE", 16, 0.40, "EDA", [
        "Foundations of Vocational Education", "Technical Drawing", "Workshop Practice", "Agricultural Education",
        "Home Economics Education", "Entrepreneurship Education", "Teaching Practice", "Industrial Training",
        "Curriculum Development in TVET", "Measurement and Evaluation", "Guidance in Vocational Education", "Instructional Methods"],
      siwes=True, aliases=["Vocational & Technical Education", "Voc. Tech. Education"]),
    D("BED", "Business Education", "FEDU", "B.Sc.(Ed.)", 4, "BED", 20, 0.62, "EDA", [
        "Principles of Business Education", "Office Practice", "Shorthand", "Keyboarding", "Accounting Education",
        "Teaching Practice", "Marketing Education", "Business Communication", "Office Technology", "Measurement and Evaluation",
        "Entrepreneurship Education", "Records Management"],
      aliases=["Business Educ."]),
    D("EDF", "Educational Foundations", "FEDU", "B.Ed.", 4, "EDF", 18, 0.68, "EDA", [
        "Philosophy of Education", "Sociology of Education", "Educational Psychology", "Guidance and Counselling",
        "History of Education", "Educational Administration", "Teaching Practice", "Measurement and Evaluation",
        "Early Childhood Education", "Adult Education", "Educational Research Methods", "Special Education"],
      aliases=["Educational Foundation", "Edu. Foundations"]),
    # ---------------------------------------------------------------- Engineering and Environmental Science
    D("CHE", "Chemical Engineering", "FENG", "B.Eng.", 5, "CHE", 18, 0.25, "ENG", [
        "Engineering Mathematics", "Thermodynamics", "Fluid Mechanics", "Mass Transfer", "Heat Transfer",
        "Chemical Reaction Engineering", "Process Control", "Unit Operations", "Process Design",
        "Petroleum Refining", "Separation Processes", "Process Safety"], first_intake=2023, siwes=True,
      aliases=["Chem. Engineering"]),
    D("CVE", "Civil Engineering", "FENG", "B.Eng.", 5, "CVE", 22, 0.15, "ENG", [
        "Engineering Mathematics", "Strength of Materials", "Structural Analysis", "Soil Mechanics", "Surveying",
        "Highway Engineering", "Hydraulics", "Reinforced Concrete Design", "Water Resources Engineering",
        "Foundation Engineering", "Construction Management", "Steel Design"], first_intake=2023, siwes=True,
      aliases=["Civil Eng."]),
    D("EEE", "Electrical and Electronics Engineering", "FENG", "B.Eng.", 5, "EEE", 25, 0.14, "ENG", [
        "Engineering Mathematics", "Circuit Theory", "Electromagnetic Fields", "Electronics", "Electrical Machines",
        "Power Systems", "Control Engineering", "Digital Electronics", "Telecommunications", "Signals and Systems",
        "Microprocessors", "Renewable Energy Systems"], first_intake=2023, siwes=True,
      aliases=["Electrical/Electronics Engineering", "Elect. & Electronics Engineering"]),
    D("ARC", "Architecture", "FENG", "B.Sc.", 4, "ARC", 16, 0.28, "ENG", [
        "Architectural Design", "Architectural Graphics", "History of Architecture", "Building Construction",
        "Environmental Control", "Structures for Architects", "Urban Design", "Landscape Architecture",
        "Building Materials", "Theory of Architecture", "Computer-Aided Design", "Professional Practice"], first_intake=2023,
      aliases=["Archi."]),
    D("BLD", "Building", "FENG", "B.Sc.", 5, "BLD", 13, 0.20, "ENG", [
        "Building Construction", "Building Materials", "Building Services", "Structural Mechanics", "Site Management",
        "Measurement of Building Works", "Building Maintenance", "Construction Technology", "Building Economics",
        "Construction Planning", "Estimating", "Building Law"], first_intake=2023, siwes=True,
      aliases=["Building Tech."]),
    D("EVM", "Environmental Management", "FENG", "B.Sc.", 4, "EVM", 13, 0.40, "ENG", [
        "Introduction to Environmental Management", "Environmental Chemistry", "Ecology", "Environmental Impact Assessment",
        "Waste Management", "Environmental Law", "Climate Change", "Geographic Information Systems",
        "Environmental Economics", "Disaster Management", "Sustainable Development", "Water Resources Management"], first_intake=2023,
      aliases=["Environmental Mgt."]),
    D("ESM", "Estate Management", "FENG", "B.Sc.", 5, "ESM", 13, 0.35, "ENG", [
        "Principles of Estate Management", "Land Economics", "Valuation", "Property Management", "Land Law",
        "Urban Land Economics", "Real Estate Finance", "Building Construction for Estate Surveyors", "Land Use Planning",
        "Property Investment", "Compulsory Acquisition and Compensation", "Feasibility and Viability Appraisal"], first_intake=2023,
      siwes=True, aliases=["Estate Mgt."]),
    # ---------------------------------------------------------------- Health Sciences and Technology
    D("MLS", "Medical Laboratory Science", "FHST", "BMLS", 5, "MLS", 31, 0.62, "HLT", [
        "Medical Microbiology", "Haematology", "Clinical Chemistry", "Histopathology", "Immunology", "Parasitology",
        "Blood Transfusion Science", "Virology", "Laboratory Management", "Cytology", "Molecular Diagnostics", "Medical Biochemistry"],
      siwes=True, aliases=["Med. Lab. Science", "Medical Lab Science"]),
    D("NSC", "Nursing Science", "FHST", "B.N.Sc.", 5, "NSC", 34, 0.85, "HLT", [
        "Foundations of Nursing", "Medical-Surgical Nursing", "Maternal and Child Health Nursing", "Community Health Nursing",
        "Mental Health Nursing", "Nursing Pharmacology", "Nursing Research", "Nursing Ethics", "Paediatric Nursing",
        "Nursing Administration", "Nutrition in Nursing", "Clinical Nursing Practice"],
      aliases=["Nursing"]),
    # ---------------------------------------------------------------- Law
    D("LAW", "Law", "FLAW", "LL.B.", 5, "LAW", 45, 0.55, "MED", [
        "Legal Methods", "Nigerian Legal System", "Constitutional Law", "Law of Contract", "Criminal Law",
        "Law of Torts", "Land Law", "Commercial Law", "Equity and Trusts", "Law of Evidence", "Company Law",
        "Jurisprudence", "International Law", "Administrative Law"], direct_entry=False,
      project_title="Long Essay", aliases=["Law (LL.B.)"]),
    # ---------------------------------------------------------------- Management Sciences
    D("ACC", "Accountancy", "FMS", "B.Sc.", 4, "ACC", 38, 0.55, "GEN", [
        "Financial Accounting", "Cost Accounting", "Management Accounting", "Auditing", "Taxation",
        "Public Sector Accounting", "Corporate Finance", "Accounting Theory", "Advanced Financial Reporting",
        "Accounting Information Systems", "Forensic Accounting", "Financial Management"], siwes=True,
      aliases=["Accounting"]),
    D("BFN", "Banking and Finance", "FMS", "B.Sc.", 4, "BFN", 22, 0.52, "GEN", [
        "Principles of Banking", "Monetary Economics", "Financial Markets", "Bank Lending", "Corporate Finance",
        "Investment Analysis", "International Finance", "Bank Management", "Risk Management", "Insurance",
        "Microfinance", "Financial Regulation"], siwes=True, aliases=["Banking & Finance"]),
    D("BUS", "Business Management", "FMS", "B.Sc.", 4, "BUS", 31, 0.50, "GEN", [
        "Principles of Management", "Organisational Behaviour", "Human Resource Management", "Production Management",
        "Business Policy", "Small Business Management", "Business Statistics", "Business Law", "Strategic Management",
        "Operations Research", "Management Information Systems", "Business Ethics"], siwes=True,
      aliases=["Business Admin.", "Business Mgt."]),
    D("MKT", "Marketing", "FMS", "B.Sc.", 4, "MKT", 18, 0.55, "GEN", [
        "Principles of Marketing", "Consumer Behaviour", "Marketing Research", "Advertising", "Sales Management",
        "International Marketing", "Marketing Communications", "Services Marketing", "Retail Management",
        "Digital Marketing", "Product Management", "Marketing Strategy"], siwes=True, aliases=["Mktg."]),
    D("PAD", "Public Administration", "FMS", "B.Sc.", 4, "PAD", 22, 0.52, "GEN", [
        "Introduction to Public Administration", "Public Policy Analysis", "Local Government Administration",
        "Public Personnel Administration", "Public Finance", "Comparative Public Administration", "Development Administration",
        "Administrative Law", "Public Enterprise Management", "Organisation Theory", "Intergovernmental Relations", "Research Methods"],
      aliases=["Public Admin."]),
    # ---------------------------------------------------------------- Science
    D("ABG", "Applied Biology", "FSC", "B.Sc.", 4, "ABG", 16, 0.55, "GEN", [
        "Cell Biology", "Plant Biology", "Animal Biology", "Ecology", "Genetics", "Entomology", "Parasitology",
        "Hydrobiology", "Plant Physiology", "Biostatistics", "Evolution", "Applied Ecology"], siwes=True,
      aliases=["Applied Bio."]),
    D("AMB", "Applied Microbiology", "FSC", "B.Sc.", 4, "AMB", 34, 0.62, "GEN", [
        "General Microbiology", "Microbial Physiology", "Food Microbiology", "Industrial Microbiology", "Microbial Genetics",
        "Medical Microbiology", "Environmental Microbiology", "Immunology", "Virology", "Mycology",
        "Petroleum Microbiology", "Pharmaceutical Microbiology"], siwes=True, aliases=["Microbiology", "Applied Micro."]),
    D("STA", "Applied Statistics", "FSC", "B.Sc.", 4, "STA", 13, 0.40, "GEN", [
        "Descriptive Statistics", "Probability", "Statistical Inference", "Regression Analysis", "Sampling Techniques",
        "Design of Experiments", "Time Series Analysis", "Multivariate Analysis", "Statistical Computing",
        "Operations Research", "Demography", "Econometric Methods"], siwes=True, aliases=["Statistics"]),
    D("BCH", "Biochemistry", "FSC", "B.Sc.", 4, "BCH", 31, 0.60, "GEN", [
        "General Biochemistry", "Enzymology", "Metabolism", "Molecular Biology", "Nutritional Biochemistry",
        "Clinical Biochemistry", "Plant Biochemistry", "Biochemical Techniques", "Toxicology", "Membrane Biochemistry",
        "Bioenergetics", "Industrial Biochemistry"], siwes=True, aliases=["Biochem."]),
    D("BTN", "Biotechnology", "FSC", "B.Sc.", 4, "BTN", 16, 0.55, "GEN", [
        "Introduction to Biotechnology", "Genetic Engineering", "Bioprocess Technology", "Plant Biotechnology",
        "Animal Biotechnology", "Bioinformatics", "Fermentation Technology", "Environmental Biotechnology",
        "Bioethics", "Tissue Culture", "Molecular Biology", "Biosafety"], siwes=True, aliases=["Biotech."]),
    D("CSC", "Computer Science", "FSC", "B.Sc.", 4, "CSC", 40, 0.35, "GEN", [
        "Computer Programming", "Discrete Structures", "Computer Architecture", "Numerical Analysis",
        "Data Communication", "Computer Networks", "Compiler Construction", "Artificial Intelligence",
        "Computer Graphics", "Information Security", "Data Warehousing and Data Mining", "Human-Computer Interaction"],
      siwes=True, aliases=["Dept. of Computer Science", "Computer Sci."],
      fixed_courses={
          100: [("CSC 101", "Introduction to Computer Science", 3), ("CSC 102", "Introduction to Computer Systems", 3)],
          200: [("CSC 204", "Database Creation and Management", 3), ("CSC 215", "Low Level Programming", 3),
                ("CSC 216", "Internet Programming", 3), ("CSC 221", "Information Technology and Internet Concepts", 2),
                ("CSC 231", "Data Structures and Algorithms", 3)],
          300: [("CSC 311", "Object Oriented Programming", 3), ("CSC 323", "Operating Systems I", 3),
                ("CSC 325", "Software Engineering", 3), ("CSC 398", "SIWES", 18)],
          400: [("CSC 498", "Research Project", 6)],
      }),
    D("GEP", "Geology and Exploration Geophysics", "FSC", "B.Sc.", 4, "GEP", 13, 0.30, "GEN", [
        "Physical Geology", "Mineralogy", "Petrology", "Structural Geology", "Stratigraphy", "Palaeontology",
        "Exploration Geophysics", "Hydrogeology", "Petroleum Geology", "Field Geology", "Geochemistry", "Mining Geology"],
      siwes=True, aliases=["Geology", "Geology & Exploration Geophysics"]),
    D("ICH", "Industrial Chemistry", "FSC", "B.Sc.", 4, "ICH", 18, 0.45, "GEN", [
        "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry", "Industrial Processes",
        "Polymer Chemistry", "Petroleum Chemistry", "Chemical Thermodynamics", "Instrumental Analysis",
        "Reaction Kinetics", "Environmental Chemistry", "Quality Control"], siwes=True, aliases=["Ind. Chemistry"]),
    D("IMA", "Industrial Mathematics", "FSC", "B.Sc.", 4, "MAT", 13, 0.35, "GEN", [
        "Real Analysis", "Linear Algebra", "Differential Equations", "Numerical Analysis", "Abstract Algebra",
        "Mathematical Methods", "Operations Research", "Complex Analysis", "Optimisation Theory",
        "Mathematical Modelling", "Vector Analysis", "Graph Theory"], siwes=True, aliases=["Industrial Maths"]),
    D("IPH", "Industrial Physics", "FSC", "B.Sc.", 4, "PHY", 13, 0.28, "GEN", [
        "Classical Mechanics", "Electromagnetism", "Quantum Physics", "Thermal Physics", "Electronics", "Optics",
        "Solid State Physics", "Nuclear Physics", "Instrumentation", "Mathematical Physics", "Renewable Energy Physics",
        "Geophysics"], siwes=True, aliases=["Ind. Physics"]),
    # ---------------------------------------------------------------- Social Sciences and Humanities
    D("ECO", "Economics", "FSSH", "B.Sc.", 4, "ECO", 34, 0.45, "GEN", [
        "Microeconomic Theory", "Macroeconomic Theory", "Mathematics for Economists", "Statistics for Economists",
        "Development Economics", "Public Finance", "Monetary Economics", "International Economics", "Econometrics",
        "Labour Economics", "Economic History", "Energy Economics"], aliases=["Econs."]),
    D("ENL", "English Language and Literature", "FSSH", "B.A.", 4, "ENL", 25, 0.70, "GEN", [
        "Introduction to Literature", "English Grammar", "African Literature", "Phonetics and Phonology",
        "The Novel", "Poetry", "Drama", "Stylistics", "Sociolinguistics", "Literary Criticism", "Semantics",
        "Creative Writing"], aliases=["English & Literature", "English Language & Literature"]),
    D("HIS", "History and International Relations", "FSSH", "B.A.", 4, "HIS", 18, 0.55, "GEN", [
        "History of Nigeria", "African History", "Historiography", "International Relations", "Foreign Policy",
        "Diplomatic History", "Economic History", "History of West Africa", "International Organisations",
        "Strategic Studies", "Conflict and Peace Studies", "Global Politics"],
      aliases=["History & International Relations", "History & Intl. Relations"]),
    D("LIN", "Languages and Linguistics", "FSSH", "B.A.", 4, "LIN", 13, 0.68, "GEN", [
        "Introduction to Linguistics", "Phonetics", "Phonology", "Morphology", "Syntax", "Semantics",
        "Igbo Language", "French Language", "Sociolinguistics", "Psycholinguistics", "Translation", "Language Planning"],
      aliases=["Linguistics", "Languages & Linguistics"]),
    D("MAC", "Mass Communication", "FSSH", "B.Sc.", 4, "MAC", 34, 0.60, "GEN", [
        "Introduction to Mass Communication", "News Writing", "Broadcast Journalism", "Public Relations", "Advertising",
        "Media Law and Ethics", "Photojournalism", "Development Communication", "Online Journalism",
        "Communication Research", "Film Studies", "Editing and Production"], siwes=True,
      aliases=["Mass Comm", "Mass Comm."]),
    D("PHL", "Philosophy", "FSSH", "B.A.", 4, "PHL", 11, 0.35, "GEN", [
        "Introduction to Philosophy", "Logic", "Ethics", "Epistemology", "Metaphysics", "African Philosophy",
        "Philosophy of Science", "Political Philosophy", "History of Philosophy", "Philosophy of Mind", "Aesthetics",
        "Philosophy of Religion"], aliases=["Philo."]),
    D("POL", "Political Science", "FSSH", "B.Sc.", 4, "POL", 31, 0.45, "GEN", [
        "Introduction to Political Science", "Nigerian Government and Politics", "Political Theory", "Comparative Politics",
        "International Politics", "Public Administration", "Political Economy", "Research Methods", "Local Government",
        "Political Behaviour", "Foreign Policy Analysis", "Electoral Studies"], aliases=["Pol. Science"]),
    D("PSY", "Psychology", "FSSH", "B.Sc.", 4, "PSY", 22, 0.65, "GEN", [
        "Introduction to Psychology", "Developmental Psychology", "Social Psychology", "Experimental Psychology",
        "Psychological Statistics", "Abnormal Psychology", "Cognitive Psychology", "Industrial Psychology",
        "Clinical Psychology", "Personality", "Psychometrics", "Health Psychology"], aliases=["Psych."]),
    D("RPS", "Religion and Peace Studies", "FSSH", "B.A.", 4, "RPS", 11, 0.45, "GEN", [
        "Introduction to Religion", "African Traditional Religion", "Old Testament Studies", "New Testament Studies",
        "Islamic Studies", "Church History", "Peace Studies", "Conflict Resolution", "Sociology of Religion",
        "Religious Ethics", "Comparative Religion", "Religion and Society"], aliases=["Religion & Peace Studies"]),
    D("SWK", "Social Work", "FSSH", "B.Sc.", 4, "SWK", 18, 0.70, "GEN", [
        "Introduction to Social Work", "Social Welfare Policy", "Casework", "Group Work", "Community Organisation",
        "Social Work Practice", "Child Welfare", "Medical Social Work", "Social Research", "Gerontology",
        "Family Welfare", "Field Practicum"], aliases=["Social Work & Social Development"]),
    D("SOC", "Sociology and Anthropology", "FSSH", "B.Sc.", 4, "SOC", 22, 0.58, "GEN", [
        "Introduction to Sociology", "Social Anthropology", "Sociological Theory", "Social Research Methods",
        "Rural Sociology", "Urban Sociology", "Sociology of the Family", "Criminology", "Medical Sociology",
        "Population Studies", "Industrial Sociology", "Social Change"], aliases=["Sociology & Anthropology", "Sociology"]),
    D("THA", "Theatre Arts", "FSSH", "B.A.", 4, "THA", 13, 0.55, "GEN", [
        "Introduction to Theatre", "Acting", "Directing", "Playwriting", "Theatre History", "Stage Design",
        "Costume and Make-up", "African Theatre", "Dance", "Film Production", "Theatre Management", "Dramatic Theory"],
      aliases=["Theatre Art", "Theatre & Film Studies"]),
]
del D

DEPARTMENT_ALIASES = {d.name: d.aliases for d in DEPARTMENTS if d.aliases}

# General studies and entrepreneurship courses taken by every programme: (code, title, units, level)
GST_COURSES = [
    ("GST 101", "Use of English I", 2, 100),
    ("GST 103", "Nigerian Peoples and Culture", 2, 100),
    ("GST 102", "Use of English II", 2, 100),
    ("GST 104", "History and Philosophy of Science", 2, 100),
    ("GST 201", "Peace and Conflict Resolution", 2, 200),
    ("GST 202", "Entrepreneurship and Innovation", 2, 200),
    ("ENT 301", "Venture Creation", 2, 300),
    ("ENT 302", "Business Development", 2, 300),
]

# 100-level courses shared by the programmes of a faculty: (code, title, units)
FACULTY_COMMON = {
    "FSC": [("MAT 101", "Algebra and Matrices", 3), ("MAT 102", "Elementary Calculus", 3),
            ("PHY 101", "General Physics I", 3), ("PHY 102", "General Physics II", 3),
            ("ICH 101", "General Chemistry I", 3), ("BIO 102", "General Biology II", 3)],
    "FENG": [("MAT 101", "Algebra and Matrices", 3), ("MAT 102", "Elementary Calculus", 3),
             ("PHY 101", "General Physics I", 3), ("PHY 102", "General Physics II", 3),
             ("ICH 101", "General Chemistry I", 3), ("GET 102", "Engineering Graphics", 2)],
    "FBMS": [("BIO 101", "General Biology I", 3), ("BIO 102", "General Biology II", 3),
             ("ICH 101", "General Chemistry I", 3), ("PHY 101", "General Physics I", 3), ("PHY 102", "General Physics II", 3)],
    "FHST": [("BIO 101", "General Biology I", 3), ("BIO 102", "General Biology II", 3),
             ("ICH 101", "General Chemistry I", 3), ("PHY 101", "General Physics I", 3), ("PHY 102", "General Physics II", 3)],
    "FARM": [("BIO 101", "General Biology I", 3), ("BIO 102", "General Biology II", 3),
             ("ICH 101", "General Chemistry I", 3), ("AGR 102", "Introduction to Agriculture", 2)],
    "FMS": [("ACC 101", "Principles of Accounting I", 3), ("ACC 102", "Principles of Accounting II", 3),
            ("ECO 101", "Principles of Economics I", 3), ("ECO 102", "Principles of Economics II", 3)],
    "FEDU": [("EDU 101", "Introduction to the Teaching Profession", 2), ("EDU 102", "History of Education in Nigeria", 2)],
    "FSSH": [("SSH 101", "Logic and Critical Thinking", 2), ("SSH 102", "Introduction to the Social Sciences", 2)],
    "FLAW": [],
}

# Five-point grading scale reported for EBSU: (lowest score, grade, grade point)
GRADE_SCALE = [(70, "A", 5), (60, "B", 4), (50, "C", 3), (45, "D", 2), (40, "E", 1), (0, "F", 0)]

# ---------------------------------------------------------------------------- fees (naira)
# Tuition is NOT published for every programme, so these are estimates by fee band,
# following the published patterns: a higher professional band, a constant premium for
# students from outside Ebonyi State, and a 10% cut announced in April 2024.
TUITION_INDIGENE = {"MED": 250_000, "HLT": 210_000, "ENG": 125_000, "GEN": 110_000, "EDA": 85_000}
NON_INDIGENE_PREMIUM = {"MED": 64_000, "HLT": 64_000, "ENG": 45_000, "GEN": 45_000, "EDA": 45_000}
TUITION_CUT = 0.10
TUITION_CUT_FROM = 2024


def school_fees(band: str, year: int, indigene: bool) -> int:
    amount = TUITION_INDIGENE[band] + (0 if indigene else NON_INDIGENE_PREMIUM[band])
    if year >= TUITION_CUT_FROM:
        amount = round(amount * (1 - TUITION_CUT) / 500) * 500
    return amount


def registration_fee(indigene: bool) -> int:
    return 12_000 if indigene else 22_000


# Official acceptance fees published on ebsu.edu.ng.
ACCEPTANCE_PROFESSIONAL = 50_050  # Medicine and Surgery, Law, Nursing Science, Medical Laboratory Science
ACCEPTANCE_OTHERS = 30_050
PROFESSIONAL_CODES = {"MBS", "LAW", "NSC", "MLS"}

# Payment behaviour (simulated). Higher = more likely to pay in full.
PAYMENT_BASE_LOGIT = {2021: 2.05, 2022: 1.85, 2023: 1.45, 2024: 1.00}
INSTALMENTS_FROM = 2023  # two-instalment payment allowed from 2023/2024

PAYMENT_CHANNELS = ["Remita (card)", "Remita (bank branch)", "Remita (USSD)", "Bank transfer"]
PAYMENT_CHANNEL_WEIGHTS = [44, 31, 9, 16]
