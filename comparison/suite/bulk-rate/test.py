"""Bulk packets per second at full rate through the box, against the same device plugged into the PC (the native sim,
lent to the PC hub). The devices are the device comparison's three bulk shapes: a mouse beside a vendor interface
whose bulk IN is numbered 0x85; one HID interface with an interrupt IN and a bulk IN; a mouse beside a vendor
interface with an interrupt IN, an interrupt OUT and a bulk pair. Each mouse reports every millisecond. Each bulk IN
sends a counter as fast as the bus takes it, and the bulk OUT is written as fast as the device takes it, so natively
the bus and the real device set the rate. Both sims must run one build.

Each device is presented on the box's sim and on the native sim, and both are read the same way through usbfs, with
eight 4,096-byte transfers queued per bulk endpoint for 3 s: the bulk IN alone, the bulk OUT alone (64-byte packets,
each transfer one of eight fixed patterns), then both at once. The HID interface's interrupt IN is read beside its
bulk IN, as a driver taking that interface would; the other mice stay with the kernel. The sims count what each OUT
endpoint received: packets, bytes, and a CRC16 over the bytes in order. Two rounds a run, native then the box. Per
endpoint and leg: packets per second on each side and the box's share of native, counter steps that weren't one, and
whether the real device received every byte written once and in order. Medius runs with imperfect clones on (it
refuses bulk without them); its drop counters are read around each leg.
"""
import ctypes
import fcntl
import os
import struct
import time

from medius_shapes import core
from medius_shapes.personalities import sim_module

SECS = 3.0
ROUNDS = 2
MPS = 64
PUMP_US = 20             # faster than full speed carries 64-byte packets: the bus sets the pace
DEPTH = 8
URB_LEN = 64 * MPS
SETTLE_S = 1.0
LINGER_S = 0.5           # after the last write, for what the box still holds to reach the real device
_KEEP = []               # transfers discarded but never reaped, kept alive while their handle may still reap them

_U = ord("U")
_IOCTL = (3 << 30) | (16 << 16) | (_U << 8) | 18
_GETDRIVER = (1 << 30) | (260 << 16) | (_U << 8) | 8
_DISCONNECT, _CONNECT = (_U << 8) | 22, (_U << 8) | 23


def fresh_mouse():
    """A still mouse no other shape matches, so the first device is a new one to the box."""
    return core.personality(0x62CF, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])


SHAPES = {"fresh_mouse": fresh_mouse}


def devices():
    """(row, pid, personality, interface the bulk endpoints are on, bulk IN, bulk OUT or None, interrupt IN read beside
    the bulk IN or None)."""
    mouse = core.EndpointSpec(0x81, 3, 1, 8, 3)
    jiggle = core.Pump(0x81, 1000, core.GEN_MOUSE_JIGGLE)
    high = core.personality(
        0x62D3, core.cfg(2, core.MOUSE_IF + core.itf(1, 1, 0xFF) + core.ep(0x85, MPS, 0, 2)),
        [mouse, core.EndpointSpec(0x85, 2, 1, MPS, MPS)],
        pump=core.Pump(0x85, PUMP_US, core.GEN_COUNTER), pump2=jiggle)
    hid = core.personality(
        0x62D4, core.cfg(1, core.itf(0, 2, 3, 1, 2) + core.hid(len(core.MOUSE_DESC)) + core.ep(0x81)
                         + core.ep(0x82, MPS, 0, 2)),
        [mouse, core.EndpointSpec(0x82, 2, 1, MPS, MPS)],
        pump=core.Pump(0x82, PUMP_US, core.GEN_COUNTER), pump2=jiggle)
    pair = core.personality(
        0x62D5, core.cfg(2, core.MOUSE_IF + core.itf(1, 4, 0xFF) + core.ep(0x82, MPS) + core.ep(0x02, MPS)
                         + core.ep(0x83, MPS, 0, 2) + core.ep(0x03, MPS, 0, 2)),
        [mouse, core.EndpointSpec(0x82, 3, 1, MPS, MPS), core.EndpointSpec(0x02, 3, 1, MPS),
         core.EndpointSpec(0x83, 2, 1, MPS, MPS), core.EndpointSpec(0x03, 2, 1, MPS)],
        pump=core.Pump(0x83, PUMP_US, core.GEN_COUNTER), pump2=jiggle)
    return [("Vendor bulk IN numbered 0x85", 0x62D3, high, 1, 0x85, None, None),
            ("HID interface with a bulk IN", 0x62D4, hid, 0, 0x82, None, 0x81),
            ("Vendor bulk pair", 0x62D5, pair, 1, 0x83, 0x03, None)]


def _table():
    t = []
    for i in range(256):
        c = i << 8
        for _ in range(8):
            c = ((c << 1) ^ 0x1021) & 0xFFFF if c & 0x8000 else (c << 1) & 0xFFFF
        t.append(c)
    return t


TABLE = _table()


def crc_upd(c, data):
    """CRC16-CCITT-FALSE (the sim's) carried from state c over data."""
    for b in data:
        c = ((c << 8) & 0xFFFF) ^ TABLE[(c >> 8) ^ b]
    return c


