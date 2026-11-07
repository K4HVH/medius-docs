"""A move sent the moment the clone is back after the real device is unplugged and plugged back in: how soon it
reaches the PC, and whether any of it is lost.

The program stays connected to the box throughout. Per cycle the sim disconnects (its D+ pull-up off, as an
unplug looks to the box), and 3 s after the clone has left the PC it reconnects. The moment the PC has the clone
configured again (sysfs: the device's VID:PID with bConfigurationValue set), the program sends one immediate move
of 10 counts (stock km.move_now, Medius MOVE(NOW)). Once the move has landed or 3 s have passed, a control move of
3 counts, given 1 s, tells a lost move from a box that is not injecting at all.

Read off the PC's USB bus: the box's control port and every device number free on the clone's bus when the
capture starts, since the clone comes back under a new one. The device sends no X, so all X on the clone is
injected. Per move: ms from its packet reaching the control port to the first and the last of its counts on the
bus, counts delivered, lost and extra. Against the move's packet: when the PC sent the clone SET_CONFIGURATION,
first polled its interrupt IN, and got its first report. And the evdev view, timed from the write: the clone's
node is opened as soon as it exists, so counts the PC took before then are on the bus but not in the evdev totals.

Shapes: a mouse sending one empty report every 2 s, and one every 8 ms. Ten cycles each. A box one command behind
at the start is skipped.
"""
import glob
import os
import time

from medius_compare import capture, devices, layout, stats, wire
from medius_compare.capture import REL_X, mono
from medius_shapes import scripted

CYCLES, DX, CTRL, AWAY_S, WINDOW_S = 10, 10, 3, 3.0, 3.0
USB = "/sys/bus/usb/devices"


def slow_mouse():
    """A mouse sending one empty report every 2 s."""
    return scripted.scripted_mouse(0x71C0, [(1, scripted.mouse(0, 0)), (1999, b"")])


def busy_mouse():
    """A mouse sending one empty report every 8 ms."""
    return scripted.scripted_mouse(0x71C1, [(1, scripted.mouse(0, 0)), (7, b"")])


SHAPES = {"slow-mouse": slow_mouse, "busy-mouse": busy_mouse}


def _ms(x):
    return round(x * 1e3, 2) if x is not None else None


def _read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return None


def _ident(usb):
    v, p = _read(f"{USB}/{usb}/idVendor"), _read(f"{USB}/{usb}/idProduct")
    return f"{v}:{p}".lower() if v and p else None


def _configured(usb):
    return _read(f"{USB}/{usb}/bConfigurationValue") not in (None, "", "0")


def _mouse_in(usb):
    """The clone's mouse: its interrupt IN endpoint and report layout, from sysfs."""
    for rd in sorted(glob.glob(f"{USB}/{usb}/{usb}:*/*:*/report_descriptor")):
        with open(rd, "rb") as f:
            lay = layout.mouse_layout(f.read())
        if lay is None:
            continue
        itf = os.path.dirname(os.path.dirname(rd))
        for ep in sorted(glob.glob(f"{itf}/ep_*")):
            if _read(f"{ep}/direction") == "in" and _read(f"{ep}/type") == "Interrupt":
                return int(os.path.basename(ep)[3:], 16), lay
    raise RuntimeError(f"no mouse with an interrupt IN endpoint on {usb}")


def _x(report, lay):
    if lay.report_id and report[:1] != bytes([lay.report_id]):
        return 0
    if len(report) * 8 < lay.x[0] + lay.x[1]:
        return 0
    return layout.field(report, lay.x)


def _free_devnums(bus):
    used = set()
    for d in os.listdir(USB):
        if ":" in d:
            continue
        if _read(f"{USB}/{d}/busnum") == str(bus):
            try:
                used.add(int(_read(f"{USB}/{d}/devnum")))
            except (TypeError, ValueError):
                pass
    return set(range(1, 128)) - used


