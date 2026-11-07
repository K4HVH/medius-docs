"""Data from the PC to the real device, and vendor data from the real device. The sim records what reaches it, so
each leg checks the device end.

Legs:
  kbd_led    a boot keyboard with no interrupt OUT: the PC writes an LED output report (Caps Lock) through hidraw,
             which goes as SET_REPORT on endpoint 0; the sim's endpoint 0 log must show it
  hid_out    a vendor-page HID interface with an 8-byte output report and an interrupt OUT endpoint: 20 writes
             through hidraw; the sim's OUT log must count 20 packets with the same CRC
  vendor_in  a vendor interface streaming a counter on its interrupt IN, read through usbfs for 1 s with eight
             transfers queued: packets received and whether the counter in them runs without a gap"""
import os
import struct
import time

from medius_compare.devices import usb_nodes
from medius_shapes import core, scripted
from medius_shapes.personalities import sim_module

KBD_PID, HID_OUT_PID = 0x7100, 0x7101
SETTLE_S = 2.0
# A vendor-page report, 8 bytes in and 8 out.
HID_OUT_DESC = bytes.fromhex("0600ff0901a1010902150026ff00750895088102" "0903750895089102" "c0")
OUTLOG, EP0LOG = 0x5A, 0x5D


def led_keyboard():
    """A boot keyboard with no interrupt OUT, sending one empty report every 2 s."""
    return scripted.scripted_keyboard(KBD_PID, [(1, scripted.keys()), (1999, b"")])


def hid_out_device():
    """A vendor-page HID interface with an 8-byte interrupt IN and an 8-byte interrupt OUT, nothing pumped."""
    iface = (bytes([9, 4, 0, 0, 2, 3, 0, 0, 0]) + bytes([9, 0x21, 0x11, 1, 0, 1, 0x22, len(HID_OUT_DESC), 0])
             + bytes([7, 5, 0x81, 3, 8, 0, 1]) + bytes([7, 5, 0x02, 3, 8, 0, 1]))
    cfg = bytes([9, 2, 9 + len(iface), 0, 1, 1, 0, 0x80, 50]) + iface
    return core.Personality(speed=core.SPEED_FULL, device=core.device_desc(scripted.VID, HID_OUT_PID, 1),
                            configs=[cfg], strings=[bytes([4, 3, 0x09, 0x04])], hid_report=HID_OUT_DESC,
                            endpoints=[core.EndpointSpec(0x81, 3, 1, 8, 8), core.EndpointSpec(0x02, 3, 1, 8)],
                            pump=core.Pump(ep=0))


SHAPES = {"led-keyboard": led_keyboard, "hid-out": hid_out_device}


def crc16(data, crc=0xFFFF):
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def _ask(ctx, ty, secs=0.6):
    """One of the sim's records, read and cleared: the reply's payload, or None."""
    lk = sim_module("link")
    link = ctx.sim()
    try:
        link.s.reset_input_buffer()
        link.s.write(lk.frame(ty, 0))
        link.s.flush()
        buf, end = b"", time.monotonic() + secs
        while time.monotonic() < end:
            buf += link.s.read(256)
            got, buf = lk.decode_stream(buf)
            for t, _, p in got:
                if t == lk.RESP:
                    return p
    finally:
        link.close()
    return None


def _out_log(ctx):
    """What the sim's OUT endpoints received since the last read: packets, bytes, CRC16 over the bytes in arrival
    order, and each packet's length."""
    p = _ask(ctx, OUTLOG)
    if p is None or len(p) < 11:
        return None
    packets, nbytes, crc, n = struct.unpack("<IIHB", p[:11])
    return {"packets": packets, "bytes": nbytes, "crc": crc, "lens": list(struct.unpack(f"<{n}H", p[11:11 + 2 * n]))}


