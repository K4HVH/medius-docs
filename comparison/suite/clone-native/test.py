"""Each clone against the real device plugged in directly: the same device shape on the box's sim and on the native
sim (lent to the PC hub), read from the PC the same way, every difference listed.

The shapes are the device comparison's (about 60: medius_shapes.clone_cases, the sim's built-in devices among them,
and mice and keyboards at several report rates). Both sims must run one build. Per shape:
  enumeration  every control transfer the PC's kernel made to each device while enumerating it and binding its
               drivers, off the kernel's USB monitor: the request, how it ended, the bytes that came back
  reads        every descriptor at the lengths a host asks for, each configuration, the strings, GET_STATUS,
               GET_CONFIGURATION, and per HID interface GET_INTERFACE, GET_STATUS, the HID descriptor, the report
               descriptor at its declared length and past it, GET_IDLE and GET_PROTOCOL, as raw control transfers
               through usbfs with every interface taken from its kernel driver for the reads
  reports      how many reports each HID interface sent in a second, read through hidraw
  enumerated_again  whether the device went and came back on its own while the reads ran (they are taken again)
A clone with no difference is faithful; one that enumerates again where the real device doesn't differs. Reply times are recorded, not judged (ep0-compare judges them).

Medius runs as it ships, imperfect clones off; the shapes it refuses are then presented again with imperfect clones
on (the `imperfect` pass). Stock has no such setting.

Outcome per shape: faithful with no difference, imperfect with any, not cloned when no clone came up (a refusal
counts as imperfect where the table names no refusal). A row takes its worst shape.
"""
import ctypes
import errno
import fcntl
import glob
import os
import struct
import subprocess
import sys
import threading
import time

from medius_compare import integrity
from medius_compare.capture import RawCap
from medius_compare.devices import LegUnavailable
from medius_shapes import clone_cases, core, scripted
from medius_shapes.personalities import builtin, sim_module

SECS = 25.0
STALL = "STALL"
MAIN = ("Faithful", "Imperfect")
IMPERFECT = ("Faithful", "Imperfect", "Not cloned")


def fresh_mouse():
    """A still mouse no other shape matches, so the first shape is a new device to the box."""
    return core.personality(0x62CF, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])


def eight_bit_mouse():
    """A mouse with 8-bit X and Y moving every millisecond."""
    return scripted.scripted_mouse8(0x7101, [(1, scripted.mouse8(1, 0)), (1, scripted.mouse8(-1, 0))])


def report_id_combo():
    """A mouse and a keyboard on one endpoint under report IDs, the mouse moving every millisecond."""
    return scripted.scripted_combo(0x7102, [(1, scripted.combo_mouse(1, 0)), (1, scripted.combo_mouse(-1, 0))])


def boot_keyboard():
    """A boot keyboard sending one empty report a second."""
    return scripted.scripted_keyboard(0x7103, [(1, scripted.keys()), (999, b"")])


def mouse_125():
    """A mouse with 16-bit axes declaring and reporting every 8 ms."""
    return scripted.scripted_mouse(0x7104, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))],
                                   interval_us=8000)


def mouse_500():
    """The same every 2 ms."""
    return scripted.scripted_mouse(0x7107, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))],
                                   interval_us=2000)


def mouse_250():
    """The same every 4 ms."""
    return scripted.scripted_mouse(0x7108, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))],
                                   interval_us=4000)


def mouse_16bit():
    """The same every millisecond."""
    return scripted.scripted_mouse(0x7105, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))])


def mouse_with_streaming_vendor():
    """That mouse beside a vendor-page HID interface streaming a 64-byte counter every millisecond."""
    return scripted.scripted_mouse(0x7106, [(1, scripted.mouse(1, 0)), (1, scripted.mouse(-1, 0))],
                                   stream_beside=True)


SHAPES = {f.__name__: f for f in (fresh_mouse, eight_bit_mouse, report_id_combo, boot_keyboard, mouse_125,
                                  mouse_500, mouse_250, mouse_16bit, mouse_with_streaming_vendor)}

