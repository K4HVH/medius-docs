"""What each box does with input a program held when the program exits or goes quiet.

A program presses a button or a key, or locks native input, through the box's API, then either closes the control
port, as a program exiting or crashing does (`close`), or keeps the port open and sends nothing for 10 s, as a
hung program does (`silent`). Targets:
  button     a still mouse; press left (stock km.left(1), Medius INJECT left press)
  key        a still boot keyboard; press 'a' (stock km.down(4), Medius INJECT key 0x04)
  lock_x     a mouse moving X 1, 2, 3, 4 counts a report every ms and clicking left (10 ms down, 10 ms up); lock
             X (stock km.lock_mx(1), Medius LOCK x)
  lock_left  the same mouse; lock left (stock km.lock_ml(1), Medius LOCK left)
Each case, read off the clone's evdev node: the target set, then 1 s with the program connected and talking (a
Medius query every 0.25 s; stock needs none), checked in effect. Then one state query as the program's last
command (stock km.left() / km.isdown(4) / km.lock_mx() / km.lock_ml(); Medius QUERY HEALTH), then the exit, and
5 s watched after a close or the 10 s of silence. Per case: whether the target was released (the button's or
key's release edge, or native X or a native left press back on the PC), how long after the last command and,
for `close`, after the port closed; whether it was still in effect at the end. Then the program reconnects or
speaks again and reads the box's state (stock the same query; Medius HEALTH, LOCKS and the STATS `session`
count, which rises once per release of state a program set), and whether reconnecting alone released anything.
Last, every target is released explicitly and checked clear. Three tries of each target and mode.
"""
import fcntl
import os
import time

from medius_compare import capture, devices
from medius_compare.devices import LegUnavailable
from medius_compare.capture import REL_X, mono
from medius_shapes import scripted

BTN_LEFT, KEY_A, HID_A = 0x110, 30, 0x04
EVIOCGKEY = 0x80604518
TRIES, WINDOW_S, SILENT_S, RELEASED_BY_S = 3, 5.0, 10.0, 3.0
CLICKING_PID = 0x71B2
STOCK_QUERY = {"button": "km.left()", "key": f"km.isdown({HID_A})", "lock_x": "km.lock_mx()",
               "lock_left": "km.lock_ml()"}
TARGETS = (("button", "mouse"), ("key", "keyboard"), ("lock_x", "clicking"), ("lock_left", "clicking"))
ROWS = {(t, m): f"recovery-exit-{t.replace('_', '-')}-{m}" for t, _ in TARGETS for m in ("close", "silent")}


def clicking_mouse():
    """A mouse moving X 1, 2, 3, 4 counts a report every millisecond, its left button down 10 ms and up 10 ms."""
    return scripted.scripted_mouse(CLICKING_PID, [(1, scripted.mouse((i % 4) + 1, 0, 0, 1 if i < 10 else 0))
                                                  for i in range(20)])


SHAPES = {"clicking-mouse": clicking_mouse}


def _ms(x):
    return round(x * 1e3, 1) if x is not None else None


