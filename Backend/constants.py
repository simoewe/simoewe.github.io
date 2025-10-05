"""Shared constants for the backend analysis pipeline."""

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.txt'}
MAX_PDF_PAGES = 300
MAX_WORDS_ANALYSIS = 120_000
PDF_OPTIMIZE_THRESHOLD_BYTES = 8 * 1024 * 1024  # 8 MB
PDF_PDFMINER_MAX_BYTES = 4 * 1024 * 1024  # Don't send very large PDFs to pdfminer
PDF_PDFMINER_MAX_PAGES = 80

DEFAULT_TREND_KEYWORDS = [
    "Artificial Intelligence",
    "AI",
    "Machine Learning",
    "Blockchain",
    "Internet of Things",
    "IoT",
    "Digital Twin",
    "5G",
    "Robotics",
    "Autonomous Systems",
    "Automation",
    "Virtual Reality",
    "Augmented Reality",
    "Cloud Computing",
    "Edge Computing",
    "Fog Computing",
    "Big Data Analytics"
]

TREND_TERMS = [
    "Artificial Intelligence",
    "Blockchain",
    "Big Data Analytics",
    "Internet of Things",
    "Digital Twin",
    "5G Network",
    "Robotics",
    "Autonomous Systems",
    "Virtual Reality",
    "Augmented Reality",
    "Cloud Computing",
    "Edge Computing",
    "Fog Computing"
]

TREND_STATUS_PATTERNS = {
    'using': [
        r'\buse(s|d|ing)?\b',
        r'\butili[sz](e|es|ed|ing)\b',
        r'\bdeploy(ed|ing|s)?\b',
        r'\bimplement(ed|ing|s)?\b',
        r'\bin operation\b',
        r'\bproduction use\b',
        r'\broll(ed|ing) out\b',
        r'\bnutzt\b',
        r'\bverwendet\b',
        r'\beingesetzt\b',
        r'im einsatz',
        r'\bsetzt\b.*ein',
        r'\barbeitet mit\b',
        r'\bbetreibt\b',
        r'\boperationell\b'
    ],
    'evaluating': [
        r'\bevaluat(e|es|ed|ing)\b',
        r'\basses(s|ses|sed|sing)\b',
        r'\bpilot(s|ed|ing)?\b',
        r'\btest(et|et|ing)?\b',
        r'\bexplor(es|ed|ing)?\b',
        r'\bconsider(s|ed|ing)?\b',
        r'\bplan(s|ned|ning)?\b',
        r'\bplant\b',
        r'\bgeplant\b',
        r'\bpruft\b',
        r'\bprueft\b',
        r'\bbewertet\b',
        r'\bvorbereitet\b',
        r'\bscoping\b',
        r'\bevaluierung\b'
    ],
    'discontinued': [
        r'\bno longer\b',
        r'\bstopp(ed|ing|s)?\b',
        r'\bdiscontinu',
        r'\bnicht mehr\b',
        r'\babgeschafft\b',
        r'\baufgegeben\b',
        r'\bbeendet\b',
        r'\bverzichtet\b',
        r'\babgelost\b',
        r'\bstellt\b.*ein',
        r'\bstellte\b.*ein'
    ]
}

TREND_STATUS_ORDER = ['using', 'evaluating', 'discontinued', 'unspecified']

STRIP_CHARS = ".,!?:()[]'\""
