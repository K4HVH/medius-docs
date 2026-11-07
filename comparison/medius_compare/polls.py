"""Report timing on the PC's poll grid, from usbmon stamps.

usbmon stamps a completion when the kernel hands the transfer back, sometimes 0.2-2 ms after the bus carried
it and never early. An interrupt endpoint polled every P carries each report on a poll, so on the bus a report
can only move by whole polls. Each report is placed on the poll its stamp sits on, and a stamp off the grid
(stamped late) is left unjudged.

The test devices tick on their host's frames, so a device never drifts across a poll. What the hosts and a
box add shows as a report off the local pattern, or a step in the pattern: a poll that took no report, every
report after it a poll later.
"""
import contextlib
import os
import struct

EPS_US = 15.0     # a stamp this close to a poll is on it: on-grid stamps sit within 11 us (p99.9)
WINDOW = 25       # judged reports either side of the local pattern
TRACK = 0.1       # how fast the grid's phase follows its drift against the stamping clock


@contextlib.contextmanager
def awake():
    """Keep the CPUs out of deep idle while a capture runs (/dev/cpu_dma_latency at 0). Waking from it for
    each completion spread a 125 Hz stream's stamps to sd 20-29 us, past the grid's tolerance; held, 6-11 us."""
    fd = os.open("/dev/cpu_dma_latency", os.O_WRONLY)
    try:
        os.write(fd, struct.pack("<i", 0))
        yield
    finally:
        os.close(fd)


def place(stamps_us, poll_us):
    """Each stamp's poll number, or None for a stamp off the grid."""
    if not stamps_us:
        return []
    t0 = stamps_us[0]
    head = [(t - t0) % poll_us for t in stamps_us[:64]]
    bins = {}
    for m in head:
        b = int(m // 5)
        bins[b] = bins.get(b, 0) + 1
    peak = max(bins, key=bins.get) * 5 + 2.5
    near = [x for x in (((m - peak + poll_us / 2) % poll_us) - poll_us / 2 for m in head) if abs(x) <= EPS_US]
    phase = t0 + peak + (sum(near) / len(near) if near else 0.0)
    slots = []
    for t in stamps_us:
        n = round((t - phase) / poll_us)
        off = t - phase - n * poll_us
        if abs(off) <= EPS_US:
            slots.append(n)
            phase += TRACK * off
        else:
            slots.append(None)
    return slots


def _median(xs):
    s = sorted(xs)
    return s[len(s) // 2]


def timing(stamps_us, poll_us, ticks=None, tick_us=None):
    """Judge a stream's reports against the poll grid. `ticks` is the device tick each report was made on
    (every `tick_us`); by default one report per poll. Returns the reports judged and left unjudged, the
    reports a poll early or late, and the polls missed (steps in the pattern, each poll it moved counted)."""
    ticks = list(range(len(stamps_us))) if ticks is None else ticks
    k = round((tick_us or poll_us) / poll_us)
    slots = place(stamps_us, poll_us)
    nxt = None
    for j in range(len(slots) - 1, -1, -1):
        if slots[j] is None:
            continue
        if nxt is not None and slots[j] >= nxt:
            slots[j] = None
            continue
        nxt = slots[j]
    d = [s - k * i for s, i in zip(slots, ticks) if s is not None]
    base = [_median(d[max(0, j - WINDOW):j + WINDOW + 1]) for j in range(len(d))]
    return {"poll_us": poll_us, "reports": len(d), "unjudged": len(slots) - len(d),
            "early_late": sum(1 for x, b in zip(d, base) if x != b),
            "missed": sum(abs(b - a) for a, b in zip(base, base[1:]))}


def poll_us(dev, intf=0, ep=0x81):
    """How often the PC polls an endpoint of the USB device at sysfs path `dev`, in us."""
    try:
        with open(f"{dev}:1.{intf}/ep_{ep:02x}/interval") as f:
            v = f.read().strip()
    except OSError:
        return None
    return float(v[:-2]) * 1000 if v.endswith("ms") else float(v[:-2]) if v.endswith("us") else None


def burst_ticks(index, first, seq, run=7, rest=3):
    """Ticks for a counter that wraps at `seq`, with `rest` silent ticks after every `run` reports from the
    start of each wrap, the first report's counter value `first`."""
    cycle = seq + rest * (seq // run)
    return [(n // seq) * cycle + n % seq + rest * ((n % seq) // run) for n in (first + i for i in index)]


def sequence_index(vals, seq):
    """A running index from a counter that wraps at `seq`: a lost report leaves a gap, a repeat holds the place."""
    out, at = [], 0
    for j, v in enumerate(vals):
        if j:
            step = (v - vals[j - 1]) % seq
            at += step if step < seq // 2 else step - seq
        out.append(at)
    return out
