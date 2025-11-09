"""Utility helpers for sampling large documents without loading everything."""

from typing import List


def select_evenly_spaced_indices(total_count: int, target_count: int) -> List[int]:
    """
    Return sorted indices that are spread across the total range.

    Ensures the first and last positions are included (where possible) and that
    the list is strictly increasing to avoid duplicate processing.
    """
    if total_count <= 0:
        return []
    if target_count is None or target_count <= 0 or target_count >= total_count:
        return list(range(total_count))

    if target_count == 1:
        return [0]

    step = (total_count - 1) / (target_count - 1)
    indices: List[int] = []
    for i in range(target_count):
        idx = int(round(i * step))
        if indices and idx <= indices[-1]:
            idx = indices[-1] + 1
        if idx >= total_count:
            idx = total_count - 1
        indices.append(idx)
    return indices