# (name, a builder or the sim's built-in device as its name and arguments, PID or None)
CASES = clone_cases.SHAPES + [
    ("gamingmouse", ["gamingmouse"], None),
    ("keyboard", ["keyboard"], None),
    ("silentmouse", ["silentmouse"], None),
    ("hsmouse", ["hsmouse"], None),
    ("stall 200", ["stall", "200"], None),
    ("vendorbulk 1000 0", ["vendorbulk", "1000", "0"], None),
    ("wide 1024 8 0", ["wide", "1024", "8", "0"], None),
    ("multiconfigshift", ["multiconfigshift"], None),
] + [(f.__name__, f, None) for f in (eight_bit_mouse, report_id_combo, boot_keyboard, mouse_125, mouse_500, mouse_250,
                                     mouse_16bit, mouse_with_streaming_vendor)]

MAIN_ROWS = {
    "devices-clone-mice-1ms": ["eight_bit_mouse", "mouse_16bit", "report_id_combo"],
    "devices-clone-boot-keyboard": ["boot_keyboard"],
    "devices-clone-hid-stream-beside-mouse": ["mouse_with_streaming_vendor"],
    "devices-clone-vendor-beside-mouse": ["two_high_in", "vendintrep 0x84", "vendintrep 0x85", "vendintrep 0x86",
                                          "vendorintr"],
    "devices-clone-hid-variants": ["hid_after_ep", "hid_alt", "hid_out_only", "hid_phys_first", "hidtwoin",
                                   "widehid 64"],
    "devices-clone-layouts": ["altsetting", "iface_from_one", "iface_gap", "ten_interfaces"],
    "devices-clone-slow-report": ["rpt_stall_declared", "rpt_stall_declared_zero", "slow_report_450",
                                  "slow_report_700"],
    "devices-clone-pad-serial": ["cdcnotify", "xinput"],
    "devices-clone-qualifier": ["speed_both", "speed_neither"],
    "devices-clone-mice-slow": ["mouse", "composite", "mouse_125", "multiconfig", "multiconfigrptgap"],
    "devices-clone-mice-fast": ["mouse_500", "mouse_250"],
    "devices-clone-control-endpoint": ["ctrlep"],
    "devices-clone-report-1500": ["bigreport 0 1500"],
    "devices-clone-report-declared-3000": ["bigreport 3000 0"],
    "devices-clone-second-config": ["multiconfigovercap"],
    "devices-clone-nine-alternates": ["nine_alternates"],
    "devices-clone-interface-12": ["high_interface"],
    "devices-clone-far-interfaces": ["far_interfaces"],
    "devices-clone-builtins": ["gamingmouse", "keyboard", "silentmouse"],
    "devices-clone-stall": ["stall 200"],
    "devices-clone-hsmouse": ["hsmouse"],
}
IMPERFECT_ROWS = {
    "devices-imperfect-clone-isochronous": ["vendoriso"],
    "devices-imperfect-clone-bulk": ["hidbulkin", "vendbulkhigh", "vendorbulk 1000 0"],
    "devices-imperfect-clone-five-in": ["five_in"],
    "devices-imperfect-clone-six-in": ["six_in"],
    "devices-imperfect-clone-five-hid": ["five_hid_interfaces"],
    "devices-imperfect-clone-unused-five-in": ["unused_config_five_in"],
    "devices-imperfect-clone-endpoint-7": ["vendintrep 0x87"],
    "devices-imperfect-clone-wide-packets": ["widehid 65 8", "wide 1024 8 0"],
    "devices-imperfect-clone-long-configuration": ["long_configuration"],
}

_U = ord("U")
_IOCTL = (3 << 30) | (16 << 16) | (_U << 8) | 18
_GETDRIVER = (1 << 30) | (260 << 16) | (_U << 8) | 8
_DISCONNECT, _CONNECT = (_U << 8) | 22, (_U << 8) | 23

