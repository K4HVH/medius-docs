"""Game pads through the box: relay, and stock's controller commands.

Three pads, scripted on the sim, each moving its left stick through set values:
  xinput  a pad on the XInput protocol (vendor class, no HID interface), under IDs the PC's pad driver binds to,
          reporting a 20-byte report every 8 ms
  hidpad  a generic HID gamepad (two sticks, two triggers, a hat, 16 buttons), every 4 ms
  gip     a pad on the GIP protocol (one vendor interface with an interrupt IN and OUT), under IDs the PC's pad
          driver binds to, every 4 ms; the sim records what the PC's driver sends it at start-up
Per pad: does the clone enumerate and the PC's driver bind, and do the sim's stick values reach the PC unchanged
(read off the pad's evdev node for 1.5 s). On stock, also whether km.controller_physical() reads the pad and whether
km.controller_state() moves the stick the PC receives."""
import fcntl
import os
import select
import struct
import threading
import time

from medius_compare.devices import LegUnavailable, usb_nodes
from medius_shapes import core
from medius_shapes.personalities import sim_module

LX_STEPS = [0, 8000, 16000, -8000, -16000, 30000]
HID_XS = [0x80, 0xC0, 0xFF, 0x40, 0x00, 0x90]
SETTLE_S = 3.0
OUTLOG = 0x5A
EV_ABS, ABS_X = 3, 0
EVIOCGBIT_ABS = 0x80404523
EVIOCSCLOCKID = 0x400445A0
EV = struct.Struct("llHHi")


def _xinput_report(lx=0, ly=0, rx=0, ry=0, lt=0, rt=0, buttons=0):
    return struct.pack("<BBHBBhhhh6x", 0x00, 0x14, buttons, lt, rt, lx, ly, rx, ry)


def xinput_pad():
    recs = [r for v in LX_STEPS for r in ((1, _xinput_report(lx=v)), (49, b""))]
    dev = core.device_desc(0x045E, 0x028E, 1, mps0=8, bcd_dev=0x0114, dev_class=0xFF, dev_sub=0xFF, dev_proto=0xFF,
                           i_man=1, i_prod=2, i_ser=3)
    eps = ([core.EndpointSpec(0x81, 3, 1, 32, 20), core.EndpointSpec(0x82, 3, 1, 32, 0),
            core.EndpointSpec(0x83, 3, 1, 32), core.EndpointSpec(0x84, 3, 1, 32)]
           + [core.EndpointSpec(a, 3, 1, 32) for a in (0x01, 0x02, 0x03)])
    ctrl = (core.ctrl_record(0xC1, 0x01, 0x0100, 0, core.XINPUT_CAPS)
            + core.ctrl_record(0xC0, 0x01, 0x0000, 0, core.XINPUT_SERIAL)
            + core.ctrl_record(0x80, 0x06, 0x0304, 0x0409, core.XINPUT_STRINGS[3]))
    return core.Personality(speed=core.SPEED_FULL, device=dev, configs=[core.XINPUT_CFG],
                            strings=[bytes([4, 3, 0x09, 0x04])] + core.XINPUT_STRINGS[:3], endpoints=eps,
                            pump=core.Pump(0x81, 8000, core.GEN_SCRIPT), script=core.script(recs), ctrl=ctrl,
                            hooks=core.EnumHooks(ep0_mps=8))


# A generic gamepad: 16 buttons, hat, X Y Z Rz (sticks, 8-bit centred 0x80), Rx Ry (triggers, 8-bit).
HIDPAD_DESC = bytes.fromhex(
    "05010905a101"
    "05091901291015002501750195108102"
    "05010939150025073500463b016514750495018142"
    "750495018103"
    "6500"
    "0930093109320935150026ff0075089504810209330934150026ff00750895028102"
    "c0")


def _hidpad_report(x=0x80, y=0x80, z=0x80, rz=0x80, lt=0, rt=0, buttons=0, hat=8):
    return struct.pack("<HBBBBBBB", buttons, hat & 0x0F, x, y, z, rz, lt, rt)


