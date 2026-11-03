"""The left button and locks.

  latency  left press and release injected into a still mouse, 100 times: from the command's write to the
           clone's BTN_LEFT edge
  stuck    a left press injected, then the control port closed without a release: is left still held on the
           PC 3 s later? Then the port is opened again and left released
  or_rule  the device holds left for 2 s and releases it for 2 s; while it holds, the box injects a release,
           then a press and release: the PC must see left held throughout
  mask     the device clicks left every 100 ms; the box blocks native left (stock km.left_mask, Medius LOCK
           left) for 1 s: no native click may reach the PC, while an injected press still does
  bite     the device moves X every millisecond; the box locks X (stock km.lock_mx, Medius LOCK x) 20 times:
           on the PC's USB bus, from the lock's packet reaching the control port to the last native X report,
           and from the unlock's packet to the first native X report back

Stock gets km.left, Medius INJECT press and soft-release. Held states are read with EVIOCGKEY."""
import fcntl
import os
import struct
import time

from medius_compare import stats, wire
from medius_compare.capture import EvCap, mono, pointer_node
from medius_compare.devices import usb_nodes
from medius_shapes.scripted import mouse, scripted_mouse

EVIOCGKEY = 0x80604518
BTN_LEFT = 0x110
SETTLE_S = 2.5
N = 100
BITES = 20
LOCK = 0x0A
LOCK_AXIS, AXIS_X = 3, 0

SHAPES = {
    "held-left": lambda: scripted_mouse(0x70A1, [(1, mouse(buttons=1)), (1999, b""), (1, mouse()), (1999, b"")]),
    "clicking": lambda: scripted_mouse(0x70A2, [(1, mouse(buttons=1)), (49, b""), (1, mouse()), (49, b"")]),
    "moving-x": lambda: scripted_mouse(0x70A3, [(1, mouse(1, 0))]),
}

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


