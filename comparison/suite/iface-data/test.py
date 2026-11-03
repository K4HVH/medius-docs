"""Data through every IN endpoint of the box's clone: a clone of an interface the box can't serve delivers nothing
there, which is worse than refusing the device.

Per shape and endpoint, the sim streams a counter on that endpoint: a full-size packet each interval, every byte one
more than the last, the first byte one more than the previous packet's first. The PC reads it through usbfs with
eight transfers queued, its interface taken from any kernel driver (and left so) and switched to the endpoint's
alternate setting, for 2 s. The sim's built-in devices stream the endpoint the sim always feeds, 1,000 packets a second; shapes from
medius_shapes.clone_cases are presented once per IN endpoint with the counter moved to it, at the interval the
device declares. Per endpoint: packets read and their rate against the native rate, the clone's interval and packet
size, counter steps other than one (packets lost or repeated on the way), and packets of the wrong length or
contents. The sim's pump waits while its queue is full, so a box that reads slowly shows fewer packets, not gaps. Not
read: an isochronous endpoint (the sim never feeds one) and a control endpoint (control transfers, not a stream).

Medius runs as it ships, imperfect clones off; the shapes it refuses are then presented again with imperfect clones
on (the `imperfect` pass). Stock has no such setting.

Outcomes, per row's endpoints: not cloned; an endpoint missing from the clone, or delivering <95% of the native
rate, sends nothing; otherwise every endpoint runs at the native rate.
"""
import copy
import ctypes
import fcntl
import os
import struct
import time

from medius_shapes import clone_cases, core
from medius_shapes.personalities import builtin, sim_module

SECS = 2.0
BUILTIN_RATE = 1000.0
OUTCOMES = ("Every endpoint at the native rate", "Not cloned", "An endpoint sends nothing")
# The sim's built-in devices: name and arguments, PID, the endpoint the sim streams a counter on.
BUILTIN = [
    (["vendorintr"], 0x6140, 0x82),
    (["vendintrep", "0x84"], 0x6184, 0x84),
    (["vendintrep", "0x85"], 0x6185, 0x85),
    (["vendintrep", "0x86"], 0x6186, 0x86),
    (["vendintrep", "0x87"], 0x6187, 0x87),
    (["altsetting"], 0x6143, 0x82),
    (["cdcnotify"], 0x6146, 0x82),
    (["hidtwoin"], 0x6149, 0x82),
    (["vendbulkhigh"], 0x6145, 0x85),
    (["hidbulkin"], 0x6144, 0x82),
    (["vendorbulk", "1000", "0"], 0x6141, 0x83),
    (["widehid", "65", "65"], 0x6151, 0x81),        # 65-byte reports, one more than a full-speed packet holds
]
BUILT = [clone_cases.two_high_in, clone_cases.five_in, clone_cases.six_in, clone_cases.ten_interfaces,
         clone_cases.high_interface, core.xinput, clone_cases.five_hid_interfaces]
ROWS = {"vendorintr": "vendorintr", "vendintrep-0x84": "vendintrep 0x84", "vendintrep-0x85": "vendintrep 0x85",
        "vendintrep-0x86": "vendintrep 0x86", "vendintrep-0x87": "vendintrep 0x87", "altsetting": "altsetting",
        "cdcnotify": "cdcnotify", "hidtwoin": "hidtwoin", "vendbulkhigh": "vendbulkhigh", "hidbulkin": "hidbulkin",
        "vendorbulk-1000-0": "vendorbulk 1000 0", "widehid-65-65": "widehid 65 65", "two-high-in": "two_high_in",
        "five-in": "five_in", "six-in": "six_in", "ten-interfaces": "ten_interfaces",
        "high-interface": "high_interface", "xinput": "xinput", "five-hid": "five_hid_interfaces"}

_U = ord("U")
_IOCTL = (3 << 30) | (16 << 16) | (_U << 8) | 18
_GETDRIVER = (1 << 30) | (260 << 16) | (_U << 8) | 8
_DISCONNECT = (_U << 8) | 22
_SETINTERFACE = (2 << 30) | (8 << 16) | (_U << 8) | 4


def fresh_mouse():
    """A still mouse no other shape matches, so the first shape is a new device to the box."""
    return core.personality(0x62CF, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])


SHAPES = {"fresh_mouse": fresh_mouse}