def hid_pad():
    recs = [r for v in HID_XS for r in ((1, _hidpad_report(x=v)), (49, b""))]
    iface = (bytes([9, 4, 0, 0, 1, 3, 0, 0, 0]) + bytes([9, 0x21, 0x11, 1, 0, 1, 0x22, len(HIDPAD_DESC), 0])
             + bytes([7, 5, 0x81, 3, 16, 0, 4]))
    cfg = bytes([9, 2, 9 + len(iface), 0, 1, 1, 0, 0x80, 50]) + iface
    return core.Personality(speed=core.SPEED_FULL, device=core.device_desc(0x214E, 0x7201, 1), configs=[cfg],
                            strings=[bytes([4, 3, 0x09, 0x04])], hid_report=HIDPAD_DESC,
                            endpoints=[core.EndpointSpec(0x81, 3, 1, 16, 9)],
                            pump=core.Pump(0x81, 4000, core.GEN_SCRIPT), script=core.script(recs))


# One vendor interface (FF/47/D0) with interrupt IN 0x81 and OUT 0x01, 64 bytes.
GIP_CFG = bytes.fromhex(
    "0902" "2000" "01" "01" "00" "a0" "fa"
    "0904000002ff47d000" "07058103400004" "07050103400004")


def _gip_report(seq, lx=0):
    body = struct.pack("<HHHhhhh", 0, 0, 0, lx, 0, 0, 0) + bytes(4)
    return bytes([0x20, 0x00, seq & 0xFF, len(body)]) + body


def gip_pad():
    recs = [r for i, v in enumerate(LX_STEPS) for r in ((1, _gip_report(i, v)), (49, b""))]
    dev = core.device_desc(0x045E, 0x02EA, 1, mps0=64, bcd_dev=0x0408, dev_class=0xFF, dev_sub=0x47, dev_proto=0xD0,
                           i_man=1, i_prod=2, i_ser=3)
    eps = [core.EndpointSpec(0x81, 3, 1, 64, 18), core.EndpointSpec(0x01, 3, 1, 64)]
    return core.Personality(speed=core.SPEED_FULL, device=dev, configs=[GIP_CFG],
                            strings=[bytes([4, 3, 0x09, 0x04]), core.sd("Maker"), core.sd("Pad"), core.sd("0001")],
                            endpoints=eps, pump=core.Pump(0x81, 4000, core.GEN_SCRIPT), script=core.script(recs))


SHAPES = {"xinput-pad": xinput_pad, "hid-pad": hid_pad, "gip-pad": gip_pad}
PADS = (("xinput", LX_STEPS), ("hidpad", HID_XS), ("gip", LX_STEPS))


def _out_log(ctx, secs=0.6):
    """What reached the pad on its OUT endpoints since the last read: packets, bytes, CRC16 over the bytes in arrival
    order, and each packet's length."""
    lk = sim_module("link")
    link = ctx.sim()
    try:
        link.s.reset_input_buffer()
        link.s.write(lk.frame(OUTLOG, 0))
        link.s.flush()
        buf, end, p = b"", time.monotonic() + secs, None
        while p is None and time.monotonic() < end:
            buf += link.s.read(256)
            got, buf = lk.decode_stream(buf)
            p = next((pl for t, _, pl in got if t == lk.RESP), None)
    finally:
        link.close()
    if p is None or len(p) < 11:
        return None
    packets, nbytes, crc, n = struct.unpack("<IIHB", p[:11])
    return {"packets": packets, "bytes": nbytes, "crc": crc, "lens": list(struct.unpack(f"<{n}H", p[11:11 + 2 * n]))}


def _interfaces(usb):
    d = f"/sys/bus/usb/devices/{usb}"
    out = []
    for it in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if it.startswith(usb + ":"):
            drv = f"{d}/{it}/driver"
            out.append([int(it.rsplit(".", 1)[1]), os.path.basename(os.path.realpath(drv)) if os.path.exists(drv)
                        else None])
    return sorted(out)


