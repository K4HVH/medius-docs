"""Injected moves in every direction: does each axis get exactly what was sent?

Each of eight directions (+X, -X, +Y, -Y and the four diagonals) is sent per mouse and move kind (stock km.move
and km.move_now, Medius MOVE and MOVE with NOW). Scripted mice with five buttons and a wheel:
  still    16-bit X and Y, one empty report every 2 s (stock won't inject into a device that hasn't reported
           since it was cloned)
  moving   16-bit X and Y, reporting every millisecond with X +1, Y +1 and wheel +1
  still8   8-bit X and Y (a field of -127..127), one empty report every 2 s
  moving8  8-bit X and Y, X +1, Y +1 and wheel +1 every millisecond
Legs, per direction:
  sparse   100 unit moves (each axis -1, 0 or +1) 30-60 ms apart
  stream   500 unit moves paced at 1 kHz
  big      5 moves of 300 counts on each commanded axis, 150-250 ms apart: past the 8-bit field, so the box must
           split each one across reports
  control  once per mouse, before the rest: nothing sent, the same capture. The method's error; reads 0
The clone's evdev node is read from 0.3 s before the first command until what arrived matches what was sent (or
3 s pass), then 0.5 s more so an overshoot shows too. The moving mice carry native motion on both cursor axes,
taken off using the wheel: each native report carries one wheel count with its (+1, +1), nothing is injected on
the wheel, so native motion over a capture is the wheel total times (+1, +1). Each capture starts and ends with
nothing injected in flight, so at both edges a native report's motion and its wheel count arrive together. As a
coarse check that the wheel tag held, `sim_reports_bracketing` is the sim's count of reports the box took, read
just before and just after the capture: it should read a few above `native_reports`, never below.
Recorded per leg: want and got per axis and how far off, the reports carrying motion, and the time from the last
command until the running total reached what was sent and stayed there. For the still mice also: the reports
moving against the commanded direction or on an axis not commanded, the largest value per report, a histogram,
and on the 8-bit mouse the reports at the field's limit. Stock: ERR replies per leg, and whether its parser is in
step before and after each mouse (one behind, it holds back each last command, and the run stops). Medius gets a
QUERY(HEALTH) every 0.25 s while the test waits, as its 1 s silence rule asks of a host.
"""
import random
import time

from medius_compare import capture
from medius_shapes.scripted import mouse, mouse8, scripted_mouse, scripted_mouse8

ARGS = {"n": 100, "stream": 500, "big": 300, "big_n": 5, "settle": 3.0}
SETTLE_S = 2.0
FIELD8 = 127
DIRS = [("+x", 1, 0), ("-x", -1, 0), ("+y", 0, 1), ("-y", 0, -1),
        ("+x+y", 1, 1), ("+x-y", 1, -1), ("-x+y", -1, 1), ("-x-y", -1, -1)]


def moving():
    return scripted_mouse(0x7261, [(1, mouse(1, 1, 1))])


def still8():
    return scripted_mouse8(0x7262, [(1, mouse8(0, 0)), (1999, b"")])


def moving8():
    return scripted_mouse8(0x7263, [(1, mouse8(1, 1, 1))])


SHAPES = {"moving": moving, "still8": still8, "moving8": moving8}
# (leg, field bits, native motion per report, outcome row)
MICE = [("still", 16, (0, 0), "inj-dirs-still"), ("moving", 16, (1, 1), "inj-dirs-moving"),
        ("still8", 8, (0, 0), "inj-dirs-still8"), ("moving8", 8, (1, 1), "inj-dirs-moving8")]


class _Keep:
    def __init__(self, box):
        self.box, self.last = box, capture.mono()

    def tick(self):
        if self.box.kind == "medius" and capture.mono() - self.last >= 0.25:
            self.last = capture.mono()
            try:
                self.box.device.query_health()
            except self.box.medius.MediusError:
                pass

    def wait(self, secs):
        end = capture.mono() + secs
        while capture.mono() < end:
            self.tick()
            time.sleep(min(0.02, max(0.0, end - capture.mono())))


def _move(box, dx, dy, now):
    if now and box.kind == "stock":
        box.send(f"km.move_now({dx},{dy})")
    else:
        box.move(dx, dy, now=now)


def _sums(frames):
    return (sum(r.get(capture.REL_X, 0) for _, r, _ in frames), sum(r.get(capture.REL_Y, 0) for _, r, _ in frames),
            sum(r.get(capture.REL_WHEEL, 0) for _, r, _ in frames))


def _injected(frames, nat):
    x, y, w = _sums(frames)
    return x - w * nat[0], y - w * nat[1], w


def _send(box, moves, now, pace):
    t_last = capture.mono()
    if pace == "stream":
        nxt = capture.mono()
        for dx, dy in moves:
            nxt += 0.001
            _move(box, dx, dy, now)
            t_last = capture.mono()
            lead = nxt - capture.mono() - 0.0003
            if lead > 0:
                time.sleep(lead)
            while capture.mono() < nxt:
                pass
    else:
        for i, (dx, dy) in enumerate(moves):
            _move(box, dx, dy, now)
            t_last = capture.mono()
            if i < len(moves) - 1:
                time.sleep(random.uniform(*pace))
    return t_last


