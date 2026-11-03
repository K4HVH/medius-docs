"""Native keyboard reports through the box at 500 Hz and 250 Hz: every report, once, unchanged, in order, and how
evenly spaced on the bus?

kbd-relay's method at two more rates. The sim plays a boot keyboard (8-byte report) whose two key slots step
through 160 distinct pairs (slot 1 'a'..'p', slot 2 '1'..'0') and repeat, so each report names itself. It ticks
on its host's frames, each report armed 500 us into the frame. Legs:
  500  a report every 2 ms, bInterval 2
  250  a report every 4 ms, bInterval 4
The clone's interrupt IN completions are read off the USB monitor for 15 s. Per leg: reports (and roughly how many
the sim sent in that time), dropped (steps skipped), duplicated, reordered, reports not from the sequence, the
intervals between reports (all, and those within half a period of nominal), steady intervals 10% or more off
nominal, intervals over 1.5 periods, and a histogram of the intervals in 0.1 ms bins. Each report is also placed
on the PC's poll grid: reports a poll early or late, and polls missed. Raw stamps are kept. Also the clone's
endpoint as the PC sees it: the bInterval it declares and the interval the host controller polls at."""
import time

from medius_compare import polls, stats, wire
from medius_shapes import scripted

SEQ = 160
FRAME_ARM_US = 500
SECS = 15.0
SETTLE_S = 2.5
LEGS = {"500": (0x71D0, 2000), "250": (0x71D1, 4000)}


def _records():
    return [(1, scripted.keys(4 + i // 10, 30 + i % 10)) for i in range(SEQ)]


def _shape(pid, iv):
    return lambda: scripted.scripted_keyboard(pid, _records(), interval_us=iv, frame_arm_us=FRAME_ARM_US)


SHAPES = {f"counting-keyboard-{leg}": _shape(*spec) for leg, spec in LEGS.items()}


def _grid(stamps, ticks, poll_us, tick_us):
    g = polls.timing(stamps, poll_us, ticks, tick_us)
    return {"poll_us": g["poll_us"], "judged": g["reports"], "unjudged": g["unjudged"],
            "early_late": g["early_late"], "missed_polls": g["missed"]}


def _analyse(reps, period_us, poll=None):
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
    return {"reports": len(vals), "dropped": drops, "duplicated": dups, "reordered": reord, "bad_bytes": bad,
            "interval": stats.summary(gaps), "steady_interval": stats.summary(steady),
            "outside_10pct": sum(1 for g in steady if abs(g - per) >= 0.1 * per),
            "gaps_over_1_5x": sum(1 for g in gaps if g > 1.5 * per),
            "poll_grid": _grid(stamps, idx, poll or period_us, period_us),
            "stamps_us": [round(t - stamps[0]) for t in stamps] if stamps else [], "index": idx}


def _endpoint(usb):
    out = {}
    for f in ("bInterval", "interval"):
        try:
            with open(f"/sys/bus/usb/devices/{usb}:1.0/ep_81/{f}") as fh:
                out[f] = fh.read().strip()
        except OSError:
            out[f] = None
    return out


def _histogram(reps):
    ts = [t for t, d in reps if len(d) == 8 and d[2]]
    h = {}
    for a, b in zip(ts, ts[1:]):
        k = f"{(b - a) / 1e3:.1f}"
        h[k] = h.get(k, 0) + 1
    return dict(sorted(h.items(), key=lambda kv: float(kv[0])))


def _leg(ctx, leg):
    _, iv = LEGS[leg]
    p = ctx.device(leg)
    time.sleep(SETTLE_S)
    _, dev = wire.resolve(p.usb)
    with polls.awake(), wire.Wire([p.usb]) as w:
        time.sleep(SECS)
    reps = wire.reports(w.events, dev)
    r = {"leg": leg, "period_us": iv, "sent_approx": round(SECS * 1e6 / iv), "clone_endpoint": _endpoint(p.usb),
         **_analyse(reps, iv, polls.poll_us(f"/sys/bus/usb/devices/{p.usb}")), "interval_hist_ms": _histogram(reps)}
    g = r["poll_grid"]
    ctx.log(f"{leg}: reports {r['reports']}/{r['sent_approx']} dropped {r['dropped']} dup {r['duplicated']} "
            f"reord {r['reordered']} bad {r['bad_bytes']} early/late {g['early_late']} missed {g['missed_polls']} "
            f"ep {r['clone_endpoint']}")
    return r


def _sequence(r):
    if r["dropped"]:
        return "Some lost"
    if r["duplicated"] or r["reordered"]:
        return "Repeated or out of order"
    return "All, once, in order"


def run(ctx):
    results = [_leg(ctx, leg) for leg in LEGS]
    return {"results": results, "outcomes": {f"pass-seq-kbd-{leg}": _sequence(r) for leg, r in zip(LEGS, results)}}
