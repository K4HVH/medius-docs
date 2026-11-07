"""Devices that play a motion script, one report a tick, so every report they send is known in advance."""
import struct

from .core import (EndpointSpec, GEN_COUNTER, GEN_FIXED, GEN_SCRIPT, KBD_DESC, Personality, Pump, SPEED_FULL,
                   VEND8_DESC, VEND64_DESC, device_desc, script)

VID = 0x214E

# Five buttons, 16-bit X and Y, a wheel: [buttons][x i16][y i16][wheel i8].
MOUSE_DESC = bytes([
    0x05, 0x01, 0x09, 0x02, 0xA1, 0x01, 0x09, 0x01, 0xA1, 0x00,
    0x05, 0x09, 0x19, 0x01, 0x29, 0x05, 0x15, 0x00, 0x25, 0x01, 0x95, 0x05, 0x75, 0x01, 0x81, 0x02,
    0x95, 0x01, 0x75, 0x03, 0x81, 0x03,
    0x05, 0x01, 0x09, 0x30, 0x09, 0x31, 0x16, 0x01, 0x80, 0x26, 0xFF, 0x7F, 0x75, 0x10, 0x95, 0x02,
    0x81, 0x06,
    0x09, 0x38, 0x15, 0x81, 0x25, 0x7F, 0x75, 0x08, 0x95, 0x01, 0x81, 0x06,
    0xC0, 0xC0,
])
# The same with 8-bit X and Y: [buttons][x i8][y i8][wheel i8].
MOUSE8_DESC = bytes([
    0x05, 0x01, 0x09, 0x02, 0xA1, 0x01, 0x09, 0x01, 0xA1, 0x00,
    0x05, 0x09, 0x19, 0x01, 0x29, 0x05, 0x15, 0x00, 0x25, 0x01, 0x95, 0x05, 0x75, 0x01, 0x81, 0x02,
    0x95, 0x01, 0x75, 0x03, 0x81, 0x03,
    0x05, 0x01, 0x09, 0x30, 0x09, 0x31, 0x09, 0x38, 0x15, 0x81, 0x25, 0x7F, 0x75, 0x08, 0x95, 0x03,
    0x81, 0x06,
    0xC0, 0xC0,
])
BUTTON_BIT = {"left": 0x01, "right": 0x02, "middle": 0x04, "side1": 0x08, "side2": 0x10}


def mouse(dx=0, dy=0, wheel=0, buttons=0):
    return struct.pack("<Bhhb", buttons, dx, dy, wheel)


def mouse8(dx=0, dy=0, wheel=0, buttons=0):
    return struct.pack("<Bbbb", buttons, dx, dy, wheel)


# The mouse as report ID 1 and a boot keyboard as report ID 2, on one interface and one endpoint.
COMBO_MOUSE_ID, COMBO_KBD_ID = 1, 2
COMBO_DESC = (MOUSE_DESC[:6] + bytes([0x85, COMBO_MOUSE_ID]) + MOUSE_DESC[6:]
              + KBD_DESC[:6] + bytes([0x85, COMBO_KBD_ID]) + KBD_DESC[6:])


def combo_mouse(dx=0, dy=0, wheel=0, buttons=0):
    return bytes([COMBO_MOUSE_ID]) + mouse(dx, dy, wheel, buttons)


def combo_keys(*codes, mods=0):
    return bytes([COMBO_KBD_ID]) + keys(*codes, mods=mods)


def keys(*codes, mods=0):
    return bytes([mods, 0] + list(codes) + [0] * (6 - len(codes)))


