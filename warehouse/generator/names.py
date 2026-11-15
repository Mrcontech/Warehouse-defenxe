"""
Name pools for the simulated students. EVERY NAME IS DRAWN AT RANDOM: no combination
describes a real person. Pools follow the main language groups of each state of origin,
weighted so that most students come from Ebonyi State, as at a state university in
Abakaliki.
"""

# (state of origin, weight in per cent, name pool)
STATES = [
    ("Ebonyi", 72.0, "igbo_ebonyi"),
    ("Enugu", 5.4, "igbo"),
    ("Anambra", 3.6, "igbo"),
    ("Abia", 3.4, "igbo"),
    ("Imo", 3.2, "igbo"),
    ("Cross River", 3.0, "efik_ibibio"),
    ("Benue", 1.6, "tiv_idoma"),
    ("Akwa Ibom", 1.2, "efik_ibibio"),
    ("Kogi", 1.0, "igala"),
    ("Delta", 0.9, "south_south"),
    ("Rivers", 0.8, "south_south"),
    ("Edo", 0.6, "south_south"),
    ("Lagos", 0.6, "yoruba"),
    ("Oyo", 0.4, "yoruba"),
    ("Ogun", 0.3, "yoruba"),
    ("Plateau", 0.3, "tiv_idoma"),
    ("Kaduna", 0.3, "hausa"),
    ("Kano", 0.2, "hausa"),
    ("FCT", 0.3, "igbo"),
]

