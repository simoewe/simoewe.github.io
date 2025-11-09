"""High-level document analysis service."""

import base64
import io
import logging
from collections import Counter

import matplotlib.pyplot as plt
import re
from textblob import TextBlob
from wordcloud import WordCloud

try:
    from .constants import (
        DEFAULT_TREND_KEYWORDS,
        STRIP_CHARS,
        get_max_words_analysis,
    )
    from .keyword_utils import build_snippet, compile_keyword_pattern, tokenize_keyword
    from .trend_analysis import analyze_trends
    from .sampling_utils import select_evenly_spaced_indices
except ImportError:  # Fallback when modules are imported without package context
    from constants import (
        DEFAULT_TREND_KEYWORDS,
        STRIP_CHARS,
        get_max_words_analysis,
    )
    from keyword_utils import build_snippet, compile_keyword_pattern, tokenize_keyword
    from trend_analysis import analyze_trends
    from sampling_utils import select_evenly_spaced_indices


_WORD_LIMIT_SENTINEL = object()
SENTIMENT_CHAR_LIMIT = 20000
REGEX_CHUNK_SIZE = 250_000
REGEX_CHUNK_OVERLAP = 1_000
WORDCLOUD_MAX_TERMS = 400
WORDCLOUD_MAX_WORDS = 180_000


def build_keyword_specs(user_keywords):
    keyword_candidates = user_keywords + DEFAULT_TREND_KEYWORDS
    keyword_specs = []
    seen_keyword_tokens = set()

    for candidate in keyword_candidates:
        label = candidate.strip()
        tokens = tokenize_keyword(label)
        if not tokens:
            continue
        token_key = tuple(tokens)
        if token_key in seen_keyword_tokens:
            continue
        seen_keyword_tokens.add(token_key)
        keyword_specs.append({
            'label': label,
            'tokens': tokens
        })

    return keyword_specs


def tokenize_lower_text(lower_text):
    return [
        token
        for token in (
            word.strip(STRIP_CHARS)
            for word in lower_text.split()
        )
        if token
    ]


def truncate_text_basic(text, word_limit):
    if word_limit is None or word_limit <= 0:
        return text
    tokens = text.split()
    if len(tokens) <= word_limit:
        return text
    return " ".join(tokens[:word_limit])


