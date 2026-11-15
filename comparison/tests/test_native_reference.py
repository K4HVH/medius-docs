import importlib.util
from pathlib import Path

import pytest

SUITE = Path(__file__).resolve().parents[1] / "suite"


def _load(test_id):
    spec = importlib.util.spec_from_file_location(f"suite_{test_id.replace('-', '_')}", SUITE / test_id / "test.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Ctx:
    def log(self, msg):
        pass


class _Monitor:
    def __init__(self, bus):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass


def test_clone_native_stops_when_the_native_sim_never_comes_up(monkeypatch):
    m = _load("clone-native")
    monkeypatch.setattr(m, "_Control", _Monitor)
    monkeypatch.setattr(m, "_present", lambda link, shape: None)
    monkeypatch.setattr(m, "_read", lambda port, name, binary=False: "5")
    monkeypatch.setattr(m, "_wait_up", lambda port, before, secs: port == "3-2.3")
    monkeypatch.setattr(m.time, "sleep", lambda s: None)
    with pytest.raises(RuntimeError, match="native sim did not come up"):
        m._case(_Ctx(), [object(), object()], ["3-2.3", "3-1.2"], "mouse", ("mouse",))


def test_ep0_stacks_stops_when_the_native_sim_never_comes_up(monkeypatch):
    m = _load("ep0-stacks")
    monkeypatch.setattr(m, "_present", lambda link, p: False)
    with pytest.raises(RuntimeError, match="native sim did not come up"):
        m._kind(_Ctx(), [object(), object()], ["3-2.3", "3-1.2"], 0, next(iter(m.KINDS)))
