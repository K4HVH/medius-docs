"""Tests for medius_compare.devices, with no evdev, sim or USB bus: every hardware touch is a stand-in."""
import pytest
from medius_compare.declare import LegDecl
from medius_compare.devices import LegUnavailable, Presented, RealDevices, SimDevices
from medius_shapes import core

CLONE = "1-2.3"


def found(port):
    return {"vid": 0x1D50, "pid": 0x6160, "product": "mouse", "descriptor_sha256": "ab" * 32, "layout": None}


def real(kinds, moved):
    return RealDevices("medius", clone_port=CLONE, nodes=lambda port: ["/dev/input/event7", "/dev/hidraw3"],
                       kinds=lambda node: kinds, moved=lambda nodes, secs: moved, describe=found)


def test_real_devices_takes_a_still_mouse():
    p = real({"mouse"}, moved=False).present(LegDecl("rest", "still-mouse"), "medius")
    assert isinstance(p, Presented) and p.nodes == ["/dev/input/event7", "/dev/hidraw3"] and p.pid == 0x6160


def test_real_devices_refuses_a_moving_mouse():
    with pytest.raises(LegUnavailable, match="moved"):
        real({"mouse"}, moved=True).present(LegDecl("rest", "still-mouse"), "medius")


def test_real_devices_names_the_device_a_leg_lacks():
    with pytest.raises(LegUnavailable, match="keyboard"):
        real({"mouse"}, moved=False).present(LegDecl("typing", "still-keyboard"), "medius")
    with pytest.raises(LegUnavailable, match="sim"):
        real({"mouse"}, moved=False).present(LegDecl("sine", "sim:sine-mouse"), "medius")


class FakeLink:
    uploads = []

    def __init__(self, port):
        self.port = port

    def present(self, personality, settle=0.35, verify=True):
        FakeLink.uploads.append((self.port, personality))

    def present_builtin(self, pid, *a, settle=0.35):
        FakeLink.uploads.append((self.port, pid))

    def close(self):
        pass


class FakeBench:
    box = {"stock": {"clone": "1-2.2"}, "medius": {"clone": CLONE}}
    sim = {"stock": {"serial": "SIMSTOCK", "box": "stock", "native": "1-1.2"},
           "medius": {"serial": "SIMMEDIUS", "box": "medius", "native": "1-1.2"}}

    def __init__(self, cabling):
        self.cabling = cabling

    def layout_now(self):
        return self.cabling

    def sim_port(self, name):
        return f"/dev/serial/by-id/sim-{name}"


def sim_devices(cabling, appeared):
    shape = core.personality(0x6299, core.cfg(1, core.MOUSE_IF), [core.EndpointSpec(0x81, 3, 1, 8, 3)])
    FakeLink.uploads = []
    return SimDevices(FakeBench(cabling), link=FakeLink, shapes={"sim:fake": lambda: shape},
                      appears=lambda port, vid, pid, timeout: appeared.append((port, vid, pid)) or True,
                      describe=found, nodes=lambda port: [f"/dev/input/{port}"])


def test_sim_devices_presents_on_the_box_sim_and_native_sim():
    appeared = []
    d = sim_devices("native:medius", appeared)
    d.present(LegDecl("rest", "sim:fake"), "stock")
    d.present(LegDecl("rest", "sim:fake"), "native")
    assert [port for port, _ in FakeLink.uploads] == ["/dev/serial/by-id/sim-stock", "/dev/serial/by-id/sim-stock"]
    assert appeared == [("1-2.2", 0x1D50, 0x6299), ("1-1.2", 0x1D50, 0x6299)]
    d = sim_devices("native:stock", appeared)
    p = d.present(LegDecl("rest", "sim:fake"), "native")
    assert FakeLink.uploads[-1][0] == "/dev/serial/by-id/sim-medius" and p.nodes == ["/dev/input/1-1.2"]


def test_a_shape_that_never_appears_is_unavailable():
    d = sim_devices("main", [])
    d._appears = lambda port, vid, pid, timeout: False
    with pytest.raises(LegUnavailable, match="1-2.3"):
        d.present(LegDecl("rest", "sim:fake"), "medius")


def test_native_needs_a_native_cabling():
    with pytest.raises(LegUnavailable, match="native"):
        sim_devices("main", []).present(LegDecl("rest", "sim:fake"), "native")


def fake_sysfs(tmp_path, port, vid, pid):
    dev = tmp_path / "bus" / "usb" / "devices" / port
    dev.mkdir(parents=True)
    (dev / "idVendor").write_text(f"{vid:04x}\n")
    (dev / "idProduct").write_text(f"{pid:04x}\n")
    target = tmp_path / "devices" / "usb3" / port / f"{port}:1.0" / "0003:1D50:6FF0.0001"
    target.mkdir(parents=True)
    node = tmp_path / "class" / "input" / "event5"
    node.mkdir(parents=True)
    (node / "device").symlink_to(target)


def test_appears_looks_once_even_with_no_time_to_wait(tmp_path):
    from medius_compare.devices import appears
    fake_sysfs(tmp_path, "1-1.2", 0x1D50, 0x6FF0)
    assert appears("1-1.2", 0x1D50, 0x6FF0, 0.0, sysfs=str(tmp_path))
    assert not appears("1-1.2", 0x1D50, 0x6FF1, 0.0, sysfs=str(tmp_path))


def test_locate_finds_the_port_the_beacon_appears_on():
    seen = {"1-1.2": (0x1D50, 0x6FF0)}
    FakeLink.uploads = []
    d = SimDevices(FakeBench("main"), link=FakeLink,
                   appears=lambda port, vid, pid, timeout: seen.get(port) == (vid, pid))
    assert d.locate("SIMSTOCK") == "1-1.2"
    assert FakeLink.uploads[-1][0] == "/dev/serial/by-id/sim-stock"


def test_a_builtin_leg_presents_the_sims_own_device():
    appeared = []
    d = sim_devices("main", appeared)
    d._builtin = lambda name: {"gamingmouse": 22}[name]
    d._changed = lambda port, before, timeout: True
    p = d.present(LegDecl("rest", "sim:builtin:gamingmouse"), "medius")
    assert FakeLink.uploads[-1] == ("/dev/serial/by-id/sim-medius", 22) and p.usb == CLONE


def test_a_builtin_the_clone_keeps_counts_as_presented(tmp_path):
    from medius_compare.devices import reenumerated
    fake_sysfs(tmp_path, "1-2.3", 0x1D50, 0x6160)
    (tmp_path / "bus" / "usb" / "devices" / "1-2.3" / "devnum").write_text("9\n")
    assert reenumerated("1-2.3", 9, 3.0, sysfs=str(tmp_path), keep_s=0.2)
    assert not reenumerated("1-2.4", 9, 0.3, sysfs=str(tmp_path), keep_s=0.2)


def test_the_other_box_sim_is_parked_unless_it_is_lent():
    FakeLink.uploads = []
    d = SimDevices(FakeBench("main"), link=FakeLink)
    d._builtin = lambda name: {"silentmouse": 25}[name]
    d.park_others("medius")
    assert FakeLink.uploads == [("/dev/serial/by-id/sim-stock", 25)]
    FakeLink.uploads = []
    SimDevices(FakeBench("native:medius"), link=FakeLink).park_others("medius")
    assert FakeLink.uploads == []
