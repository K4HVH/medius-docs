"""Native mouse reports through the box: does every report the real device sends reach the PC, once, unchanged,
in order and on time?

The sim plays a 16-bit mouse whose Y field counts 1..200 and repeats, X and wheel zero, so each report names
itself. It ticks on its host's frames, each report armed 500 us into the frame. Read off the clone's hidraw node
(every report, byte for byte), its evdev node (kernel timestamps) and the USB monitor (bus timing). Legs:
  1000/500/250/125  a report every tick at that rate (bInterval 1/2/4/8)
  burst             1 kHz in runs of seven reports with three silent ticks between
  inject            the 1 kHz mouse while the box is sent move(+1,0) 1,000 times a second: native reports must
                    still all arrive, unmerged and on time; X shows where the moves went
Counts: delivered, dropped (a jump in the sequence), duplicated, merged (a Y value not in the sequence: two
reports summed), reordered, any byte that differs from what the sim sent, and the interval spread. On the bus,
the native reports' intervals and each report's place on the PC's poll grid: reports a poll early or late, and
polls missed. Raw stamps are kept.

`base` runs every leg for 15 s; `500long` runs the 500 Hz mouse for 2 minutes."""
import struct
import time

from medius_compare import capture, polls, stats, wire
from medius_compare.devices import usb_nodes
from medius_shapes import scripted

SEQ = 200
FRAME_ARM_US = 500
SECS = 15.0
LONG_SECS = 120.0
SETTLE_S = 2.5


def _records(gap_every=0, gap_len=0):
    recs = []
    for i in range(SEQ):
        recs.append((1, scripted.mouse(0, i + 1)))
        if gap_every and (i + 1) % gap_every == 0:
            recs.append((gap_len, b""))
    return recs


LEGS = {
    "1000": (0x7040, 1000, _records()),
    "500": (0x7041, 2000, _records()),
    "250": (0x7042, 4000, _records()),
    "125": (0x7043, 8000, _records()),
    "burst": (0x7044, 1000, _records(7, 3)),
    "inject": (0x7045, 1000, _records()),
}


def _shape(pid, iv, recs):
    return lambda: scripted.scripted_mouse(pid, recs, interval_us=iv, frame_arm_us=FRAME_ARM_US)


SHAPES = {f"counting-mouse-{leg}": _shape(*spec) for leg, spec in LEGS.items()}


def _analyse(raws, frames, period_us, x_allowed=False):
    vals, bad_bytes, lens, xs, own = [], 0, {}, 0, 0
    for _, d in raws:
        lens[len(d)] = lens.get(len(d), 0) + 1
        if len(d) < 6:
            bad_bytes += 1
            continue
        b, x, y, w = struct.unpack_from("<Bhhb", d, 0)
        xs += x
        if y == 0:
            own += 1
            continue
        vals.append(y)
        if b or w or (x and not x_allowed) or len(d) != 6:
            bad_bytes += 1
    drops = dups = merges = reord = 0
    for a, b_ in zip(vals, vals[1:]):
        exp = a % SEQ + 1
        if b_ == exp:
            continue
        if b_ == a:
            dups += 1
        elif b_ > SEQ:
            merges += 1
        else:
            fwd = (b_ - exp) % SEQ
            if fwd < SEQ // 2:
                drops += fwd
            else:
                reord += 1
    ts = [t for t, r, _ in frames if r.get(capture.REL_Y, 0)]
    gaps = [b - a for a, b in zip(ts, ts[1:])]
    per = period_us / 1e6
    in_bin = sum(1 for g in gaps if abs(g - per) < 0.1 * per) / max(1, len(gaps))
    steady = [g for g in gaps if abs(g - per) < 0.5 * per]
    return {"native_reports": len(vals), "box_reports": own, "x_total": xs, "dropped": drops, "duplicated": dups,
            "merged": merges, "reordered": reord, "bad_bytes": bad_bytes, "report_lengths": lens,
            "rate_hz": round(len(ts) / (ts[-1] - ts[0]), 2) if len(ts) > 1 else None,
            "interval": stats.summary(gaps), "steady_interval": stats.summary(steady),
            "in_nominal_bin": round(in_bin, 5), "gaps_over_1_5x": sum(1 for g in gaps if g > 1.5 * per)}