_CHILD = r"""
import fcntl, os, select, struct, sys, time
bus = int(sys.argv[1])
fd = os.open(f"/dev/usbmon{bus}", os.O_RDONLY)
for size in (1200 * 1024, 1024 * 1024, 512 * 1024):
    try:
        fcntl.ioctl(fd, 0x9204, size)
        break
    except OSError:
        pass
fcntl.ioctl(fd, 0x80089203, bytes(8))
H = struct.Struct("<QBBBBHccqiiII8s")
out = sys.stdout.buffer
out.write(b"R")
out.flush()
closed = None
while True:
    r, _, _ = select.select([fd] if closed else [fd, 0], [], [], 0.05 if closed else 0.2)
    if not closed and 0 in r and not os.read(0, 1):
        closed = time.time() * 1e6
        continue
    if fd not in r:
        if closed:
            break
        continue
    b = os.read(fd, 65536)
    uid, typ, xt, ep, dn, _, _, _, sec, usec, st, ln, lc, setup = H.unpack_from(b)
    if closed and (sec * 1000000 + usec > closed or time.time() * 1e6 - closed > 2e6):
        break
    if xt != 2:
        continue
    data = b[H.size:H.size + lc]
    out.write(struct.pack("<QqBBiI8sH", uid, sec * 1000000 + usec, typ, dn, st, ln, setup, len(data)) + data)
    out.flush()
_, dropped = struct.unpack("<II", fcntl.ioctl(fd, 0x80089203, bytes(8)))
out.write(struct.pack("<QqBBiI8sH", dropped, 0, ord("L"), 0, 0, 0, bytes(8), 0))
out.flush()
"""
_REC = struct.Struct("<QqBBiI8sH")


class _Control:
    def __init__(self, bus):
        self.bus, self.ev, self.lost = bus, [], None

    def __enter__(self):
        self.p = subprocess.Popen([sys.executable, "-c", _CHILD, str(self.bus)], stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, bufsize=0)
        if self.p.stdout.read(1) != b"R":
            raise RuntimeError(f"usbmon{self.bus} did not open (run as root)")
        self.t = threading.Thread(target=self._drain, daemon=True)
        self.t.start()
        return self

    def _drain(self):
        buf = b""
        while True:
            c = self.p.stdout.read(65536)
            if not c:
                return
            buf += c
            while len(buf) >= _REC.size:
                uid, ts, typ, dn, st, ln, setup, n = _REC.unpack_from(buf)
                if len(buf) < _REC.size + n:
                    break
                if typ == ord("L"):
                    self.lost = uid
                else:
                    self.ev.append((uid, ts, chr(typ), dn, st, ln, setup, buf[_REC.size:_REC.size + n]))
                buf = buf[_REC.size + n:]

    def __exit__(self, *a):
        self.p.stdin.close()
        self.p.wait(timeout=5)
        self.t.join(timeout=5)
        if self.lost is None:
            integrity.report("usbmon_unfinished", 1)
        else:
            integrity.report("usbmon_lost", self.lost)

    def transfers(self, dn):
        pend, out = {}, []
        for uid, ts, typ, d, st, ln, setup, data in self.ev:
            if d != dn:
                continue
            if typ == "S":
                pend[uid] = (ts, setup, data)
            elif uid in pend:
                t0, su, od = pend.pop(uid)
                out.append((su.hex(), st, ln, (data if su[0] & 0x80 else od).hex(), ts - t0))
        return out


def _read(port, name, binary=False):
    try:
        with open(f"/sys/bus/usb/devices/{port}/{name}", "rb" if binary else "r") as f:
            v = f.read()
    except OSError:
        return None
    return v if binary else v.strip()


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


def _wait_up(port, before, secs):
    end = time.monotonic() + secs
    while time.monotonic() < end:
        if _read(port, "devnum") not in (None, before) and _read(port, "bConfigurationValue") not in (None, "", "0"):
            time.sleep(1.5)
            return True
        time.sleep(0.05)
    return False


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


