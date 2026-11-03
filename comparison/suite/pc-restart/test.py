"""The PC dropping the clone and taking it back while the box keeps its power: does injection still work after?

Two ways, five cycles each:
  port      the PC disables the hub port the clone is on for 3 s, then enables it again (the clone's bus goes and
            comes back, as when the PC restarts and its ports reset)
  deauth    the PC unconfigures the clone (sysfs authorized 0) for 3 s, then configures it again
Each cycle: the time until the clone is back with an input node, then, 0.7 s later, one immediate move of 10
counts (stock km.move_now, Medius MOVE(NOW)): whether it reaches the PC within 3 s and how fast, read off the
clone's evdev node. `reports` lists the clone's reports from the command until 50 ms after the move was whole (or
the 3 s ended), read from hidraw: ms after the command and bytes, the first 30.

Variants: `base`, a still mouse; `busy`, a mouse sending one empty report every 8 ms, so the device has always
reported recently.
"""
import time

from medius_compare import capture, devices
from medius_compare.capture import REL_X, mono
from medius_shapes import scripted

CYCLES, OFF_S, WINDOW_S, HELD_MS = 5, 3.0, 3.0, 1000
USB = "/sys/bus/usb/devices"


def busy_mouse():
    """A mouse sending one empty report every 8 ms."""
    return scripted.scripted_mouse(0x70B1, [(1, scripted.mouse(0, 0)), (7, b"")])


SHAPES = {"busy-mouse": busy_mouse}


def _read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return None


def _ident(usb):
    v, p = _read(f"{USB}/{usb}/idVendor"), _read(f"{USB}/{usb}/idProduct")
    return f"{v}:{p}".lower() if v and p else None


def _write(path, value):
    with open(path, "w") as f:
        f.write(value)


def _port_disable(usb):
    if "." not in usb:
        bus, port = usb.split("-")
        return f"{USB}/usb{bus}/{bus}-0:1.0/usb{bus}-port{port}/disable"
    hub, port = usb.rsplit(".", 1)
    return f"{USB}/{hub}:1.0/{hub}-port{port}/disable"


def _hidraw(usb, secs=2.0):
    end = time.monotonic() + secs
    while True:
        nodes = [n for n in devices.usb_nodes(usb) if "/hidraw" in n]
        if nodes or time.monotonic() > end:
            return nodes[0] if nodes else None
        time.sleep(0.02)


def _drop(usb, how):
    """Drop the clone for OFF_S and take it back; returns when the PC asked for it back."""
    path, off, on = ((_port_disable(usb), "1", "0") if how == "port" else (f"{USB}/{usb}/authorized", "0", "1"))
    _write(path, off)
    time.sleep(OFF_S)
    t0 = time.monotonic()
    _write(path, on)
    return t0


def _cycle(box, usb, want, how):
    t0 = _drop(usb, how)
    back = node = None
    while time.monotonic() - t0 < 20:
        node = capture.pointer_node(devices.usb_nodes(usb)) if _ident(usb) == want else None
        if node:
            back = time.monotonic() - t0
            break
        time.sleep(0.02)
    row = {"how": how, "back_s": round(back, 3) if back else None}
    if back is None:
        return row
    time.sleep(0.5)
    hidraw = _hidraw(usb)
    if hidraw is None:
        row["error"] = "no hidraw node"
        return row
    cap = capture.EvCap(node)
    rc = capture.RawCap(hidraw)
    try:
        lag = box.lagging()
        time.sleep(0.2)
        cap.take()
        rc.take()
        t1 = mono()
        box.move(10, 0, now=True)
        if lag:
            box.send("km.screen()")
        fr = cap.wait(lambda f: sum(x[1].get(REL_X, 0) for x in f) >= 10, WINDOW_S)
        time.sleep(0.05)
        row["reports"] = [(round((t - t1) * 1e3, 2), d.hex()) for t, d in rc.take()][:30]
        xs = [(t, r.get(REL_X, 0)) for t, r, _ in fr if r.get(REL_X, 0)]
        row["delivered"] = sum(v for _, v in xs)
        row["first_ms"] = round((xs[0][0] - t1) * 1e3, 2) if xs else None
        row["parser_lag"] = lag
    finally:
        cap.close()
        rc.close()
    return row


def _variant(ctx, leg):
    p = ctx.device(leg)
    want = f"{p.vid:04x}:{p.pid:04x}"
    results = []
    for how in ("port", "deauth"):
        for c in range(CYCLES):
            row = {**_cycle(ctx.box, p.usb, want, how), "cycle": c}
            results.append(row)
            ctx.log(f"{leg} {how} {c}: back {row['back_s']} s, first count {row.get('first_ms')} ms")
            time.sleep(1.0)
    return {"results": results}


def _outcome(rows):
    if len(rows) < CYCLES:
        return None
    held = any(r.get("first_ms") is None or r["first_ms"] > HELD_MS for r in rows)
    return "Sometimes held >1 s" if held else "Arrives at once"


def run(ctx):
    out = {"base": _variant(ctx, "still")}
    out["busy"] = _variant(ctx, "busy") if "busy" in ctx.legs else {"skipped": "needs the sim", "results": []}
    base = out["base"]["results"]
    out["outcomes"] = {"recovery-restart-move-port-cycle": _outcome([r for r in base if r["how"] == "port"]),
                       "recovery-restart-move-reconfigure": _outcome([r for r in base if r["how"] == "deauth"])}
    return out
