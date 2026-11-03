"""Tests for medius_compare.polls and medius_compare.stats."""
from medius_compare import polls, stats


def test_poll_grid_counts_early_late_and_missed():
    poll = 1000
    slots = [2 * i for i in range(100)]
    slots[40] -= 1
    slots[60:] = [s + 2 for s in slots[60:]]
    stamps = [300 + 3 + s * poll for s in slots]
    got = polls.timing(stamps, poll, ticks=list(range(100)), tick_us=2000)
    assert (got["early_late"], got["missed"], got["reports"], got["unjudged"]) == (1, 2, 100, 0)


def test_poll_grid_leaves_a_late_stamp_unjudged():
    stamps = [300 + i * 1000 for i in range(100)]
    stamps[50] += 400
    got = polls.timing(stamps, 1000)
    assert (got["early_late"], got["missed"], got["reports"], got["unjudged"]) == (0, 0, 99, 1)


def test_summary_percentiles():
    s = stats.summary([i / 1e6 for i in range(1, 101)])
    assert (s["n"], s["min"], s["p50"], s["p95"], s["p99"], s["max"]) == (100, 1.0, 50.5, 95.05, 99.01, 100.0)
    assert stats.summary([]) == {"n": 0}
