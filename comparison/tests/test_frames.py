"""Tests for medius_compare.frames: control frames as the published protocol lays them out."""
from medius_compare import frames


def test_a_move_frame_is_byte_exact():
    assert frames.move(5, -3, seq=7).hex() == "a501070600000500fdff00b73e"


def test_a_wheel_frame_and_an_empty_frame():
    assert frames.wheel(-1, seq=255, flags=frames.MOVE_NOW).hex() == "a501ff040001ffff01347f"
    assert frames.encode(0x06, 0).hex() == "a50600000059a3"


def test_stock_binary_commands():
    assert frames.mak(0x18, b"\x01\x00\x00\x00") == bytes.fromhex("dead0400180100" "0000")
    assert frames.mak_move(-2, 3) == bytes.fromhex("dead040018feff0300")
