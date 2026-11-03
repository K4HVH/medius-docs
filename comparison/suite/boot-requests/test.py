"""The class requests a host's HID driver sends to set a mouse up for boot protocol. The sim plays a gaming mouse
(two HID interfaces, reporting every millisecond); the PC reads its reports through hidraw for 0.6 s, then sends
SET_PROTOCOL(boot) and SET_IDLE(0) to each interface and GET_PROTOCOL to both, reads the mouse's reports through
usbfs for 0.5 s (3 bytes each once it has switched; reports held from before the switch come first), then sends
SET_PROTOCOL(report) back. 100 tries: a box that drops one now and then needs that many to show it.
Per try: which requests went unanswered (1 s timeout) or failed, and whether the real device switched. A request
left unanswered here is one a host waits out, and may reset the real device over."""
import os
import time
from collections import Counter

from medius_compare import wire
from medius_shapes.personalities import sim_module

TRIES = 100
STEPS = [("SET_PROTOCOL(boot)", 0x21, 0x0B, 0, None), ("SET_IDLE(0)", 0x21, 0x0A, 0, None)]
_KEEP = []


def _sys(usb, name):
    with open(f"/sys/bus/usb/devices/{usb}/{name}") as f:
        return f.read().strip()


def _put(path, text):
    with open(path, "w") as f:
        f.write(text)


def _node(usb):
    return f"/dev/bus/usb/{int(_sys(usb, 'busnum')):03d}/{int(_sys(usb, 'devnum')):03d}"


def _config(usb):
    return int(_sys(usb, "bConfigurationValue") or 0)


class _Taken:
    def __init__(self, usb, intfs):
        self.usb, self.intfs, self.unbound = usb, intfs, []

    def __enter__(self):
        cfg = _config(self.usb)
        for i in self.intfs:
            name = f"{self.usb}:{cfg}.{i}"
            drv = f"/sys/bus/usb/devices/{name}/driver"
            if os.path.exists(drv):
                d = os.path.basename(os.path.realpath(drv))
                _put(f"/sys/bus/usb/drivers/{d}/unbind", name)
                self.unbound.append((d, name))
        self.dev = sim_module("usbfs").RawDevice(_node(self.usb))
        for i in self.intfs:
            try:
                self.dev.claim(i)
            except OSError:
                pass
        return self.dev

    def __exit__(self, *a):
        self.dev.close()
        for d, name in self.unbound:
            try:
                _put(f"/sys/bus/usb/drivers/{d}/bind", name)
            except OSError:
                pass


def _hidraw(usb, intf):
    base = f"/sys/bus/usb/devices/{usb}/{usb}:{_config(usb)}.{intf}"
    for root, dirs, _ in os.walk(base):
        if os.path.basename(root) == "hidraw":
            for n in dirs:
                return os.open(f"/dev/{n}", os.O_RDONLY | os.O_NONBLOCK)
    return None


def _lengths(usb, ep, secs=0.6, intf=0):
    """Lengths of the packets the clone completed on `ep` over `secs`, with its hidraw node open so the PC polls."""
    fd = _hidraw(usb, intf)
    _, dev = wire.resolve(usb)
    try:
        with wire.Wire([usb]) as w:
            time.sleep(secs)
    finally:
        if fd is not None:
            os.close(fd)
    return Counter(e.len for e in w.events if e.dev == dev and e.kind == "C" and e.xfer == 1 and e.ep == ep)


def _read_lengths(dev, ep, secs=0.5):
    """Lengths of the reports read off `ep` through usbfs for `secs`, one read at a time with a 20 ms timeout, in
    order."""
    out = []
    end = time.monotonic() + secs
    while time.monotonic() < end:
        urb, buf = dev.submit_in(ep, 64)
        try:
            _, status, data = dev.reap(timeout=0.02)
        except TimeoutError:
            dev.discard(urb)
            try:
                _, status, data = dev.reap(timeout=1.0)
            except TimeoutError:
                _KEEP.append((urb, buf))
                continue
        if status == 0:
            out.append(len(data))
    return out


def _one_try(usb):
    before = _lengths(usb, 0x81)
    rows = []
    with _Taken(usb, (0, 1)) as dev:
        def ask(name, bm, rq, wv, i, wl):
            t = time.monotonic()
            try:
                r = dev.control(0, bm, rq, wv, i, b"" if wl is None else wl, timeout=1.0)
                rows.append({"request": name, "interface": i, "ok": True, "ms": round(1e3 * (time.monotonic() - t), 2)})
                return r
            except OSError as e:
                rows.append({"request": name, "interface": i, "ok": False, "error": str(e),
                             "ms": round(1e3 * (time.monotonic() - t), 1)})
                return None

        for i in (0, 1):
            for name, bm, rq, wv, wl in STEPS:
                ask(name, bm, rq, wv, i, wl)
        proto = []
        for i in (0, 1):
            r = ask("GET_PROTOCOL", 0xA1, 0x03, 0, i, 1)
            proto.append(r[0] if r else None)
        time.sleep(0.1)
        after = _read_lengths(dev, 0x81)
        for i in (0, 1):
            ask("SET_PROTOCOL(report)", 0x21, 0x0B, 1, i, None)
    first_boot = after.index(3) if 3 in after else None
    return {"report_lengths_before": dict(before), "report_lengths_after": dict(Counter(after)),
            "get_protocol": proto, "report_lengths_first": after[:12],
            "reports_before_first_boot_report": first_boot,
            "switched": first_boot is not None and set(after[first_boot:]) == {3}, "requests": rows,
            "unanswered": [r for r in rows if not r["ok"]]}


def run(ctx):
    usb = ctx.device("gaming").usb
    time.sleep(1.5)
    res = {"tries": []}
    for n in range(TRIES):
        try:
            t = _one_try(usb)
        except OSError as e:
            t = {"error": str(e)}
        t["try"] = n
        res["tries"].append(t)
        ctx.log(f"try {n}: switched {t.get('switched')} unanswered "
                f"{[(u['request'], u['interface']) for u in t.get('unanswered', [])]} {t.get('error', '')}")
        time.sleep(1.0)
    bad = [t for t in res["tries"] if t.get("unanswered") or t.get("error")]
    res["tries_with_a_request_unanswered"] = len(bad)
    res["by_request"] = {}
    for t in res["tries"]:
        for u in t.get("unanswered", []):
            key = f"{u['request']} interface {u['interface']}"
            res["by_request"][key] = res["by_request"].get(key, 0) + 1
    return {"results": [res]}