def _give_back(node, iface):
    try:
        fd = os.open(node, os.O_RDWR)
    except OSError:
        return
    try:
        fcntl.ioctl(fd, _IOCTL, struct.pack("iiP", iface, _CONNECT, 0))
    except OSError:
        pass
    finally:
        os.close(fd)


def _xfer(d, bm, rq, wv, wi, arg, timeout):
    try:
        urb, _buf = d.submit_control(0, bm, rq, wv, wi, arg)
    except OSError as e:
        return (19 if e.errno == 19 else 5), b""
    a, t0 = ctypes.addressof(urb), time.monotonic()
    while True:
        try:
            addr, st, data = d.reap(timeout=max(0.0, timeout - (time.monotonic() - t0)))
        except TimeoutError:
            d.discard(urb)
            try:
                d.reap(timeout=1.0)
            except TimeoutError:
                pass
            return "timeout", b""
        if addr == a:
            break
    if st == 0:
        return 0, data if bm & 0x80 else b""
    return {-32: 32, -75: 75, -19: 19, -108: 19}.get(st, 5), data


def _ctl(d, bm, rq, wv, wi, wl):
    st, data = _xfer(d, bm, rq, wv, wi, wl, 1.5)
    if st == 0:
        return data.hex()
    return STALL if st == 32 else f"error {110 if st == 'timeout' else st}"


def _ok(r):
    return r != STALL and not r.startswith("error")


def _reads(d):
    out = []
    dd = _ctl(d, 0x80, 6, 0x0100, 0, 18)
    out.append(["device", dd])
    for wl in (8, 64, 255):
        out.append([f"device, wLength {wl}", _ctl(d, 0x80, 6, 0x0100, 0, wl)])
    dev = bytes.fromhex(dd) if _ok(dd) else b""
    ncfg = dev[17] if len(dev) >= 18 else 1
    hids, cur = [], _ctl(d, 0x80, 8, 0, 0, 1)
    for c in range(ncfg + 1):
        head = _ctl(d, 0x80, 6, 0x0200 | c, 0, 9)
        out.append([f"configuration {c}, 9 bytes", head])
        h = bytes.fromhex(head) if _ok(head) else b""
        if len(h) < 4:
            continue
        total = struct.unpack_from("<H", h, 2)[0]
        full = b""
        for wl in (total, 4096):
            r = _ctl(d, 0x80, 6, 0x0200 | c, 0, wl)
            out.append([f"configuration {c}, wLength {wl}", r])
            if _ok(r):
                full = bytes.fromhex(r)
        i, intf = 0, None
        while i + 2 <= len(full) and full[i] >= 2:
            if full[i + 1] == 4:
                intf = full[i + 2]
            if full[i + 1] == 0x21 and full[i] >= 9 and intf is not None and cur == f"{h[5]:02x}":
                hids.append((intf, struct.unpack_from("<H", full, i + 7)[0]))
            i += full[i]
    out.append(["GET_CONFIGURATION", cur])
    out.append(["GET_STATUS(device)", _ctl(d, 0x80, 0, 0, 0, 2)])
    out.append(["device qualifier", _ctl(d, 0x80, 6, 0x0600, 0, 10)])
    out.append(["other-speed configuration", _ctl(d, 0x80, 6, 0x0700, 0, 255)])
    out.append(["BOS", _ctl(d, 0x80, 6, 0x0F00, 0, 255)])
    for intf, dl in sorted(set(hids)):
        out.append([f"GET_INTERFACE({intf})", _ctl(d, 0x81, 0x0A, 0, intf, 1)])
        out.append([f"GET_STATUS(interface {intf})", _ctl(d, 0x81, 0, 0, intf, 2)])
        out.append([f"HID descriptor, interface {intf}", _ctl(d, 0x81, 6, 0x2100, intf, 9)])
        for wl in sorted({dl, 64, 255, 4096} - {0}):
            out.append([f"report descriptor, interface {intf}, wLength {wl}", _ctl(d, 0x81, 6, 0x2200, intf, wl)])
        out.append([f"GET_IDLE, interface {intf}", _ctl(d, 0xA1, 0x02, 0, intf, 1)])
        out.append([f"GET_PROTOCOL, interface {intf}", _ctl(d, 0xA1, 0x03, 0, intf, 1)])
    out.append(["string 0", _ctl(d, 0x80, 6, 0x0300, 0, 255)])
    idx = {dev[14], dev[15], dev[16]} if len(dev) >= 18 else set()
    for i in sorted(idx | {1, 2, 3, 4} - {0}):
        out.append([f"string {i}", _ctl(d, 0x80, 6, 0x0300 | i, 0x0409, 255)])
    return out


