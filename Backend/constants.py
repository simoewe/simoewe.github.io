"""Shared constants for the backend analysis pipeline."""

import os


def _get_int_env(name, default):
    """
    Read an integer limit from the environment.

    Returns the default when the variable is missing or invalid.
    Returns None (disabling the guard) when the variable is set to
    <= 0 or to a semantic "no limit" marker.
    """
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default

    value = raw_value.strip()
    if not value:
        return default

    lowered = value.lower()
    if lowered in {"none", "null", "nolimit", "no_limit", "unlimited"}:
        return None

    try:
        parsed = int(value.replace("_", "").replace(",", ""))
    except ValueError:
        return default

    return parsed if parsed > 0 else None


ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.txt'}
MAX_PDF_PAGES = _get_int_env('MAX_PDF_PAGES', 500)
_DEFAULT_MAX_WORDS_ANALYSIS = _get_int_env('MAX_WORDS_ANALYSIS', 120_000)
_current_word_limit = _DEFAULT_MAX_WORDS_ANALYSIS


def get_max_words_analysis():
    """Return the currently configured max-word limit (None disables the guard)."""
    return _current_word_limit


def get_default_max_words_analysis():
    """Expose the startup default to allow clients to restore it."""
    return _DEFAULT_MAX_WORDS_ANALYSIS


def set_max_words_analysis(limit):
    """
    Update the runtime word limit.

    Accepts None to disable the guard or any positive integer.
    """
    global _current_word_limit
    if limit is None:
        _current_word_limit = None
        return

    try:
        parsed = int(str(limit).replace("_", "").replace(",", ""))
    except (TypeError, ValueError):
        raise ValueError("Word limit must be an integer or null") from None

    if parsed <= 0:
        _current_word_limit = None
        return

    _current_word_limit = parsed


# Preserve legacy name for modules that still import the constant directly.
MAX_WORDS_ANALYSIS = get_max_words_analysis()
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
    "Big Data Analytics",
    "Data-Analysis",
    "Data Analytics",
    "Advanced Data Analytics"
]

TREND_TERMS = [
    "Artificial Intelligence",
    "Blockchain",
    "Big Data Analytics",
    "Data-Analysis",
    "Data Analytics",
    "Advanced Data Analytics",
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
