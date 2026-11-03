"""Tests for medius_shapes: shapes are plain data, and build() hands the sim exactly what its own library
would have built."""
import importlib
import inspect
import os
import pkgutil
import subprocess
import sys
from pathlib import Path

import pytest

import medius_shapes
from medius_shapes import core

HERE = Path(__file__).resolve().parent.parent


def every_shape():
    """Every zero-argument function in medius_shapes that returns a personality."""
    for info in pkgutil.iter_modules(medius_shapes.__path__):
        if info.name == "personalities":
            continue
        mod = importlib.import_module(f"medius_shapes.{info.name}")
        for name, fn in inspect.getmembers(mod, inspect.isfunction):
            if fn.__module__ != mod.__name__ or name.startswith("_"):
                continue
            if any(p.default is p.empty and p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)
                   for p in inspect.signature(fn).parameters.values()):
                continue
            out = fn()
            if isinstance(out, core.Personality):
                yield f"{info.name}.{name}", out


def test_shapes_are_data():
    code = ("import sys; sys.modules['rig'] = None; sys.path.insert(0, %r); sys.path.insert(0, %r);"
            "import test_shapes as t; names = [n for n, _ in t.every_shape()];"
            "assert 'rig' not in [m.split('.')[0] for m in sys.modules if sys.modules[m]]; print(len(names))"
            % (str(HERE), str(HERE / "tests")))
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    assert int(r.stdout) > 0
    for name, p in every_shape():
        assert isinstance(p.device, bytes) and all(isinstance(c, bytes) for c in p.configs), name
        assert all(isinstance(e, core.EndpointSpec) for e in p.endpoints), name


needs_sim_library = pytest.mark.skipif(not os.path.isdir(os.path.join(os.environ.get("SIM_LIBRARY", ""), "rig")),
                                       reason="the sim's library is not checked out beside this repo")


@needs_sim_library
def test_build_matches_the_sim_library_field_for_field():
    from medius_shapes.personalities import _rig
    rp = _rig()
    records = [(3, b"\x00\x01\x00"), (2, b"")]
    common = dict(speed=core.SPEED_FULL, device=core.device_desc(core.VID, 0x6299, 2, mps0=16, i_man=1),
                  configs=[core.cfg(1, core.MOUSE_IF), core.cfg(1, core.MOUSE_IF, value=2)],
                  strings=[bytes([4, 3, 9, 4]), core.sd("maker")], bos=b"\x05\x0f\x05\x00\x00",
                  qualifier=bytes([10, 6, 0, 2, 0, 0, 0, 64, 1, 0]), hid_report=core.MOUSE_DESC,
                  hid_report2=core.KBD_DESC, rpt2_iface=2, alt_model=1)
    eps = [(0x81, 3, 1, 8, 3, 0, 1, 200, 4, 0), (0x02, 2, 2, 64, 0, 0, 0, 0, 5, 1)]
    hooks = dict(ep0_mps=8, set_address_delay_us=7, swap_on_nth_getdesc=3 | core.SWAP_PERSIST,
                 ep0_die_on_getreport=4, slow_rpt_iface=1, slow_rpt_ms=450, slow_rpt_times=1, slow_str_ms=5,
                 slow_reset_ms=30, ep0_quirks=core.Q_BEHIND | core.Q_DIR_STRICT, dev_status=2)
    mine = core.Personality(**common, endpoints=[core.EndpointSpec(*e) for e in eps], hooks=core.EnumHooks(**hooks),
                            pump=core.Pump(0x81, 1000, core.GEN_SCRIPT, 0, 500), pump2=core.Pump(0x02, 8000),
                            script=core.script(records, once=True, zlp_idle=True),
                            ctrl=core.ctrl_record(0xC0, 1, 0, 0, b"ab") + core.ctrl_record(0x40, 2, 1, 0, link=0))
    theirs = rp.Personality(**common, endpoints=[rp.EndpointSpec(*e) for e in eps], hooks=rp.EnumHooks(**hooks),
                            pump=rp.Pump(0x81, 1000, rp.GEN_SCRIPT, 0, 500), pump2=rp.Pump(0x02, 8000),
                            script=rp.script(records, once=True, zlp_idle=True),
                            ctrl=rp.ctrl_record(0xC0, 1, 0, 0, b"ab") + rp.ctrl_record(0x40, 2, 1, 0, link=0))
    assert mine.encode() == theirs.encode()
    assert mine.digest() == theirs.digest()


@needs_sim_library
def test_the_defaults_match_the_sim_library():
    rp = __import__("medius_shapes.personalities", fromlist=["_rig"])._rig()
    assert core.Personality().encode() == rp.Personality().encode()
    assert core.device_desc() == rp.device_desc()
    assert core.hid_config() == rp.hid_config()


def test_without_the_sim_library_the_shapes_say_where_to_name_it(monkeypatch):
    import sys
    from medius_shapes import personalities
    monkeypatch.setattr(personalities, "SIM_LIBRARY", None)
    monkeypatch.delenv("SIM_LIBRARY", raising=False)
    monkeypatch.setitem(sys.modules, "rig", None)
    with pytest.raises(RuntimeError, match="sim_library"):
        personalities.sim_module("usbfs")
