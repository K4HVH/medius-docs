"""Percentile summaries, as the comparison's tables show them."""


def pct(xs, p):
    """The p-th percentile of xs, linearly interpolated between ranks."""
    if not xs:
        return float("nan")
    s = sorted(xs)
    k = (len(s) - 1) * p / 100.0
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def summary(xs, scale=1e6, unit="us"):
    """n, mean, sd and percentiles of xs, scaled (seconds to microseconds by default) and rounded to 0.01."""
    if not xs:
        return {"n": 0}
    n = len(xs)
    m = sum(xs) / n
    sd = (sum((x - m) ** 2 for x in xs) / max(1, n - 1)) ** 0.5
    return {"n": n, "unit": unit, "mean": round(m * scale, 2), "sd": round(sd * scale, 2),
            "min": round(min(xs) * scale, 2), "p50": round(pct(xs, 50) * scale, 2),
            "p95": round(pct(xs, 95) * scale, 2), "p99": round(pct(xs, 99) * scale, 2),
            "max": round(max(xs) * scale, 2)}
