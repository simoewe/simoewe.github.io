"""Trend-specific analysis utilities."""

from collections import Counter
import re
import unicodedata

from .constants import TREND_STATUS_ORDER, TREND_STATUS_PATTERNS, TREND_TERMS


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

    if discontinued and discontinued > max(using, evaluating):
        suffix = 'Hinweis' if discontinued == 1 else 'Hinweise'
        return f"Das Unternehmen setzt {trend} nicht mehr ein ({discontinued} {suffix})."

    summary_parts = []
    if using:
        suffix = 'Hinweis' if using == 1 else 'Hinweise'
        summary_parts.append(f"nutzt {trend} ({using} {suffix})")
    if evaluating:
        suffix = 'Hinweis' if evaluating == 1 else 'Hinweise'
        summary_parts.append(f"bewertet oder plant {trend} ({evaluating} {suffix})")

    if not summary_parts:
        return f"{trend} wird erwähnt, ohne klare Aussage zur Nutzung."

    if len(summary_parts) == 1:
        joined = summary_parts[0]
    else:
        joined = ", ".join(summary_parts[:-1]) + " und " + summary_parts[-1]

    return f"Das Unternehmen {joined}."


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