def _held(node, code):
    fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    try:
        st = bytearray(96)
        fcntl.ioctl(fd, EVIOCGKEY, st)
    finally:
        os.close(fd)
    return bool(st[code // 8] & (1 << (code % 8)))


def _node(p, leg):
    events = [n for n in p.nodes if "/input/" in n]
    if leg == "keyboard":
        return next((n for n in events if "keyboard" in devices.kinds_of(n)), None)
    return capture.pointer_node(events)


def _keep(box, secs):
    end = mono() + secs
    while mono() < end:
        if box.kind == "medius":
            try:
                box.device.query_health()
            except box.medius.MediusError:
                pass
        time.sleep(min(0.25, max(0.0, end - mono())))


def _set(box, target):
    if target == "button":
        box.press("left")
    elif target == "key":
        box.press(f"key:{HID_A}")
    else:
        box.lock("x" if target == "lock_x" else "left")


def _clear_all(box):
    for step in (lambda: box.release("left"), lambda: box.release(f"key:{HID_A}"), lambda: box.unlock("x"),
                 lambda: box.unlock("left")):
        step()
        time.sleep(0.02)


def _state(box, target, session0=None, full=False):
    if box.kind == "stock":
        q = STOCK_QUERY[target]
        return {"query": q, "reply": box.query(q, timeout=0.5)}
    try:
        h = box.device.query_health()
        out = {"health": {"injection_active": h.injection_active, "lock_on": h.lock_on,
                          "clone_configured": h.clone_configured}}
        if full:
            out["locks"] = len(box.device.query_locks().entries)
            s = box.device.query_stats().session
            out["session_releases"] = (s - session0) & 0xFFFF if session0 is not None else None
        return out
    except box.medius.MediusError as e:
        return {"error": repr(e)}


def _gone_at(target, frames, after):
    for t, rel, keys in frames:
        if t <= after:
            continue
        if target == "button" and any(c == BTN_LEFT and v == 0 for c, v in keys):
            return t
        if target == "key" and any(c == KEY_A and v == 0 for c, v in keys):
            return t
        if target == "lock_x" and rel.get(REL_X, 0) > 0:
            return t
        if target == "lock_left" and any(c == BTN_LEFT and v == 1 for c, v in keys):
            return t
    return None


def _through(target, frames, a, b):
    if target == "lock_x":
        return sum(rel.get(REL_X, 0) for t, rel, _ in frames if a < t <= b and rel.get(REL_X, 0) > 0)
    return sum(1 for t, _, ks in frames if a < t <= b for c, v in ks if c == BTN_LEFT and v == 1)


def _in_effect(target, node, frames, now):
    if target in ("button", "key"):
        return _held(node, KEY_A if target == "key" else BTN_LEFT)
    return _through(target, frames, now - 0.5, now) == 0


def _quiet(box, mode):
    """Stop talking: close the port, or keep it open and send nothing. Returns the bare port Medius keeps open."""
    if mode == "silent":
        return box.raw() if box.kind == "medius" else None
    box.drop()
    return None


def _case(box, target, mode, node):
    r = {"target": target, "mode": mode, "lag_at_start": box.lagging()}
    cap = capture.EvCap(node)
    raw, away = None, False
    try:
        session0 = box.device.query_stats().session if box.kind == "medius" else None
        time.sleep(0.3)
        cap.take()
        _set(box, target)
        _keep(box, 0.2)
        t_hold = mono()
        _keep(box, 0.8)
        if target in ("button", "key"):
            r["held_while_connected"] = _held(node, KEY_A if target == "key" else BTN_LEFT)
        else:
            r["through_while_connected"] = _through(target, cap.peek(), t_hold, mono())
        r["state_before_exit"] = _state(box, target)
        t_last = mono()
        away = True
        raw = _quiet(box, mode)
        t_closed = mono()
        if mode == "close":
            r["close_took_ms"] = _ms(t_closed - t_last)
        time.sleep(max(0.0, t_last + (WINDOW_S if mode == "close" else SILENT_S) - mono()))
        t_end = mono()
        frames = cap.peek()
        t_gone = _gone_at(target, frames, t_last)
        r["released"] = t_gone is not None
        r["released_after_last_command_ms"] = _ms(t_gone - t_last) if t_gone else None
        if mode == "close":
            r["released_after_close_ms"] = _ms(t_gone - t_closed) if t_gone else None
        r["in_effect_at_end"] = _in_effect(target, node, frames, t_end)
        t_back = mono()
        if raw is not None:
            raw.close()
            raw = None
        if mode == "close" or box.kind == "medius":
            box.reopen()
        away = False
        if mode == "close":
            r["lag_on_reconnect"] = box.lagging()
        r["state_after"] = _state(box, target, session0, full=True)
        time.sleep(0.1)
        r["released_by_reconnect"] = (_gone_at(target, cap.peek(), t_back) is not None
                                      if r["in_effect_at_end"] else None)
        t_clear = mono()
        _clear_all(box)
        time.sleep(0.3)
        if target in ("button", "key"):
            r["clean_after"] = not _held(node, KEY_A if target == "key" else BTN_LEFT)
        else:
            r["clean_after"] = _through(target, cap.peek(), t_clear, mono()) > 0
    finally:
        if raw is not None:
            raw.close()
        if away and (mode == "close" or box.kind == "medius"):
            box.reopen()
        cap.close()
    return r


def _summary(cases):
    order, out = [], []
    for c in cases:
        if (c["target"], c["mode"]) not in order:
            order.append((c["target"], c["mode"]))
    for t, m in order:
        cs = [c for c in cases if c["target"] == t and c["mode"] == m and "released" in c]
        rel = [c["released_after_last_command_ms"] for c in cs if c["released"]]
        out.append({"target": t, "mode": m, "runs": len(cs), "released": len(rel),
                    "released_after_last_command_ms": rel,
                    "in_effect_at_end": sum(1 for c in cs if c["in_effect_at_end"]),
                    "released_by_reconnect": sum(1 for c in cs if c["released_by_reconnect"]),
                    "clean_after": sum(1 for c in cs if c["clean_after"])})
    return out


def _outcome(cases):
    if len(cases) < TRIES or any("released" not in c for c in cases):
        return None
    ok = all(c["released"] and c["released_after_last_command_ms"] <= RELEASED_BY_S * 1e3 for c in cases)
    return "Released" if ok else "Still in effect"


def run(ctx):
    box = ctx.box
    res = {"cases": [], "lag_before": box.lagging()}
    if res["lag_before"]:
        res["skipped"] = "one command behind at the start"
    else:
        for target, leg in TARGETS:
            try:
                if leg not in ctx.legs:
                    raise LegUnavailable("needs the sim")
                node = _node(ctx.device(leg), leg)
            except LegUnavailable as e:
                res["cases"] += [{"target": target, "mode": m, "skipped": str(e)}
                                 for m in ("close", "silent") for _ in range(TRIES)]
                continue
            for mode in ("close", "silent"):
                for i in range(TRIES):
                    r = _case(box, target, mode, node)
                    r["repeat"] = i
                    res["cases"].append(r)
                    ctx.log(f"{target} {mode} {i}: released {r['released']} "
                            f"after {r['released_after_last_command_ms']} ms")
                    time.sleep(0.5)
        res["lag_after"] = box.lagging()
    res["summary"] = _summary(res["cases"])
    outcomes = {row: _outcome([c for c in res["cases"] if (c["target"], c["mode"]) == key])
                for key, row in ROWS.items()}
    return {"results": [res], "outcomes": outcomes}
