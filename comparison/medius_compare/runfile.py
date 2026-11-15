"""Run files: one per box per invocation, rewritten after every run so a stopped run can carry on."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

FORMAT = "medius-compare-run/1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class RunFile:
    def __init__(self, path: Path, data: dict):
        self.path = Path(path)
        self.data = data

    @classmethod
    def create(cls, path, box, entry, tool_version, host, firmware, sims):
        data = {"format": FORMAT, "tool": {"version": tool_version, "entry": entry}, "box": box,
                "started": _now(), "finished": None, "host": host, "firmware": firmware, "sims": sims,
                "tests": {}}
        rf = cls(path, data)
        rf._write()
        return rf

    @classmethod
    def open(cls, path):
        return cls(path, cls.load(path))

    @staticmethod
    def load(path) -> dict:
        data = json.loads(Path(path).read_text())
        if data.get("format") != FORMAT:
            raise ValueError(f"{path}: not a {FORMAT} file")
        return data

    def begin_test(self, test_id, version, layout, legs, devices, state, skipped_legs=None):
        entry = self.data["tests"].get(test_id)
        if entry is None or entry["version"] != version:
            entry = {"version": version, "layout": layout, "legs": list(legs), "skipped_legs": skipped_legs or {},
                     "devices": devices, "state": state, "integrity": {"usbmon_lost": 0, "cut_transfers": 0},
                     "runs": [], "failed": None}
            self.data["tests"][test_id] = entry
        else:
            entry.update(devices=devices, state=state, failed=None)
        self._write()

    def add_run(self, test_id, raw: dict, integrity=None):
        entry = self.data["tests"][test_id]
        entry["runs"].append(raw)
        if integrity:
            for k, v in integrity.items():
                entry["integrity"][k] = entry["integrity"].get(k, 0) + v
        self._write()

    def fail(self, test_id, reason: str):
        self.data["tests"][test_id]["failed"] = reason
        self._write()

    def skip(self, test_id, version, reason: str):
        self.data["tests"][test_id] = {"version": version, "skipped": reason, "runs": []}
        self._write()

    def runs_done(self, test_id) -> int:
        entry = self.data["tests"].get(test_id)
        return len(entry["runs"]) if entry else 0

    def close(self):
        self.data["finished"] = _now()
        self._write()

    def _write(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=1) + "\n")
        os.replace(tmp, self.path)


def resume_point(path) -> dict:
    """Runs already on file per test, for carrying on from where a run stopped."""
    return {tid: len(entry.get("runs", [])) for tid, entry in RunFile.load(path)["tests"].items()}


def resolve(doc, ptr: str):
    """The value at JSON pointer `ptr` (RFC 6901) in `doc`, or None where the path doesn't exist."""
    if ptr in ("", "/"):
        return doc
    cur = doc
    for raw in ptr.lstrip("/").split("/"):
        part = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return None
        elif isinstance(cur, dict):
            if part not in cur:
                return None
            cur = cur[part]
        else:
            return None
    return cur
