"""Control frames written straight to a box's port, for tests that pace or break them on purpose.

Medius: `[A5][type][seq][len u16 LE][payload][crc16 LE]`, the CRC (CCITT-FALSE) over everything after A5 and
before the CRC, as the protocol pages give it. Stock: `DE AD [len u16 LE][cmd][payload]` (its binary API)."""
import struct

SOF = 0xA5
MOVE = 0x01
MOTION_CURSOR, MOTION_WHEEL, MOTION_PAN = 0, 1, 2
MOVE_NOW = 0x01
MAK_MOVE = 0x18


def crc16(data, crc=0xFFFF):
    for b in data:
        crc ^= (b << 8) & 0xFFFF
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def encode(type_, seq, payload=b""):
    payload = bytes(payload)
    hdr = bytes([type_ & 0xFF, seq & 0xFF, len(payload) & 0xFF, len(payload) >> 8])
    crc = crc16(hdr + payload)
    return bytes([SOF]) + hdr + payload + bytes([crc & 0xFF, crc >> 8])


def move(dx, dy, seq=0, flags=0):
    return encode(MOVE, seq, struct.pack("<BhhB", MOTION_CURSOR, dx, dy, flags))


def wheel(dz, seq=0, flags=0):
    return encode(MOVE, seq, struct.pack("<BhB", MOTION_WHEEL, dz, flags))


def pan(d, seq=0, flags=0):
    return encode(MOVE, seq, struct.pack("<BhB", MOTION_PAN, d, flags))


def mak(cmd, payload=b""):
    payload = bytes(payload)
    n = len(payload) + 1 if cmd in (0xA4, 0xA5) else len(payload)
    return b"\xde\xad" + n.to_bytes(2, "little") + bytes([cmd]) + payload


def mak_move(dx, dy):
    return mak(MAK_MOVE, struct.pack("<hh", dx, dy))