class Patterns:
    """The eight transfers the OUT legs write in turn, and the CRC of any number of them in that order. The CRC is
    linear, so carrying a state over one transfer is its CRC from 0 XOR the state carried over as many zeros."""

    def __init__(self):
        self.bufs = [bytes(((k * 64 + i // MPS) & 0xFF) if i % MPS == 0 else (k + i) & 0xFF for i in range(URB_LEN))
                     for k in range(DEPTH)]
        self.base = [crc_upd(0, b) for b in self.bufs]
        zero = bytes(URB_LEN)
        self.col = [crc_upd(1 << bit, zero) for bit in range(16)]

    def crc(self, n):
        c = 0xFFFF
        for k in range(n):
            s, r, bit = c, 0, 0
            while s:
                if s & 1:
                    r ^= self.col[bit]
                s >>= 1
                bit += 1
            c = self.base[k % DEPTH] ^ r
        return c


def _submit(usbfs, d, ep, buf, length, xfer):
    urb = usbfs.Urb()
    urb.type = xfer
    urb.endpoint = ep
    urb.buffer = ctypes.cast(buf, ctypes.c_void_p)
    urb.buffer_length = length
    usbfs._ioctl(d.fd, usbfs.SUBMITURB, ctypes.byref(urb))
    return urb


def _run(usbfs, d, ins, out, pats, secs):
    st = {ep: {"packets": 0, "bytes": 0, "breaks": 0, "last": None, "urbs": 0, "error": None, "t1": None}
          for ep in list(ins) + ([out] if out else [])}
    live = {}

    def go(ep, k):
        xfer = usbfs.TYPE_INTERRUPT if ins.get(ep) == "interrupt" else usbfs.TYPE_BULK
        if ep == out:
            buf = ctypes.create_string_buffer(pats.bufs[k % DEPTH], URB_LEN)
            n = URB_LEN
        else:
            n = MPS if xfer == usbfs.TYPE_INTERRUPT else URB_LEN
            buf = ctypes.create_string_buffer(n)
        u = _submit(usbfs, d, ep, buf, n, xfer)
        live[ctypes.addressof(u)] = (ep, k, u, buf)

    t0 = time.monotonic()
    nxt = {ep: 0 for ep in st}
    for ep in st:
        for _ in range(DEPTH):
            go(ep, nxt[ep])
            nxt[ep] += 1
    end = t0 + secs
    while live:
        now = time.monotonic()
        if now > end + 5.0:
            break
        try:
            addr, status, data = d.reap(timeout=1.0)
        except TimeoutError:
            if now > end:
                break
            continue
        ent = live.pop(addr, None)
        if ent is None:
            continue
        ep = ent[0]
        s = st[ep]
        if status:
            s["error"] = s["error"] or f"URB status {status}"
            continue
        s["t1"] = time.monotonic()
        if ep == out:
            s["urbs"] += 1
            s["packets"] += URB_LEN // MPS
            s["bytes"] += URB_LEN
        else:
            s["bytes"] += len(data)
            for i in range(0, len(data), MPS):
                if ins[ep] == "bulk":
                    c = data[i]
                    if s["last"] is not None and c != (s["last"] + 1) & 0xFF:
                        s["breaks"] += 1
                    s["last"] = c
                s["packets"] += 1
        # The INs stop at the deadline; the OUT writes on through the transfers it has queued.
        if time.monotonic() < end and not s["error"]:
            go(ep, nxt[ep])
            nxt[ep] += 1
    for _ep, _k, u, _b in list(live.values()):
        d.discard(u)
    stop = time.monotonic() + 1.0
    while live and time.monotonic() < stop:
        try:
            addr, status, data = d.reap(timeout=0.2)
        except (TimeoutError, OSError):
            break
        ent = live.pop(addr, None)
        if ent and ent[0] == out and status == 0:
            st[out]["urbs"] += 1
            st[out]["packets"] += URB_LEN // MPS
            st[out]["bytes"] += URB_LEN
    _KEEP.extend(live.values())
    for s in st.values():
        s["secs"] = round(s.pop("t1") - t0, 3) if s["t1"] else None
        s["per_second"] = round(s["packets"] / s["secs"], 1) if s["secs"] else None
        s.pop("last")
    return {str(ep): s for ep, s in st.items()}


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


def _leg(node, link, iface, ins, out, pats, secs):
    usbfs = sim_module("usbfs")
    bound = _take(node, iface)
    d = usbfs.RawDevice(node)
    try:
        d.claim(iface)
        if out:
            link.simstat()                              # reading clears it
        st = _run(usbfs, d, ins, out, pats, secs)
    finally:
        d.close()
        if bound:
            _give_back(node, iface)
    if out:
        time.sleep(LINGER_S)
        got = link.simstat()
        o = st[str(out)]
        dev = got["out"][out & 0x0F] if got else None
        o["device"] = dev
        o["device_all_in_order"] = bool(dev and dev["packets"] == o["packets"] and dev["bytes"] == o["bytes"]
                                        and dev["crc"] == pats.crc(o["urbs"]))
    return st


def _node(port, pid=None):
    base = f"/sys/bus/usb/devices/{port}"
    try:
        with open(f"{base}/idProduct") as f:
            if pid is not None and int(f.read(), 16) != pid:
                return None
        with open(f"{base}/bConfigurationValue") as f:
            if f.read().strip() in ("", "0"):
                return None
        with open(f"{base}/busnum") as f:
            bus = int(f.read())
        with open(f"{base}/devnum") as f:
            dev = int(f.read())
    except (OSError, ValueError):
        return None
    return f"/dev/bus/usb/{bus:03d}/{dev:03d}"


def _present(links, ports, p, pid, timeout=40.0):
    before = [_node(port) for port in ports]
    for link in links:
        for k in range(3):
            try:
                link.present(p, settle=0.5)
                break
            except RuntimeError:
                if k == 2:
                    raise
                time.sleep(0.5)
    end, got = time.time() + timeout, (None, None)
    while time.time() < end:
        got = tuple(_node(port, pid) for port in ports)
        if all(n and n != b for n, b in zip(got, before)):
            time.sleep(1.0)
            return got
        time.sleep(0.1)
    # A box skips re-cloning a byte-identical device, so an unchanged node there is the device asked for.
    if all(got):
        return got
    if got[1]:
        raise RuntimeError(f"{pid:04x} came up on the native sim, and the clone did not")
    raise RuntimeError(f"{pid:04x} did not come up on both sides")


def _drops(ctx):
    if ctx.box_name != "medius":
        return None
    s = ctx.box.device.query_stats()
    return {k: getattr(s, k) for k in ("tx_drops", "relay_drops", "host_rx_drops", "link_rx_drops")}


def _device_rows(ctx, links, ports, row, pid, p, iface, bulk_in, bulk_out, intr_in, pats):
    nodes = _present(links, ports, p, pid)
    time.sleep(SETTLE_S)
    ins = {bulk_in: "bulk"}
    if intr_in:
        ins[intr_in] = "interrupt"
    legs = [("IN", ins, None)]
    if bulk_out:
        legs += [("OUT", {}, bulk_out), ("IN and OUT at once", ins, bulk_out)]
    rows = []
    for name, li, lo in legs:
        r = {"device": row, "pid": f"0x{pid:04x}", "leg": name, "rounds": []}
        drops0 = _drops(ctx)
        for _ in range(ROUNDS):
            rnd = {}
            for side, node, link in (("native", nodes[1], links[1]), ("box", nodes[0], links[0])):
                try:
                    rnd[side] = _leg(node, link, iface, li, lo, pats, SECS)
                except OSError as e:
                    rnd[side] = {"error": str(e)}
            r["rounds"].append(rnd)
        d1 = _drops(ctx)
        r["drops"] = {k: (d1[k] - drops0[k]) & 0xFFFFFFFF for k in d1} if drops0 and d1 else None
        for ep, what in [(e, "bulk IN") for e in li if li[e] == "bulk"] + ([(lo, "bulk OUT")] if lo else []):
            key = str(ep)
            sides = {}
            for side in ("native", "box"):
                vals = [x[side][key]["per_second"] for x in r["rounds"]
                        if key in x.get(side, {}) and x[side][key]["per_second"]]
                sides[side] = round(sum(vals) / len(vals), 1) if vals else None
            share = round(sides["box"] / sides["native"], 3) if sides["box"] and sides["native"] else None
            in_order = ({s: all(x[s][key].get("device_all_in_order") for x in r["rounds"] if key in x.get(s, {}))
                         for s in sides} if what == "bulk OUT" else None)
            r.setdefault("summary", {})[f"0x{ep:02x}"] = {
                "what": what, "native_per_second": sides["native"], "box_per_second": sides["box"],
                "share_of_native": share,
                "breaks": {s: sum(x[s][key]["breaks"] for x in r["rounds"] if key in x.get(s, {})) for s in sides},
                "device_all_in_order": in_order}
            ctx.log(f"{row:30s} {name:19s} {what:9s} native {sides['native']}/s, box {sides['box']}/s"
                    f" ({share if share is None else f'{share:.0%}'} of native)")
        rows.append(r)
    return rows


def run(ctx):
    ports = [ctx.device("start").usb, ctx.native("start").usb]
    links = [ctx.sim()]
    pats = Patterns()
    out = {"secs": SECS, "rounds": ROUNDS, "pump_us": PUMP_US, "transfer_bytes": URB_LEN, "queued": DEPTH,
           "imperfect_optin": ctx.box.settings()["optin"] if ctx.box_name == "medius" else None, "rows": []}
    try:
        links.append(ctx.sim("native"))
        builds = [(link.diag() or {}).get("build") for link in links]
        if None in builds or builds[0] != builds[1]:
            raise RuntimeError(f"the sims run different builds ({builds}); flash both with one build")
        out["sim_build"] = builds[0]
        for dev in devices():
            out["rows"] += _device_rows(ctx, links, ports, *dev, pats)
    finally:
        for link in links:
            link.close()
    return out
