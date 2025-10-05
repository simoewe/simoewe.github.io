"""Utilities for working with keywords in the analysis pipeline."""

import re

try:
    from .constants import STRIP_CHARS
except ImportError:
    from constants import STRIP_CHARS


def tokenize_keyword(keyword):
    return [
        part.strip(STRIP_CHARS)
        for part in re.split(r'[-_/\s]+', keyword.lower())
        if part.strip(STRIP_CHARS)
    ]


def compile_keyword_pattern(tokens):
    if not tokens:
        return None
    separator = r'(?:\s+|[-_/]+)'
    pattern = r'(?<!\w)' + separator.join(re.escape(token) for token in tokens) + r'(?!\w)'
    return re.compile(pattern, re.IGNORECASE)


def build_snippet(text, start, end, word_spans, window=5):
    def index_at_or_after(position):
        for idx, match in enumerate(word_spans):
            if match.start() <= position < match.end():
                return idx
            if match.start() > position:
                return idx
        return len(word_spans)

    start_idx = index_at_or_after(start)
    end_idx = index_at_or_after(end)

    left_start = max(0, start_idx - window)
    left_words = [m.group(0) for m in word_spans[left_start:start_idx]]
    right_words = [m.group(0) for m in word_spans[end_idx:end_idx + window]]

    keyword_text = text[start:end].strip()
    snippet_parts = []
    if left_words:
        snippet_parts.append(" ".join(left_words))
    if keyword_text:
        snippet_parts.append(keyword_text)
    if right_words:
        snippet_parts.append(" ".join(right_words))

    snippet = " ".join(snippet_parts).strip()
    snippet = re.sub(r'\s+', ' ', snippet)
    return f"... {snippet} ..." if snippet else ""
