"""Locks beyond X and the left button, read off the PC's USB bus.

Per target the device keeps producing the input the lock blocks; each of 10 cycles locks for 2 s and unlocks
for 1 s. Per cycle: how long after the lock's packet reaches the box's control port the input still reaches the
PC, how long it takes to reach the PC after the unlock, and what got through while locked (from 20 ms after the
lock). Back is timed from the moment the input could first show: the unlock's packet if the device holds it
then, else the start of its next press, placed by the shape's period from the last one on the bus before the
lock. Motion and the wheel come every millisecond, so their lock and unlock are timed directly. A 50 ms click
or tap times a lock or unlock only when it lands mid-press and reads ~0 otherwise, so its p50 follows the
phase: the held targets time buttons and keys, the clicks and taps what gets through.
  y           Y +1 every millisecond                  stock km.lock_my     Medius LOCK y
  y+          Y +1 three times, then -1, every ms     stock km.lock_my+    Medius LOCK y positive (only -1 may pass)
  wheel       wheel +1 every millisecond              stock km.lock_mw     Medius LOCK wheel
  right       right button 50 ms down, 50 ms up       stock km.lock_mr     Medius LOCK right; an injected right
                                                                                  press mid-lock must still land
  key         'a' 50 ms down, 50 ms up (keyboard)     stock km.mask('a')   Medius LOCK key 'a'
  right_held  right button held throughout            as right: what the PC receives while locked
  key_held    'a' held throughout                     as key
For buttons and keys "through" counts presses the PC received starting while locked; for the held cases, the
share of reports showing the usage held while locked."""
import struct
import time

from medius_compare import stats, wire
from medius_shapes.scripted import keys, mouse, scripted_keyboard, scripted_mouse

SETTLE_S = 2.5
CYCLES = 10
LOCK, INJECT = 0x0A, 0x03
HID_A = 0x04


def _y(d):
    return struct.unpack_from("<h", d, 3)[0] if len(d) >= 5 else 0


# (name, leg, stock lock and unlock, Medius target and direction, live, leaked amount, (period, live time) us)
TARGETS = [
    ("y", "y", ("km.lock_my(1)", "km.lock_my(0)"), ("y", "BOTH"),
     lambda d: _y(d) != 0, lambda d: abs(_y(d)), None),
    ("y+", "y-pos", ("km.lock_my+(1)", "km.lock_my+(0)"), ("y", "POSITIVE"),
     lambda d: _y(d) > 0, lambda d: max(0, _y(d)), None),
    ("wheel", "wheel", ("km.lock_mw(1)", "km.lock_mw(0)"), ("wheel", "BOTH"),
     lambda d: len(d) >= 6 and d[5] != 0, lambda d: int(len(d) >= 6 and d[5] != 0), None),
    ("right", "right", ("km.lock_mr(1)", "km.lock_mr(0)"), ("right", "BOTH"),
     lambda d: d[0] & 2, "edges", (100000, 50000)),
    ("key", "key", ("km.mask('a',1)", "km.mask('a',0)"), ("key", "BOTH"),
     lambda d: HID_A in d[2:8], "edges", (100000, 50000)),
    ("right_held", "right-held", ("km.lock_mr(1)", "km.lock_mr(0)"), ("right", "BOTH"),
     lambda d: d[0] & 2, "share", None),
    ("key_held", "key-held", ("km.mask('a',1)", "km.mask('a',0)"), ("key", "BOTH"),
     lambda d: HID_A in d[2:8], "share", None),
]

SHAPES = {
    "y": lambda: scripted_mouse(0x7170, [(1, mouse(0, 1))]),
    "y-pos": lambda: scripted_mouse(0x7171, [(3, mouse(0, 1)), (1, mouse(0, -1))]),
    "wheel": lambda: scripted_mouse(0x7172, [(1, mouse(0, 0, 1))]),
    "right": lambda: scripted_mouse(0x7173, [(50, mouse(buttons=2)), (50, mouse())]),
    "key": lambda: scripted_keyboard(0x7174, [(50, keys(HID_A)), (50, keys())]),
    "right-held": lambda: scripted_mouse(0x7175, [(1, mouse(buttons=2))]),
    "key-held": lambda: scripted_keyboard(0x7176, [(1, keys(HID_A))]),
}

_settled = []


def _present(ctx, leg):
    p = ctx.device(leg)
    if not any(q is p for q in _settled):
        _settled.append(p)
        time.sleep(SETTLE_S)
    return p


def _frames(data):
    i = 0
    while i + 7 <= len(data):
        if data[i] != 0xA5:
            i += 1
            continue
        n = data[i + 3] | data[i + 4] << 8
        yield data[i + 1], bytes(data[i + 5:i + 5 + n])
        i += 7 + n


def _scale(p):
    return struct.unpack_from("<h", p, 4)[0] if len(p) >= 6 else None


