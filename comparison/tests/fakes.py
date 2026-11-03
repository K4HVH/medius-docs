"""Fakes for the engine's unit tests: boxes, devices and a bench with no hardware."""
from medius_compare.devices import Presented


class FakeBox:
    def __init__(self, kind, readback=None):
        self.kind = kind
        self._settings = {}
        self._readback = readback or {}
        self.closed = False

    def firmware(self):
        return {"version": "V4.122"} if self.kind == "stock" else {"device": "3.5.0+fake", "proto": 10}

    def apply(self, settings):
        self._settings.update(settings)

    def settings(self):
        return {**self._settings, **self._readback}

    def lagging(self):
        return False

    def close(self):
        self.closed = True


class FakeDevices:
    def __init__(self):
        self.presented = []
        self.restored = []

    def present(self, leg, box):
        self.presented.append((leg.id, leg.device, box))
        return Presented(vid=0x1D50, pid=0x6160, product="Fake mouse", nodes=[], descriptor_sha256="ab" * 32)

    def restore(self, box):
        self.restored.append(box)


class FakeBench:
    def __init__(self, layout="main"):
        self.layout = layout
        self.moves = []
        self.cycled = []

    def layout_now(self):
        return self.layout

    def move_to(self, layout):
        self.moves.append(layout)
        self.layout = layout

    def wait_for(self, layout, timeout=None):
        return True

    def sims(self):
        return {"box": {"serial": "FAKE", "build": "fake"}, "native": None}

    def power_cycle(self, box):
        self.cycled.append(box)
