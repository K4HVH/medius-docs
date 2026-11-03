"""The parts every shape is made of: a personality (descriptors, endpoints, the pumps that stream on them,
canned control answers, enumeration quirks) and the byte builders for standard USB descriptors.

The fields and defaults match the sim's own personality, so `personalities.build` copies them across.
"""
from dataclasses import dataclass, field
from typing import List, Optional

VID = 0x1D50
SPEED_FULL, SPEED_HIGH = 0, 1

# What a pump streams on its endpoint.
GEN_MOUSE_JIGGLE, GEN_COUNTER, GEN_FIXED, GEN_SIZERAMP, GEN_BULK_ZLP = 0, 1, 2, 3, 4
GEN_TRACE_REPLAY, GEN_TRACE_BURST, GEN_MOUSE_MIRROR = 5, 6, 7
GEN_SCRIPT = 10

# swap_on_nth_getdesc: count from when the shape is presented, not from the last bus reset.
SWAP_PERSIST = 0x8000
CTRL_LINK_NONE = 0x0F

# How a device's endpoint 0 answers requests the USB specification leaves open, or that it gets wrong.
Q_DIR_STRICT, Q_RECIP_TWO_BITS, Q_RECIP_LAX, Q_HID_STALL, Q_WLEN_STATUS = 0x0001, 0x0002, 0x0004, 0x0008, 0x0010
Q_RW_STALL, Q_RW_WINDEX_STALL, Q_EP0_CLEAR_ACK, Q_HID_OWN, Q_WLEN_CONFIG = 0x0020, 0x0040, 0x0080, 0x0100, 0x0200
Q_EP0_SET_ACK, Q_DESC_ANY, Q_EPDESC_ANY, Q_DEVFEAT_ACK = 0x0400, 0x0800, 0x1000, 0x2000
Q_IN0_NAK, Q_IFREQ_STALL, Q_WLEN_SHORT = 0x4000, 0x8000, 0x1_0000
Q_OVERRUN, Q_UNDEF_ACK, Q_RECIP_ANY, Q_ANY_INDEX = 0x2_0000, 0x4_0000, 0x8_0000, 0x10_0000
Q_UNCONF_IF, Q_UNCONF_STRICT, Q_ALT_ANY = 0x20_0000, 0x40_0000, 0x80_0000
Q_DESC0_NAK, Q_ST_FEATURES, Q_ST_ONEWAY, Q_ZLP_IFZERO = 1 << 24, 1 << 25, 1 << 26, 1 << 27
Q_EPFEAT_ACK, Q_IF_LIMIT, Q_EP_LIMIT, Q_EPHALT_ANY = 1 << 28, 1 << 29, 1 << 30, 1 << 31
Q_MISROUTE, Q_RW_IGNORED, Q_OUT_REPLY = 1 << 32, 1 << 33, 1 << 34
Q_ALT_IGNORED, Q_EP0_SET_SPLIT, Q_UNCONF_EP_STALL, Q_DESC_LOOSE = 1 << 35, 1 << 36, 1 << 37, 1 << 38
Q_DESC_BLIND, Q_CFG_ANY_INDEX, Q_SETCFG_ANY = 1 << 39, 1 << 40, 1 << 41
Q_WDATA_NAK, Q_PAD_REPLY, Q_BEHIND, Q_WDATA_DEAD = 1 << 42, 1 << 43, 1 << 44, 1 << 45
Q_LONG_BUF, Q_REQ7_HIST = 1 << 46, 1 << 47


@dataclass
class EndpointSpec:
    addr: int
    xfer: int = 3            # 1 iso, 2 bulk, 3 interrupt
    config: int = 1          # 0 = every configuration
    declared_mps: int = 8
    emit_size: int = 0
    iso_mult: int = 0
    toggle: int = 0          # 0 normal, 1 always DATA0, 2 reset mid-stream
    stall_after: int = 0
    nak_every: int = 0       # IN: skip every Nth tick; OUT: take a packet, then NAK for N ms
    alt: int = 0             # the alternate setting the endpoint belongs to


@dataclass
class EnumHooks:
    ep0_mps: int = 64
    set_address_delay_us: int = 0
    swap_on_nth_getdesc: int = 0
    # 1: endpoint 0 answers nothing after the first class GET_REPORT, until a bus reset; 2: the same, and a bus
    # reset doesn't bring it back; 3: nothing after a standard GET_STATUS at recipient 3, until a bus reset;
    # 4: that one request unanswered, everything else answered; 5: 3, once the device reads as another.
    ep0_die_on_getreport: int = 0
    # GET_DESCRIPTOR(REPORT) on this interface answered slow_rpt_ms late (0xFFFF: STALLed) for the first
    # slow_rpt_times fetches (0xFF: all); 0xFF = off.
    slow_rpt_iface: int = 0xFF
    slow_rpt_ms: int = 0
    slow_rpt_times: int = 0
    slow_str_ms: int = 0     # every string fetch answered this late
    slow_reset_ms: int = 0   # every CLEAR_FEATURE(ENDPOINT_HALT) and SET_INTERFACE finished this late
    ep0_quirks: int = 0      # Q_*
    dev_status: int = 0      # the GET_STATUS(device) word