def _read(port, name, binary=False):
    try:
        with open(f"/sys/bus/usb/devices/{port}/{name}", "rb" if binary else "r") as f:
            v = f.read()
    except OSError:
        return None
    return v if binary else v.strip()


def _port_dev(port):
    try:
        return (int(_read(port, "busnum")), int(_read(port, "devnum")),
                f"{_read(port, 'idVendor')}:{_read(port, 'idProduct')}".lower())
    except (TypeError, ValueError):
        return None


def _wait_new(port, pid, before, secs=25.0):
    want = f"{core.VID:04x}:{pid:04x}"
    t0 = time.monotonic()
    while time.monotonic() < t0 + secs:
        now = _port_dev(port)
        if now and now[2] == want and (before is None or now[:2] != before[:2] or time.monotonic() > t0 + 6):
            time.sleep(1.5)
            return _port_dev(port)
        time.sleep(0.1)
    return None


def _endpoints(port):
    raw = _read(port, "descriptors", True) or b""
    try:
        cur = int(_read(port, "bConfigurationValue") or 0)
    except ValueError:
        return {}
    i, block = 18, b""
    while i + 4 <= len(raw):
        total = raw[i + 2] | raw[i + 3] << 8
        if total < 9:
            break
        if raw[i + 5] == cur:
            block = raw[i:i + total]
            break
        i += total
    out, j, iface, alt = {}, 0, None, 0
    while j + 2 <= len(block) and block[j] >= 2:
        if block[j + 1] == 4 and block[j] >= 9:
            iface, alt = block[j + 2], block[j + 3]
        elif block[j + 1] == 5 and block[j] >= 7 and iface is not None:
            out.setdefault(block[j + 2], (iface, alt, block[j + 3] & 3, (block[j + 4] | block[j + 5] << 8) & 0x7FF,
                                          block[j + 6]))
        j += block[j]
    return out


def _take(node, iface):
    fd = os.open(node, os.O_RDWR)
    try:
        try:
            drv = fcntl.ioctl(fd, _GETDRIVER, struct.pack("I256s", iface, b""))[4:].split(b"\0", 1)[0]
        except OSError:
            return False
        if drv == b"usbfs":
            return False
        try:
            fcntl.ioctl(fd, _IOCTL, struct.pack("iiP", iface, _DISCONNECT, 0))
            return True
        except OSError:
            return False
    finally:
        os.close(fd)


def _read_ep(port, ep, secs):
    pd = _port_dev(port)
    if not pd:
        return {"error": "clone gone"}
    eps = _endpoints(port)
    if ep not in eps:
        return {"present": False}
    iface, alt, xt, mps, iv = eps[ep]
    rec = {"present": True, "interface": iface, "alt": alt, "type": {2: "bulk", 3: "interrupt"}.get(xt, xt),
           "mps": mps, "bInterval": iv}
    usbfs = sim_module("usbfs")
    node = f"/dev/bus/usb/{pd[0]:03d}/{pd[1]:03d}"
    _take(node, iface)
    pkts, err = [], None
    with usbfs.RawDevice(node) as d:
        try:
            d.claim(iface)
            if alt:
                fcntl.ioctl(d.fd, _SETINTERFACE, struct.pack("II", iface, alt))
            kind = usbfs.TYPE_BULK if xt == 2 else usbfs.TYPE_INTERRUPT
            live = {}
            for _ in range(8):
                u, b = d.submit_in(ep, mps, kind)
                live[ctypes.addressof(u)] = (u, b)
            end = time.monotonic() + secs
            while time.monotonic() < end:
                try:
                    a, status, data = d.reap(timeout=max(0.05, end - time.monotonic()))
                except TimeoutError:
                    break
                live.pop(a, None)
                if status == 0 and data:
                    pkts.append(bytes(data))
                elif status != 0:
                    err = status
                if status == 0 and time.monotonic() < end:
                    u, b = d.submit_in(ep, mps, kind)
                    live[ctypes.addressof(u)] = (u, b)
            for u, _ in live.values():
                d.discard(u)
            for _ in range(len(live)):
                try:
                    d.reap(timeout=0.5)
                except TimeoutError:
                    break
        except OSError as e:
            err = str(e)
    steps = {}
    for p, q in zip(pkts, pkts[1:]):
        s = (q[0] - p[0]) & 0xFF
        steps[s] = steps.get(s, 0) + 1
    bad = sum(1 for p in pkts if any(p[i] != (p[0] + i) & 0xFF for i in range(len(p))))
    rec.update(packets=len(pkts), per_second=round(len(pkts) / secs, 1),
               counter_steps={str(k): v for k, v in sorted(steps.items())},
               lost=sum((s - 1) * n for s, n in steps.items() if s > 1), repeated=steps.get(0, 0), bad_contents=bad,
               lengths=sorted({len(p) for p in pkts}), error=err)
    return rec


