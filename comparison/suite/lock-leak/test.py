"""Whether a held lock lets native input through, read on the clone's mouse node.

The mouse reports every millisecond. For the axis legs X counts 1, 2, 3, 4 and repeats (2.5 counts/ms). For
the button legs it also holds left for 10 ms and releases it for 10 ms (50 presses/s). For axis_inj_negx X
counts 100 to 103, so a leaked report stands out from injected motion even when the two share a report. Each
leg: 1 s unlocked (the baseline: the mouse's input must reach the PC), then the lock (stock km.lock_mx(1) or
km.lock_ml(1), Medius LOCK x or LOCK left), 0.1 s for it to take hold, then 10 s held while the box injects as
the leg says, then the unlock.
  axis_idle      lock X, no injection
  axis_inj_y     lock X, inject move(0,+1) at 1 kHz
  axis_inj_y125  lock X, inject move(0,+1) at 125 Hz
  axis_inj_negx  lock X on the 100-103 mouse, inject move(-1,0) at 1 kHz: injected motion only adds negative
                 X, so a report with positive X carries leaked motion
  button_idle    lock left, no injection
  button_inj_y   lock left, inject move(0,+1) at 1 kHz
Per leg: native X counts (or left presses) that reached the PC while locked, against the baseline. For
axis_inj_negx: the X of every report whose X is positive, and the injected total from the negative reports."""
import time

from medius_compare.capture import REL_X, REL_Y, EvCap, mono, pointer_node
from medius_compare.devices import usb_nodes
from medius_shapes.scripted import mouse, scripted_mouse

BTN_LEFT = 0x110
SETTLE_S = 2.0
SECS = 10.0
SHAPES = {
    "x-ramp": lambda: scripted_mouse(0x7090, [(1, mouse(i + 1, 0)) for i in range(4)]),
    "x-ramp-click": lambda: scripted_mouse(0x7091, [(1, mouse((i % 4) + 1, 0, 0, 1 if i < 10 else 0))
                                                    for i in range(20)]),
    "x-big": lambda: scripted_mouse(0x7092, [(1, mouse(100 + i, 0)) for i in range(4)]),
}
LEGS = [
    ("axis_idle", "x-ramp", "x", None, 0, "input-leak-x-idle"),
    ("axis_inj_y", "x-ramp", "x", (0, 1), 1000, "input-leak-x-inject-y-1khz"),
    ("axis_inj_y125", "x-ramp", "x", (0, 1), 125, "input-leak-x-inject-y-125hz"),
    ("axis_inj_negx", "x-big", "x", (-1, 0), 1000, "input-leak-x-inject-neg-x"),
    ("button_idle", "x-ramp-click", "left", None, 0, "input-leak-left-idle"),
    ("button_inj_y", "x-ramp-click", "left", (0, 1), 1000, "input-leak-left-inject-y"),
]

_settled = []


def _present(ctx, leg):
    p = ctx.device(leg)
    if not any(q is p for q in _settled):
        _settled.append(p)
        time.sleep(SETTLE_S)
    return p


def _mouse_node(port, timeout=10.0):
    end = time.monotonic() + timeout
    while True:
        node = pointer_node(usb_nodes(port))
        if node:
            return node
        if time.monotonic() > end:
            raise RuntimeError(f"no mouse node on {port}")
        time.sleep(0.1)


def _hold(box, secs, move, hz):
    if not move:
        time.sleep(secs)
        return 0
    sent = 0
    end = mono() + secs
    nxt = mono()
    while mono() < end:
        nxt += 1.0 / hz
        box.move(*move)
        sent += 1
        lead = nxt - mono() - 0.0003
        if lead > 0:
            time.sleep(lead)
        while mono() < nxt:
            pass
    return sent


def _tally(frames):
    xs = [r.get(REL_X, 0) for _, r, _ in frames]
    return {"x": sum(xs), "y": sum(r.get(REL_Y, 0) for _, r, _ in frames),
            "x_pos": sum(x for x in xs if x > 0), "x_pos_reports": sum(1 for x in xs if x > 0),
            "x_neg": -sum(x for x in xs if x < 0),
            "presses": sum(1 for _, _, ks in frames for c, v in ks if c == BTN_LEFT and v == 1)}


def _leg(box, node, name, what, move, hz):
    cap = EvCap(node)
    try:
        time.sleep(0.3)
        cap.take()
        time.sleep(1.0)
        base = _tally(cap.take())
        box.lock(what)
        time.sleep(0.1)
        cap.take()
        sent = _hold(box, SECS, move, hz)
        time.sleep(0.2)
        held = _tally(cap.take())
        box.unlock(what)
        time.sleep(0.2)
    finally:
        cap.close()
    r = {"leg": name, "baseline_1s": base, "locked": held, "injected": sent}
    if what == "left":
        r["leak"], r["live"] = held["presses"], base["presses"]
    elif move == (-1, 0):
        r["leak"], r["live"] = held["x_pos"], base["x_pos"]
        r["injected_delivered"] = held["x_neg"]
    else:
        r["leak"], r["live"] = held["x"], base["x"]
    return r


def run(ctx):
    box = ctx.box
    results, outcomes = [], {}
    try:
        for name, leg, what, move, hz, row in LEGS:
            node = _mouse_node(_present(ctx, leg).usb)
            if box.lagging():
                results.append({"leg": name, "lagging": True})
                ctx.log(f"{name}: one command behind: stopping")
                break
            r = _leg(box, node, name, what, move, hz)
            r["lagging"] = False
            live = r.pop("live")
            results.append(r)
            if live > 0:
                outcomes[row] = "None" if r["leak"] == 0 else "Some"
            else:
                ctx.log(f"{name}: no native input reached the PC unlocked, so the lock can't be judged")
            ctx.log(f"{name}: leak {r['leak']}, locked {r['locked']}, injected {r['injected']}")
    finally:
        box.leave()
    return {"results": results, "outcomes": outcomes}