POOLS = {
    "igbo_ebonyi": {
        "surnames": [
            "Nwali", "Nweke", "Nwankwo", "Nwigwe", "Nwankwegu", "Oko", "Okoro", "Igwe", "Ogbu", "Ali",
            "Agwu", "Elom", "Eze", "Chukwu", "Nwafor", "Nwuzor", "Nwobasi", "Nwokpoku", "Ugwu", "Ude",
            "Odoh", "Mbam", "Ezeani", "Nwaeze", "Aleke", "Nwibo", "Onwe", "Uguru", "Idika", "Edeh",
            "Nwachi", "Nwaogbe", "Nwoke", "Nwode", "Nwogha", "Ogbonnaya", "Nwakpu", "Egwu", "Nwangele",
            "Okpata", "Nwamaka", "Nwuruku", "Orji", "Nwosu", "Agbo", "Nwekpa", "Ekuma", "Oti", "Nwele",
        ],
        "male": [
            "Chinedu", "Chukwuemeka", "Ikenna", "Obinna", "Emeka", "Chidi", "Uchenna", "Nnamdi", "Kelechi",
            "Ifeanyi", "Chibuike", "Somtochukwu", "Ebuka", "Tochukwu", "Onyekachi", "Chijioke", "Arinze",
            "Ugochukwu", "Kenechukwu", "Okechukwu", "Nonso", "Ikechukwu", "Chinonso", "Ekene", "Nwabueze",
            "Oluchukwu", "Chimezie", "Azubuike", "Ogbonna", "Nnaemeka",
        ],
        "female": [
            "Chiamaka", "Ngozi", "Adaeze", "Chinwe", "Nneka", "Ifeoma", "Uchechi", "Ogechi", "Chioma",
            "Amarachi", "Ebere", "Nkechi", "Chisom", "Nwamaka", "Ijeoma", "Onyinye", "Ugochi", "Chinyere",
            "Kosisochukwu", "Ozioma", "Chidinma", "Obioma", "Ifunanya", "Amaka", "Nkiruka", "Ogochukwu",
            "Uloma", "Oluchi", "Chinenye", "Somadina",
        ],
    },
    "igbo": {
        "surnames": [
            "Okafor", "Okonkwo", "Eze", "Nwosu", "Obi", "Chukwu", "Ezenwa", "Okeke", "Onyeka", "Ibe",
            "Onu", "Uzor", "Anyanwu", "Nwachukwu", "Ejiofor", "Okoye", "Agu", "Obiora", "Ezeh", "Ike",
            "Nwankwo", "Udeh", "Okolo", "Anozie", "Iwu", "Nwaigwe", "Ugwuanyi", "Asogwa", "Ezeugwu", "Onah",
        ],
        "male": [
            "Chinedu", "Chukwuemeka", "Ikenna", "Obinna", "Emeka", "Chidi", "Uchenna", "Nnamdi", "Kelechi",
            "Ifeanyi", "Chibuike", "Tochukwu", "Chijioke", "Arinze", "Ugochukwu", "Okechukwu", "Ikechukwu",
            "Chinonso", "Ekene", "Chukwudi",
        ],
        "female": [
            "Chiamaka", "Ngozi", "Adaeze", "Chinwe", "Nneka", "Ifeoma", "Uchechi", "Ogechi", "Chioma",
            "Amarachi", "Ebere", "Nkechi", "Chisom", "Ijeoma", "Onyinye", "Chinyere", "Chidinma", "Ifunanya",
            "Adanna", "Obiageli",
        ],
    },
    "yoruba": {
        "surnames": [
            "Adeyemi", "Ogunleye", "Afolabi", "Balogun", "Oladipo", "Adebayo", "Ogunbiyi", "Akinola", "Olawale",
            "Adewale", "Ojo", "Oyelaran", "Adeniran", "Ogundipe", "Ayodele", "Olaniyan", "Akande", "Oyewole",
        ],
        "male": ["Oluwaseun", "Tunde", "Ayodeji", "Femi", "Kunle", "Segun", "Tobi", "Olumide", "Babatunde", "Damilare"],
        "female": ["Folake", "Funmilayo", "Bisola", "Yetunde", "Temitope", "Adunni", "Morenike", "Titilayo", "Damilola", "Omolara"],
    },
    "hausa": {
        "surnames": ["Abubakar", "Bello", "Ibrahim", "Musa", "Sani", "Usman", "Yusuf", "Garba", "Lawal", "Danjuma", "Aliyu", "Shehu"],
        "male": ["Abdullahi", "Aminu", "Ibrahim", "Musa", "Sani", "Umar", "Yusuf", "Haruna", "Bashir", "Kabiru"],
        "female": ["Aisha", "Fatima", "Hauwa", "Zainab", "Maryam", "Hadiza", "Amina", "Halima", "Rukayya", "Safiya"],
    },
    "efik_ibibio": {
        "surnames": ["Bassey", "Effiong", "Okon", "Ekpo", "Etim", "Udo", "Edet", "Inyang", "Archibong", "Asuquo", "Umoh", "Essien"],
        "male": ["Ekpenyong", "Effiong", "Okon", "Ubong", "Aniekan", "Nsikak", "Itoro", "Akpan", "Utibe", "Edidiong"],
        "female": ["Ekaette", "Arit", "Uduak", "Mfon", "Imaobong", "Idara", "Emem", "Nkoyo", "Ima", "Enobong"],
    },
    "tiv_idoma": {
        "surnames": ["Agber", "Iorliam", "Ortese", "Akaa", "Ochigbo", "Adah", "Agbo", "Onoja", "Tyokase", "Ogwuche", "Akpen", "Okpe"],
        "male": ["Terver", "Tersoo", "Aondona", "Msughter", "Ojonugwa", "Sesugh", "Iorwuese", "Ochai", "Ekoja", "Torkuma"],
        "female": ["Mwuese", "Doosuur", "Ochanya", "Ene", "Ngodoo", "Nguveren", "Ojoma", "Ladi", "Mlumun", "Agbenu"],
    },
    "igala": {
        "surnames": ["Abah", "Attah", "Idakwo", "Ocheja", "Egwu", "Ajibo", "Ameh", "Onuche", "Achimugu", "Ekele"],
        "male": ["Ojonugwa", "Ojochide", "Ameh", "Ojonimi", "Ugbede", "Agbo", "Inikpi", "Abuh", "Ocholi", "Ichaba"],
        "female": ["Ojonoka", "Ufedo", "Enefola", "Ojochogwu", "Ojoma", "Ehi", "Ugbedeojo", "Adama", "Ojochenemi", "Ehiojo"],
    },
    "south_south": {
        "surnames": ["Ighodaro", "Omoregie", "Osagie", "Briggs", "Amadi", "Ikpe", "Ejiro", "Tamuno", "Ebiye", "Okotie", "Edewor", "Igbinedion"],
        "male": ["Osaze", "Efosa", "Tamunosiki", "Ejiro", "Oghenekaro", "Ese", "Osagie", "Ebiere", "Tonye", "Ovie"],
        "female": ["Oghenetega", "Ejiroghene", "Ivie", "Osasere", "Ibiere", "Tamaraebi", "Ese", "Ebiwari", "Efe", "Omonigho"],
    },
}

ENGLISH_MALE = [
    "David", "Michael", "Emmanuel", "Daniel", "Samuel", "Joseph", "Victor", "Paul", "John", "Peter",
    "Stephen", "Anthony", "Francis", "Kingsley", "Godwin", "Benjamin", "Collins", "Stanley", "Henry", "Charles",
]
ENGLISH_FEMALE = [
    "Mary", "Grace", "Blessing", "Joy", "Mercy", "Esther", "Faith", "Gloria", "Precious", "Juliet",
    "Patience", "Rita", "Ruth", "Deborah", "Favour", "Vivian", "Lilian", "Peace", "Gift", "Comfort",
]

# Share of first or middle names drawn from the English list, by pool.
ENGLISH_SHARE = {
    "igbo_ebonyi": 0.35, "igbo": 0.35, "yoruba": 0.2, "hausa": 0.05,
    "efik_ibibio": 0.35, "tiv_idoma": 0.3, "igala": 0.3, "south_south": 0.35,
}
