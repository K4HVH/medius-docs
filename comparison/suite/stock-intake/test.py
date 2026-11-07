"""Where each box's control-port intake gives out: one-count moves in single writes and paced fast, counted in
the clone's reports on the PC's USB bus.

An overload can leave stock's parser one command behind until it is powered off. A box found one command behind
before a step is power-cycled first (`cycled_before`), so every step starts in step; one still behind after the
cycle has that step recorded as skipped. Medius gets the same steps, as MOVE frames (12 bytes). Steps, each into a
still mouse:
  sweep    one write of N moves: stock's binary MOVE (9 bytes) N = 28-32, 64, 256; stock's text `km.move(1,0)`
           (14 bytes) N = 18-21; text `km.move(0000001,0)` (20 bytes) N = 12-14, which tells a limit in bytes from
           one in commands
  paced    binary moves paced in 1 ms batches for 2 s at 5,000, 7,000, 10,000, 15,000 and 20,000/s
  text8k   `km.move(1,0)` paced at 8,000/s for 2 s, three times
Per step: moves delivered, refusals (`DE AD 01 00 18 FF` and `ERR`), and whether the box answers in step after.
Every step keeps its place in `results`, run or skipped.
"""
import glob
import os
import time

from medius_compare import capture, devices, frames, layout, wire

BIN = frames.mak_move(1, 0)
TEXT = b"km.move(1,0)\r\n"
LONG = b"km.move(0000001,0)\r\n"
MED = frames.move(1, 0)
STEPS = ([("sweep", "binary 9 B", BIN, n) for n in (28, 29, 30, 31, 32, 64, 256)]
         + [("sweep", "text 14 B", TEXT, n) for n in (18, 19, 20, 21)]
         + [("sweep", "text 20 B", LONG, n) for n in (12, 13, 14)]
         + [("paced", "binary", BIN, r) for r in (5000, 7000, 10000, 15000, 20000)]
         + [("text8k", f"text 14 B, run {i}", TEXT, 8000) for i in (1, 2, 3)])
PACED_S = 2.0


class _Port:
    """The box's control port as bytes. Medius takes its frames on the bare port with the package closed, and
    answers a query through the package between writes."""

    def __init__(self, box):
        self.box = box
        self.raw = box.raw() if box.kind == "medius" else None

    def write(self, data):
        (self.raw or self.box).write(data)

    def drain(self):
        if self.raw is None:
            return self.box.drain()
        got = b""
        while chunk := self.raw.read():
            got += chunk
        return got

    def in_step(self):
        if self.raw is None:
            return not self.box.lagging()
        self.raw.close()
        try:
            self.box.reopen()
            self.box.device.query_health()
            ok = True
        except self.box.medius.MediusError:
            ok = False
        self.raw = self.box.raw()
        return ok

    def close(self):
        if self.raw is not None:
            self.raw.close()
            self.raw = None
            self.box.reopen()


def _read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return ""


def _mouse_in(usb):
    """The clone's mouse: its interrupt IN endpoint and report layout, from sysfs."""
    for rd in sorted(glob.glob(f"/sys/bus/usb/devices/{usb}/{usb}:*/*:*/report_descriptor")):
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


def _paced(write, frame, rate, secs):
    per_ms = max(1, rate // 1000)
    nxt = time.monotonic()
    for _ in range(int(secs * 1000)):
        write(frame * per_ms)
        nxt += 0.001
        while time.monotonic() < nxt:
            pass
    return per_ms * int(secs * 1000)


def _send(port, part, frame, arg):
    if part == "sweep":
        port.write(frame * arg)
        return arg
    return _paced(port.write, frame, arg, PACED_S)


def _delivered(usb, ep, lay, send):
    _, dev = wire.resolve(usb)
    with wire.Wire([usb]) as w:
        sent = send()
        last, end, n = time.monotonic(), time.monotonic() + 8, 0
        while time.monotonic() < end:
            time.sleep(0.25)
            m = len(w.events)
            if m != n:
                n, last = m, time.monotonic()
            elif time.monotonic() - last > 1.0:
                break
    return sent, sum(_x(d, lay) for _, d in wire.reports(w.events, dev, ep))


def _outcome(steps):
    if any("in_step" not in s for s in steps):
        return None
    ok = [s["in_step"] for s in steps]
    if all(ok):
        return "In step"
    return "Sometimes one command behind until a power cycle" if any(ok) else "One command behind until a power cycle"


def _back(ctx, leg, old, timeout=30.0):
    end = time.monotonic() + timeout
    while capture.pointer_node(devices.usb_nodes(old.usb)) is None and time.monotonic() < end:
        time.sleep(0.1)
    return ctx.device(leg)


def run(ctx):
    p = ctx.device("rest")
    ep, lay = _mouse_in(p.usb)
    box = ctx.box
    port = _Port(box)
    results = []
    try:
        for i, (part, form, frame, arg) in enumerate(STEPS):
            rec = {"step": i, "part": part, "slot": form, "n_or_rate": arg}
            if box.kind == "medius":
                frame, form = MED, "frame 12 B"
            rec["form"] = form
            rec["cycled_before"] = False
            if box.lagging():
                ctx.unjam()
                q = _back(ctx, "rest", p)
                rec["cycled_before"], p = q is not p, q
                ep, lay = _mouse_in(p.usb)
                if box.lagging():
                    rec["skipped"] = "one command behind after a power cycle"
                    results.append(rec)
                    ctx.log(f"{part} {rec['slot']} {arg}: skipped, one command behind after a power cycle")
                    continue
            if box.kind == "stock":
                box.send("km.echo(0)")
                time.sleep(0.05)
            port.drain()
            rec["bytes"] = len(frame) * arg if part == "sweep" else None
            sent, x = _delivered(p.usb, ep, lay, lambda: _send(port, part, frame, arg))
            rx = port.drain()
            rec.update(sent=sent, delivered=x, refused=rx.count(b"\xde\xad\x01\x00\x18\xff") + rx.count(b"ERR"),
                       in_step=port.in_step())
            results.append(rec)
            ctx.log(f"{part} {rec['slot']} {arg}: {x}/{sent}, in step {rec['in_step']}"
                    f"{', after a power cycle' if rec['cycled_before'] else ''}")
    finally:
        port.close()
    return {"results": results,
            "outcomes": {"link-write-parser-29": _outcome(results[1:2]),
                         "link-write-parser-30": _outcome(results[2:3]),
                         "link-fast-parser-10000": _outcome(results[16:17]),
                         "link-fast-parser-15000": _outcome(results[17:18]),
                         "link-fast-parser-20000": _outcome(results[18:19]),
                         "link-fast-parser-text-8000": _outcome(results[19:22])}}