def _grid(stamps, ticks, poll_us, tick_us):
    g = polls.timing(stamps, poll_us, ticks, tick_us)
    return {"poll_us": g["poll_us"], "judged": g["reports"], "unjudged": g["unjudged"],
            "early_late": g["early_late"], "missed_polls": g["missed"]}


def _wire_intervals(events, dev, period_us, poll=None, burst=False):
    reps = [(e.ts, struct.unpack_from("<h", e.data, 3)[0]) for e in events if e.dev == dev and e.kind == "C"
            and e.xfer == 1 and e.ep & 0x80 and len(e.data) >= 5 and struct.unpack_from("<h", e.data, 3)[0]]
    ts = [t / 1e6 for t, _ in reps]
    gaps = [b - a for a, b in zip(ts, ts[1:])]
    per = period_us / 1e6
    steady = [g for g in gaps if abs(g - per) < 0.5 * per]
    stamps = [t for t, _ in reps]
    idx = polls.sequence_index([y for _, y in reps], SEQ)
    ticks = polls.burst_ticks(idx, reps[0][1] - 1, SEQ) if burst and reps else idx
    return {"reports": len(ts), "interval": stats.summary(gaps), "steady_interval": stats.summary(steady),
            "outside_10pct": sum(1 for g in gaps if abs(g - per) >= 0.1 * per),
            "gaps_over_1_5x": sum(1 for g in gaps if g > 1.5 * per),
            "poll_grid": _grid(stamps, ticks, poll or period_us, period_us),
            "stamps_us": [round(t - stamps[0]) for t in stamps] if stamps else [], "index": idx}


def _inject(box, secs):
    sent, nxt, end = 0, time.monotonic(), time.monotonic() + secs
    while time.monotonic() < end:
        nxt += 0.001
        box.move(1, 0)
        sent += 1
        while time.monotonic() < nxt:
            pass
    time.sleep(0.5)
    return sent


def _hidraw(nodes):
    for n in nodes:
        if "hidraw" in n:
            return n
    raise RuntimeError("the clone has no hidraw node")


def _leg(ctx, leg, secs):
    _, iv, _ = LEGS[leg]
    p = ctx.device(leg)
    time.sleep(SETTLE_S)
    nodes = usb_nodes(p.usb)
    rc = capture.RawCap(_hidraw(nodes))
    cap = capture.EvCap(capture.pointer_node(nodes))
    try:
        time.sleep(1.0)
        rc.take()
        cap.take()
        _, dev = wire.resolve(p.usb)
        with polls.awake(), wire.Wire([p.usb]) as w:
            if leg == "inject":
                sent = _inject(ctx.box, secs)
            else:
                sent = 0
                time.sleep(secs)
        raws, frames = rc.take(), cap.take()
    finally:
        rc.close()
        cap.close()
    r = {"leg": leg, **_analyse(raws, frames, iv, x_allowed=(leg == "inject")), "injected": sent,
         "wire": _wire_intervals(w.events, dev, iv, polls.poll_us(f"/sys/bus/usb/devices/{p.usb}"),
                                 burst=(leg == "burst"))}
    g = r["wire"]["poll_grid"]
    ctx.log(f"{leg} {secs:.0f} s: native {r['native_reports']} box {r['box_reports']} dropped {r['dropped']} "
            f"dup {r['duplicated']} merged {r['merged']} reord {r['reordered']} bad {r['bad_bytes']} "
            f"early/late {g['early_late']} missed {g['missed_polls']}")
    return r


def _sequence(r):
    if r["dropped"] or r["merged"]:
        return "Some lost"
    if r["duplicated"] or r["reordered"] or r["box_reports"]:
        return "Repeated or out of order"
    return "All, once, in order"


def _bytes(r):
    return "Changed" if r["bad_bytes"] else "Unchanged"


def run(ctx):
    base = {"secs": SECS, "results": [_leg(ctx, leg, SECS) for leg in LEGS]}
    long = {"secs": LONG_SECS, "results": [_leg(ctx, "500", LONG_SECS)]}
    by_leg = {r["leg"]: r for r in base["results"]}
    outcomes = {}
    for leg in ("1000", "500", "250", "125", "burst"):
        outcomes[f"pass-seq-{leg}"] = _sequence(by_leg[leg])
        outcomes[f"pass-bytes-mouse-{leg}"] = _bytes(by_leg[leg])
    outcomes["pass-seq-500-long"] = _sequence(long["results"][0])
    return {"base": base, "500long": long, "outcomes": outcomes}
