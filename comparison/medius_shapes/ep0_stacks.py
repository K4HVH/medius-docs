"""Endpoint 0 the way different device stacks answer it: one mouse, a vendor-page HID interface and a vendor
interface carrying a class descriptor, presented as each kind of stack in KINDS (EnumHooks.ep0_quirks)."""
from .core import (EndpointSpec, EnumHooks, GEN_FIXED, MOUSE_DESC, Personality, Pump, SPEED_FULL, SWAP_PERSIST,
                   VEND8_DESC, VID, cfg, ctrl_record, device_desc, ep, hid, itf, sd)
from .core import (Q_ALT_ANY, Q_ALT_IGNORED, Q_ANY_INDEX, Q_BEHIND, Q_CFG_ANY_INDEX, Q_DESC0_NAK, Q_DESC_ANY,
                   Q_DESC_BLIND, Q_DESC_LOOSE, Q_DEVFEAT_ACK, Q_DIR_STRICT, Q_EP0_CLEAR_ACK, Q_EP0_SET_ACK,
                   Q_EP0_SET_SPLIT, Q_EPDESC_ANY, Q_EPFEAT_ACK, Q_EPHALT_ANY, Q_EP_LIMIT, Q_HID_OWN, Q_HID_STALL,
                   Q_IF_LIMIT, Q_IFREQ_STALL, Q_IN0_NAK, Q_LONG_BUF, Q_MISROUTE, Q_OUT_REPLY, Q_OVERRUN, Q_PAD_REPLY,
                   Q_RECIP_ANY, Q_RECIP_LAX, Q_RECIP_TWO_BITS, Q_REQ7_HIST, Q_RW_IGNORED, Q_RW_STALL,
                   Q_RW_WINDEX_STALL, Q_SETCFG_ANY, Q_ST_FEATURES, Q_ST_ONEWAY, Q_UNCONF_EP_STALL, Q_UNCONF_IF,
                   Q_UNCONF_STRICT, Q_UNDEF_ACK, Q_WDATA_DEAD, Q_WDATA_NAK, Q_WLEN_CONFIG, Q_WLEN_SHORT,
                   Q_WLEN_STATUS, Q_ZLP_IFZERO)

_STM32 = (Q_WLEN_STATUS | Q_WLEN_CONFIG | Q_OVERRUN | Q_EP0_CLEAR_ACK | Q_EP0_SET_ACK | Q_ALT_ANY | Q_ST_FEATURES
          | Q_ST_ONEWAY | Q_ZLP_IFZERO | Q_IF_LIMIT | Q_EPHALT_ANY | Q_CFG_ANY_INDEX | Q_WDATA_NAK)

