"""
Shared scoring utilities for ChromaDB match results.
Both intake_agent.py and matching.py use these — centralised here to avoid coupling.
"""


def normalize_match_score(raw: float) -> float:
    """
    Maps raw ChromaDB cosine similarity (0.0–1.0) to a display-friendly score.

    all-MiniLM-L6-v2 on medical specialty queries produces cosine similarities
    in the 0.05–0.50 range. Displaying 0.40 as "40% match" misleads users —
    it is actually an excellent match. This maps the expected range to 55–97%.

    Examples:  0.10 → 0.59,  0.20 → 0.69,  0.30 → 0.78,  0.40 → 0.87,  0.50 → 0.97
    """
    lo, hi     = 0.05, 0.50
    d_lo, d_hi = 0.55, 0.97
    normalized = (raw - lo) / (hi - lo) * (d_hi - d_lo) + d_lo
    return round(min(d_hi, max(d_lo, normalized)), 4)
