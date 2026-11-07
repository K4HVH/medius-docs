"""Wire timing from the kernel's USB monitor, as root.

The binary interface (/dev/usbmonN) is read by a child process that keeps the events of the devices asked for,
so a busy test can't make the kernel drop events. Every event of one bus is on one clock, so a command's
packet to a box's control port and the clone's report it causes can be timed against each other.

    with Wire(["1-2", "/dev/ttyACM0"]) as w:
        ...
    for e in w.events: e.ts (us), e.kind ('S'ubmit/'C'omplete/'E'rror), e.xfer (0 iso, 1 intr, 2 ctrl,
                       3 bulk), e.ep (0x80 = IN), e.dev, e.len, e.data

`lost` counts events the kernel dropped because the reader fell behind, and `cut` transfers the kernel kept
less of than they carried. Either one fails the test: such a capture can't say a report went missing.
"""
import fcntl
import os
import select
import struct
import subprocess
import sys
import threading
import time
from collections import namedtuple

from . import integrity

Event = namedtuple("Event", "ts kind xfer ep dev len data")
HDR = struct.Struct("<QBBBBHccqiiII8s")   # usbmon's binary event header
REC = struct.Struct("<qBBBBHH")           # child to parent: ts, kind, xfer, ep, dev, length, kept bytes
RING_SIZE, STATS = 0x9204, 0x80089203     # MON_IOCT_RING_SIZE; MON_IOCG_STATS (queued, dropped; read clears)
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def parse_event(b, devs, keep):
    """One usbmon event as (record for the parent, or None for another device; whether it was cut)."""
    _, typ, xt, ep, dn, _, _, flag_data, sec, usec, _, ln, lc, setup = HDR.unpack_from(b)
    if dn not in devs:
        return None, False
    cut = flag_data == b"\x00" and lc < ln
    data = bytes(setup) if xt == 2 and typ == ord("S") else bytes(b[HDR.size:HDR.size + min(lc, keep)])
    return REC.pack(sec * 1_000_000 + usec, typ, xt, ep, dn, ln, len(data)) + data, cut


def _child(bus, devs, keep):
    fd = os.open(f"/dev/usbmon{bus}", os.O_RDONLY)
    for size in (1200 * 1024, 1024 * 1024, 512 * 1024):
        try:
            fcntl.ioctl(fd, RING_SIZE, size)
            break
        except OSError:
            pass
    fcntl.ioctl(fd, STATS, bytes(8))
    out = sys.stdout.buffer
    out.write(b"R")
    out.flush()
    buf = bytearray(HDR.size + (1 << 18))
    closed, cut = None, 0
    while True:
        r, _, _ = select.select([fd] if closed else [fd, 0], [], [], 0.05 if closed else 0.2)
        if not closed and 0 in r and not os.read(0, 1):
            closed = time.time() * 1e6
            continue
        if fd not in r:
            if closed:
                break
            continue
        n = os.readv(fd, [buf])
        rec, was_cut = parse_event(memoryview(buf)[:n], devs, keep)
        if closed and time.time() * 1e6 - closed > 2e6:
            break
        if rec is None:
            continue
        if closed and REC.unpack_from(rec)[0] > closed:
            break
        cut += was_cut
        out.write(rec)
        out.flush()
    _, dropped = struct.unpack("<II", fcntl.ioctl(fd, STATS, bytes(8)))
    out.write(REC.pack(cut, ord("X"), 0, 0, 0, 0, 0) + REC.pack(dropped, ord("L"), 0, 0, 0, 0, 0))
    out.flush()


def _sysfs_usb(dev):
    path = dev if dev.startswith("/sys/") else f"/sys/bus/usb/devices/{dev}"
    with open(os.path.join(path, "busnum")) as f:
        bus = int(f.read())
    with open(os.path.join(path, "devnum")) as f:
        return bus, int(f.read())


def resolve(dev):
    """(bus, device number) of a USB device named by sysfs name (`1-2`), sysfs path, or a tty it serves."""
    if dev.startswith("/dev/"):
        name = os.path.basename(os.path.realpath(dev))
        return _sysfs_usb(os.path.realpath(f"/sys/class/tty/{name}/device/.."))
    return _sysfs_usb(dev)


