// Best-effort extraction of the cursor delta from an emitted HID report. Covers the common shapes
// (an optional report id, a button byte, then 8- or 16-bit X/Y); returns null for anything else, so
// the lab falls back to timing-only for exotic descriptors.
export interface MouseLayout {
  reportId: boolean;
  wide: boolean;
}

export function inferLayout(reportLen: number, hasReportId: boolean): MouseLayout {
  const body = reportLen - (hasReportId ? 1 : 0) - 1;
  return { reportId: hasReportId, wide: body >= 4 };
}

const i8 = (v: number) => (v > 127 ? v - 256 : v);
const i16 = (b: Uint8Array, o: number) => {
  const v = b[o] | (b[o + 1] << 8);
  return v > 32767 ? v - 65536 : v;
};

export function parseMouseDelta(bytes: Uint8Array, layout: MouseLayout): { dx: number; dy: number } | null {
  let o = (layout.reportId ? 1 : 0) + 1;
  if (layout.wide) {
    if (bytes.length < o + 4) return null;
    return { dx: i16(bytes, o), dy: i16(bytes, o + 2) };
  }
  if (bytes.length < o + 2) return null;
  return { dx: i8(bytes[o]), dy: i8(bytes[o + 1]) };
}
