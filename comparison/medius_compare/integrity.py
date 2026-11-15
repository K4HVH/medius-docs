"""What a run's captures lost; the engine fails a test whose run lost anything."""
from contextlib import contextmanager

_sink = None


@contextmanager
def collecting(counts: dict):
    """Collect every loss reported inside the block into `counts`."""
    global _sink
    prev, _sink = _sink, counts
    try:
        yield counts
    finally:
        _sink = prev


def report(kind: str, n: int):
    if n and _sink is not None:
        _sink[kind] = _sink.get(kind, 0) + n