@dataclass
class Pump:
    ep: int = 0
    interval_us: int = 0
    gen: int = GEN_FIXED
    gen_arg: int = 0
    # 0: a tick every interval_us. Otherwise a tick on every host frame interval_us spans, armed this long
    # into the frame.
    frame_arm_us: int = 0


@dataclass
class CtrlRecord:
    """One canned endpoint 0 answer. An IN record serves `data` cut to wLength; an OUT record takes the data
    stage, and with `link` set overwrites that IN record's answer with it."""
    bm: int
    req: int
    wv: int
    wi: int
    data: bytes = b""
    any_wv: bool = False
    any_wi: bool = False
    link: int = CTRL_LINK_NONE


def ctrl_record(bm, req, wv, wi, data=b"", any_wv=False, any_wi=False, link=CTRL_LINK_NONE) -> list:
    """A one-record list; records add up with +."""
    return [CtrlRecord(bm, req, wv, wi, bytes(data), any_wv, any_wi, link)]


@dataclass
class Script:
    """Motion for a GEN_SCRIPT pump: each (count, report) is sent on `count` consecutive ticks. An empty report
    sends nothing, or with `zlp_idle` a zero-length packet. It repeats unless `once`."""
    records: list
    once: bool = False
    zlp_idle: bool = False


def script(records, once=False, zlp_idle=False) -> Script:
    return Script([(int(c), bytes(d)) for c, d in records], once, zlp_idle)


@dataclass
class Personality:
    speed: int = SPEED_FULL
    device: bytes = b""
    configs: List[bytes] = field(default_factory=list)
    strings: List[bytes] = field(default_factory=list)
    bos: bytes = b""
    qualifier: bytes = b""
    hid_report: bytes = b""
    hid_report2: bytes = b""          # the report descriptor of interface rpt2_iface, when it differs
    endpoints: List[EndpointSpec] = field(default_factory=list)
    hooks: EnumHooks = field(default_factory=EnumHooks)
    pump: Pump = field(default_factory=Pump)
    pump2: Pump = field(default_factory=Pump)
    script: Optional[Script] = None
    ctrl: List[CtrlRecord] = field(default_factory=list)
    rpt2_iface: int = 1
    alt_model: int = 0                # 0: one device-wide alternate setting; 1: per interface

    def encode(self) -> bytes:
        from .personalities import build
        return build(self).encode()

    def digest(self) -> int:
        from .personalities import build
        return build(self).digest()


def device_desc(vid=0x1D50, pid=0x6100, n_configs=1, mps0=64, bcd_usb=0x0200, bcd_dev=0x0100,
                dev_class=0, dev_sub=0, dev_proto=0, i_man=0, i_prod=0, i_ser=0) -> bytes:
    return bytes([18, 1, bcd_usb & 0xFF, bcd_usb >> 8, dev_class, dev_sub, dev_proto, mps0,
                  vid & 0xFF, vid >> 8, pid & 0xFF, pid >> 8, bcd_dev & 0xFF, bcd_dev >> 8,
                  i_man, i_prod, i_ser, n_configs])


def cfg(n_if, body, value=1):
    t = 9 + len(body)
    return bytes([9, 2, t & 255, t >> 8, n_if, value, 0, 0xA0, 50]) + body


def itf(n, n_ep, cls, sub=0, pro=0, alt=0, s=0):
    return bytes([9, 4, n, alt, n_ep, cls, sub, pro, s])


def hid(rl):
    return bytes([9, 0x21, 0x11, 1, 0, 1, 0x22, rl & 255, rl >> 8])


def ep(a, mps=8, iv=1, attr=3):
    return bytes([7, 5, a, attr, mps & 255, mps >> 8, iv])


def sd(text):
    u = text.encode("utf-16-le")
    return bytes([2 + len(u), 3]) + u


def hid_config(cfg_value=1, proto=2, report_len=50, ep_addr=0x81, ep_attr=0x03, ep_mps=8,
               ep_interval=10, iface_class=3, iface_sub=1, w_total=None) -> bytes:
    """One HID interface with one endpoint, wTotalLength as given or as built."""
    body = (bytes([9, 4, 0, 0, 1, iface_class, iface_sub, proto, 0])
            + bytes([9, 0x21, 0x11, 0x01, 0, 1, 0x22, report_len & 0xFF, report_len >> 8])
            + bytes([7, 5, ep_addr, ep_attr, ep_mps & 0xFF, ep_mps >> 8, ep_interval]))
    total = (9 + len(body)) if w_total is None else w_total
    return bytes([9, 2, total & 0xFF, total >> 8, 1, cfg_value, 0, 0xA0, 50]) + body