def _interfaces(port):
    raw = _read(port, "descriptors", True) or b""
    try:
        cur = int(_read(port, "bConfigurationValue") or 0)
    except ValueError:
        return []
    i = 18
    while i + 4 <= len(raw):
        total = raw[i + 2] | raw[i + 3] << 8
        if total < 9:
            break
        if raw[i + 5] == cur:
            block, j, found = raw[i:i + total], 0, []
            while j + 2 <= len(block) and block[j] >= 2:
                if block[j + 1] == 4 and block[j] >= 9 and block[j + 3] == 0:
                    found.append(block[j + 2])
                j += block[j]
            return found
        i += total
    return []


def _read_device(port):
    usbfs = sim_module("usbfs")
    node = f"/dev/bus/usb/{int(_read(port, 'busnum')):03d}/{int(_read(port, 'devnum')):03d}"
    ifaces = _interfaces(port)
    taken = [n for n in ifaces if _take(node, n)]
    try:
        with usbfs.RawDevice(node) as d:
            for n in ifaces:
                try:
                    d.claim(n)
                except OSError:
                    pass
            return _reads(d)
    finally:
        for n in taken:
            _give_back(node, n)


def _read_settled(port, again):
    """The reads, taken again once the device is back if it enumerated again while they ran."""
    was = _read(port, "devnum")
    try:
        return _read_device(port)
    except OSError as e:
        if e.errno != errno.ENODEV:
            raise
    again.append(port)
    if not _wait_up(port, was, SECS):
        raise LegUnavailable(f"the device on {port} went and did not come back")
    return _read_device(port)


def _hid_reports(port, secs=1.0):
    caps = []
    for raw in sorted(glob.glob(f"/sys/bus/usb/devices/{port}/{port}:*/*/hidraw/hidraw*")):
        iface = raw.split(f"{port}:", 1)[1].split("/", 1)[0]
        try:
            caps.append((iface, RawCap("/dev/" + os.path.basename(raw))))
        except OSError:
            pass
    time.sleep(secs)
    out = {}
    for name, c in caps:
        out[name] = len(c.take())
        c.close()
    return out


def _diff(a, b):
    out = []
    for i in range(max(len(a), len(b))):
        x = a[i] if i < len(a) else None
        y = b[i] if i < len(b) else None
        if x != y:
            out.append([i, x, y])
    return out


