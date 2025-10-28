"""High-level document analysis service."""

import base64
import io
import logging
from collections import Counter

import matplotlib.pyplot as plt
from textblob import TextBlob
from wordcloud import WordCloud
import re

try:
    from .constants import (
        DEFAULT_TREND_KEYWORDS,
        MAX_WORDS_ANALYSIS,
    )
    from .keyword_utils import build_snippet, compile_keyword_pattern, tokenize_keyword
    from .trend_analysis import analyze_trends
except ImportError:  # Fallback when modules are imported without package context
    from constants import (
        DEFAULT_TREND_KEYWORDS,
        MAX_WORDS_ANALYSIS,
    )
    from keyword_utils import build_snippet, compile_keyword_pattern, tokenize_keyword
    from trend_analysis import analyze_trends


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


def analyze_document(text, user_keywords, text_metadata=None):
    text_lower = text.lower()
    words = [w.strip(".,!?;:()[]") for w in text_lower.split() if w.strip(".,!?;:()[]")]
    total_words = len(words)

    word_limit = MAX_WORDS_ANALYSIS
    if word_limit is not None and total_words > word_limit:
        logging.info(f"Document rejected due to length: {total_words} words")
        raise ValueError(
            f'Document too large (limit {word_limit:,} words). '
            'Please choose a shorter file.'
        )

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
    word_spans = list(word_pattern.finditer(text))

    freq = {}
    kwic_results = {}
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

    for spec in keyword_specs:
        label = spec['label']
        tokens = spec['tokens']
        pattern = compile_keyword_pattern(tokens)
        matches = list(pattern.finditer(text_lower)) if pattern else []

        freq[label] = len(matches)

        contexts = []
        for match in matches:
            snippet = build_snippet(text, match.start(), match.end(), word_spans, window=window)
            if snippet:
                contexts.append({
                    'snippet': snippet,
                    'page': find_page_for_offset(match.start()),
                    'start': match.start(),
                    'end': match.end(),
                    'match_text': text[match.start():match.end()].strip()
                })
            if len(contexts) >= 5:
                break
        kwic_results[label] = contexts

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

    blob = TextBlob(text)
    sentiment = {
        'polarity': blob.sentiment.polarity,
        'subjectivity': blob.sentiment.subjectivity
    }

    sentences = re.split(r'(?<=[.!?])\s+', text)
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

    wordcloud_image = generate_wordcloud(freq)

    analysis_payload = {
        'frequencies': freq,
        'densities': density,
        'kwic': kwic_results,
        'collocations': collocations,
        'sentiment': sentiment,
        'readability': readability,
        'trends': trend_results,
        'trendInsights': trend_insights
    }

    return analysis_payload, wordcloud_image, total_words
