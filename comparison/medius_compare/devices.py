"""What a test leg runs against: a still device an owner plugged in, or a shape the sim plays."""
from dataclasses import dataclass, field


@dataclass
class Presented:
    vid: int
    pid: int
    product: str
    nodes: list = field(default_factory=list)
    descriptor_sha256: str = ""
    layout: object = None

    def record(self, leg: str) -> dict:
        return {"leg": leg, "vid": self.vid, "pid": self.pid, "product": self.product,
                "descriptor_sha256": self.descriptor_sha256}


class LegUnavailable(Exception):
    """The leg's device can't be had on this bench (no sim, no keyboard plugged in)."""