def _move_now(box, dx):
    if box.kind == "stock":
        box.send(f"km.move_now({dx},0)")
    else:
        box.move(dx, 0, now=True)


class _XWatch:
    """Running total of X in the clone's reports on the bus, scanning only events new since the last call."""

    def __init__(self, w, dev, ep, lay):
        self.w, self.dev, self.ep, self.lay, self.i, self.x = w, dev, ep, lay, 0, 0

    def total(self):
        ev = self.w.events
        n = len(ev)
        for e in ev[self.i:n]:
            if e.dev == self.dev and e.kind == "C" and e.xfer == 1 and e.ep == self.ep and e.len:
                self.x += _x(e.data, self.lay)
        self.i = n
        return self.x


def _wait_for(pred, secs):
    end = mono() + secs
    while mono() < end:
        if pred():
            return True
        time.sleep(0.005)
    return pred()


def _follow(outs, reps, targets):
    rows = []
    for i, t0 in enumerate(outs[:len(targets)]):
        t1 = outs[i + 1] if i + 1 < len(outs) else float("inf")
        hits = [(t, x) for t, x in reps if t0 <= t < t1 and x]
        acc, done = 0, None
        for t, x in hits:
            acc += x
            if done is None and acc >= targets[i]:
                done = t
        rows.append({"first_ms": _ms((hits[0][0] - t0) / 1e6) if hits else None,
                     "done_ms": _ms((done - t0) / 1e6) if done is not None else None,
                     "delivered": acc, "lost": max(0, targets[i] - acc), "extra": max(0, acc - targets[i]),
                     "reports": len(hits)})
    return rows


def _first_ts(events, pred):
    return next((e.ts for e in events if pred(e)), None)


def _reconnect(ctx):
    s = ctx.sim()
    try:
        s.reconnect(settle=0)
    finally:
        s.close()


def _cycle(ctx, usb, want, ep, lay, ch343):
    box = ctx.box
    row = {}
    s = ctx.sim()
    try:
        t0 = time.monotonic()
        s.disconnect()
    finally:
        s.close()
    gone = None
    while time.monotonic() - t0 < 6.0:
        if _ident(usb) != want:
            gone = time.monotonic() - t0
            break
        time.sleep(0.005)
    row["clone_gone_s"] = round(gone, 3) if gone is not None else None
    time.sleep(AWAY_S)
    bus = int(usb.split("-")[0])
    devs = _free_devnums(bus)
    try:
        devs.add(wire.resolve(usb)[1])
    except (OSError, ValueError):
        pass
    cap, frames, t_send, t_ctrl, t_open, back = None, [], None, None, None, False
    try:
        with wire.Wire(sorted(devs) + ([box.port] if ch343 else []), bus=bus) as w:
            _reconnect(ctx)
            back = True
            t1 = mono()
            t_back = None
            while mono() - t1 < 30.0:
                if _ident(usb) == want and _configured(usb):
                    t_back = mono()
                    break
                time.sleep(0.001)
            if t_back is None:
                row["back_s"] = None
                return row
            t_send = mono()
            _move_now(box, DX)
            row["back_s"] = round(t_back - t1, 3)
            dev = wire.resolve(usb)[1]
            xw = _XWatch(w, dev, ep, lay)
            end = mono() + 2.0
            node = None
            while node is None and mono() < end:
                node = capture.pointer_node(devices.usb_nodes(usb))
                if node is None:
                    time.sleep(0.01)
            if node:
                cap = capture.EvCap(node)
                t_open = mono()
            _wait_for(lambda: xw.total() >= DX, max(0.0, t_send + WINDOW_S - mono()))
            time.sleep(0.2)
            x1 = xw.total()
            t_ctrl = mono()
            _move_now(box, CTRL)
            _wait_for(lambda: xw.total() - x1 >= CTRL, 1.0)
            time.sleep(0.2)
    finally:
        if not back:
            _reconnect(ctx)
        if cap:
            frames = cap.peek()
            cap.close()
    ev = w.events
    outs = wire.outs(ev, ch343, lambda d: wire.is_move(box.kind, d)) if ch343 else []
    reps = [(t, _x(d, lay)) for t, d in wire.reports(ev, dev, ep)]
    moves = _follow(outs, reps, [DX, CTRL])
    row["move_packets_seen"] = len(outs)
    row["move"] = moves[0] if moves else None
    row["control"] = moves[1] if len(moves) > 1 else None
    if outs:
        t_out = outs[0]

        def rel(t):
            return _ms((t - t_out) / 1e6) if t is not None else None

        row["x_before_move"] = sum(x for t, x in reps if t < t_out)
        row["vs_move_packet_ms"] = {
            "set_configuration": rel(_first_ts(ev, lambda e: e.dev == dev and e.xfer == 2 and e.kind == "S"
                                               and e.data[:2] == b"\x00\x09")),
            "first_poll": rel(_first_ts(ev, lambda e: e.dev == dev and e.xfer == 1 and e.kind == "S"
                                        and e.ep & 0x80)),
            "first_report": rel(_first_ts(ev, lambda e: e.dev == dev and e.xfer == 1 and e.kind == "C"
                                          and e.ep & 0x80 and e.len)),
        }
    xe = [(t, r.get(REL_X, 0)) for t, r, _ in frames if r.get(REL_X, 0)]
    m1 = [(t, x) for t, x in xe if t_send <= t < t_ctrl]
    m2 = [(t, x) for t, x in xe if t >= t_ctrl]
    row["evdev"] = {"opened_ms": _ms(t_open - t_send) if t_open else None,
                    "move_first_ms": _ms(m1[0][0] - t_send) if m1 else None, "move_x": sum(x for _, x in m1),
                    "control_first_ms": _ms(m2[0][0] - t_ctrl) if m2 else None, "control_x": sum(x for _, x in m2)}
    return row