def _case(ctx, links, ports, name, spec):
    built = spec() if callable(spec) else None
    shape = built if built is not None else spec
    before = [_read(p, "devnum") for p in ports]
    buses = sorted({int(p.split("-", 1)[0]) for p in ports})
    mons = [_Control(b) for b in buses]
    for m in mons:
        m.__enter__()
    try:
        errors = []

        def go(link):
            try:
                _present(link, shape)
            except Exception as e:  # noqa: BLE001
                errors.append(e)
        th = [threading.Thread(target=go, args=(link,)) for link in links]
        for t in th:
            t.start()
        for t in th:
            t.join()
        if errors:
            raise errors[0]
        up = [_wait_up(p, b, SECS) for p, b in zip(ports, before)]
        time.sleep(1.0)
    finally:
        for m in mons:
            m.__exit__(None, None, None)
    row = {"case": name, "cloned": up[0], "native_up": up[1]}
    if not up[1]:
        row["verdict"] = "native did not come up"
    elif not up[0]:
        row["verdict"] = "not cloned"
    else:
        tr = []
        for p in ports:
            tr.append(mons[buses.index(int(p.split("-", 1)[0]))].transfers(int(_read(p, "devnum"))))
        tc, tn = tr
        row["enumeration"] = {"clone": [list(t[:4]) for t in tc], "native": [list(t[:4]) for t in tn],
                              "clone_us": [t[4] for t in tc], "native_us": [t[4] for t in tn],
                              "differ": _diff([list(t[:4]) for t in tc], [list(t[:4]) for t in tn])}
        again = []
        rc, rn = (_read_settled(p, again) for p in ports)
        row["enumerated_again"] = {"clone": ports[0] in again, "native": ports[1] in again}
        row["reads"] = {"clone": rc, "native": rn,
                        "differ": [[x[0], x[1], y[1]] for x, y in zip(rc, rn) if x != y]
                        + ([["count", len(rc), len(rn)]] if len(rc) != len(rn) else [])}
        time.sleep(1.5)
        hc, hn = _hid_reports(ports[0]), _hid_reports(ports[1])
        row["reports_1s"] = {"clone": hc, "native": hn}
        off = [k for k in set(hc) | set(hn)
               if (hc.get(k, 0) == 0) != (hn.get(k, 0) == 0)
               or (hn.get(k, 0) and abs(hc.get(k, 0) - hn[k]) > max(2, 0.05 * hn[k]))]
        row["reports_differ"] = sorted(off)
        n = (len(row["enumeration"]["differ"]) + len(row["reads"]["differ"]) + len(off)
             + (row["enumerated_again"]["clone"] != row["enumerated_again"]["native"]))
        row["verdict"] = "faithful" if n == 0 else f"{n} differences"
    ctx.log(f"{name}: {row['verdict']}")
    return row


def _pass(ctx, links, ports, cases):
    return [_case(ctx, links, ports, name, spec) for name, spec, _pid in cases]


def _label(row, order):
    if row is None:
        return None
    v = row["verdict"]
    if v == "faithful":
        return "Faithful"
    if v == "not cloned":
        return "Not cloned" if "Not cloned" in order else "Imperfect"
    if v.endswith("differences"):
        return "Imperfect"
    return None


def outcomes(out):
    base = {r["case"]: r for r in out["base"]["results"]}
    again = {r["case"]: r for r in (out.get("imperfect") or {}).get("results", [])}
    o = {}
    for rows, order, pick in ((MAIN_ROWS, MAIN, lambda s: base.get(s)),
                              (IMPERFECT_ROWS, IMPERFECT, lambda s: again.get(s, base.get(s)))):
        for rid, shapes in rows.items():
            labels = [_label(pick(s), order) for s in shapes]
            o[rid] = None if None in labels else max(labels, key=order.index)
    return o


def run(ctx):
    ports = [ctx.device("start").usb, ctx.native("start").usb]
    links = [ctx.sim()]
    out = {"sim_build": None, "imperfect_opt_in": None, "base": None, "imperfect": None}
    try:
        links.append(ctx.sim("native"))
        builds = [(link.diag() or {}).get("build") for link in links]
        if None in builds or builds[0] != builds[1]:
            raise RuntimeError(f"the sims run different builds ({builds}); flash both with one build")
        out["sim_build"] = builds[0]
        if ctx.box_name == "medius":
            out["imperfect_opt_in"] = ctx.box.settings()["optin"]
        out["base"] = {"results": _pass(ctx, links, ports, CASES)}
        if ctx.box_name == "medius":
            refused = [c for c, r in zip(CASES, out["base"]["results"]) if r["verdict"] == "not cloned"]
            was = ctx.box.settings()["optin"]
            ctx.box.apply({"optin": True})
            try:
                out["imperfect"] = {"imperfect_opt_in": True, "results": _pass(ctx, links, ports, refused)}
            finally:
                ctx.box.apply({"optin": was})
    finally:
        for link in links:
            link.close()
    out["outcomes"] = outcomes(out)
    return out