def _intervals(cfg):
    i, out = 0, {}
    while i + 1 < len(cfg) and cfg[i]:
        if cfg[i + 1] == 5 and cfg[i] >= 7:
            out[cfg[i + 2]] = cfg[i + 6]
        i += cfg[i]
    return out


def _variants(fn):
    base = fn()
    ivs = _intervals(base.configs[0])
    for es in base.endpoints:
        if not es.addr & 0x80 or es.xfer == 1:
            continue
        p = copy.deepcopy(base)
        for e in p.endpoints:
            if e.addr == es.addr:
                e.emit_size = e.declared_mps
        ms = max(1, ivs.get(es.addr, 1)) if es.xfer == 3 else 1
        p.pump = core.Pump(es.addr, 1000 * ms, core.GEN_COUNTER)
        p.pump2 = core.Pump()
        yield es.addr, p, 1000.0 / ms


def _present(link, shape, settle=0.3, tries=3):
    if isinstance(shape, (list, tuple)):
        args = [int(a, 0) for a in shape[1:]] + [0, 0, 0]
        link.present_builtin(builtin(shape[0]), *args[:3], settle=settle)
        return
    for k in range(tries):
        try:
            link.present(shape, settle=settle)
            return
        except RuntimeError:
            if k == tries - 1:
                raise
            time.sleep(0.4)


def _jobs():
    jobs = [(" ".join(args), ep, pid, BUILTIN_RATE, args) for args, pid, ep in BUILTIN]
    for fn in BUILT:
        for ep, p, rate in _variants(fn):
            jobs.append((fn.__name__, ep, p.device[10] | p.device[11] << 8, rate, p))
    return jobs


def _job(ctx, link, port, name, ep, pid, rate, shape):
    before = _port_dev(port)
    _present(link, shape)
    now = _wait_new(port, pid, before)
    rec = {"shape": name, "ep": f"0x{ep:02x}", "device_per_second": rate, "cloned": now is not None,
           "reenumerated": bool(now and before and now[:2] != before[:2])}
    if now:
        time.sleep(0.5)
        rec.update(_read_ep(port, ep, SECS))
    ctx.log(" ".join(f"{k}={rec.get(k)}" for k in ("shape", "ep", "cloned", "present", "per_second",
                                                    "device_per_second", "lost", "repeated", "bad_contents", "error")))
    return rec


def _label(rec):
    if not rec["cloned"]:
        return "Not cloned"
    if not rec.get("present") or (rec.get("per_second") or 0) < 0.95 * rec["device_per_second"]:
        return "An endpoint sends nothing"
    return "Every endpoint at the native rate"


def outcomes(out):
    base = out["base"]["results"]
    again = {(r["shape"], r["ep"]): r for r in (out.get("imperfect") or {}).get("results", [])}
    o = {}
    for key, shape in ROWS.items():
        recs = [r for r in base if r["shape"] == shape]
        if not recs:
            o[f"devices-ep-data-{key}"] = o[f"devices-ep-data-imp-{key}"] = None
            continue
        o[f"devices-ep-data-{key}"] = max((_label(r) for r in recs), key=OUTCOMES.index)
        o[f"devices-ep-data-imp-{key}"] = max((_label(again.get((r["shape"], r["ep"]), r)) for r in recs),
                                              key=OUTCOMES.index)
    return o


def run(ctx):
    port = ctx.device("start").usb
    link = ctx.sim()
    jobs = _jobs()
    out = {"secs": SECS, "base": None, "imperfect": None}
    try:
        out["base"] = {"results": [_job(ctx, link, port, *j) for j in jobs]}
        if ctx.box_name == "medius":
            refused = [j for j, r in zip(jobs, out["base"]["results"]) if not r["cloned"]]
            was = ctx.box.settings()["optin"]
            ctx.box.apply({"optin": True})
            try:
                out["imperfect"] = {"imperfect_opt_in": True,
                                    "results": [_job(ctx, link, port, *j) for j in refused]}
            finally:
                ctx.box.apply({"optin": was})
    finally:
        link.close()
    out["outcomes"] = outcomes(out)
    return out
