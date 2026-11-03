"""Tests for medius_compare.layout: a mouse's report layout read from its report descriptor."""
from medius_compare import layout

# A gaming mouse: no report ID, 16 buttons, 16-bit X and Y, an 8-bit wheel and AC Pan.
WIDE = bytes.fromhex(
    "05010902a101" "0901a100"
    "05091901291015002501951075018102"
    "0501160180 26ff7f 7510 9502 0930 0931 8106".replace(" ", "")
    + "1581257f750895010938 8106".replace(" ", "")
    + "050c0a3802 95018106 c0c0".replace(" ", ""))
# A keyboard on report ID 1, then a mouse on report ID 2: 5 buttons, 12-bit X and Y, an 8-bit wheel.
REPORT_ID = bytes.fromhex(
    "05010906a1018501050719002965150025017501950881 00c0".replace(" ", "")
    + "05010902a1018502" "0901a100"
    + "050919012905150025019505750181029503750181 03".replace(" ", "")
    + "05010930093116 01f8 26ff07 750c 9502 8106".replace(" ", "")
    + "09381581257f75089501 8106 c0c0".replace(" ", ""))
KEYBOARD = bytes.fromhex("05010906a101050719002965150025017501950681 00c0".replace(" ", ""))


def test_mouse_layout_reads_16_bit_and_report_id_mice():
    w = layout.mouse_layout(WIDE)
    assert (w.report_id, w.report_len) == (0, 8)
    assert (w.buttons, w.x, w.y, w.wheel, w.pan) == ((0, 16), (16, 16), (32, 16), (48, 8), (56, 8))
    r = layout.mouse_layout(REPORT_ID)
    assert (r.report_id, r.report_len) == (2, 6)
    assert (r.buttons, r.x, r.y, r.wheel, r.pan) == ((8, 5), (16, 12), (28, 12), (40, 8), None)


def test_field_reads_a_signed_value_across_bytes():
    r = layout.mouse_layout(REPORT_ID)
    assert layout.field(bytes([2, 0, 0xFF, 0x0F, 0x00, 0x00]), r.x) == -1
    report = bytes([2, 0x05, 0x01, 0x20, 0x00, 0xFE])
    assert (layout.field(report, r.x), layout.field(report, r.y), layout.field(report, r.wheel)) == (1, 2, -2)
    assert layout.field(report, r.buttons, signed=False) == 0x05


def test_a_descriptor_with_no_mouse_has_no_layout():
    assert layout.mouse_layout(KEYBOARD) is None


def test_a_constant_field_is_padding_whatever_usage_it_names():
    desc = bytes.fromhex("05010902a101" "0930 7508 9501 8103".replace(" ", "")
                         + "0930 0931 1581 257f 7508 9502 8106 c0".replace(" ", ""))
    m = layout.mouse_layout(desc)
    assert (m.x, m.y, m.report_len) == ((8, 8), (16, 8), 3)
