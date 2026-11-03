"""Reading the clone's input nodes.

A reader that falls behind loses events in the kernel: evdev flushes its client's buffer and inserts
SYN_DROPPED, and hidraw drops reports with no marker. A test's pacing loop holds Python's interpreter lock for
milliseconds at a time, so each node is drained by a child process doing nothing else, into a 1 MB pipe the
test reads at leisure. A hidraw read keeps its boundary and its read time: each is framed [t f64][len u16][bytes].
"""
import fcntl
import os
import select
import struct
import subprocess
import sys
import threading
import time

from . import integrity

EVIOCSCLOCKID = 0x400445A0
EVIOCGBIT_REL = 0x80084522
CLOCK_MONOTONIC = 1
EV_SYN, EV_KEY, EV_REL = 0, 1, 2
SYN_REPORT, SYN_DROPPED = 0, 3
REL_X, REL_Y, REL_HWHEEL, REL_WHEEL = 0, 1, 6, 8
EV = struct.Struct("llHHi")
F_SETPIPE_SZ = 1031

_PUMP = r'''
import os, select, struct, sys, time
fd, framed = int(sys.argv[1]), sys.argv[2] == "1"
def put(b):
    while b:
        b = b[os.write(1, b):]
while True:
    select.select([fd], [], [])
    try:
        d = os.read(fd, 65536)
    except BlockingIOError:
        continue
    except OSError:
        break
    if not d:
        break
    try:
        put(struct.pack("<dH", time.clock_gettime(time.CLOCK_MONOTONIC), len(d)) + d if framed else d)
    except OSError:
        break
'''


def mono():
    return time.clock_gettime(time.CLOCK_MONOTONIC)


def _pump(fd, framed):
    proc = subprocess.Popen([sys.executable, "-c", _PUMP, str(fd), "1" if framed else "0"], pass_fds=(fd,),
                            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE)
    rfd = proc.stdout.fileno()
    try:
        fcntl.fcntl(rfd, F_SETPIPE_SZ, 1 << 20)
    except OSError:
        pass
    os.set_blocking(rfd, False)
    return proc, rfd


def _unpump(proc):
    proc.terminate()
    try:
        proc.wait(1)
    except subprocess.TimeoutExpired:
        proc.kill()
    proc.stdout.close()


class EvDecoder:
    """evdev events to frames, one per SYN_REPORT: (t, {REL code: summed value}, [(KEY code, value)])."""

    def __init__(self):
        self.frames = []
        self.syn_dropped = 0
        self.lock = threading.Lock()
        self._rem = b""
        self._rel, self._keys = {}, []
        self._first = True

    def feed(self, data):
        data = self._rem + data
        n = len(data) - len(data) % EV.size
        self._rem = data[n:]
        for i in range(0, n, EV.size):
            sec, usec, typ, code, val = EV.unpack_from(data, i)
            first, self._first = self._first, False
            if typ == EV_REL:
                self._rel[code] = self._rel.get(code, 0) + val
            elif typ == EV_KEY:
                self._keys.append((code, val))
            elif typ == EV_SYN and code == SYN_REPORT:
                with self.lock:
                    self.frames.append((sec + usec / 1e6, self._rel, self._keys))
                self._rel, self._keys = {}, []
            elif typ == EV_SYN and code == SYN_DROPPED:
                # Setting the clock at open flushes a node with events waiting and marks it once.
                if not first:
                    self.syn_dropped += 1
                self._rel, self._keys = {}, []

    def take(self):
        with self.lock:
            f, self.frames = self.frames, []
        return f

    def peek(self):
        with self.lock:
            return list(self.frames)

    def finish(self):
        integrity.report("evdev_dropped", self.syn_dropped)


class EvCap(EvDecoder):
    """One evdev node, kernel timestamps on CLOCK_MONOTONIC."""

    def __init__(self, node):
        super().__init__()
        self.node = node
        self.fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
        fcntl.ioctl(self.fd, EVIOCSCLOCKID, struct.pack("i", CLOCK_MONOTONIC))
        self.running = True
        self.proc, self.rfd = _pump(self.fd, False)
        self.t = threading.Thread(target=self._run, daemon=True)
        self.t.start()

    def _run(self):
        while self.running:
            r, _, _ = select.select([self.rfd], [], [], 0.05)
            if not r:
                continue
            try:
                data = os.read(self.rfd, 1 << 20)
            except BlockingIOError:
                continue
            except OSError:
                break
            if not data:
                break
            self.feed(data)

    def wait(self, pred, timeout):
        """Wait until pred(frames) is true; returns the frames so far, not cleared."""
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            f = self.peek()
            if pred(f):
                return f
            time.sleep(0.0005)
        return self.peek()

    def close(self):
        self.running = False
        self.t.join(1)
        _unpump(self.proc)
        os.close(self.fd)
        self.finish()


class RawCap:
    """One hidraw node; each read is one report, stamped on CLOCK_MONOTONIC when the child read it."""

    HDR = struct.Struct("<dH")

    def __init__(self, node):
        self.node = node
        self.fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
        self.reports = []
        self.lock = threading.Lock()
        self.running = True
        self.proc, self.rfd = _pump(self.fd, True)
        self.t = threading.Thread(target=self._run, daemon=True)
        self.t.start()

    def _run(self):
        buf = b""
        while self.running:
            r, _, _ = select.select([self.rfd], [], [], 0.05)
            if not r:
                continue
            try:
                data = os.read(self.rfd, 1 << 20)
            except BlockingIOError:
                continue
            except OSError:
                break
            if not data:
                break
            buf += data
            got = []
            while len(buf) >= self.HDR.size:
                t, n = self.HDR.unpack_from(buf)
                if len(buf) < self.HDR.size + n:
                    break
                got.append((t, buf[self.HDR.size:self.HDR.size + n]))
                buf = buf[self.HDR.size + n:]
            if got:
                with self.lock:
                    self.reports.extend(got)

    def take(self):
        with self.lock:
            r, self.reports = self.reports, []
        return r

    def close(self):
        self.running = False
        self.t.join(1)
        _unpump(self.proc)
        os.close(self.fd)


def pointer_node(nodes):
    """The evdev node among `nodes` that reports REL_X: the mouse."""
    for node in nodes:
        if not os.path.basename(node).startswith("event"):
            continue
        try:
            fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
        except OSError:
            continue
        try:
            bits = bytearray(8)
            fcntl.ioctl(fd, EVIOCGBIT_REL, bits)
            if bits[0] & 0x03:
                return node
        except OSError:
            pass
        finally:
            os.close(fd)
    return None
