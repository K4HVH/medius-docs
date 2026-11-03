"""`report`: one box's run beside the other's, row by row, as the comparison's tables lay them out. It
compares nothing with the published numbers; that is up to whoever reads it."""
from .runfile import RunFile, resolve


def _firmware(f: dict) -> str:
    fw = f.get("firmware") or {}
    return fw.get("version") or fw.get("device") or "?"


def _cell(entry, ptr):
    if entry is None:
        return "not run"
    if entry.get("skipped"):
        return "skipped"
    if entry.get("failed"):
        return "failed"
    ptrs = ptr if isinstance(ptr, list) else [ptr]
    vals = []
    for run in entry["runs"]:
        got = [resolve(run, p) for p in ptrs]
        if any(v is None for v in got):
            continue
        vals.append(sum(got) if all(isinstance(v, (int, float)) for v in got) else got[0])
    if not vals:
        return "-"
    if all(isinstance(v, (int, float)) for v in vals):
        lo, hi = min(vals), max(vals)
        return f"{lo:g}" if lo == hi else f"{lo:g}-{hi:g}"
    return ", ".join(sorted({str(v) for v in vals}))


def report(paths, suite) -> str:
    files = {}
    for p in paths:
        f = RunFile.load(p)
        if f["box"] in files:
            raise ValueError(f"one run per box: {p} is a second {f['box']} run")
        files[f["box"]] = f
    boxes = [b for b in ("stock", "medius") if b in files]
    out = ["", "".ljust(48) + "".join(b.ljust(22) for b in boxes),
           "Firmware".ljust(48) + "".join(_firmware(files[b]).ljust(22) for b in boxes)]
    for t in sorted(suite.values(), key=lambda t: t.id):
        entries = {b: files[b]["tests"].get(t.id) for b in boxes}
        if not any(entries.values()):
            continue
        out += ["", f"== {t.id}"]
        for table in t.tables:
            out.append(f"  {table.label}" + (f" ({table.unit})" if table.unit else ""))
            for row in table.rows:
                cells = []
                for b in boxes:
                    ptr = row.ptr.get(b) if isinstance(row.ptr, dict) else row.ptr
                    cells.append(_cell(entries[b], ptr).ljust(22))
                out.append(f"    {row.label[:42]}".ljust(48) + "".join(cells))
    return "\n".join(out) + "\n"
