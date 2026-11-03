"""The command line both entry points share: `run` and `report`."""
import argparse
import os
import sys
from pathlib import Path

from .declare import load_suite
from .engine import Engine, Selection
from .report import report

SUITE = Path(__file__).resolve().parent.parent / "suite"


def _engine(entry: str, args, suite) -> Engine:
    from . import boxes as boxes_mod
    from . import devices as devices_mod
    from .bench import Bench, SoloBench
    if entry == "no-sim":
        if not args.box or not args.port:
            raise SystemExit("name the box and its control port: --box stock|medius --port /dev/ttyACMn")
        box = boxes_mod.open_box(args.box, args.port)
        return Engine(entry=entry, bench=SoloBench(), devices=devices_mod.RealDevices(box_name=args.box),
                      boxes={args.box: box}, suite=suite, out_dir=args.out)
    bench = Bench.load(args.bench)
    wanted = [args.box] if args.box else ["stock", "medius"]
    boxes = {k: boxes_mod.open_box(k, bench.control_port(k)) for k in wanted if k != "native"}
    return Engine(entry=entry, bench=bench, devices=devices_mod.SimDevices(bench), boxes=boxes, suite=suite,
                  out_dir=args.out)


def main(entry: str, argv=None) -> int:
    ap = argparse.ArgumentParser(prog="medius-compare" + ("-sim" if entry == "sim" else ""),
                                 description="Measure a MAKCU box, stock or Medius, the way the comparison does.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="run tests on a box and write a run file")
    r.add_argument("--test", action="append", default=[], help="one test by id (repeat for more)")
    r.add_argument("--category", action="append", default=[], help="every test in a category (repeat for more)")
    r.add_argument("--box", choices=["stock", "medius"] + (["native"] if entry == "sim" else []))
    r.add_argument("--runs", type=int, default=3, help="runs of each test (default 3)")
    r.add_argument("--out", type=Path, default=Path("runs"), help="where run files go (default ./runs)")
    r.add_argument("--resume", help="carry on a stopped run, by its stamp (the run file's name)")
    if entry == "no-sim":
        r.add_argument("--port", help="the box's control port, e.g. /dev/ttyACM0")
    else:
        r.add_argument("--bench", type=Path, default=None, help="the bench config (default ~/.config/medius-compare/bench.toml)")
        r.add_argument("--layout", choices=["main", "native"], help="only the tests run in this cabling")
    p = sub.add_parser("report", help="put a stock run and a Medius run side by side")
    p.add_argument("files", nargs=2, type=Path)
    args = ap.parse_args(argv)
    suite = load_suite(SUITE)
    if args.cmd == "report":
        sys.stdout.write(report(args.files, suite))
        return 0
    if os.geteuid() != 0:
        raise SystemExit("run as root: the tests read the clone's input nodes and the USB bus")
    engine = _engine(entry, args, suite)
    selection = Selection(tests=args.test, categories=args.category, boxes=[args.box] if args.box else [],
                          layouts=[args.layout] if getattr(args, "layout", None) else [])
    for path in engine.run(selection, runs=args.runs, resume=args.resume):
        print(path)
    return 0