def _arrived_ms(frames, want, nat, t_last):
    run, last_off = [0, 0], None
    for i, (_, r, _) in enumerate(frames):
        w = r.get(capture.REL_WHEEL, 0)
        run[0] += r.get(capture.REL_X, 0) - w * nat[0]
        run[1] += r.get(capture.REL_Y, 0) - w * nat[1]
        if tuple(run) != want:
            last_off = i
    if tuple(run) != want or last_off is None or last_off + 1 >= len(frames):
        return None
    return round((frames[last_off + 1][0] - t_last) * 1e3, 2)


def _per_report(frames, sx, sy, bits):
    xs = [r.get(capture.REL_X, 0) for _, r, _ in frames]
    ys = [r.get(capture.REL_Y, 0) for _, r, _ in frames]

    def wrong(vs, s):
        return sum(1 for v in vs if v and (s == 0 or (v > 0) != (s > 0)))

    d = {"x_wrong_way": wrong(xs, sx), "y_wrong_way": wrong(ys, sy),
         "max_abs_x": max((abs(v) for v in xs), default=0), "max_abs_y": max((abs(v) for v in ys), default=0),
         "x_hist": {str(v): xs.count(v) for v in sorted(set(xs)) if v},
         "y_hist": {str(v): ys.count(v) for v in sorted(set(ys)) if v}}
    if bits == 8:
        d["at_field_limit"] = sum(1 for x, y in zip(xs, ys) if abs(x) >= FIELD8 or abs(y) >= FIELD8)
    return d


def _appends(ctx):
    try:
        link = ctx.sim()
        try:
            d = link.diag()
        finally:
            link.close()
        return d["appends"] if d else None
    except Exception:
        return None


def _leg(ctx, cap, keep, nat, moves, now, pace, settle, hold=0.5):
    box = ctx.box
    want = (sum(m[0] for m in moves), sum(m[1] for m in moves))
    keep.wait(0.3)
    s0 = _appends(ctx) if nat != (0, 0) else None
    cap.take()
    if box.kind == "stock":
        box.drain()
    t_last = _send(box, moves, now, pace) if moves else capture.mono()
    end = capture.mono() + settle
    while moves and capture.mono() < end:
        if _injected(cap.peek(), nat)[:2] == want:
            break
        keep.tick()
        time.sleep(0.01)
    keep.wait(hold)
    frames = cap.take()
    s1 = _appends(ctx) if nat != (0, 0) else None
    refused = box.drain().count(b"ERR") if box.kind == "stock" else None
    sim = s1 - s0 if s0 is not None and s1 is not None else None
    return want, frames, t_last, refused, sim


def _record(shape, bits, nat, kind, dname, leg, moves, leg_out, sx, sy):
    want, frames, t_last, refused, sim = leg_out
    gx, gy, w = _injected(frames, nat)
    rec = {"shape": shape, "field_bits": bits, "native_per_report": list(nat), "kind": kind, "dir": dname,
           "leg": leg, "commands": len(moves), "per_command": list(moves[0]) if moves else None,
           "want": list(want), "got": [gx, gy], "off": [gx - want[0], gy - want[1]], "exact": (gx, gy) == want,
           "native_reports": w, "sim_reports_bracketing": sim,
           "reports_with_motion": sum(1 for _, r, _ in frames if r.get(capture.REL_X) or r.get(capture.REL_Y)),
           "arrived_ms_after_last": _arrived_ms(frames, want, nat, t_last) if moves else None,
           "refused": refused}
    if nat == (0, 0):
        rec.update(_per_report(frames, sx, sy, bits))
    return rec


def _mouse(ctx, cap, keep, shape, bits, nat):
    a = ARGS
    recs = [_record(shape, bits, nat, None, "none", "control", [],
                    _leg(ctx, cap, keep, nat, [], False, None, 0, hold=1.5), 0, 0)]
    for kind in ("move", "now"):
        for dname, sx, sy in DIRS:
            for leg, moves, pace in (("sparse", [(sx, sy)] * a["n"], (0.03, 0.06)),
                                     ("stream", [(sx, sy)] * a["stream"], "stream"),
                                     ("big", [(sx * a["big"], sy * a["big"])] * a["big_n"], (0.15, 0.25))):
                out = _leg(ctx, cap, keep, nat, moves, kind == "now", pace, a["settle"])
                recs.append(_record(shape, bits, nat, kind, dname, leg, moves, out, sx, sy))
    return recs


def run(ctx):
    box = ctx.box
    keep = _Keep(box)
    results, in_step, outcomes = [], [], {}
    for shape, bits, nat, row in MICE:
        p = ctx.device(shape)
        time.sleep(SETTLE_S)
        step = {"shape": shape, "in_step_before": not box.lagging()}
        in_step.append(step)
        if not step["in_step_before"]:
            ctx.log(f"one command behind before {shape}: stopping")
            break
        cap = capture.EvCap(capture.pointer_node(p.nodes))
        try:
            recs = _mouse(ctx, cap, keep, shape, bits, nat)
        finally:
            cap.close()
        results += recs
        outcomes[row] = "Exact" if all(r["exact"] for r in recs) else "Off"
        ctx.log(f"{shape}: {sum(r['exact'] for r in recs)}/{len(recs)} legs exact")
        step["in_step_after"] = not box.lagging()
        if not step["in_step_after"]:
            ctx.log(f"one command behind after {shape}: stopping")
            break
    return {"args": ARGS, "in_step": in_step, "results": results, "outcomes": outcomes}
