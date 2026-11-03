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
    from .bench import Bench, SoloBench
    from .devices import RealDevices, SimDevices
    if entry == "no-sim":
        box = boxes_mod.open_box(args.box, args.port)
        return Engine(entry=entry, bench=SoloBench(), devices=RealDevices(args.box), boxes={args.box: box},
                      suite=suite, out_dir=args.out)
    bench = Bench.load(args.bench)
    if bench.sim_library:
        from medius_shapes import personalities
        personalities.SIM_LIBRARY = bench.sim_library
    devices = SimDevices(bench)
    bench._locate, bench._describe = devices.locate, devices.describe_sim
    wanted = [args.box] if args.box in ("stock", "medius") else ["stock", "medius"]
    boxes = {k: boxes_mod.open_box(k, bench.control_port(k)) for k in wanted}
    return Engine(entry=entry, bench=bench, devices=devices, boxes=boxes, suite=suite, out_dir=args.out)


def _clone_port(box: str, port: str) -> str:
    """The USB port the box's clone is on: a Medius box says what it cloned; stock can't, so it is named."""
    from medius_bench import quiet
    if box == "medius":
        import medius
        return quiet.clone_usb_port(medius.Device.open(port))
    found = "; ".join(f"{p} ({ident}{', ' + name if name else ''})" for p, ident, name in quiet.input_ports())
    raise SystemExit("name the stock box's clone with --usb-port: the USB port its PC cable is on, carrying the "
                     f"mouse or keyboard plugged into the box. Input devices on this PC: {found or 'none'}")


def _run(entry: str, args, suite) -> int:
    from medius_bench import clone_guard
    clone_guard.engage()
    engine = _engine(entry, args, suite)
    selection = Selection(tests=args.test, categories=args.category, boxes=[args.box] if args.box else [],
                          layouts=[args.layout] if getattr(args, "layout", None) else [])
    for path in engine.run(selection, runs=args.runs, resume=args.resume, stock_jam_runs=args.stock_jam_runs):
        print(path)
    return 0


def main(entry: str, argv=None) -> int:
    ap = argparse.ArgumentParser(prog="medius-compare" + ("-sim" if entry == "sim" else ""),
                                 description="Measure a MAKCU box, stock or Medius, the way the comparison does.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="run tests on a box and write a run file")
    r.add_argument("--test", action="append", default=[], help="one test by id (repeat for more)")
    r.add_argument("--category", action="append", default=[], help="every test in a category (repeat for more)")
    r.add_argument("--box", choices=["stock", "medius"] + (["native"] if entry == "sim" else []))
    r.add_argument("--runs", type=int, default=3, help="runs of each test (default 3)")
    r.add_argument("--stock-jam-runs", type=int, help="runs on stock of each test that can leave it one command "
                                                       "behind, each needing a power cycle (default: --runs)")
    r.add_argument("--out", type=Path, default=Path("runs"), help="where run files go (default ./runs)")
    r.add_argument("--resume", help="carry on a stopped run, by its stamp (the run file's name)")
    if entry == "no-sim":
        r.add_argument("--port", help="the box's control port, e.g. /dev/ttyACM0")
        r.add_argument("--usb-port", help="the USB port the box's clone is on, e.g. 1-4 (found from a Medius box; "
                                          "name it for stock)")
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
    if entry == "no-sim":
        if not args.box or not args.port:
            raise SystemExit("name the box and its control port: --box stock|medius --port /dev/ttyACMn")
        from medius_bench import quiet
        with quiet.quieted([args.usb_port or _clone_port(args.box, args.port)]):
            return _run(entry, args, suite)
    return _run(entry, args, suite)