def _one_hid(pid, proto, rdesc, rlen, records, once, interval_us, subclass=1, mps=8, zlp_idle=False,
             zlp_beside=False, silent_beside=False, stream_beside=False, frame_arm_us=0):
    iface = (bytes([9, 4, 0, 0, 1, 3, subclass, proto, 0])
             + bytes([9, 0x21, 0x11, 0x01, 0, 1, 0x22, len(rdesc) & 0xFF, len(rdesc) >> 8])
             + bytes([7, 5, 0x81, 0x03, mps, 0, max(1, interval_us // 1000)]))
    eps = [EndpointSpec(addr=0x81, xfer=3, config=1, declared_mps=mps, emit_size=rlen)]
    extra = {}
    if zlp_beside:
        iface += (bytes([9, 4, 1, 0, 1, 3, 0, 0, 0])
                  + bytes([9, 0x21, 0x11, 0x01, 0, 1, 0x22, len(VEND8_DESC), 0])
                  + bytes([7, 5, 0x82, 0x03, 8, 0, 1]))
        eps.append(EndpointSpec(addr=0x82, xfer=3, config=1, declared_mps=8, emit_size=0))
        extra = dict(hid_report2=VEND8_DESC, rpt2_iface=1, pump2=Pump(ep=0x82, interval_us=1000, gen=GEN_FIXED))
    elif silent_beside:
        iface += (bytes([9, 4, 1, 0, 1, 3, 0, 0, 0])
                  + bytes([9, 0x21, 0x11, 0x01, 0, 1, 0x22, len(VEND8_DESC), 0])
                  + bytes([7, 5, 0x82, 0x03, 8, 0, 1]))
        eps.append(EndpointSpec(addr=0x82, xfer=3, config=1, declared_mps=8, emit_size=0))
        extra = dict(hid_report2=VEND8_DESC, rpt2_iface=1)
    elif stream_beside:
        iface += (bytes([9, 4, 1, 0, 1, 3, 0, 0, 0])
                  + bytes([9, 0x21, 0x11, 0x01, 0, 1, 0x22, len(VEND64_DESC), 0])
                  + bytes([7, 5, 0x82, 0x03, 64, 0, 1]))
        eps.append(EndpointSpec(addr=0x82, xfer=3, config=1, declared_mps=64, emit_size=64))
        extra = dict(hid_report2=VEND64_DESC, rpt2_iface=1, pump2=Pump(ep=0x82, interval_us=1000, gen=GEN_COUNTER))
    total = 9 + len(iface)
    cfg = bytes([9, 2, total & 0xFF, total >> 8, 2 if zlp_beside or silent_beside or stream_beside else 1, 1, 0,
                 0xA0, 50]) + iface
    return Personality(speed=SPEED_FULL, device=device_desc(VID, pid, 1), configs=[cfg],
                       strings=[bytes([4, 0x03, 0x09, 0x04])], hid_report=rdesc, endpoints=eps,
                       pump=Pump(ep=0x81, interval_us=interval_us, gen=GEN_SCRIPT, frame_arm_us=frame_arm_us),
                       script=script(records, once, zlp_idle), **extra)


def scripted_mouse(pid, records, once=False, interval_us=1000, mps=8, zlp_idle=False, zlp_beside=False,
                   silent_beside=False, stream_beside=False, frame_arm_us=0):
    """A mouse playing `records` [(count, mouse(...))], one report a tick: an empty report is a silent tick
    (a zero-length packet with `zlp_idle`), `mps` under 6 splits reports across packets, `frame_arm_us` ticks on the
    host's frames, and `zlp_beside`, `silent_beside` or `stream_beside` adds a HID interface that answers with
    zero-length packets, never reports, or streams a 64-byte counter."""
    return _one_hid(pid, 2, MOUSE_DESC, 6, records, once, interval_us, mps=mps, zlp_idle=zlp_idle,
                    zlp_beside=zlp_beside, silent_beside=silent_beside, stream_beside=stream_beside,
                    frame_arm_us=frame_arm_us)


def scripted_mouse8(pid, records, once=False, interval_us=1000):
    """scripted_mouse with 8-bit X and Y (mouse8 records)."""
    return _one_hid(pid, 2, MOUSE8_DESC, 4, records, once, interval_us)


def scripted_combo(pid, records, once=False, interval_us=1000):
    """The mouse (report ID 1) and a keyboard (report ID 2) on one 16-byte endpoint."""
    return _one_hid(pid, 0, COMBO_DESC, 7, records, once, interval_us, subclass=0, mps=16)


def scripted_keyboard(pid, records, once=False, interval_us=1000, frame_arm_us=0):
    """A boot keyboard playing `records` of keys(...) reports."""
    return _one_hid(pid, 1, KBD_DESC, 8, records, once, interval_us, frame_arm_us=frame_arm_us)


STILL_MOUSE_PID, STILL_KEYBOARD_PID, STILL_COMPOSITE_PID = 0x7FF0, 0x7FF1, 0x7FF2


def still_mouse():
    """A mouse at rest: it sends nothing until it moves, as one on a desk does."""
    return scripted_mouse(STILL_MOUSE_PID, [(1, b"")])


def still_keyboard():
    """A boot keyboard nobody is typing on."""
    return scripted_keyboard(STILL_KEYBOARD_PID, [(1, b"")])


def still_composite():
    """A mouse and a keyboard on one endpoint under report IDs, both at rest."""
    return scripted_combo(STILL_COMPOSITE_PID, [(1, b"")])


IDLE_MOUSE_PID = 0x7030


def idle_mouse():
    """A mouse at rest that sends one empty report every 2 s."""
    return scripted_mouse(IDLE_MOUSE_PID, [(1, mouse(0, 0)), (1999, b"")])