def _held(node):
    fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    try:
        st = bytearray(96)
        fcntl.ioctl(fd, EVIOCGKEY, st)
    finally:
        os.close(fd)
    return bool(st[BTN_LEFT // 8] & (1 << (BTN_LEFT % 8)))


def _left(frames):
    return [(t, v) for t, _, ks in frames for c, v in ks if c == BTN_LEFT]


def _frames(data):
    i = 0
    while i + 7 <= len(data):
        if data[i] != 0xA5:
            i += 1
            continue
        n = data[i + 3] | data[i + 4] << 8
        yield data[i + 1], bytes(data[i + 5:i + 5 + n])
        i += 7 + n


def _x_lock(kind, on):
    if kind == "stock":
        text = f"km.lock_mx({1 if on else 0})".encode()
        return lambda d: text in d
    scale = 0 if on else 100

    def hit(d):
        return any(t == LOCK and len(p) >= 6 and p[0] == LOCK_AXIS and p[1] | p[2] << 8 == AXIS_X
                   and struct.unpack_from("<h", p, 4)[0] == scale for t, p in _frames(d))
    return hit


def _latency_and_stuck(ctx):
    box = ctx.box
    node = _mouse_node(_present(ctx, "rest").usb)
    cap = EvCap(node)
    try:
        time.sleep(0.5)
        dl, ul, miss = [], [], 0
        for _ in range(N):
            cap.take()
            t0 = mono()
            box.press("left")
            f = cap.wait(lambda fr: [e for e in _left(fr) if e[1] == 1], 0.3)
            d = [e for e in _left(f) if e[1] == 1]
            t1 = mono()
            box.release("left")
            f = cap.wait(lambda fr: [e for e in _left(fr) if e[1] == 0], 0.3)
            u = [e for e in _left(f) if e[1] == 0]
            if d and u:
                dl.append(d[0][0] - t0)
                ul.append(u[0][0] - t1)
            else:
                miss += 1
            time.sleep(0.03)
        latency = {"leg": "latency", "press": stats.summary(dl), "release": stats.summary(ul), "missed": miss}
        cap.take()
        box.press("left")
        time.sleep(0.2)
        box.drop()
        time.sleep(3.0)
        stuck = {"leg": "stuck", "held_3s_after_close": _held(node)}
        box.reopen()
        box.release("left")
        time.sleep(0.2)
        stuck["held_after_release"] = _held(node)
    finally:
        cap.close()
    return latency, stuck


def _or_rule(ctx):
    box = ctx.box
    node = _mouse_node(_present(ctx, "held-left").usb)
    cap = EvCap(node)
    try:
        cap.wait(lambda fr: [e for e in _left(fr) if e[1] == 1], 5.0)
        cap.take()
        time.sleep(0.2)
        box.release("left")
        time.sleep(0.2)
        h1 = _held(node)
        box.press("left")
        time.sleep(0.2)
        box.release("left")
        time.sleep(0.2)
        h2 = _held(node)
        f = cap.wait(lambda fr: [e for e in _left(fr) if e[1] == 0], 3.0)
    finally:
        cap.close()
    return {"leg": "or_rule", "held_after_injected_release": h1, "held_after_injected_press_release": h2,
            "edges": [(round(t, 4), v) for t, v in _left(f)]}


def _mask(box, on):
    if box.kind == "stock":
        box.send(f"km.left_mask({1 if on else 0})")
    else:
        (box.lock if on else box.unlock)("left")


def _mask_leg(ctx):
    box = ctx.box
    node = _mouse_node(_present(ctx, "clicking").usb)
    cap = EvCap(node)
    try:
        time.sleep(0.5)
        cap.take()
        time.sleep(1.0)
        before = len([e for e in _left(cap.take()) if e[1] == 1])
        _mask(box, True)
        time.sleep(0.3)
        cap.take()
        time.sleep(1.0)
        during = len([e for e in _left(cap.take()) if e[1] == 1])
        box.press("left")
        time.sleep(0.1)
        inj_held = _held(node)
        box.release("left")
        time.sleep(0.1)
        _mask(box, False)
        time.sleep(0.3)
        cap.take()
        time.sleep(1.0)
        after = len([e for e in _left(cap.take()) if e[1] == 1])
    finally:
        if box.kind == "stock":
            box.send("km.left_mask(0)")
        cap.close()
    return {"leg": "mask", "physical_clicks_per_s_before": before, "during_mask": during,
            "injected_press_while_masked_held": inj_held, "after_unmask": after}


def _bite(ctx):
    box = ctx.box
    p = _present(ctx, "moving-x")
    _, ch = wire.resolve(box.port)
    _, cl = wire.resolve(p.usb)
    with wire.Wire([p.usb, box.port]) as w:
        for _ in range(BITES):
            time.sleep(0.3)
            box.lock("x")
            time.sleep(0.3)
            box.unlock("x")
        time.sleep(0.3)
    locks = wire.outs(w.events, ch, _x_lock(box.kind, True))
    unlocks = wire.outs(w.events, ch, _x_lock(box.kind, False))
    reps = [(t, d) for t, d in wire.reports(w.events, cl, 0x81)
            if len(d) >= 3 and struct.unpack_from("<h", d, 1)[0] > 0]
    bite, back, prev = [], [], None
    for t_un in unlocks:
        mine = [t for t in locks if (prev is None or t > prev) and t < t_un]
        prev = t_un
        if not mine:
            continue
        t_lock = mine[0]
        through = [t for t, _ in reps if t_lock <= t < t_un]
        bite.append((through[-1] - t_lock) / 1e6 if through else 0.0)
        t_next = next((t for t in locks if t > t_un), t_un + 500000)
        nxt = [t for t, _ in reps if t_un <= t < t_next]
        back.append((nxt[0] - t_un) / 1e6 if nxt else None)
    return {"leg": "bite", "locks": len(bite), "last_native_after_lock": stats.summary(bite),
            "first_native_after_unlock": stats.summary([u for u in back if u is not None]),
            "unlock_missing": sum(1 for u in back if u is None)}


def run(ctx):
    results = [None] * 5
    outcomes = {}
    if "rest" in ctx.legs:
        results[0], results[1] = _latency_and_stuck(ctx)
        outcomes["recovery-exit-left-button"] = "Still held" if results[1]["held_3s_after_close"] else "Released"
        ctx.log(f"latency press p50 {results[0]['press'].get('p50')} us; stuck {results[1]}")
    if "held-left" in ctx.legs:
        r = results[2] = _or_rule(ctx)
        outcomes["input-held-left-release"] = "Still held" if r["held_after_injected_release"] else "Released"
        outcomes["input-held-left-click"] = "Still held" if r["held_after_injected_press_release"] else "Released"
        ctx.log(f"or_rule {r}")
    if "clicking" in ctx.legs:
        r = results[3] = _mask_leg(ctx)
        if not r["during_mask"]:
            outcomes["input-held-injected-locked"] = "Arrives" if r["injected_press_while_masked_held"] else "Blocked"
        ctx.log(f"mask {r}")
    if "moving-x" in ctx.legs:
        r = results[4] = _bite(ctx)
        ctx.log(f"bite p50 {r['last_native_after_lock'].get('p50')} us, back p50 "
                f"{r['first_native_after_unlock'].get('p50')} us")
    return {"results": results, "outcomes": outcomes}
