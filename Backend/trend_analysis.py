"""Trend-specific analysis utilities."""

from collections import Counter
import re
import unicodedata

try:
    from .constants import TREND_STATUS_ORDER, TREND_STATUS_PATTERNS, TREND_TERMS
except ImportError:
    from constants import TREND_STATUS_ORDER, TREND_STATUS_PATTERNS, TREND_TERMS


def normalize_to_ascii(text):
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')


def classify_trend_status(sentence):
    lowered = sentence.lower()
    normalized = normalize_to_ascii(lowered)
    candidates = {lowered, normalized}

    for status, patterns in TREND_STATUS_PATTERNS.items():
        for pattern in patterns:
            for candidate in candidates:
                if re.search(pattern, candidate):
                    return status
    return 'unspecified'


def build_trend_summary(trend, status_counts):
    using = status_counts.get('using', 0)
    evaluating = status_counts.get('evaluating', 0)
    discontinued = status_counts.get('discontinued', 0)

    def ref_label(count):
        return 'reference' if count == 1 else 'references'

    if discontinued and discontinued > max(using, evaluating):
        return (
            f"The company no longer uses {trend} "
            f"({discontinued} {ref_label(discontinued)})."
        )

    summary_parts = []
    if using:
        summary_parts.append(
            f"actively uses {trend} ({using} {ref_label(using)})"
        )
    if evaluating:
        summary_parts.append(
            f"is evaluating or planning {trend} "
            f"({evaluating} {ref_label(evaluating)})"
        )

    if not summary_parts:
        return f"{trend} is mentioned without a clear usage statement."

    if len(summary_parts) == 1:
        joined = summary_parts[0]
    else:
        joined = ", ".join(summary_parts[:-1]) + " and " + summary_parts[-1]

    return f"The company {joined}."


def analyze_trends(sentences):
    trend_results = []
    trend_insights = []

    for trend in TREND_TERMS:
        trend_lower = trend.lower()
        mentions = []
        for sentence in sentences:
            if trend_lower in sentence.lower():
                status = classify_trend_status(sentence)
                mentions.append({
                    'sentence': sentence.strip(),
                    'status': status
                })

        if not mentions:
            continue

        status_counts = Counter(m['status'] for m in mentions)
        status_counts_full = {
            status: status_counts.get(status, 0)
            for status in TREND_STATUS_ORDER
        }
        summary = build_trend_summary(trend, status_counts_full)

        trend_results.append({
            'trend': trend,
            'count': len(mentions),
            'contexts': [m['sentence'] for m in mentions[:3]],
            'status_counts': status_counts_full,
            'summary': summary
        })

        trend_insights.append({
            'trend': trend,
            'summary': summary,
            'total_mentions': len(mentions),
            'status_counts': status_counts_full,
            'evidence': mentions[:5]
        })

    return trend_results, trend_insights