class Wire:
    def __init__(self, devs, bus=None, keep=64):
        named = [d for d in devs if isinstance(d, str)]
        found = [resolve(d) for d in named]
        buses = {b for b, _ in found} | ({bus} if bus is not None else set())
        if len(buses) != 1:
            raise ValueError(f"the devices must share one bus, one clock: {devs} are on buses {sorted(buses)}")
        self.bus = buses.pop()
        self.devs = [n for _, n in found] + [d for d in devs if not isinstance(d, str)]
        self.keep = keep
        self.events = []
        self.lost = None
        self.cut = 0
        self._buf = b""

    def __enter__(self):
        code = (f"import sys; sys.path.insert(0, {HERE!r}); from medius_compare import wire; "
                f"wire._child({self.bus}, {set(self.devs)!r}, {self.keep})")
        self.p = subprocess.Popen([sys.executable, "-c", code], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  bufsize=0)
        if self.p.stdout.read(1) != b"R":
            raise RuntimeError(f"usbmon{self.bus} did not open (run as root)")
        self._t = threading.Thread(target=self._drain, daemon=True)
        self._t.start()
        return self

    def _drain(self):
        while True:
            c = self.p.stdout.read(65536)
            if not c:
                return
            self.consume(c)

    def consume(self, chunk):
        buf = self._buf + chunk
        while len(buf) >= REC.size:
            ts, typ, xt, ep, dn, ln, n = REC.unpack_from(buf)
            if len(buf) < REC.size + n:
                break
            if typ == ord("L"):
                self.lost = ts
            elif typ == ord("X"):
                self.cut = ts
            else:
                self.events.append(Event(ts, chr(typ), xt, ep, dn, ln, buf[REC.size:REC.size + n]))
            buf = buf[REC.size + n:]
        self._buf = buf

    def finish(self):
        """Report what the capture lost to the run's integrity counts."""
        if self.lost is None:
            integrity.report("usbmon_unfinished", 1)
            return
        integrity.report("usbmon_lost", self.lost)
        integrity.report("cut_transfers", self.cut)

    def __exit__(self, *a):
        self.p.stdin.close()
        self.p.wait(timeout=5)
        self._t.join(timeout=5)
        self.finish()

    def take(self):
        """The events so far, cleared."""
        ev, self.events = self.events, []
        return ev


def is_move(kind, data):
    """Whether a control-port OUT packet carries a move: Medius's MOVE frame, or stock's km.move."""
    if kind == "medius":
        return len(data) > 1 and data[0] == 0xA5 and data[1] == 0x01
    return data.startswith(b"km.move")


def outs(events, ch343, pred=lambda d: True):
    """Delivery times (us) of the control port's OUT packets whose bytes satisfy `pred`. An OUT packet's bytes
    come with its submission and its delivery with the completion."""
    t, pending = [], False
    for e in events:
        if e.dev != ch343 or e.xfer != 3 or e.ep & 0x80:
            continue
        if e.kind == "S":
            pending = pred(e.data)
        elif e.kind == "C" and pending:
            t.append(e.ts)
            pending = False
    return t


def reports(events, dev, ep=None):
    """(ts us, bytes) of every interrupt IN packet the device completed with data."""
    return [(e.ts, e.data) for e in events if e.dev == dev and e.kind == "C" and e.xfer == 1 and e.ep & 0x80
            and e.len and (ep is None or e.ep == ep)]


def move_latency(events, kind, ch343, clone, dx, field=lambda d: int.from_bytes(d[1:3], "little", signed=True)):
    """Per move, from its packet reaching the control port to the clone's reports carrying its X, in seconds:
    (first, done, reports). `field` reads X from a report (by default bytes 1-2, the test mouse's layout)."""
    sent = outs(events, ch343, lambda d: is_move(kind, d))
    ins = [(t, field(d)) for t, d in reports(events, clone) if len(d) >= 3]
    rows, j = [], 0
    for i, t0 in enumerate(sent):
        t_next = sent[i + 1] if i + 1 < len(sent) else float("inf")
        while j < len(ins) and ins[j][0] < t0:
            j += 1
        acc, first, done, n, k = 0, None, None, 0, j
        while k < len(ins) and ins[k][0] < t_next and done is None:
            t, x = ins[k]
            if x:
                n += 1
                acc += x
                first = first if first is not None else t
                if acc >= dx:
                    done = t
            k += 1
        rows.append(((first - t0) / 1e6 if first is not None else None,
                     (done - t0) / 1e6 if done is not None else None, n))
    return rows


def first_after(outs_us, reps, hit, window_us=300000):
    """Per OUT time: (latency s or None, reports that hit) for the reports after it, before the next OUT."""
    rows, j = [], 0
    for i, t0 in enumerate(outs_us):
        t1 = min(outs_us[i + 1] if i + 1 < len(outs_us) else float("inf"), t0 + window_us)
        while j < len(reps) and reps[j][0] < t0:
            j += 1
        hits = [t for t, d in reps[j:] if t < t1 and hit(d)]
        rows.append(((hits[0] - t0) / 1e6 if hits else None, len(hits)))
    return rows
