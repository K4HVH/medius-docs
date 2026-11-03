"""Malformed input on each box's control port, then a valid 7-count move: does the box act on the bad bytes, does
the valid move arrive whole, and does the box still answer queries in step?

X is counted in the clone's mouse reports on the PC's USB bus. `acted` is any motion besides the valid move. Garbage
is paced at 64 bytes/ms and carries no 0xDE or 0xA5 byte, so no stock binary command or Medius frame can form by
chance. Cases:
  garbage       64 KB of random bytes
  cut           a move cut off after half its bytes; the valid move 100 ms later
  cut_now       the same, the valid move straight after
  bad_length    a move whose length field claims more than the box takes (Medius 0xFFFF; stock one byte long)
  unknown       an unknown command (Medius type 0x7E; stock `km.foo()` and binary opcode 0x90)
  short         a move shorter than a move (Medius a 2-byte payload; stock `km.move(5)`)
  bad_value     stock `km.move(a,b)` and `km.move(70000,0)`; Medius takes no text, so it has no such case
  corrupt       a 5-count move with one bit flipped in its count
  bytewise      the valid move written one byte at a time, 1 ms apart
  interleaved   100 one-count moves 1 ms apart, each followed by a stray 0x00
The valid move is stock's km.move and Medius's MOVE(NOW). A box found out of step after a case stops there.
"""
import glob
import os
import random
import time

from medius_compare import frames, layout, wire

CHECK = 7
ARRIVES = {"garbage": "link-bad-garbage", "cut": "link-bad-cut", "cut_now": "link-bad-cut-now",
           "bad_length": "link-bad-length", "unknown": "link-bad-unknown", "short": "link-bad-short",
           "corrupt": "link-bad-corrupt", "bytewise": "link-bad-bytewise"}


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


def _garbage(n, seed):
    r = random.Random(seed)
    return bytes(b for b in (r.randrange(256) for _ in range(n * 2)) if b not in (0xDE, 0xA5))[:n]


def _flip(data, byte, bit):
    b = bytearray(data)
    b[byte] ^= 1 << bit
    return bytes(b)


def _cases(kind):
    """(name, steps or None where the box has no such case, the valid move)."""
    if kind == "stock":
        def mv(dx):
            return f"km.move({dx},0)\r\n".encode()
        check = mv(CHECK)
        own = [("bad_length", [("raw", b"\xde\xad\x05\x00\x18" + frames.mak_move(5, 0)[5:]), ("sleep", 0.1)]),
               ("unknown", [("raw", b"km.foo()\r\n"), ("sleep", 0.05), ("raw", frames.mak(0x90)), ("sleep", 0.05)]),
               ("short", [("raw", b"km.move(5)\r\n"), ("sleep", 0.05)]),
               ("bad_value", [("raw", b"km.move(a,b)\r\n"), ("sleep", 0.05), ("raw", b"km.move(70000,0)\r\n"),
                              ("sleep", 0.2)]),
               ("corrupt", [("raw", _flip(mv(5), 8, 0)), ("sleep", 0.2)])]
    else:
        def mv(dx):
            return frames.move(dx, 0)
        check = frames.move(CHECK, 0, flags=frames.MOVE_NOW)
        own = [("bad_length", [("raw", bytes([frames.SOF, frames.MOVE, 0, 0xFF, 0xFF]) + mv(5)[5:-2])]),
               ("unknown", [("raw", frames.encode(0x7E, 0, b"\x00\x01")), ("sleep", 0.05)]),
               ("short", [("raw", frames.encode(frames.MOVE, 0, bytes([frames.MOTION_CURSOR, 5]))),
                          ("sleep", 0.05)]),
               ("bad_value", None),
               ("corrupt", [("raw", _flip(mv(5), 6, 0)), ("sleep", 0.2)])]
    half = mv(5)[:len(mv(5)) // 2]
    return ([("garbage", [("paced", _garbage(65536, 1))]),
             ("cut", [("raw", half), ("sleep", 0.1)]),
             ("cut_now", [("raw", half)])]
            + own
            + [("bytewise", [("bytewise", mv(CHECK))]),
               ("interleaved", [("items", [mv(1) + b"\x00"] * 100), ("sleep", 0.3)])]), check


def _play(port, steps):
    for op, arg in steps:
        if op == "raw":
            port.write(arg)
        elif op == "sleep":
            time.sleep(arg)
        elif op == "paced":
            nxt = time.monotonic()
            for i in range(0, len(arg), 64):
                port.write(arg[i:i + 64])
                nxt += 0.001
                while time.monotonic() < nxt:
                    pass
        elif op == "items":
            for item in arg:
                port.write(item)
                time.sleep(0.001)
        elif op == "bytewise":
            for i in range(len(arg)):
                port.write(arg[i:i + 1])
                time.sleep(0.001)


def _outcomes(results):
    by = {r["case"]: r for r in results if "total" in r}
    out = {row: None if case not in by else "Arrives" if by[case]["check_arrived"] else "Lost"
           for case, row in ARRIVES.items()}
    il = by.get("interleaved")
    out["link-bad-interleaved"] = None if il is None else "Arrives" if il["interleaved_delivered"] == 100 else "Lost"
    out["link-bad-parser"] = (None if not by else "Correct" if all(r["in_step"] for r in by.values())
                              else "One behind")
    return out


def run(ctx):
    p = ctx.device("rest")
    ep, lay = _mouse_in(p.usb)
    _, dev = wire.resolve(p.usb)
    box = ctx.box
    out = {"results": []}
    if box.lagging():
        out["skipped"] = "one command behind before the run began"
        out["outcomes"] = _outcomes([])
        return out
    port = _Port(box)
    try:
        if box.kind == "stock":
            box.send("km.echo(0)")
            time.sleep(0.05)
            box.drain()
        cases, check = _cases(box.kind)
        for name, steps in cases:
            if steps is None:
                out["results"].append({"case": name, "skipped": "no such input for this box"})
                continue
            time.sleep(0.3)
            port.drain()
            with wire.Wire([p.usb]) as w:
                _play(port, steps)
                if name != "bytewise":
                    port.write(check)
                time.sleep(0.6)
            total = sum(_x(d, lay) for _, d in wire.reports(w.events, dev, ep))
            extra = 100 if name == "interleaved" else 0
            rec = {"case": name, "total": total, "acted": total - CHECK,
                   "check_arrived": total - extra >= CHECK if name != "interleaved" else None,
                   "interleaved_delivered": total - CHECK if name == "interleaved" else None,
                   "replies": port.drain().decode("latin1")[-200:]}
            rec["in_step"] = port.in_step()
            out["results"].append(rec)
            ctx.log(f"{name}: total {total}, in step {rec['in_step']}")
            if not rec["in_step"]:
                break
    finally:
        port.close()
    out["outcomes"] = _outcomes(out["results"])
    return out