def _ep0_log(ctx):
    """The control OUT data stages the sim's endpoint 0 took since the last read: how many, and the last one's setup
    packet and bytes."""
    p = _ask(ctx, EP0LOG)
    if p is None or len(p) < 14:
        return None
    count, setup, n = struct.unpack("<I8sH", p[:14])
    return {"count": count, "setup": setup, "data": bytes(p[14:14 + n])}


def _hidraw(nodes):
    for n in nodes:
        if "hidraw" in n:
            return n
    return None


def _node(usb):
    def read(name):
        with open(f"/sys/bus/usb/devices/{usb}/{name}") as f:
            return int(f.read())
    return f"/dev/bus/usb/{read('busnum'):03d}/{read('devnum'):03d}"


def _kbd_led(ctx):
    r = {"leg": "kbd_led"}
    p = ctx.device("kbd_led")
    time.sleep(SETTLE_S)
    _ep0_log(ctx)
    node = _hidraw(usb_nodes(p.usb))
    if node is None:
        return {**r, "error": "the clone has no hidraw node", "led_reached_device": False}
    fd = os.open(node, os.O_WRONLY)
    try:
        os.write(fd, bytes([0x00, 0x02]))
    finally:
        os.close(fd)
    time.sleep(0.5)
    log = _ep0_log(ctx)
    r["ep0_log"] = {"count": log["count"], "setup": log["setup"].hex(), "data": log["data"].hex()} if log else None
    r["led_reached_device"] = bool(log and log["count"] and log["data"].endswith(b"\x02"))
    return r


def _hid_out(ctx):
    r = {"leg": "hid_out"}
    p = ctx.device("hid_out")
    time.sleep(SETTLE_S)
    _out_log(ctx)
    node = _hidraw(usb_nodes(p.usb))
    sent = b""
    if node:
        fd = os.open(node, os.O_WRONLY)
        try:
            for i in range(20):
                pkt = bytes([(i + j) & 0xFF for j in range(8)])
                os.write(fd, b"\x00" + pkt)
                sent += pkt
                time.sleep(0.01)
        finally:
            os.close(fd)
    time.sleep(0.5)
    log = _out_log(ctx)
    r.update(sent_packets=20 if node else 0, sent_crc=crc16(sent), out_log=log,
             all_reached=bool(log and log["packets"] == 20 and log["crc"] == crc16(sent)))
    return r


def _vendor_in(ctx):
    r = {"leg": "vendor_in"}
    p = ctx.device("vendor_in")
    time.sleep(SETTLE_S)
    dev = sim_module("usbfs").RawDevice(_node(p.usb))
    inflight = []
    try:
        dev.claim(1)
        inflight = [dev.submit_in(0x82, 64) for _ in range(8)]
        got, end = [], time.monotonic() + 1.0
        while time.monotonic() < end:
            try:
                _, status, data = dev.reap(timeout=0.2)
            except OSError:
                continue
            if status == 0 and data:
                got.append(bytes(data))
            inflight.append(dev.submit_in(0x82, 64))
        firsts = [g[0] for g in got]
        gaps = sum(1 for x, y in zip(firsts, firsts[1:]) if (y - x) & 0xFF != 1)
        r.update(packets_1s=len(got), counter_gaps=gaps, sample=got[0][:8].hex() if got else None)
    except OSError as e:
        r["error"] = str(e)
    finally:
        dev.close()
    return r


def run(ctx):
    results = [_kbd_led(ctx), _hid_out(ctx), _vendor_in(ctx)]
    for r in results:
        ctx.log(str(r))
    return {"results": results, "outcomes": _outcomes(results)}


def _outcomes(results):
    led, out, vin = results
    return {"pass-pc-led": "Passed on" if led.get("led_reached_device") else "Clone reconnects instead",
            "pass-pc-hid-out": "Passed on" if out.get("all_reached") else "Clone reconnects instead",
            "pass-dev-vendor": "Reaches the PC" if vin.get("packets_1s") else "Hidden"}