def _abs_nodes(usb):
    out = []
    for n in usb_nodes(usb):
        if "/input/" not in n:
            continue
        try:
            fd = os.open(n, os.O_RDONLY | os.O_NONBLOCK)
        except OSError:
            continue
        bits = bytearray(8)
        try:
            fcntl.ioctl(fd, EVIOCGBIT_ABS, bits)
        except OSError:
            bits = bytearray(8)
        finally:
            os.close(fd)
        if bits[0] & 1:
            out.append(n)
    return out


def _read_abs_x(node, secs):
    """ABS_X values the node reports in `secs`, in order, as (kernel time, value)."""
    fd = os.open(node, os.O_RDONLY | os.O_NONBLOCK)
    vals = []
    try:
        fcntl.ioctl(fd, EVIOCSCLOCKID, struct.pack("i", 1))
        end = time.monotonic() + secs
        while time.monotonic() < end:
            if not select.select([fd], [], [], 0.05)[0]:
                continue
            d = os.read(fd, EV.size * 64)
            for i in range(0, len(d) - EV.size + 1, EV.size):
                sec, usec, typ, code, val = EV.unpack_from(d, i)
                if typ == EV_ABS and code == ABS_X:
                    vals.append((sec + usec / 1e6, val))
    finally:
        os.close(fd)
    return vals


def _stock_commands(box, node, r):
    r["km_device"] = box.query("km.device()")
    r["controller_physical"] = box.query("km.controller_physical()")
    r["controller_state_q"] = box.query("km.controller_state()")
    if node:
        got = {}
        t = threading.Thread(target=lambda: got.setdefault("v", _read_abs_x(node, 2.0)))
        t.start()
        time.sleep(0.2)
        t_inj = time.clock_gettime(time.CLOCK_MONOTONIC)
        r["inject_reply"] = box.query("km.controller_state(0,0,0,0,12345,0,0,0)")
        time.sleep(0.6)
        t_zero = time.clock_gettime(time.CLOCK_MONOTONIC)
        box.query("km.controller_state(0,0,0,0,0,0,0,0)")
        t.join()
        r["abs_x_timeline_ms"] = [(round((tt - t_inj) * 1e3, 2), v) for tt, v in got.get("v", [])]
        r["zero_sent_at_ms"] = round((t_zero - t_inj) * 1e3, 2)
    r["controller_physical_after"] = box.query("km.controller_physical()")


def _pad(ctx, pad):
    r = {"pad": pad}
    try:
        usb = ctx.device(pad).usb
        r["cloned"] = True
    except LegUnavailable as e:
        r.update(cloned=False, error=str(e))
        return r
    time.sleep(SETTLE_S)
    r["interfaces"] = _interfaces(usb)
    nodes = _abs_nodes(usb)
    r["abs_nodes"] = nodes
    r["pad_out_log"] = _out_log(ctx)
    if nodes:
        r["abs_x_seen"] = sorted(set(v for _, v in _read_abs_x(nodes[0], 1.5)))
    if ctx.box_name == "stock":
        _stock_commands(ctx.box, nodes[0] if nodes else None, r)
    return r


def _sticks(r, sent):
    seen = r.get("abs_x_seen") or []
    bound = bool(r.get("interfaces")) and r["interfaces"][0][1] is not None
    ok = r.get("cloned") and bound and seen and set(seen) <= set(sent)
    return "Unchanged" if ok else "Changed"


def _reaches(r):
    return "Reaches the pad" if (r.get("pad_out_log") or {}).get("packets") else "Lost"


def _outcomes(results):
    by = {r["pad"]: r for r in results}
    return {"pass-pad-xinput": _sticks(by.get("xinput", {}), LX_STEPS),
            "pass-pad-hid": _sticks(by.get("hidpad", {}), HID_XS),
            "pass-pad-gip": _sticks(by.get("gip", {}), LX_STEPS),
            "pass-pad-out-xinput": _reaches(by.get("xinput", {})),
            "pass-pad-out-gip": _reaches(by.get("gip", {}))}


def run(ctx):
    results = []
    for pad, _ in PADS:
        results.append(_pad(ctx, pad))
        ctx.log(str(results[-1]))
    return {"results": results, "outcomes": _outcomes(results)}