def _lock_target(box, name):
    m = box.medius
    if name == "y":
        return m.LockTarget.y()
    if name == "wheel":
        return m.LockTarget.wheel()
    if name == "right":
        return m.LockTarget.usage(m.Usage.button(m.Button.RIGHT))
    return m.LockTarget.usage(m.Usage.key(HID_A))


def _set_lock(box, stock_cmds, med, on):
    if box.kind == "stock":
        box.send(stock_cmds[0 if on else 1])
    else:
        target, direction = med
        d = getattr(box.medius.Direction, direction)
        (box.device.lock if on else box.device.unlock)(_lock_target(box, target), d)


def _due_after(reps, live, cycle, t_lock, t_un):
    if not cycle:
        return t_un
    period, length = cycle
    starts = [t for (tp, dp), (t, d) in zip(reps, reps[1:]) if t < t_lock and live(d) and not live(dp)]
    if not starts:
        return t_un
    s0 = starts[-1] + (t_un - starts[-1]) // period * period
    return t_un if t_un < s0 + length else s0 + period


def _target(ctx, name, leg, stock_cmds, med, live, leak, cycle):
    box = ctx.box
    p = _present(ctx, leg)
    _, ch = wire.resolve(box.port)
    _, cl = wire.resolve(p.usb)
    right = name.startswith("right")
    time.sleep(0.5)
    try:
        with wire.Wire([p.usb, box.port]) as w:
            for _ in range(CYCLES):
                _set_lock(box, stock_cmds, med, True)
                time.sleep(1.0)
                if right:
                    box.press("right")
                    time.sleep(0.2)
                    box.release("right")
                time.sleep(1.0)
                _set_lock(box, stock_cmds, med, False)
                time.sleep(1.0)
    finally:
        if box.kind == "stock":
            box.send(stock_cmds[1])
        box.leave()
    if box.kind == "stock":
        locks = wire.outs(w.events, ch, lambda d: stock_cmds[0].encode() in d)
        unlocks = wire.outs(w.events, ch, lambda d: stock_cmds[1].encode() in d)
        inj = wire.outs(w.events, ch, lambda d: b"km.right(1)" in d)
    else:
        locks = wire.outs(w.events, ch, lambda d: any(t == LOCK and _scale(q) == 0 for t, q in _frames(d)))
        unlocks = wire.outs(w.events, ch, lambda d: any(t == LOCK and _scale(q) == 100 for t, q in _frames(d)))
        inj = wire.outs(w.events, ch, lambda d: any(t == INJECT and q[:1] == b"\x00" and q[3:4] == b"\x01"
                                                    for t, q in _frames(d)))
    reps = wire.reports(w.events, cl)
    bite, back, leaks, injected = [], [], [], []
    for t_lock, t_un in zip(locks, unlocks):
        after = [t for t, d in reps if t_lock <= t < t_un and live(d)]
        within = [t for t in after if t - t_lock < 100000]
        bite.append((within[-1] - t_lock) / 1e6 if within else 0.0)
        inj_t = [t for t in inj if t_lock < t < t_un]
        win = [d for t, d in reps if t_lock + 20000 <= t < t_un and not any(0 <= t - ti < 300000 for ti in inj_t)]
        if leak == "edges":
            st = [bool(live(d)) for d in win]
            leaks.append(sum(1 for a, b in zip(st, st[1:]) if b and not a))
        elif leak == "share":
            leaks.append(round(sum(1 for d in win if live(d)) / max(1, len(win)), 3))
        else:
            leaks.append(sum(leak(d) for d in win))
        if right and inj_t:
            injected.append(any(d[0] & 2 for t, d in reps if 0 <= t - inj_t[0] < 50000))
        nxt = [t for t, d in reps if t >= t_un and live(d)]
        back.append((nxt[0] - _due_after(reps, live, cycle, t_lock, t_un)) / 1e6 if nxt else None)
    rec = {"target": name, "runs": len(locks), "still_through_after_lock": stats.summary(bite),
           "back_after_unlock": stats.summary([v for v in back if v is not None]),
           "returned": sum(v is not None for v in back), "through_while_locked": leaks}
    if right:
        rec["injected_press_landed"] = injected
    return rec


def run(ctx):
    results = []
    for name, leg, stock_cmds, med, live, leak, cycle in TARGETS:
        if leg not in ctx.legs:
            results.append(None)
            continue
        rec = _target(ctx, name, leg, stock_cmds, med, live, leak, cycle)
        results.append(rec)
        ctx.log(f"{name}: cycles {rec['runs']}, through after lock p50 {rec['still_through_after_lock'].get('p50')} "
                f"us, back p50 {rec['back_after_unlock'].get('p50')} us, through while locked "
                f"{rec['through_while_locked']}")
    return {"results": results}
