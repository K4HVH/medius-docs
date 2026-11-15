"""Native keyboard reports through the box, read on the bus: every report, once, unchanged, in order, on time?

The sim plays a boot keyboard (8-byte report) whose two key slots step through 160 distinct pairs (slot 1
'a'..'p', slot 2 '1'..'0') and repeat, so each report names itself. It ticks on its host's frames, each report
armed 500 us into the frame. The clone's interrupt IN completions are read off the USB monitor for 15 s. Legs:
  1000   a report every millisecond (bInterval 1)
  125    a report every 8 ms (bInterval 8)
  burst  1 kHz in runs of seven reports with three silent ticks between
Each report is also placed on the PC's poll grid: reports a poll early or late, and polls missed. Raw stamps are
kept."""
import time

from medius_compare import polls, stats, wire
from medius_shapes import scripted

SEQ = 160
FRAME_ARM_US = 500
SECS = 15.0
SETTLE_S = 2.5


def _records(gap_every=0, gap_len=0):
    out = []
    for i in range(SEQ):
        out.append((1, scripted.keys(4 + i // 10, 30 + i % 10)))
        if gap_every and (i + 1) % gap_every == 0:
            out.append((gap_len, b""))
    return out


LEGS = {"1000": (0x7140, 1000, _records()), "125": (0x7141, 8000, _records()), "burst": (0x7142, 1000, _records(7, 3))}


def _shape(pid, iv, recs):
    return lambda: scripted.scripted_keyboard(pid, recs, interval_us=iv, frame_arm_us=FRAME_ARM_US)


SHAPES = {f"counting-keyboard-{leg}": _shape(*spec) for leg, spec in LEGS.items()}


def _grid(stamps, ticks, poll_us, tick_us):
    g = polls.timing(stamps, poll_us, ticks, tick_us)
    return {"poll_us": g["poll_us"], "judged": g["reports"], "unjudged": g["unjudged"],
            "early_late": g["early_late"], "missed_polls": g["missed"]}


def _analyse(reps, period_us, poll=None, burst=False):
    vals, stamps, bad = [], [], 0
    for t, d in reps:
        if len(d) != 8 or d[0] or d[1] or any(d[4:]) or not (4 <= d[2] < 20 and 30 <= d[3] < 40):
            bad += 1
            continue
        vals.append((d[2] - 4) * 10 + d[3] - 30)
        stamps.append(t)
    drops = dups = reord = 0
    for a, b in zip(vals, vals[1:]):
        exp = (a + 1) % SEQ
        if b == exp:
            continue
        if b == a:
            dups += 1
        elif (b - exp) % SEQ < SEQ // 2:
            drops += (b - exp) % SEQ
        else:
            reord += 1
    ts = [t / 1e6 for t, d in reps if len(d) == 8 and d[2]]
    gaps = [b - a for a, b in zip(ts, ts[1:])]
    per = period_us / 1e6
    steady = [g for g in gaps if abs(g - per) < 0.5 * per]
    idx = polls.sequence_index(vals, SEQ)
    ticks = polls.burst_ticks(idx, vals[0], SEQ) if burst and vals else idx
    return {"reports": len(vals), "dropped": drops, "duplicated": dups, "reordered": reord, "bad_bytes": bad,
            "interval": stats.summary(gaps), "steady_interval": stats.summary(steady),
            "outside_10pct": sum(1 for g in steady if abs(g - per) >= 0.1 * per),
            "gaps_over_1_5x": sum(1 for g in gaps if g > 1.5 * per),
            "poll_grid": _grid(stamps, ticks, poll or period_us, period_us),
            "stamps_us": [round(t - stamps[0]) for t in stamps] if stamps else [], "index": idx}


def _leg(ctx, leg):
    _, iv, _ = LEGS[leg]
    p = ctx.device(leg)
    time.sleep(SETTLE_S)
    _, dev = wire.resolve(p.usb)
    with polls.awake(), wire.Wire([p.usb]) as w:
        time.sleep(SECS)
    r = {"leg": leg, **_analyse(wire.reports(w.events, dev), iv, polls.poll_us(f"/sys/bus/usb/devices/{p.usb}"),
                                burst=(leg == "burst"))}
    g = r["poll_grid"]
    ctx.log(f"{leg}: reports {r['reports']} dropped {r['dropped']} dup {r['duplicated']} reord {r['reordered']} "
            f"bad {r['bad_bytes']} early/late {g['early_late']} missed {g['missed_polls']}")
    return r


def _sequence(r):
    if r["dropped"]:
        return "Some lost"
    if r["duplicated"] or r["reordered"]:
        return "Repeated or out of order"
    return "All, once, in order"


def _bytes(r):
    return "Changed" if r["bad_bytes"] else "Unchanged"


def run(ctx):
    results = [_leg(ctx, leg) for leg in LEGS]
    outcomes = {}
    for leg, r in zip(LEGS, results):
        outcomes[f"pass-seq-kbd-{leg}"] = _sequence(r)
        outcomes[f"pass-bytes-kbd-{leg}"] = _bytes(r)
    return {"secs": SECS, "results": results, "outcomes": outcomes}