# name: (ep0_quirks, GET_STATUS(device) word, configuration bmAttributes). A kind's PID is PID0 plus its place here,
# so new kinds go last.
KINDS = {
    "permissive": (0, 0, 0xA0),
    "strict": (Q_DIR_STRICT, 1, 0xA0),
    "twobit": (Q_RECIP_TWO_BITS | Q_DEVFEAT_ACK | Q_UNCONF_IF | Q_EPHALT_ANY, 1, 0xA0),
    "lax": (Q_RECIP_LAX | Q_HID_STALL, 1, 0xA0),
    "hidown": (Q_HID_OWN | Q_EP0_CLEAR_ACK, 0, 0xA0),
    "laxstrict": (Q_DIR_STRICT | Q_RECIP_LAX | Q_EP0_CLEAR_ACK | Q_EP0_SET_ACK, 1, 0xA0),
    "wlenstatus": (Q_WLEN_STATUS | Q_RW_WINDEX_STALL, 0, 0xE0),
    "wlenconfig": (Q_WLEN_CONFIG | Q_DESC_ANY, 1, 0xA0),
    "wlenshort": (Q_WLEN_SHORT, 1, 0xA0),
    "epdesc": (Q_EPDESC_ANY | Q_EP0_SET_ACK, 0, 0xA0),
    "rwtaken": (Q_EP0_CLEAR_ACK | Q_RW_WINDEX_STALL, 0, 0x80),
    "rwrefused": (Q_RW_STALL | Q_WLEN_STATUS | Q_WLEN_CONFIG, 1, 0xC0),
    "twocfg": (Q_HID_OWN, 0, 0xA0),
    "in0nak": (Q_IN0_NAK, 0, 0xA0),
    "in0strict": (Q_IN0_NAK | Q_DIR_STRICT, 1, 0xA0),
    "ifstrict": (Q_IFREQ_STALL | Q_DIR_STRICT, 0, 0xA0),
    "lufa": (Q_DIR_STRICT | Q_IFREQ_STALL | Q_OVERRUN | Q_DESC0_NAK | Q_EPFEAT_ACK | Q_EP_LIMIT | Q_DESC_ANY
             | Q_DESC_BLIND | Q_CFG_ANY_INDEX, 0, 0xA0),
    "stm32": (_STM32, 1, 0xA0),
    "vusb": (Q_RECIP_LAX | Q_UNDEF_ACK | Q_RECIP_ANY | Q_UNCONF_IF | Q_MISROUTE | Q_RW_IGNORED | Q_EPFEAT_ACK
             | Q_DEVFEAT_ACK | Q_ANY_INDEX | Q_OUT_REPLY | Q_ALT_IGNORED | Q_EP0_CLEAR_ACK | Q_EP0_SET_ACK
             | Q_DESC_LOOSE | Q_SETCFG_ANY, 0, 0xA0),
    "cherry": (Q_RECIP_TWO_BITS | Q_DEVFEAT_ACK | Q_ANY_INDEX | Q_UNCONF_STRICT | Q_ALT_ANY | Q_EP0_CLEAR_ACK
               | Q_EP0_SET_SPLIT | Q_UNCONF_EP_STALL | Q_CFG_ANY_INDEX, 0, 0xA0),
    "twolimit": (Q_RECIP_TWO_BITS | Q_IF_LIMIT | Q_EP_LIMIT, 0, 0xA0),
    "padded": (Q_PAD_REPLY, 1, 0xA0),
    "quiet": (Q_DIR_STRICT, 0, 0xA0),
    "quietlax": (Q_RECIP_LAX, 1, 0xA0),
    "reclone": (Q_HID_OWN, 0, 0xA0),
    "wedge": (Q_DIR_STRICT, 0, 0xA0),
    "behind": (_STM32 | Q_BEHIND, 1, 0xA0),
    "wdatadead": (_STM32 | Q_WDATA_DEAD, 1, 0xA0),
    "reclonewedge": (0, 0, 0xA0),
    "longbuf": (Q_LONG_BUF | Q_REQ7_HIST, 0, 0xA0),
}
# EnumHooks.ep0_die_on_getreport: 4 leaves GET_STATUS at recipient 3 unanswered, 3 kills endpoint 0 there, 5 kills it
# there once the device reads as another.
DIE = {"quiet": 4, "quietlax": 4, "wedge": 3, "reclonewedge": 5}
TWO_CONFIGS = ("twocfg", "reclone", "reclonewedge")
# Quirks under which a write with a data stage leaves endpoint 0 behind, or dead, until a bus reset.
LATE_KINDS = Q_BEHIND | Q_WDATA_DEAD
# The reclone kinds read as another device past this many GET_DESCRIPTOR(DEVICE), bus resets included.
RECLONE_AFTER = 50
PID0 = 0x7080
STRINGS = [bytes([4, 3, 0x09, 0x04]), sd("Test Lab"), sd("Request Mouse"), sd("SN-7080")]
FEATURE = bytes([3, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77])
FUNC = bytes([9, 0x21, 0x0B, 0xE8, 0x03, 0x40, 0x00, 0x10, 0x01])


def config(value, attrs, country=0, bcd=0x0111):
    """The configuration every kind presents: bmAttributes `attrs`, the mouse's HID descriptor at version `bcd` for
    `country`."""
    hid0 = bytearray(hid(len(MOUSE_DESC)))
    hid0[2], hid0[3], hid0[4] = bcd & 0xFF, bcd >> 8, country
    body = (itf(0, 1, 3, 1, 2) + bytes(hid0) + ep(0x81)
            + itf(1, 1, 3) + hid(len(VEND8_DESC)) + ep(0x82, 8, 4)
            + itf(2, 0, 0xFF) + FUNC)
    c = bytearray(cfg(3, body, value))
    c[7] = attrs
    return bytes(c)


def personality(name, pid):
    """Kind `name` as a device with the sim's VID and `pid`."""
    quirks, status, attrs = KINDS[name]
    configs = [config(1, attrs)] + ([config(2, attrs, 0x0D, 0x0110)] if name in TWO_CONFIGS else [])
    return Personality(speed=SPEED_FULL, device=device_desc(VID, pid, len(configs), i_man=1, i_prod=2, i_ser=3),
                       configs=configs, strings=STRINGS, hid_report=MOUSE_DESC, hid_report2=VEND8_DESC,
                       rpt2_iface=1, endpoints=[EndpointSpec(0x81, 3, 1, 8), EndpointSpec(0x82, 3, 1, 8)],
                       pump=Pump(0x81, 1000, GEN_FIXED), ctrl=ctrl_record(0xA1, 0x01, 0x0303, 0, FEATURE),
                       hooks=EnumHooks(ep0_quirks=quirks, dev_status=status, ep0_die_on_getreport=DIE.get(name, 0),
                                       swap_on_nth_getdesc=SWAP_PERSIST | RECLONE_AFTER if name.startswith("reclone")
                                       else 0))
