"""What injected motion looks like on the clone, each box on its defaults: every report the clone emits, read off
its hidraw node (zero-motion reports included), with evdev's kernel timestamps alongside.

  base    into a still mouse that reports once, 3 s after it is plugged in, then sends nothing (stock won't
          inject into a device that hasn't reported since it was cloned), so every report the clone emits is the
          box's:
          single  one move of 1, 10, 100 and 1,000 counts, default and immediate (stock km.move and km.move_now,
                  Medius MOVE and MOVE with NOW), three times each: how many reports carry it, over how long,
                  and how many extra reports (motion or not) the box emits
          stream  move(1,0) paced at 1,000, 500, 250, 125, 60 and 30/s for 2 s: the sum delivered, the report
                  rate, the delay from each command to its count, the tail after the last command
  native  the same 1,000/s and 125/s streams while the mouse moves on Y at 1 kHz and at 125 Hz: the reports
          carrying only injected motion (X and no Y; every report the mouse sends moves Y), and the native report
          timing beside them
"""
import os
import struct
import time

from medius_compare import capture, stats
from medius_shapes.scripted import mouse, scripted_mouse

SETTLE_S = 2.0


def native_1k():
    return scripted_mouse(0x7021, [(1, mouse(0, 1)), (1, mouse(0, -1))])


def native_125():
    return scripted_mouse(0x7022, [(1, mouse(0, 1)), (1, mouse(0, -1))], interval_us=8000)


def quiet_mouse():
    return scripted_mouse(0x7034, [(3000, b""), (1, mouse(0, 0))], once=True)


SHAPES = {"quiet": quiet_mouse, "native_1k": native_1k, "native_125": native_125}
QUIET_REPORT_S = 3.0


def _move(box, dx, dy, now):
    if now and box.kind == "stock":
        box.send(f"km.move_now({dx},{dy})")
    else:
        box.move(dx, dy, now=now)


def _hidraw(nodes):
    return next(n for n in nodes if os.path.basename(n).startswith("hidraw"))


def _decode(d):
    if len(d) < 6:
        return None
    return struct.unpack_from("<Bhhb", d, 0)


def _quiet(rc, cap, quiet, cap_s=5.0):
    raws, evs = [], []
    end = time.monotonic() + cap_s
    last = time.monotonic()
    while time.monotonic() < end:
        r = rc.take()
        e = cap.take() if cap else []
        if r or e:
            raws += r
            evs += e
            last = time.monotonic()
        elif time.monotonic() - last > quiet:
            break
        time.sleep(0.01)
    return raws, evs


def _describe(raws, t0):
    rep = [(t - t0, _decode(d)) for t, d in raws if _decode(d)]
    motion = [(t, r) for t, r in rep if r[1]]
    zero = [(t, r) for t, r in rep if not r[1] and not r[2] and not r[3] and not r[0]]
    gaps = [b[0] - a[0] for a, b in zip(rep, rep[1:])]
    return {"reports": len(rep), "x_reports": len(motion), "zero_reports": len(zero),
            "sum_x": sum(r[1] for _, r in rep),
            "first_x_ms": round(motion[0][0] * 1e3, 3) if motion else None,
            "last_x_ms": round(motion[-1][0] * 1e3, 3) if motion else None,
            "last_report_ms": round(rep[-1][0] * 1e3, 3) if rep else None,
            "x_per_report": [r[1] for _, r in motion][:400],
            "gap_us": stats.summary(gaps)}


def _pace(box, hz, secs):
    period = 1.0 / hz
    t_next = capture.mono()
    sent = []
    for _ in range(int(hz * secs)):
        while capture.mono() < t_next:
            pass
        sent.append(capture.mono())
        box.move(1, 0)
        t_next += period
    return sent


def _xhist(d):
    return {str(v): d["x_per_report"].count(v) for v in sorted(set(d["x_per_report"]))}


def _base(ctx):
    box = ctx.box
    p = ctx.device("idle")
    time.sleep(max(SETTLE_S, QUIET_REPORT_S + 1.0))
    rc = capture.RawCap(_hidraw(p.nodes))
    cap = capture.EvCap(capture.pointer_node(p.nodes))
    results = []
    try:
        time.sleep(0.5)
        for dx in (1, 10, 100, 1000):
            for now in (False, True):
                for trial in range(3):
                    _quiet(rc, cap, 0.3)
                    t0 = capture.mono()
                    _move(box, dx, 0, now)
                    raws, _ = _quiet(rc, cap, 0.5)
                    d = _describe(raws, t0)
                    d.update(part="single", dx=dx, now=now, trial=trial)
                    results.append(d)
        for hz in (1000, 500, 250, 125, 60, 30):
            _quiet(rc, cap, 0.3)
            t0 = capture.mono()
            sent = _pace(box, hz, 2.0)
            raws, _ = _quiet(rc, cap, 0.6, 8.0)
            d = _describe(raws, t0)
            d.update(part="stream", hz=hz, sent=len(sent), last_cmd_ms=round((sent[-1] - t0) * 1e3, 3))
            d["tail_ms"] = round(d["last_x_ms"] - d["last_cmd_ms"], 3) if d["last_x_ms"] else None
            xs = []
            for t, r in [(t, _decode(dd)) for t, dd in raws if _decode(dd)]:
                xs += [t] * max(0, r[1])
            d["lag"] = stats.summary([xs[i] - sent[i] for i in range(min(len(xs), len(sent)))])
            d["x_per_report_hist"] = _xhist(d)
            results.append(d)
            ctx.log(f"stream {hz}/s: sum {d['sum_x']}/{len(sent)}, {d['zero_reports']} empty reports")
    finally:
        rc.close()
        cap.close()
    return {"results": results}


def _native(ctx):
    box = ctx.box
    results = []
    for name in ("native_1k", "native_125"):
        p = ctx.device(name)
        time.sleep(SETTLE_S)
        rc = capture.RawCap(_hidraw(p.nodes))
        try:
            time.sleep(0.5)
            rc.take()
            time.sleep(2.0)
            alone = rc.take()
            alone_d = _describe(alone, alone[0][0] if alone else 0)
            for hz in (1000, 125):
                rc.take()
                t0 = capture.mono()
                sent = _pace(box, hz, 2.0)
                time.sleep(0.5)
                raws = rc.take()
                d = _describe(raws, t0)
                rep = [_decode(dd) for _, dd in raws if _decode(dd)]
                d.update(part="native", native=name, hz=hz, sent=len(sent),
                         native_rate_idle=round(alone_d["reports"] / 2.0, 1),
                         window_s=round(raws[-1][0] - t0, 3) if raws else None,
                         y_reports=sum(1 for r in rep if r[2]),
                         box_only=sum(1 for r in rep if r[1] and not r[2]))
                d["x_per_report_hist"] = _xhist(d)
                results.append(d)
                ctx.log(f"{name} at {hz}/s: {d['box_only']} reports carrying only injected motion")
        finally:
            rc.close()
    return {"results": results}


def run(ctx):
    return {"base": _base(ctx), "native": _native(ctx)}
