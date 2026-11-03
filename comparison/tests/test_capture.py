"""Tests for medius_compare.capture: evdev frames decoded, and a reader that fell behind found."""
import struct

from medius_compare import capture, integrity

EV = struct.Struct("llHHi")


def ev(t, typ, code, val):
    return EV.pack(int(t), int((t % 1) * 1e6), typ, code, val)


def test_evdev_frames_sum_motion_and_keep_key_edges():
    d = capture.EvDecoder()
    d.feed(ev(1.0, 2, 0, 3) + ev(1.0, 2, 0, 2) + ev(1.0, 1, 272, 1) + ev(1.0, 0, 0, 0))
    assert d.take() == [(1.0, {0: 5}, [(272, 1)])]


def test_evdev_drop_fails_the_capture_except_the_one_at_open():
    d = capture.EvDecoder()
    d.feed(ev(1.0, 0, 3, 0) + ev(1.0, 2, 0, 1) + ev(1.0, 0, 0, 0))
    assert d.syn_dropped == 0
    d.feed(ev(1.1, 2, 0, 1) + ev(1.1, 0, 3, 0) + ev(1.2, 2, 0, 1) + ev(1.2, 0, 0, 0))
    assert d.syn_dropped == 1
    found = {}
    with integrity.collecting(found):
        d.finish()
    assert found == {"evdev_dropped": 1}


def test_evdev_frame_split_across_reads():
    d = capture.EvDecoder()
    b = ev(2.0, 2, 1, -4) + ev(2.0, 0, 0, 0)
    d.feed(b[:7])
    d.feed(b[7:])
    assert d.take() == [(2.0, {1: -4}, [])]
