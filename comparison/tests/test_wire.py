"""Tests for medius_compare.wire: usbmon events parsed and judged without a bus."""
import struct

from medius_compare import integrity, wire

HDR = struct.Struct("<QBBBBHccqiiII8s")


def usbmon_event(kind, xfer, ep, dev, length, data, flag_data=b"\x00", ts_us=1_000_000):
    return HDR.pack(1, ord(kind), xfer, ep, dev, 3, b"-", flag_data, ts_us // 1_000_000, ts_us % 1_000_000, 0,
                    length, len(data), bytes(8)) + data


def test_cut_transfer_fails_the_capture():
    whole = wire.parse_event(usbmon_event("C", 1, 0x81, 5, 8, bytes(8)), {5}, keep=64)
    cut = wire.parse_event(usbmon_event("C", 1, 0x81, 5, 64, bytes(32)), {5}, keep=64)
    no_data = wire.parse_event(usbmon_event("S", 1, 0x81, 5, 8, b"", flag_data=b"<"), {5}, keep=64)
    other = wire.parse_event(usbmon_event("C", 1, 0x81, 9, 64, bytes(32)), {5}, keep=64)
    assert whole[1] is False and no_data[1] is False
    assert cut[1] is True
    assert other == (None, False)
    w = wire.Wire([5], bus=3)
    w.consume(wire.REC.pack(1_000_000, ord("C"), 1, 0x81, 5, 64, 32) + bytes(32))
    w.consume(wire.REC.pack(1, ord("X"), 0, 0, 0, 0, 0))
    w.consume(wire.REC.pack(0, ord("L"), 0, 0, 0, 0, 0))
    found = {}
    with integrity.collecting(found):
        w.finish()
    assert w.cut == 1 and found == {"cut_transfers": 1}


def test_kernel_drop_fails_the_capture():
    w = wire.Wire([5], bus=3)
    w.consume(wire.REC.pack(3, ord("L"), 0, 0, 0, 0, 0))
    found = {}
    with integrity.collecting(found):
        w.finish()
    assert w.lost == 3 and found == {"usbmon_lost": 3}


def test_a_capture_that_never_reported_its_drops_fails():
    w = wire.Wire([5], bus=3)
    found = {}
    with integrity.collecting(found):
        w.finish()
    assert found == {"usbmon_unfinished": 1}


def test_move_latency_times_a_move_to_the_reports_carrying_it():
    ev = [wire.Event(100, "S", 3, 0x02, 7, 13, b"km.move(5,0)\r\n"), wire.Event(150, "C", 3, 0x02, 7, 13, b""),
          wire.Event(1150, "C", 1, 0x81, 5, 5, bytes([0, 3, 0, 0, 0])),
          wire.Event(2150, "C", 1, 0x81, 5, 5, bytes([0, 2, 0, 0, 0]))]
    assert wire.move_latency(ev, "stock", ch343=7, clone=5, dx=5) == [(0.001, 0.002, 2)]
