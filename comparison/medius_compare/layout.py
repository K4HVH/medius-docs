"""A mouse's input report layout, read from its HID report descriptor (HID 1.11, section 6.2.2).

Offsets and sizes are in bits from the start of the report as the PC reads it, the report ID byte included.
"""
from dataclasses import dataclass
from typing import Optional, Tuple

GENERIC_DESKTOP, BUTTON, CONSUMER = 0x01, 0x09, 0x0C
POINTER, MOUSE = 0x01, 0x02
X, Y, WHEEL, AC_PAN = 0x30, 0x31, 0x38, 0x238

Field = Tuple[int, int]


@dataclass(frozen=True)
class Layout:
    report_id: int
    report_len: int
    buttons: Optional[Field]
    x: Optional[Field]
    y: Optional[Field]
    wheel: Optional[Field]
    pan: Optional[Field]


def _items(desc):
    i = 0
    while i < len(desc):
        b = desc[i]
        if b == 0xFE:
            i += 3 + (desc[i + 1] if i + 1 < len(desc) else 0)
            continue
        size = (0, 1, 2, 4)[b & 3]
        raw = desc[i + 1:i + 1 + size]
        yield (b >> 2) & 3, b >> 4, int.from_bytes(raw, "little"), size
        i += 1 + size


def _inputs(desc):
    """Every variable Input field: (application index, report ID, bit offset, bits, page, usage)."""
    glob = {"page": 0, "size": 0, "count": 0, "id": 0}
    stack, local, apps, depth = [], {"usages": [], "min": None, "max": None}, [], []
    pos, fields, ids = {}, [], set()
    for typ, tag, val, size in _items(desc):
        if typ == 1:
            if tag == 0:
                glob["page"] = val
            elif tag == 7:
                glob["size"] = val
            elif tag == 8:
                glob["id"] = val
                ids.add(val)
            elif tag == 9:
                glob["count"] = val
            elif tag == 10:
                stack.append(dict(glob))
            elif tag == 11 and stack:
                glob = stack.pop()
        elif typ == 2:
            full = val if size == 4 else (glob["page"] << 16) | val
            if tag == 0:
                local["usages"].append(full)
            elif tag == 1:
                local["min"] = full
            elif tag == 2:
                local["max"] = full
        elif typ == 0:
            if tag == 10:
                usage = (local["usages"] or [0])[0]
                if val == 1 and not depth:
                    apps.append(usage)
                depth.append(val)
            elif tag == 12 and depth:
                depth.pop()
            elif tag == 8:
                rid = glob["id"]
                at = pos.get(rid, 8 if rid else 0)
                n, bits = glob["count"], glob["size"]
                if not val & 1 and val & 2:
                    usages = list(local["usages"])
                    if local["min"] is not None and local["max"] is not None:
                        usages += range(local["min"], local["max"] + 1)
                    for k in range(n):
                        if usages:
                            u = usages[min(k, len(usages) - 1)]
                            fields.append((len(apps) - 1, rid, at + k * bits, bits, u >> 16, u & 0xFFFF))
                pos[rid] = at + n * bits
            local = {"usages": [], "min": None, "max": None}
    return apps, fields, pos


def mouse_layout(desc: bytes) -> Optional[Layout]:
    """The first mouse collection's layout, or None if the descriptor declares no mouse with X and Y."""
    apps, fields, pos = _inputs(bytes(desc))
    for app, usage in enumerate(apps):
        if usage not in ((GENERIC_DESKTOP << 16) | MOUSE, (GENERIC_DESKTOP << 16) | POINTER):
            continue
        mine = [f for f in fields if f[0] == app]

        def find(page, u):
            return next(((off, bits, rid) for _, rid, off, bits, p, uu in mine if p == page and uu == u), None)

        x, y = find(GENERIC_DESKTOP, X), find(GENERIC_DESKTOP, Y)
        if x is None or y is None:
            continue
        rid = x[2]
        buttons = [(off, bits) for _, r, off, bits, p, _ in mine if p == BUTTON and r == rid]
        wheel, pan = find(GENERIC_DESKTOP, WHEEL), find(CONSUMER, AC_PAN)
        return Layout(report_id=rid, report_len=(pos[rid] + 7) // 8,
                      buttons=(buttons[0][0], len(buttons)) if buttons else None,
                      x=x[:2], y=y[:2], wheel=wheel[:2] if wheel else None, pan=pan[:2] if pan else None)
    return None


def field(report: bytes, f: Field, signed=True) -> int:
    """A field's value from a report, little-endian across bytes."""
    off, bits = f
    v = (int.from_bytes(report, "little") >> off) & ((1 << bits) - 1)
    return v - (1 << bits) if signed and bits > 1 and v >> (bits - 1) else v
