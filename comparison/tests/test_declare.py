"""Tests for medius_compare.declare. Run: python3 -m pytest comparison/tests"""
from pathlib import Path

import pytest

from medius_compare.declare import DeclarationError, load_suite

FIXTURES = Path(__file__).parent / "fixtures" / "suite"


def test_declaration_round_trip():
    suite = load_suite(FIXTURES)
    t = suite["fake-test"]
    assert (t.id, t.version, t.category, t.layout) == ("fake-test", 2, "injection", "main")
    assert t.boxes == ["stock", "medius"] and t.jams_stock is False
    assert t.state == {"medius": {"optin": False}}
    assert [(leg.id, leg.device) for leg in t.legs] == [("rest", "still-mouse")]
    table = t.tables[0]
    assert (table.kind, table.unit, table.better, table.resolution) == ("measure", "ms", "lower", 0.01)
    assert table.rows[0].id == "fake-row" and table.rows[0].ptr == "/rest/value"


def test_an_unknown_key_names_the_file_and_key(tmp_path):
    d = tmp_path / "bad"
    d.mkdir()
    (d / "test.toml").write_text((FIXTURES / "fake-test" / "test.toml").read_text() + "\nflavour = 1\n")
    (d / "test.py").write_text("def run(ctx):\n    return {}\n")
    with pytest.raises(DeclarationError, match=r"bad/test.toml.*flavour"):
        load_suite(tmp_path)


def test_a_leg_device_must_be_still_or_sim(tmp_path):
    d = tmp_path / "bad"
    d.mkdir()
    text = (FIXTURES / "fake-test" / "test.toml").read_text().replace('device = "still-mouse"', 'device = "wiggly"')
    (d / "test.toml").write_text(text)
    (d / "test.py").write_text("def run(ctx):\n    return {}\n")
    with pytest.raises(DeclarationError, match="wiggly"):
        load_suite(tmp_path)


def test_a_declaration_without_its_test_py_is_unported(tmp_path):
    from medius_compare.declare import unported
    for name, with_code in (("ported", True), ("seeded", False)):
        d = tmp_path / name
        d.mkdir()
        (d / "test.toml").write_text((FIXTURES / "fake-test" / "test.toml").read_text().replace('"fake-test"', f'"{name}"'))
        if with_code:
            (d / "test.py").write_text("def run(ctx):\n    return {}\n")
    assert list(load_suite(tmp_path)) == ["ported"]
    assert unported(tmp_path) == ["seeded"]


def test_an_unported_declaration_is_still_checked(tmp_path):
    d = tmp_path / "seeded"
    d.mkdir()
    (d / "test.toml").write_text((FIXTURES / "fake-test" / "test.toml").read_text().replace('"fake-test"', '"seeded"')
                                 + "\nflavour = 1\n")
    with pytest.raises(DeclarationError, match="flavour"):
        load_suite(tmp_path)


def test_the_seeded_suite_loads():
    from medius_compare.declare import unported
    root = Path(__file__).parent.parent / "suite"
    assert len(load_suite(root)) + len(unported(root)) == len(list(root.glob("*/test.toml")))


def test_an_outcome_table_takes_a_label_for_runs_that_disagree(tmp_path):
    d = tmp_path / "out"
    d.mkdir()
    (d / "test.toml").write_text('''id = "out"
version = 1
category = "devices"
layout = "main"
boxes = ["stock", "medius"]

[[legs]]
id = "rest"
device = "still-mouse"

[[tables]]
section = "s"
order = 1
kind = "outcome"
label = "Device"
key = "Devices"
outcomes = ["In step", "Sometimes behind", "Behind"]
varies = "Sometimes behind"

[[tables.rows]]
id = "r"
label = "Row"
ptr = "/outcomes/r"
''')
    (d / "test.py").write_text("def run(ctx):\n    return {}\n")
    assert load_suite(tmp_path)["out"].tables[0].varies == "Sometimes behind"
