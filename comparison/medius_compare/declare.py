"""Test declarations: comparison/suite/<id>/test.toml, read and checked against a closed set of keys."""
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

TEST_KEYS = {"id", "version", "category", "layout", "boxes", "jams_stock", "state", "legs", "tables"}
LEG_KEYS = {"id", "device"}
TABLE_KEYS = {"section", "order", "kind", "label", "key", "unit", "better", "stat", "layer", "n", "hubs",
              "resolution", "commands", "outcomes", "ranked", "columns", "rows"}
ROW_KEYS = {"id", "label", "note", "ptr", "unit", "of", "of_ptr", "native_ptr", "target", "test", "box", "default",
            "values"}
LAYOUTS = {"main", "native"}
BOXES = {"stock", "medius", "native"}
KINDS = {"measure", "outcome", "settings"}
STILL_DEVICES = {"still-mouse", "still-keyboard", "still-composite"}


class DeclarationError(Exception):
    pass


@dataclass
class LegDecl:
    id: str
    device: str

    @property
    def needs_sim(self) -> bool:
        return self.device.startswith("sim:")


@dataclass
class RowDecl:
    id: str
    label: str = ""
    note: str | None = None
    ptr: object = None
    unit: str | None = None
    of: int | None = None
    of_ptr: str | None = None
    native_ptr: str | None = None
    target: float | None = None
    test: str | None = None
    box: str | None = None
    default: bool = False
    values: dict = field(default_factory=dict)


@dataclass
class TableDecl:
    section: str
    order: int
    kind: str
    label: str
    key: str
    rows: list
    unit: str | None = None
    better: str | None = None
    stat: str | None = None
    layer: str | None = None
    n: str | None = None
    hubs: str | None = None
    resolution: float | None = None
    commands: dict | None = None
    outcomes: list | None = None
    ranked: bool | None = None
    columns: list | None = None


@dataclass
class TestDecl:
    id: str
    version: int
    category: str
    layout: str
    boxes: list
    jams_stock: bool
    state: dict
    legs: list
    tables: list
    path: Path = None


def _closed(where: str, data: dict, allowed: set) -> None:
    extra = sorted(set(data) - allowed)
    if extra:
        raise DeclarationError(f"{where}: unknown key {', '.join(extra)}")


def load_test(path: Path) -> TestDecl:
    where = str(path)
    try:
        data = tomllib.loads(path.read_text())
    except tomllib.TOMLDecodeError as e:
        raise DeclarationError(f"{where}: {e}") from e
    _closed(where, data, TEST_KEYS)
    for key in ("id", "version", "category", "layout", "boxes"):
        if key not in data:
            raise DeclarationError(f"{where}: missing {key}")
    if data["layout"] not in LAYOUTS:
        raise DeclarationError(f"{where}: layout {data['layout']!r} is not one of {sorted(LAYOUTS)}")
    bad_boxes = set(data["boxes"]) - BOXES
    if bad_boxes:
        raise DeclarationError(f"{where}: boxes {sorted(bad_boxes)} are not among {sorted(BOXES)}")
    legs = []
    for leg in data.get("legs", []):
        _closed(f"{where} [[legs]]", leg, LEG_KEYS)
        if leg["device"] not in STILL_DEVICES and not leg["device"].startswith("sim:"):
            raise DeclarationError(f"{where}: leg {leg['id']} device {leg['device']!r} is neither "
                                   f"{sorted(STILL_DEVICES)} nor sim:<shape>")
        legs.append(LegDecl(**leg))
    tables = []
    for t in data.get("tables", []):
        _closed(f"{where} [[tables]]", t, TABLE_KEYS)
        if t.get("kind") not in KINDS:
            raise DeclarationError(f"{where}: table {t.get('label')!r} kind {t.get('kind')!r} is not one of {sorted(KINDS)}")
        rows = []
        for r in t.get("rows", []):
            _closed(f"{where} [[tables.rows]] {r.get('id')}", r, ROW_KEYS)
            rows.append(RowDecl(**r))
        tables.append(TableDecl(**{**t, "rows": rows}))
    return TestDecl(id=data["id"], version=data["version"], category=data["category"], layout=data["layout"],
                    boxes=list(data["boxes"]), jams_stock=bool(data.get("jams_stock", False)),
                    state=data.get("state", {}), legs=legs, tables=tables, path=path.parent)


def load_suite(root: Path) -> dict:
    """Every test under `root` (<root>/<id>/test.toml beside its test.py), by id."""
    suite = {}
    for toml in sorted(Path(root).glob("*/test.toml")):
        decl = load_test(toml)
        if decl.id != toml.parent.name:
            raise DeclarationError(f"{toml}: id {decl.id!r} differs from its directory {toml.parent.name!r}")
        if not (toml.parent / "test.py").exists():
            raise DeclarationError(f"{toml.parent}: no test.py beside test.toml")
        suite[decl.id] = decl
    return suite