# A three-button mouse with 8-bit X and Y.
MOUSE_DESC = bytes([
    0x05, 0x01, 0x09, 0x02, 0xA1, 0x01, 0x09, 0x01, 0xA1, 0x00, 0x05, 0x09, 0x19, 0x01, 0x29,
    0x03, 0x15, 0x00, 0x25, 0x01, 0x95, 0x03, 0x75, 0x01, 0x81, 0x02, 0x95, 0x01, 0x75, 0x05,
    0x81, 0x03, 0x05, 0x01, 0x09, 0x30, 0x09, 0x31, 0x15, 0x81, 0x25, 0x7F, 0x75, 0x08, 0x95,
    0x02, 0x81, 0x06, 0xC0, 0xC0,
])
MOUSE_REPORT = MOUSE_DESC
# A boot keyboard: modifiers, a reserved byte, five LEDs out, six keys.
KBD_DESC = bytes([
    0x05, 0x01, 0x09, 0x06, 0xA1, 0x01, 0x05, 0x07, 0x19, 0xE0, 0x29, 0xE7, 0x15, 0x00, 0x25,
    0x01, 0x75, 0x01, 0x95, 0x08, 0x81, 0x02, 0x95, 0x01, 0x75, 0x08, 0x81, 0x03, 0x95, 0x05,
    0x75, 0x01, 0x05, 0x08, 0x19, 0x01, 0x29, 0x05, 0x91, 0x02, 0x95, 0x01, 0x75, 0x03, 0x91,
    0x03, 0x95, 0x06, 0x75, 0x08, 0x15, 0x00, 0x25, 0x65, 0x05, 0x07, 0x19, 0x00, 0x29, 0x65,
    0x81, 0x00, 0xC0,
])
# 8-byte and 64-byte vendor-page input reports.
VEND8_DESC = bytes.fromhex("0600ff0901a1010902150026ff00750895088102c0")
VEND64_DESC = bytes.fromhex("0600ff0901a1010902150026ff00750895408102c0")

MOUSE_IF = itf(0, 1, 3, 1, 2) + hid(len(MOUSE_DESC)) + ep(0x81)


def personality(pid, config, endpoints, hid_report=MOUSE_DESC, **kw):
    """A full-speed device with the sim's VID and `pid`, one configuration. Other keywords set the
    personality's fields (hid_report2, pump, pump2, ctrl, strings, qualifier, hooks, alt_model, rpt2_iface,
    device)."""
    dev = kw.pop("device", device_desc(VID, pid, 1))
    return Personality(speed=SPEED_FULL, device=dev, configs=[config], hid_report=hid_report,
                       endpoints=endpoints, **kw)


# A pad on the XInput protocol, with no HID interface: four vendor interfaces, seven interrupt endpoints, and
# interface 3 (FF/FD/13) with no endpoint, whose string is the protocol's security banner.
XINPUT_CFG = bytes.fromhex(
    "09029900040100a0fa"
    "0904000002ff5d0100" "1121000101258114000000001301080000" "07058103200004" "07050103200008"
    "0904010004ff5d0300" "1b2100010101824001022016830000000000001603000000000000"
    "07058203200002" "07050203200004" "07058303200040" "07050303200010"
    "0904020001ff5d0200" "092100010122840700" "07058403200010"
    "0904030000fffd1304" "064100010103")
XINPUT_STRINGS = [sd("Maker"), sd("Pad"), sd("0001"),
                  sd("Xbox Security Method 3, Version 1.00, © 2005 Microsoft Corporation. All rights reserved.")]
# What a driver's probe reads: capabilities (interface recipient) and the serial (device recipient).
XINPUT_CAPS = bytes.fromhex("00143ff7ffff00000000c0ffc0ffc0ffc0ff0000")
XINPUT_SERIAL = bytes.fromhex("12345678")


def xinput(pid=0x6200):
    """The pad, streaming a 20-byte ramp on 0x81 and a full packet on 0x82."""
    dev = device_desc(VID, pid, 1, mps0=8, bcd_dev=0x0114, dev_class=0xFF, dev_sub=0xFF, dev_proto=0xFF,
                      i_man=1, i_prod=2, i_ser=3)
    eps = ([EndpointSpec(0x81, 3, 1, 32, 20), EndpointSpec(0x82, 3, 1, 32, 32),
            EndpointSpec(0x83, 3, 1, 32), EndpointSpec(0x84, 3, 1, 32)]
           + [EndpointSpec(a, 3, 1, 32) for a in (0x01, 0x02, 0x03)])
    # The sim holds strings 0-3, so the security string (4) is a canned answer.
    ctrl = (ctrl_record(0xC1, 0x01, 0x0100, 0, XINPUT_CAPS) + ctrl_record(0xC0, 0x01, 0x0000, 0, XINPUT_SERIAL)
            + ctrl_record(0x80, 0x06, 0x0304, 0x0409, XINPUT_STRINGS[3]))
    return Personality(speed=SPEED_FULL, device=dev, configs=[XINPUT_CFG],
                       strings=[bytes([4, 3, 0x09, 0x04])] + XINPUT_STRINGS[:3],
                       endpoints=eps, pump=Pump(0x81, 1000, GEN_COUNTER), pump2=Pump(0x82, 1000, GEN_COUNTER),
                       ctrl=ctrl, hooks=EnumHooks(ep0_mps=8))
