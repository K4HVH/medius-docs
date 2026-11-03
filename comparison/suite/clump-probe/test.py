"""The largest clump of one-count moves each box takes in one write, into a still mouse.

Each step writes one clump of N moves in a single write, sums the clone's X on its evdev node until X has been
still for 1 s (so extra counts show too), then checks that the box still answers in step and that 100 more moves
paced 1 ms apart all arrive. The refusals the box sends back (`DE AD 01 00 <op> FF`) are counted by opcode, after
the clump and after the 100. A variant stops at the first step that loses a count, leaves the box out of step, or
loses one of the 100.

Variants: `text` writes stock's `km.move(1,0)\\r\\n` (14 bytes) in clumps of 8, 16 and 18; `base` writes stock's
binary MOVE (`DE AD 04 00 18 01 00 00 00`, 9 bytes) in clumps of 8 to 256. Medius gets MOVE frames (12 bytes) in
both. A clump that leaves stock one command behind holds it there until a power cycle, so a box found one command
behind before a step is power-cycled first (`cycled_before`); one still behind after the cycle skips the variant.
"""
import re
import time

from medius_compare import capture, devices, frames
from medius_compare.capture import REL_X, mono

TEXT_MOVE = b"km.move(1,0)\r\n"
REJECT = re.compile(rb"\xde\xad\x01\x00(.)\xff", re.S)
VARIANTS = (("text", "text", (8, 16, 18)), ("base", "bin", (8, 16, 20, 24, 28, 32, 64, 128, 256)))


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


def _moves(kind, form, n):
    if kind == "medius":
        return [frames.move(1, 0, seq=i) for i in range(n)]
    return [TEXT_MOVE if form == "text" else frames.mak_move(1, 0)] * n


def _rejections(rx):
    out = {}
    for m in REJECT.finditer(rx):
        k = f"0x{m.group(1)[0]:02x}"
        out[k] = out.get(k, 0) + 1
    return out


def _paced(write, cmds, rate):
    per_ms, acc, i = rate / 1000.0, 0.0, 0
    nxt = mono()
    while i < len(cmds):
        nxt += 0.001
        acc += per_ms
        k = int(acc)
        acc -= k
        if k:
            write(b"".join(cmds[i:i + k]))
            i += k
        while mono() < nxt:
            pass


def _settle_x(cap, quiet=1.0, cap_s=120.0):
    total = 0
    end = time.monotonic() + cap_s
    idle_since = time.monotonic()
    while time.monotonic() < end:
        got = cap.take()
        if got:
            total += sum(rel.get(REL_X, 0) for _, rel, _ in got)
            idle_since = time.monotonic()
        elif time.monotonic() - idle_since > quiet:
            break
        time.sleep(0.005)
    return total


class _Clone:
    def __init__(self, ctx, leg):
        self.ctx, self.leg = ctx, leg
        self.p = ctx.device(leg)
        self.cap = capture.EvCap(capture.pointer_node(self.p.nodes))

    def ready(self):
        box = self.ctx.box
        if not box.lagging():
            return False, False
        self.close()
        self.ctx.unjam()
        p = _back(self.ctx, self.leg, self.p)
        cycled, self.p = p is not self.p, p
        self.cap = capture.EvCap(capture.pointer_node(p.nodes))
        return cycled, box.lagging()

    def close(self):
        if self.cap is not None:
            self.cap.close()
            self.cap = None


def _back(ctx, leg, old, timeout=30.0):
    end = time.monotonic() + timeout
    while capture.pointer_node(devices.usb_nodes(old.usb)) is None and time.monotonic() < end:
        time.sleep(0.1)
    return ctx.device(leg)


def _variant(ctx, port, clone, form, sizes):
    kind = ctx.box_name
    results = []
    for n in sizes:
        cycled, behind = clone.ready()
        if behind:
            return {"skipped": "one command behind after a power cycle", "cycled_before": cycled, "results": results}
        cap = clone.cap
        clump = b"".join(_moves(kind, form, n))
        time.sleep(0.5)
        cap.take()
        port.drain()
        port.write(clump)
        got = _settle_x(cap)
        time.sleep(0.3)
        rx = port.drain()
        r = {"form": "frame" if kind == "medius" else form, "clump": n, "bytes": len(clump), "x_delivered": got,
             "rx_bytes": len(rx), "rx_head": rx[:64].hex(), "rejections": _rejections(rx),
             "in_step_after": port.in_step(), "cycled_before": cycled}
        cap.take()
        _paced(port.write, _moves(kind, form, 100), 1000)
        r["verify_100"] = _settle_x(cap)
        time.sleep(0.3)
        r["verify_rejections"] = _rejections(port.drain())
        results.append(r)
        ctx.log(f"{form} clump of {n}: {got}/{n}, then {r['verify_100']}/100, in step {r['in_step_after']}"
                f"{', after a power cycle' if cycled else ''}")
        if got != n or not r["in_step_after"] or r["verify_100"] != 100:
            break
    return {"results": results}


def run(ctx):
    clone = _Clone(ctx, "rest")
    port = _Port(ctx.box)
    out = {}
    try:
        for name, form, sizes in VARIANTS:
            out[name] = _variant(ctx, port, clone, form, sizes)
    finally:
        port.close()
        clone.close()
    return out