def reduce_text_to_word_limit(text, metadata, word_limit, original_word_count):
    """
    Reduce the amount of text that flows into the analysis while keeping coverage across the document.
    """
    if not text or word_limit is None or word_limit <= 0:
        return text, []

    pages = (metadata or {}).get('pages') or []
    if not pages:
        return truncate_text_basic(text, word_limit), []

    page_count = len(pages)
    if page_count == 0:
        return truncate_text_basic(text, word_limit), []

    avg_words_per_page = max(1, original_word_count // max(page_count, 1))
    target_pages = max(1, min(page_count, (word_limit // avg_words_per_page) + 2))
    candidate_indices = select_evenly_spaced_indices(page_count, target_pages)
    used_indices = set()
    sampled_page_numbers = []
    remaining_words = word_limit
    segments = []

    def add_page_segment(page_index):
        nonlocal remaining_words
        if remaining_words <= 0 or page_index in used_indices:
            return
        if page_index < 0 or page_index >= page_count:
            return
        used_indices.add(page_index)
        page_entry = pages[page_index] or {}
        start = max(0, page_entry.get('start', 0))
        end = max(start, page_entry.get('end', start))
        segment = text[start:end].strip()
        if not segment:
            return
        words_in_segment = segment.split()
        if not words_in_segment:
            return

        if len(words_in_segment) > remaining_words:
            trimmed_segment = " ".join(words_in_segment[:remaining_words])
            segments.append(trimmed_segment)
            remaining_words = 0
        else:
            segments.append(segment)
            remaining_words -= len(words_in_segment)
        page_number = page_entry.get('number')
        if page_number is not None:
            sampled_page_numbers.append(page_number)

    for idx in candidate_indices:
        add_page_segment(idx)
        if remaining_words <= 0:
            break

    if remaining_words > 0:
        for idx in range(page_count):
            if remaining_words <= 0:
                break
            add_page_segment(idx)

    if not segments:
        return truncate_text_basic(text, word_limit), []

    compact_text = "\n\n".join(segments).strip()
    if not compact_text:
        return truncate_text_basic(text, word_limit), sampled_page_numbers
    return compact_text, sampled_page_numbers


def prepare_text_for_analysis(text, metadata, word_limit):
    base_text = text or ""
    lower_text_full = base_text.lower()
    words_full = tokenize_lower_text(lower_text_full)
    original_word_count = len(words_full)
    processed_text = base_text
    processed_lower = lower_text_full
    processed_words = words_full
    sampled_pages = []
    truncated = False

    if word_limit is not None and word_limit > 0 and original_word_count > word_limit:
        truncated_text, sampled_pages = reduce_text_to_word_limit(
            base_text,
            metadata,
            word_limit,
            original_word_count
        )
        processed_text = truncated_text
        processed_lower = processed_text.lower()
        processed_words = tokenize_lower_text(processed_lower)
        truncated = True
        logging.info(
            "Applied word budget: reduced from %s to %s words (limit %s)",
            original_word_count,
            len(processed_words),
            word_limit
        )

    budget_info = {
        "limit": word_limit,
        "original_word_count": original_word_count,
        "processed_word_count": len(processed_words),
        "truncated": truncated,
        "sampled_pages": sampled_pages,
        "mode": "disabled" if word_limit is None or (isinstance(word_limit, int) and word_limit <= 0) else "limited"
    }

    return processed_text, processed_lower, processed_words, budget_info


def generate_wordcloud(freq):
    nonzero_freq = {k: v for k, v in freq.items() if v > 0}
    if not nonzero_freq:
        return None

    wc = WordCloud(width=800, height=400, background_color='white')
    wc.generate_from_frequencies(nonzero_freq)
    img_io = io.BytesIO()
    plt.figure(figsize=(10, 5))
    plt.imshow(wc, interpolation='bilinear')
    plt.axis('off')
    plt.tight_layout(pad=0)
    plt.savefig(img_io, format='PNG')
    plt.close()
    img_io.seek(0)
    img_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{img_base64}"


def iter_pattern_matches(pattern, text, chunk_size=REGEX_CHUNK_SIZE, overlap=REGEX_CHUNK_OVERLAP):
    """
    Yield (start, end, group_name) offsets for regex matches while scanning the text in chunks.
    """
    if not pattern or not text:
        return

    text_length = len(text)
    if text_length <= chunk_size:
        for match in pattern.finditer(text):
            yield match.start(), match.end(), match.lastgroup
        return

    start = 0
    safe_overlap = max(0, overlap)
    while start < text_length:
        end = min(text_length, start + chunk_size)
        chunk = text[start:end]
        for match in pattern.finditer(chunk):
            yield start + match.start(), start + match.end(), match.lastgroup
        if end >= text_length:
            break
        start = max(0, end - safe_overlap)


def build_combined_keyword_regex(keyword_specs):
    """
    Build a single regex that matches all keywords at once.
    Returns (pattern, group_name->label map).
    """
    parts = []
    group_to_label = {}
    for idx, spec in enumerate(keyword_specs):
        tokens = spec['tokens']
        if not tokens:
            continue
        pattern = compile_keyword_pattern(tokens)
        if not pattern:
            continue
        group_name = f"kw{idx}"
        parts.append(f"(?P<{group_name}>{pattern.pattern})")
        group_to_label[group_name] = spec['label']

    if not parts:
        return None, {}

    combined = "|".join(parts)
    return re.compile(combined, re.IGNORECASE), group_to_label


def analyze_sentiment_safe(text):
    """
    Run TextBlob sentiment analysis on a bounded slice to avoid OOM on very large documents.
    """
    if not text:
        return {'polarity': 0.0, 'subjectivity': 0.0}, {'sampled': False, 'maxChars': SENTIMENT_CHAR_LIMIT}

    sample_text = text
    sampled = False
    if SENTIMENT_CHAR_LIMIT and len(text) > SENTIMENT_CHAR_LIMIT:
        sample_text = text[:SENTIMENT_CHAR_LIMIT]
        sampled = True

    try:
        blob = TextBlob(sample_text)
        sentiment = {
            'polarity': blob.sentiment.polarity,
            'subjectivity': blob.sentiment.subjectivity
        }
        return sentiment, {
            'sampled': sampled,
            'maxChars': SENTIMENT_CHAR_LIMIT
        }
    except Exception as exc:
        logging.warning("Sentiment analysis failed: %s", exc)
        return {'polarity': 0.0, 'subjectivity': 0.0}, {
            'sampled': sampled,
            'maxChars': SENTIMENT_CHAR_LIMIT,
            'error': str(exc)
        }


def analyze_document(text, user_keywords, text_metadata=None, word_limit_override=_WORD_LIMIT_SENTINEL):
    if word_limit_override is _WORD_LIMIT_SENTINEL:
        word_limit = get_max_words_analysis()
    else:
        word_limit = word_limit_override
    processed_text, text_lower, words, budget_info = prepare_text_for_analysis(
        text,
        text_metadata,
        word_limit
    )
    total_words = len(words)

    keyword_specs = build_keyword_specs(user_keywords)

    token_index = {}

    def add_token(token, index):
        if not token:
            return
        token_index.setdefault(token, []).append(index)

    for idx, word in enumerate(words):
        tokens = {word}
        for part in re.split(r'[-_/\s]+', word):
            part = part.strip()
            if part:
                tokens.add(part)
        for token in tokens:
            add_token(token, idx)

    word_pattern = re.compile(r'\b\w[\w\-_/]*\b')
    word_spans = list(word_pattern.finditer(processed_text))

    freq = {spec['label']: 0 for spec in keyword_specs}
    kwic_results = {spec['label']: [] for spec in keyword_specs}
    collocations = {}
    window = 20

    page_map = []
    if text_metadata and isinstance(text_metadata, dict):
        pages = text_metadata.get('pages') or []
        if isinstance(pages, list):
            page_map = [
                {
                    'number': page.get('number'),
                    'start': page.get('start', 0),
                    'end': page.get('end', 0)
                }
                for page in pages
                if page and 'number' in page
            ]

    def find_page_for_offset(offset):
        if not page_map:
            return None
        for page in page_map:
            start = page.get('start', 0)
            end = page.get('end', start)
            if start <= offset < end:
                return page.get('number')
        # If offset is at or beyond the last recorded end, assume last page
        return page_map[-1].get('number')

    combined_pattern, group_to_label = build_combined_keyword_regex(keyword_specs)

    def record_match(label, match_start, match_end):
        if label not in freq:
            return
        freq[label] += 1
        contexts = kwic_results[label]
        if len(contexts) >= 5:
            return
        snippet = build_snippet(processed_text, match_start, match_end, word_spans, window=window)
        if not snippet:
            return
        contexts.append({
            'snippet': snippet,
            'page': find_page_for_offset(match_start),
            'start': match_start,
            'end': match_end,
            'match_text': processed_text[match_start:match_end].strip()
        })

    if combined_pattern:
        for match_start, match_end, group_name in iter_pattern_matches(combined_pattern, text_lower):
            label = group_to_label.get(group_name)
            if label:
                record_match(label, match_start, match_end)
    else:
        for spec in keyword_specs:
            label = spec['label']
            pattern = compile_keyword_pattern(spec['tokens'])
            if not pattern:
                continue
            for match_start, match_end, _ in iter_pattern_matches(pattern, text_lower):
                record_match(label, match_start, match_end)

    for spec in keyword_specs:
        label = spec['label']
        tokens = spec['tokens']
        if len(tokens) == 1:
            token = tokens[0]
            indices = token_index.get(token, [])
            left_neighbors, right_neighbors = [], []
            for i in indices:
                if i > 0:
                    left_neighbors.append(words[i - 1])
                if i < len(words) - 1:
                    right_neighbors.append(words[i + 1])
            collocations[label] = {
                "left": Counter(left_neighbors).most_common(3),
                "right": Counter(right_neighbors).most_common(3)
            }
        else:
            collocations[label] = {"left": [], "right": []}

    density = {
        label: round((freq[label] / total_words) * 100, 2) if total_words > 0 else 0
        for label in freq
    }

    sentiment, sentiment_sampling = analyze_sentiment_safe(processed_text)

    sentences = re.split(r'(?<=[.!?])\s+', processed_text)
    num_sentences = len([s for s in sentences if s.strip()])
    num_syllables = sum(len(w) // 3 for w in words)
    asl = total_words / max(1, num_sentences)
    asw = num_syllables / max(1, total_words)
    flesch_score = round(206.835 - 1.015 * asl - 84.6 * asw, 2)

    readability = {
        'flesch_reading_ease': flesch_score,
        'total_words': total_words,
        'total_sentences': num_sentences
    }

    trend_results, trend_insights = analyze_trends(sentences)

    nonzero_terms = sum(1 for value in freq.values() if value > 0)
    can_render_wordcloud = (
        nonzero_terms > 0
        and nonzero_terms <= WORDCLOUD_MAX_TERMS
        and budget_info.get('processed_word_count', 0) <= WORDCLOUD_MAX_WORDS
    )
    wordcloud_image = generate_wordcloud(freq) if can_render_wordcloud else None
    if not can_render_wordcloud and nonzero_terms > 0:
        logging.info(
            "Skipping word cloud generation (terms=%s, processed_words=%s)",
            nonzero_terms,
            budget_info.get('processed_word_count')
        )

    page_selection_meta = (text_metadata or {}).get('page_selection') if text_metadata else None
    page_sampling_summary = None
    if isinstance(page_selection_meta, dict) and page_selection_meta:
        page_sampling_summary = {
            'totalPages': page_selection_meta.get('total_pages'),
            'processedPages': page_selection_meta.get('processed_pages'),
            'limit': page_selection_meta.get('limit'),
            'sampled': page_selection_meta.get('sampled'),
            'strategy': page_selection_meta.get('strategy'),
            'reason': page_selection_meta.get('reason')
        }

    sampled_pages = budget_info.get('sampled_pages') or []
    max_sampled_pages = sampled_pages[:50] if isinstance(sampled_pages, list) else []
    processing_summary = {
        'wordBudget': {
            'limit': budget_info.get('limit'),
            'originalWords': budget_info.get('original_word_count'),
            'processedWords': budget_info.get('processed_word_count'),
            'truncated': budget_info.get('truncated'),
            'sampledPages': max_sampled_pages,
            'mode': budget_info.get('mode')
        },
        'pageSampling': page_sampling_summary,
        'sentimentSampling': sentiment_sampling
    }

    analysis_payload = {
        'frequencies': freq,
        'densities': density,
        'kwic': kwic_results,
        'collocations': collocations,
        'sentiment': sentiment,
        'readability': readability,
        'trends': trend_results,
        'trendInsights': trend_insights,
        'processingSummary': processing_summary
    }

    return analysis_payload, wordcloud_image, total_words