def _shape(ctx, name):
    p = ctx.device(name)
    want = f"{p.vid:04x}:{p.pid:04x}"
    ep, lay = _mouse_in(p.usb)
    box_bus, ch343 = wire.resolve(ctx.box.port)
    note = None
    if box_bus != int(p.usb.split("-")[0]):
        note = "the box's control port is on another bus than the clone: no move packet times"
        ch343 = None
    rows = []
    for c in range(CYCLES):
        row = _cycle(ctx, p.usb, want, ep, lay, ch343)
        row["cycle"] = c
        rows.append(row)
        ctx.log(f"{name} cycle {c}: back {row.get('back_s')} s, move {row.get('move')}")
        time.sleep(1.0)
    mv = [r["move"] for r in rows if r.get("move")]
    ct = [r["control"] for r in rows if r.get("control")]
    sh = {"shape": name, "rows": rows,
          "back": stats.summary([r["back_s"] for r in rows if r.get("back_s")], scale=1, unit="s"),
          "move_first": stats.summary([m["first_ms"] for m in mv if m["first_ms"] is not None], scale=1, unit="ms"),
          "move_done": stats.summary([m["done_ms"] for m in mv if m["done_ms"] is not None], scale=1, unit="ms"),
          "moves_with_loss": sum(1 for m in mv if m["lost"]), "counts_lost": sum(m["lost"] for m in mv),
          "moves_with_extra": sum(1 for m in mv if m["extra"]),
          "moves_not_seen": sum(1 for r in rows if not r.get("move")),
          "controls_delivered": sum(1 for m in ct if not m["lost"]), "controls": len(ct)}
    if note:
        sh["note"] = note
    return sh


def run(ctx):
    box = ctx.box
    res = {"shapes": [], "lag_before": box.lagging()}
    if res["lag_before"]:
        res["skipped"] = "one command behind at the start"
        return {"results": [res]}
    for name in ("idle", "busy"):
        res["shapes"].append(_shape(ctx, name))
    res["lag_after"] = box.lagging()
    return {"results": [res]}
