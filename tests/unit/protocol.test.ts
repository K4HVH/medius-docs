import { describe, it, expect } from 'vitest';
import {
  type DecodedFrame,

  BusEventKind,
  CatchClass,
  ClockDomain,
  CATCH_ID_ANY,
  filterTraffic,
  filterEverything,
  filterTrafficClass,
  filterWatch,
  filterWatchAxes,
  filterWatchAxis,
  filterWatchClass,
  sameFilter,
  DeviceKind,
  EmitMode,
  FrameDecoder,
  FrameType,
  LogLevel,
  PayloadTooLongError,
  RebootTarget,
  SOF,
  catchPayload,
  crc16Ccitt,
  encode,
  frameTypeFromU8,
  healthFromFlags,
  injectPayload,
  INJ_KEY,
  INJ_MEDIA,
  LedMode,
  LedTarget,
  LockAxis,
  LockClass,
  Direction,
  In,
  Out,
  Press,
  Release,
  LOCK_ID_ALL,
  isComposite,
  isLocked,
  clearNamePayload,
  emitPayload,
  imperfectPayload,
  ledPayload,
  lockAxis,
  lockButton,
  lockPayload,
  moveRidePayload,
  namePayload,
  logLevelFromU8,
  nativeHz,
  parseMotionEvent,
  parseTrafficEvent,
  parseUsageEvent,
  parseLog,
  parseResp,
  queryPayload,
  rebootPayload,
  trafficTruncated,
  versionString,
  vidPid,
  moveCursorPayload,
  moveWheelPayload,
  MV_F_DISCARD,
  MV_F_FLUSH,
  MV_F_NOW,
} from '../../src/dashboard/protocol';

const toHex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

const fromHex = (s: string) =>
  new Uint8Array(s.trim().split(/\s+/).map((x) => parseInt(x, 16)));

const decodeAll = (dec: FrameDecoder, data: Uint8Array): DecodedFrame[] => {
  const out: DecodedFrame[] = [];
  dec.feed(data, (f) => out.push(f));
  return out;
};

// Ground-truth vectors, generated from the medius Rust crate's frame encoder and
// anchored by the canonical CRC-16/CCITT-FALSE check value (crc("123456789") == 0x29b1).
const VEC = {
  query_version: 'a5 05 00 01 00 00 6b 05',
  query_health: 'a5 05 01 01 00 01 fe 63',
  reboot_devdl: 'a5 07 00 01 00 00 e8 41',
  reboot_hostdl: 'a5 07 05 01 00 01 8c ed',
  empty_reset: 'a5 04 02 00 00 51 20',
  // RESP(VERSION): [what=0][proto=1][major=0][minor=1][patch=0][mac=12 34 56 78 9a bc] (11-byte payload).
  resp_version: 'a5 06 00 0b 00 00 01 00 01 00 12 34 56 78 9a bc 91 d2',
  resp_health: 'a5 06 03 02 00 01 0f 95 42',
};

describe('crc16Ccitt', () => {
  it('matches the canonical CRC-16/CCITT-FALSE check value', () => {
    expect(crc16Ccitt(new TextEncoder().encode('123456789'))).toBe(0x29b1);
  });

  it('is 0xffff for empty input (the init value)', () => {
    expect(crc16Ccitt(new Uint8Array())).toBe(0xffff);
  });
});

describe('encode (vs Rust-crate vectors)', () => {
  it('QUERY(VERSION)', () => {
    expect(toHex(encode(FrameType.Query, 0, queryPayload(0)))).toBe(VEC.query_version);
  });
  it('QUERY(HEALTH)', () => {
    expect(toHex(encode(FrameType.Query, 1, queryPayload(1)))).toBe(VEC.query_health);
  });
  it('REBOOT(DeviceDownload)', () => {
    expect(toHex(encode(FrameType.RebootDl, 0, rebootPayload(RebootTarget.DeviceDownload)))).toBe(
      VEC.reboot_devdl,
    );
  });
  it('REBOOT(HostDownload) with seq 5', () => {
    expect(toHex(encode(FrameType.RebootDl, 5, rebootPayload(RebootTarget.HostDownload)))).toBe(
      VEC.reboot_hostdl,
    );
  });
  it('empty payload (RESET)', () => {
    expect(toHex(encode(FrameType.Reset, 2, new Uint8Array()))).toBe(VEC.empty_reset);
  });
  it('multi-byte payload (RESP VERSION shape)', () => {
    expect(
      toHex(encode(FrameType.Resp, 0, new Uint8Array([0, 1, 0, 1, 0, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]))),
    ).toBe(VEC.resp_version);
  });
  it('multi-byte payload (RESP HEALTH shape)', () => {
    expect(toHex(encode(FrameType.Resp, 3, new Uint8Array([1, 0x0f])))).toBe(VEC.resp_health);
  });

  it('throws PayloadTooLongError past 512 bytes', () => {
    expect(() => encode(FrameType.Query, 0, new Uint8Array(513))).toThrow(PayloadTooLongError);
    expect(() => encode(FrameType.Query, 0, new Uint8Array(512))).not.toThrow();
  });
});

describe('FrameDecoder', () => {
  it('decodes a RESP(VERSION) frame and parseResp yields the version', () => {
    const frames = decodeAll(new FrameDecoder(), fromHex(VEC.resp_version));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.Resp);
    expect(frames[0].seq).toBe(0);
    const resp = parseResp(frames[0].payload);
    expect(resp).toEqual({
      kind: 'version',
      version: {
        protoVer: 1,
        fwMajor: 0,
        fwMinor: 1,
        fwPatch: 0,
        mac: [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc],
        name: '', // no name tail past the 11-byte header
      },
    });
  });

  it('decodes a RESP(HEALTH) frame and parseResp yields all flags', () => {
    const frames = decodeAll(new FrameDecoder(), fromHex(VEC.resp_health));
    expect(frames).toHaveLength(1);
    expect(frames[0].seq).toBe(3);
    const resp = parseResp(frames[0].payload);
    expect(resp).toEqual({
      kind: 'health',
      health: {
        linkUp: true,
        mouseAttached: true,
        cloneConfigured: true,
        injectionActive: true,
        rateConfident: false,
        lockOn: false,
        catchOn: false,
        kbdAttached: false,
      },
    });
  });

  it('round-trips every encoded frame back to its fields', () => {
    for (const len of [0, 1, 2, 5, 64, 511, 512]) {
      const payload = new Uint8Array(len);
      for (let i = 0; i < len; i++) payload[i] = (i * 37 + 11) & 0xff;
      const frames = decodeAll(new FrameDecoder(), encode(FrameType.Log, 42, payload));
      expect(frames).toHaveLength(1);
      expect(frames[0].ty).toBe(FrameType.Log);
      expect(frames[0].seq).toBe(42);
      expect(toHex(frames[0].payload)).toBe(toHex(payload));
    }
  });

  it('does not desync on a payload byte equal to the SOF (0xA5)', () => {
    const payload = new Uint8Array([0xa5, 0xa5, 0x00, 0xa5, 0xff]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.Log, 1, payload));
    expect(frames).toHaveLength(1);
    expect(toHex(frames[0].payload)).toBe(toHex(payload));
  });

  it('resyncs past leading garbage to find a valid frame', () => {
    const data = new Uint8Array([0x00, 0xff, 0x13, 0x42, ...fromHex(VEC.resp_health)]);
    const frames = decodeAll(new FrameDecoder(), data);
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.Resp);
  });

  it('drops a frame with a corrupt CRC and counts it', () => {
    const bad = fromHex(VEC.resp_version);
    bad[bad.length - 1] ^= 0xff;
    const dec = new FrameDecoder();
    const frames = decodeAll(dec, bad);
    expect(frames).toHaveLength(0);
    expect(dec.crcErrorCount).toBe(1);
  });

  it('still decodes a valid frame after a CRC error, without wedging', () => {
    const bad = fromHex(VEC.resp_version);
    bad[bad.length - 1] ^= 0xff;
    const dec = new FrameDecoder();
    const frames = decodeAll(dec, new Uint8Array([...bad, ...fromHex(VEC.resp_health)]));
    expect(frames).toHaveLength(1);
    expect(frames[0].seq).toBe(3);
    expect(dec.crcErrorCount).toBe(1);
  });

  it('reassembles a frame fed one byte at a time', () => {
    const dec = new FrameDecoder();
    const out: DecodedFrame[] = [];
    for (const b of fromHex(VEC.resp_version)) {
      dec.feed(new Uint8Array([b]), (f) => out.push(f));
    }
    expect(out).toHaveLength(1);
    expect(out[0].seq).toBe(0);
  });

  it('decodes two concatenated frames in one feed', () => {
    const data = new Uint8Array([...fromHex(VEC.resp_version), ...fromHex(VEC.resp_health)]);
    const frames = decodeAll(new FrameDecoder(), data);
    expect(frames).toHaveLength(2);
    expect(frames[0].seq).toBe(0);
    expect(frames[1].seq).toBe(3);
  });

  it('silently drops a CRC-valid frame with an unknown opcode (no crc error)', () => {
    const ty = 0x17; // next free opcode past TRAFFIC_EVENT (0x16)
    const crc = crc16Ccitt(new Uint8Array([ty, 0, 0, 0]));
    const frame = new Uint8Array([SOF, ty, 0, 0, 0, crc & 0xff, (crc >> 8) & 0xff]);
    const dec = new FrameDecoder();
    const frames = decodeAll(dec, frame);
    expect(frames).toHaveLength(0);
    expect(dec.crcErrorCount).toBe(0);
  });

  it('rejects an over-length LEN field without wedging the decoder', () => {
    // LEN = 0xffff (> MAX_PAYLOAD) then a real frame; the bogus header must be discarded.
    const data = new Uint8Array([SOF, 0x06, 0x00, 0xff, 0xff, ...fromHex(VEC.resp_health)]);
    const frames = decodeAll(new FrameDecoder(), data);
    expect(frames).toHaveLength(1);
    expect(frames[0].seq).toBe(3);
  });
});

describe('parseResp / parseLog', () => {
  it('returns null for short or empty RESP payloads', () => {
    expect(parseResp(new Uint8Array())).toBeNull();
    expect(parseResp(new Uint8Array([0, 1, 0, 1, 0]))).toBeNull(); // version needs 11 bytes (was 5, now carries the MAC)
    expect(parseResp(new Uint8Array([1]))).toBeNull(); // health needs 2 bytes
    expect(parseResp(new Uint8Array([9]))).toBeNull(); // OPTIONS needs an id byte
    expect(parseResp(new Uint8Array([8]))).toBeNull(); // selector 8 retired
  });

  it('decodes the ASCII name tail after the RESP(VERSION) header', () => {
    // Bytes past the 11-byte header are the box name (ASCII, LEN-delimited), not trailing garbage.
    expect(
      parseResp(
        new Uint8Array([0, 1, 2, 3, 4, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x42, 0x6f, 0x78]),
      ),
    ).toEqual({
      kind: 'version',
      version: {
        protoVer: 1,
        fwMajor: 2,
        fwMinor: 3,
        fwPatch: 4,
        mac: [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff],
        name: 'Box',
      },
    });
  });

  it('parses a LOG payload into level + text', () => {
    const payload = new Uint8Array([LogLevel.Warn, ...new TextEncoder().encode('link down')]);
    expect(parseLog(payload)).toEqual({ level: LogLevel.Warn, text: 'link down' });
  });

  it('parses an empty LOG payload as Info with empty text', () => {
    expect(parseLog(new Uint8Array())).toEqual({ level: LogLevel.Info, text: '' });
  });
});

describe('helpers', () => {
  it('logLevelFromU8 falls back to Info for unknown bytes', () => {
    expect(logLevelFromU8(0)).toBe(LogLevel.Error);
    expect(logLevelFromU8(4)).toBe(LogLevel.Verbose);
    expect(logLevelFromU8(99)).toBe(LogLevel.Info);
  });

  it('frameTypeFromU8 maps the catch + inject opcodes, null for unknown', () => {
    expect(frameTypeFromU8(0x03)).toBe(FrameType.Inject);
    expect(frameTypeFromU8(0x0b)).toBe(FrameType.Catch);
    expect(frameTypeFromU8(0x0c)).toBe(FrameType.MotionEvent);
    expect(frameTypeFromU8(0x0f)).toBe(FrameType.UsageEvent);
    expect(frameTypeFromU8(0x10)).toBeNull(); // reserved (was ConsEvent; media folded into USAGE_EVENT)
    expect(frameTypeFromU8(0x11)).toBe(FrameType.Option);
    expect(frameTypeFromU8(0x12)).toBe(FrameType.ClipAppend);
    expect(frameTypeFromU8(0x13)).toBe(FrameType.ClipCtrl);
    expect(frameTypeFromU8(0x14)).toBe(FrameType.ClipSet);
    expect(frameTypeFromU8(0x15)).toBe(FrameType.ClipTrigger);
    expect(frameTypeFromU8(0x16)).toBe(FrameType.TrafficEvent);
    expect(frameTypeFromU8(0x00)).toBeNull();
    expect(frameTypeFromU8(0x17)).toBeNull();
  });

  it('healthFromFlags decodes individual bits', () => {
    expect(healthFromFlags(0x05)).toEqual({
      linkUp: true,
      mouseAttached: false,
      cloneConfigured: true,
      injectionActive: false,
      rateConfident: false,
      lockOn: false,
      catchOn: false,
      kbdAttached: false,
    });
  });

  it('healthFromFlags decodes the rate_confident bit (0x10)', () => {
    expect(healthFromFlags(0x10).rateConfident).toBe(true);
    expect(healthFromFlags(0x1f)).toEqual({
      linkUp: true,
      mouseAttached: true,
      cloneConfigured: true,
      injectionActive: true,
      rateConfident: true,
      lockOn: false,
      catchOn: false,
      kbdAttached: false,
    });
  });

  it('healthFromFlags decodes the lock_on bit (0x20)', () => {
    expect(healthFromFlags(0x20).lockOn).toBe(true);
    expect(healthFromFlags(0x1f).lockOn).toBe(false);
    expect(healthFromFlags(0x3f)).toEqual({
      linkUp: true,
      mouseAttached: true,
      cloneConfigured: true,
      injectionActive: true,
      rateConfident: true,
      lockOn: true,
      catchOn: false,
      kbdAttached: false,
    });
  });

  it('healthFromFlags decodes the catch_on bit (0x40)', () => {
    expect(healthFromFlags(0x40).catchOn).toBe(true);
    expect(healthFromFlags(0x3f).catchOn).toBe(false);
    expect(healthFromFlags(0x7f)).toEqual({
      linkUp: true,
      mouseAttached: true,
      cloneConfigured: true,
      injectionActive: true,
      rateConfident: true,
      lockOn: true,
      catchOn: true,
      kbdAttached: false,
    });
  });

  it('healthFromFlags decodes the kbd_att bit (0x80)', () => {
    expect(healthFromFlags(0x80).kbdAttached).toBe(true);
    expect(healthFromFlags(0x7f).kbdAttached).toBe(false);
    expect(healthFromFlags(0xff)).toEqual({
      linkUp: true,
      mouseAttached: true,
      cloneConfigured: true,
      injectionActive: true,
      rateConfident: true,
      lockOn: true,
      catchOn: true,
      kbdAttached: true,
    });
  });

  it('versionString formats major.minor.patch', () => {
    expect(versionString({ protoVer: 1, fwMajor: 0, fwMinor: 1, fwPatch: 0, mac: [], name: '' })).toBe('0.1.0');
  });
});

// The byte vectors mirror the firmware packer test (medius-fw tests/host/test_ctrl_proto.c) so the
// JS decoder is pinned to the firmware wire format, not merely to itself.
describe('LED command (§3.7)', () => {
  it('ledPayload packs [target][mode][level]', () => {
    expect(Array.from(ledPayload(LedTarget.Both, LedMode.Blink, 128))).toEqual([2, 3, 128]);
  });
  it('enum wire values match ctrl_proto.h', () => {
    expect([LedTarget.Device, LedTarget.Host, LedTarget.Both]).toEqual([0, 1, 2]);
    expect([LedMode.Auto, LedMode.Off, LedMode.Solid, LedMode.Blink]).toEqual([0, 1, 2, 3]);
  });
});

describe('LOCK command (§3.8)', () => {
  it('lockPayload packs [class][id u16 LE][direction][state]', () => {
    // Lock the wheel axis's negative (scroll-down) direction: class axis = 3, id = wheel = 2.
    expect(
      Array.from(lockPayload(LockClass.Axis, LockAxis.Wheel, Direction.Negative, 1)),
    ).toEqual([3, 2, 0, 2, 1]);
    // Unlock the X axis, both signs.
    expect(Array.from(lockPayload(LockClass.Axis, LockAxis.X, Direction.Both, 0))).toEqual([
      3, 0, 0, 0, 0,
    ]);
    // A button locks as class button (0), id = button id, with no +3 offset.
    expect(Array.from(lockPayload(LockClass.Button, 4, Direction.Positive, 1))).toEqual([
      0, 4, 0, 1, 1,
    ]);
    // A media-class lock keeps its 16-bit usage.
    expect(Array.from(lockPayload(LockClass.Media, 0x00e9, Direction.Both, 1))).toEqual([
      2, 0xe9, 0x00, 0, 1,
    ]);
    // The id sentinel 0xFFFF blanket-locks the whole class.
    expect(Array.from(lockPayload(LockClass.Key, LOCK_ID_ALL, Direction.Both, 1))).toEqual([
      1, 0xff, 0xff, 0, 1,
    ]);
  });

  it('LockClass wire values match ctrl_proto.h', () => {
    expect([LockClass.Button, LockClass.Key, LockClass.Media, LockClass.Axis]).toEqual([0, 1, 2, 3]);
  });

  it('Direction wire values match ctrl_proto.h, and the aliases name both readings', () => {
    expect([Direction.Both, Direction.Positive, Direction.Negative]).toEqual([0, 1, 2]);
    // The edge reading (momentary usages) and the transfer reading (traffic classes) are the same
    // byte, so an alias that drifted off its member would silently mis-address a subscription.
    expect([Press, Release]).toEqual([Direction.Positive, Direction.Negative]);
    expect([In, Out]).toEqual([Direction.Positive, Direction.Negative]);
  });

  it('parses a RESP(LOCKS) entry list', () => {
    // what = 6, n = 2: axis wheel negative (dirbits 0x02), then button Left both (dirbits 0x03).
    const resp = parseResp(new Uint8Array([6, 2, 3, 2, 0, 0x02, 0, 0, 0, 0x03]));
    expect(resp).toEqual({
      kind: 'locks',
      locks: {
        entries: [
          { cls: LockClass.Axis, id: LockAxis.Wheel, positive: false, negative: true },
          { cls: LockClass.Button, id: 0, positive: true, negative: true },
        ],
      },
    });
  });

  it('parses an empty RESP(LOCKS) list', () => {
    expect(parseResp(new Uint8Array([6, 0]))).toEqual({ kind: 'locks', locks: { entries: [] } });
  });

  it('isLocked reads a per-direction lock out of the entry list', () => {
    const locks = {
      entries: [
        { cls: LockClass.Axis, id: LockAxis.Wheel, positive: false, negative: true },
        { cls: LockClass.Axis, id: LockAxis.X, positive: true, negative: true },
      ],
    };
    expect(isLocked(locks, lockAxis(LockAxis.Wheel), Direction.Negative)).toBe(true);
    expect(isLocked(locks, lockAxis(LockAxis.Wheel), Direction.Positive)).toBe(false);
    expect(isLocked(locks, lockAxis(LockAxis.Wheel), Direction.Both)).toBe(false);
    // X: both directions set means Both is true.
    expect(isLocked(locks, lockAxis(LockAxis.X), Direction.Both)).toBe(true);
    // A button not in the list reads unlocked.
    expect(isLocked(locks, lockButton(0), Direction.Positive)).toBe(false);
  });

  it('returns null for a truncated RESP(LOCKS) payload', () => {
    expect(parseResp(new Uint8Array([6]))).toBeNull(); // needs the n byte
    expect(parseResp(new Uint8Array([6, 1, 3, 2, 0]))).toBeNull(); // n=1 but only 3 entry bytes
  });
});

describe('CATCH command (§3.9)', () => {
  it('catchPayload packs one [class][id][dir][state][capture] table entry', () => {
    // Every mouse button, both edges, whole packet.
    expect(
      Array.from(catchPayload(CatchClass.Button, CATCH_ID_ANY, Direction.Both, 1)),
    ).toEqual([0x00, 0xff, 0xff, 0x00, 0x01, 0x00]);
    // One vendor interrupt endpoint (0x83), IN only, first 16 bytes.
    expect(
      Array.from(catchPayload(CatchClass.VendorInterrupt, 0x83, Direction.Positive, 1, 16)),
    ).toEqual([0x06, 0x83, 0x00, 0x01, 0x01, 0x10]);
    // The wildcard with state 0 clears the whole table in one frame.
    expect(Array.from(catchPayload(CatchClass.Any, CATCH_ID_ANY, Direction.Both, 0))).toEqual([
      0xff, 0xff, 0xff, 0x00, 0x00, 0x00,
    ]);
  });

  it('the filter builders default to the whole class, both directions, whole packet', () => {
    expect(filterEverything()).toEqual({
      cls: CatchClass.Any,
      id: CATCH_ID_ANY,
      dir: Direction.Both,
      capture: 0,
    });
    expect(filterTrafficClass(CatchClass.VendorBulk, 16)).toEqual({
      cls: CatchClass.VendorBulk,
      id: CATCH_ID_ANY,
      dir: Direction.Both,
      capture: 16,
    });
    expect(filterTraffic(CatchClass.VendorInterrupt, 0x83)).toEqual({
      cls: CatchClass.VendorInterrupt,
      id: 0x83,
      dir: Direction.Both,
      capture: 0,
    });
    // sameFilter ignores capture, because the box matches an unsubscribe on (class, id, dir).
    expect(
      sameFilter(filterTrafficClass(CatchClass.HidIn), filterTrafficClass(CatchClass.HidIn, 16)),
    ).toBe(true);
    expect(
      sameFilter(filterTrafficClass(CatchClass.HidIn), filterTrafficClass(CatchClass.HidOut)),
    ).toBe(false);
    expect(
      sameFilter(
        filterTraffic(CatchClass.VendorInterrupt, 0x83),
        filterTrafficClass(CatchClass.VendorInterrupt),
      ),
    ).toBe(false);
  });

  it('the input-side builders address one usage, one axis, or a whole class', () => {
    // No capture length applies on the input side: the event is the delta or the snapshot itself.
    expect(filterWatch(CatchClass.Button, 4)).toEqual({
      cls: CatchClass.Button,
      id: 4,
      dir: Direction.Both,
      capture: 0,
    });
    expect(filterWatchAxis(LockAxis.Wheel)).toEqual({
      cls: CatchClass.Axis,
      id: LockAxis.Wheel,
      dir: Direction.Both,
      capture: 0,
    });
    expect(filterWatchClass(CatchClass.Key)).toEqual({
      cls: CatchClass.Key,
      id: CATCH_ID_ANY,
      dir: Direction.Both,
      capture: 0,
    });
    expect(filterWatchAxes()).toEqual({
      cls: CatchClass.Axis,
      id: CATCH_ID_ANY,
      dir: Direction.Both,
      capture: 0,
    });
  });

  it('CatchClass wire values match ctrl_proto.h, and 0-3 are LOCK classes unchanged', () => {
    expect([CatchClass.Button, CatchClass.Key, CatchClass.Media, CatchClass.Axis]).toEqual([
      LockClass.Button,
      LockClass.Key,
      LockClass.Media,
      LockClass.Axis,
    ]);
    expect([
      CatchClass.HidIn,
      CatchClass.HidOut,
      CatchClass.VendorInterrupt,
      CatchClass.VendorBulk,
      CatchClass.Control,
      CatchClass.Emit,
      CatchClass.Bus,
    ]).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(CatchClass.Any).toBe(0xff);
    expect(CATCH_ID_ANY).toBe(LOCK_ID_ALL);
  });

  it('parses a CATCH RESP header + entry table', () => {
    // what=7, flags=0 (table not full), dropped=0x00000102, clk offset = -250 us,
    // rate = +1200 ppb, delay = 90 us, age = 40 ms, then two entries.
    const resp = parseResp(
      new Uint8Array([
        7, 0x00, 0x02, 0x01, 0x00, 0x00, 0x06, 0xff, 0xff, 0xff, 0xb0, 0x04, 0x00, 0x00, 0x5a, 0x00,
        0x28, 0x00, 0x02,
        // class=Button, id=ALL, dir=Both, capture=0, dropped=0
        0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
        // class=VendorBulk, id=0x02 (OUT endpoint), dir=Negative, capture=16, dropped=0x0111
        0x07, 0x02, 0x00, 0x02, 0x10, 0x11, 0x01,
      ]),
    );
    expect(resp).toEqual({
      kind: 'catch',
      catch: {
        tableFull: false,
        dropped: 0x00000102,
        clock: { offsetUs: -250, ratePpb: 1200, delayUs: 90, ageMs: 40 },
        entries: [
          {
            cls: CatchClass.Button,
            id: CATCH_ID_ANY,
            dir: Direction.Both,
            capture: 0,
            dropped: 0,
          },
          {
            cls: CatchClass.VendorBulk,
            id: 0x02,
            dir: Direction.Negative,
            capture: 16,
            dropped: 0x0111,
          },
        ],
      },
    });
  });

  it('decodes both clock fields as signed, and the delay as unsigned', () => {
    // A decoder that read clk_rate_ppb unsigned would still pass a positive-only fixture, so pin
    // it with a negative one: offset = -1, rate = -2000 ppb, delay = 0x8001 (past i16's range).
    const p = new Uint8Array(19);
    p[0] = 7;
    p.set([0xff, 0xff, 0xff, 0xff], 6); // clk_offset_us = -1
    p.set([0x30, 0xf8, 0xff, 0xff], 10); // clk_rate_ppb = -2000
    p.set([0x01, 0x80], 14); // clk_delay_us = 32769, not -32767
    p.set([0x10, 0x27], 16); // clk_age_ms = 10000
    const resp = parseResp(p);
    expect(resp?.kind).toBe('catch');
    if (resp?.kind !== 'catch') throw new Error('unreachable');
    expect(resp.catch.clock).toEqual({
      offsetUs: -1,
      ratePpb: -2000,
      delayUs: 32769,
      ageMs: 10000,
    });
  });

  it('rejects an entry count above the box\'s 32-entry table', () => {
    // The frame's payload ceiling would admit 70 entries; the box's table holds 32, so a larger
    // count is a malformed reply rather than a bigger table.
    const p = new Uint8Array(19 + 7 * 33);
    p[0] = 7;
    p[18] = 33;
    expect(parseResp(p)).toBeNull();
    const ok = new Uint8Array(19 + 7 * 32);
    ok[0] = 7;
    ok[18] = 32;
    const resp = parseResp(ok);
    expect(resp?.kind === 'catch' && resp.catch.entries).toHaveLength(32);
  });

  it('reports an unmeasured clock estimate as a null age, not an age of 0xffff', () => {
    // An empty table with clk_age_ms = 0xFFFF: "no estimate yet", which an offset of 0 alone
    // cannot distinguish from a genuinely coincident pair of clocks.
    const resp = parseResp(
      // prettier-ignore
      new Uint8Array([
        7, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 0x00,
      ]),
    );
    expect(resp).toEqual({
      kind: 'catch',
      catch: {
        tableFull: true,
        dropped: 0,
        clock: { offsetUs: 0, ratePpb: 0, delayUs: 0, ageMs: null },
        entries: [],
      },
    });
  });

  it('returns null for a truncated CATCH payload', () => {
    // 18 bytes: one short of the fixed header.
    const stub = new Uint8Array(18);
    stub[0] = 7;
    expect(parseResp(stub)).toBeNull();
    // A full header claiming one entry, with only 6 of its 7 bytes present.
    const short = new Uint8Array(19 + 6);
    short[0] = 7;
    short[18] = 1;
    expect(parseResp(short)).toBeNull();
  });

  it('parseMotionEvent decodes [ts][clk][dx][dy][dz] with i16 sign-extension', () => {
    // ts = 1, host clock, dx = +1, dy = -2, dz = -1.
    const ev = parseMotionEvent(
      new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xfe, 0xff, 0xff, 0xff]),
    );
    expect(ev).toEqual({ tsUs: 1, clk: ClockDomain.Host, dx: 1, dy: -2, dz: -1 });
  });

  it('parseMotionEvent returns null for a short payload', () => {
    expect(parseMotionEvent(new Uint8Array(10))).toBeNull(); // needs 11 bytes
  });

  it('round-trips a MOTION_EVENT frame through the decoder', () => {
    // ts = 0x000F4240 (1 s), host clock, dx = -1000, dy = +1000, dz = -120 (one notch up).
    const payload = new Uint8Array([
      0x40, 0x42, 0x0f, 0x00, 0x00, 0x18, 0xfc, 0xe8, 0x03, 0x88, 0xff,
    ]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.MotionEvent, 200, payload));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.MotionEvent);
    expect(frames[0].seq).toBe(200);
    expect(parseMotionEvent(frames[0].payload)).toEqual({
      tsUs: 1_000_000,
      clk: ClockDomain.Host,
      dx: -1000,
      dy: 1000,
      dz: -120,
    });
  });
});

describe('TRAFFIC_EVENT (§4.10)', () => {
  it('frameTypeFromU8 maps 0x16, so the decoder does not drop the frame', () => {
    // An unmapped TYPE byte is silently dropped by the decoder, which would look like a dead
    // stream rather than an error.
    expect(frameTypeFromU8(0x16)).toBe(FrameType.TrafficEvent);
  });

  it('decodes a HID_IN capture that arrived whole', () => {
    // ts = 0x00001000, HOST clock (an IN transfer off the real device), class HID_IN, interface 0,
    // IN, flags 0, true_len 4, 4 bytes. §4.10 puts HID_IN in the host domain; a device-domain
    // stamp here would be a wire-impossible combination.
    const ev = parseTrafficEvent(
      new Uint8Array([
        0x00, 0x10, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x01, 0x02, 0x03,
        0x04,
      ]),
    );
    expect(ev).toEqual({
      tsUs: 0x1000,
      clk: ClockDomain.Host,
      cls: CatchClass.HidIn,
      id: 0,
      dir: Direction.Positive,
      flags: 0,
      trueLen: 4,
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
    expect(trafficTruncated(ev!)).toBe(false);
  });

  it('reports a capture-truncated capture through true_len, not through a short byte count', () => {
    // A 512-byte bulk packet captured at capture 4: without true_len this is indistinguishable
    // from a genuinely 4-byte packet.
    const ev = parseTrafficEvent(
      new Uint8Array([
        0x00, 0x00, 0x00, 0x00, 0x01, 0x07, 0x02, 0x00, 0x02, 0x01, 0x00, 0x02, 0xaa, 0xbb, 0xcc,
        0xdd,
      ]),
    );
    expect(ev?.cls).toBe(CatchClass.VendorBulk);
    expect(ev?.dir).toBe(Direction.Negative);
    expect(ev?.flags).toBe(0x01); // end-of-transfer
    expect(ev?.trueLen).toBe(512);
    expect(ev?.bytes).toEqual(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]));
    expect(trafficTruncated(ev!)).toBe(true);
  });

  it('decodes a BUS event: the kind is in flags, the two operands in bytes', () => {
    // SET_INTERFACE on interface 1, alternate 2.
    const ev = parseTrafficEvent(
      new Uint8Array([
        0x00, 0x00, 0x00, 0x00, 0x01, 0x0a, 0x00, 0x00, 0x00, 0x05, 0x02, 0x00, 0x01, 0x02,
      ]),
    );
    expect(ev?.cls).toBe(CatchClass.Bus);
    expect(ev?.flags).toBe(BusEventKind.SetInterface);
    expect(ev?.bytes).toEqual(new Uint8Array([1, 2]));
  });

  it('decodes a CONTROL transaction: setup 8 then the data stage, the answer in flags', () => {
    // GET_DESCRIPTOR(device), the real device STALLed it.
    const ev = parseTrafficEvent(
      new Uint8Array([
        0x00, 0x00, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x01, 0xfd, 0x08, 0x00, 0x80, 0x06, 0x00,
        0x01, 0x00, 0x00, 0x12, 0x00,
      ]),
    );
    expect(ev?.cls).toBe(CatchClass.Control);
    expect(ev?.id).toBe(0); // EP0
    expect(ev?.flags).toBe(0xfd);
    expect(ev?.bytes).toHaveLength(8); // setup only, no data stage arrived
  });

  it('accepts a header with no captured bytes, and returns null below the header', () => {
    const ev = parseTrafficEvent(new Uint8Array(12));
    expect(ev?.bytes).toEqual(new Uint8Array([]));
    // true_len 0 with 0 bytes is a genuinely empty packet, not a truncated one.
    expect(trafficTruncated(ev!)).toBe(false);
    expect(parseTrafficEvent(new Uint8Array(11))).toBeNull();
  });

  it('round-trips a TRAFFIC_EVENT frame through the decoder', () => {
    // EMIT is tapped on the device chip, so §4.10 puts it in the DEVICE domain: clk = 1.
    const payload = new Uint8Array([
      0x40, 0x42, 0x0f, 0x00, 0x01, 0x09, 0x00, 0x00, 0x01, 0x00, 0x05, 0x00, 0x00, 0x00, 0x0a,
      0x00, 0x00,
    ]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.TrafficEvent, 42, payload));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.TrafficEvent);
    expect(frames[0].seq).toBe(42);
    const ev = parseTrafficEvent(frames[0].payload);
    expect(ev?.cls).toBe(CatchClass.Emit); // what the clone actually put on the wire
    expect(ev?.clk).toBe(ClockDomain.Device);
    expect(ev?.trueLen).toBe(5);
    expect(ev?.bytes).toEqual(new Uint8Array([0x00, 0x00, 0x0a, 0x00, 0x00]));
  });

  it('falls back to the host domain for a clk byte the build does not know', () => {
    // A 2 is not a domain. Collapsing it to Host keeps the event rather than dropping the frame,
    // matching how deviceKindFromU8 and logLevelFromU8 absorb an unknown byte.
    const ev = parseTrafficEvent(new Uint8Array([0, 0, 0, 0, 0x02, 0x0a, 0, 0, 0, 0, 0, 0]));
    expect(ev?.clk).toBe(ClockDomain.Host);
  });
});

describe('MOVE command (§3.1)', () => {
  it('cursor payload is [motion=0][dx i16 LE][dy i16 LE][flags]', () => {
    expect(Array.from(moveCursorPayload(5, -3))).toEqual([0, 5, 0, 0xfd, 0xff, 0]);
  });

  it('wheel payload is [motion=1][dz i16 LE][flags]', () => {
    expect(Array.from(moveWheelPayload(-2))).toEqual([1, 0xfe, 0xff, 0]);
  });

  it('saturates rather than wrapping past the i16 the wire carries', () => {
    // Wrapping would turn a big positive delta into a big negative one and fling the cursor the
    // opposite way, which is worse than clamping.
    expect(Array.from(moveCursorPayload(40000, -40000))).toEqual([0, 0xff, 0x7f, 0x00, 0x80, 0]);
    expect(Array.from(moveWheelPayload(99999))).toEqual([1, 0xff, 0x7f, 0]);
  });

  it('rounds a fractional delta instead of truncating it into the wire', () => {
    expect(Array.from(moveCursorPayload(1.6, -1.6))).toEqual([0, 2, 0, 0xfe, 0xff, 0]);
  });

  it('carries the movement-riding override in the flags byte', () => {
    expect(Array.from(moveCursorPayload(1, 1, MV_F_NOW))).toEqual([0, 1, 0, 1, 0, 0x01]);
    expect(Array.from(moveCursorPayload(0, 0, MV_F_FLUSH))).toEqual([0, 0, 0, 0, 0, 0x02]);
    expect(Array.from(moveCursorPayload(0, 0, MV_F_DISCARD))).toEqual([0, 0, 0, 0, 0, 0x04]);
    expect(Array.from(moveWheelPayload(1, MV_F_NOW))).toEqual([1, 1, 0, 0x01]);
    // Bits the box does not define are masked off rather than sent, since it ignores them anyway.
    expect(Array.from(moveCursorPayload(0, 0, 0xf8))).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('OPTION command (§3.10)', () => {
  it('imperfectPayload packs [id=0][allow]', () => {
    expect(Array.from(imperfectPayload(true))).toEqual([0, 1]);
    expect(Array.from(imperfectPayload(false))).toEqual([0, 0]);
  });

  it('moveRidePayload packs [id=1][timeout u16 LE ms]', () => {
    expect(Array.from(moveRidePayload(5))).toEqual([1, 5, 0]);
    expect(Array.from(moveRidePayload(0))).toEqual([1, 0, 0]);
    expect(Array.from(moveRidePayload(1000))).toEqual([1, 0xe8, 0x03]);
  });

  it('parses RESP(OPTIONS, IMPERFECT) into allowed / over_capacity / clone_imperfect', () => {
    // what = 9, id = 0, allowed = 1, over_capacity = 1, clone_imperfect = 1.
    expect(parseResp(new Uint8Array([9, 0, 1, 1, 1]))).toEqual({
      kind: 'imperfect',
      imperfect: { allowed: true, overCapacity: true, cloneImperfect: true },
    });
    // Faithful-only, an over-capacity device attached but refused (no live clone).
    expect(parseResp(new Uint8Array([9, 0, 0, 1, 0]))).toEqual({
      kind: 'imperfect',
      imperfect: { allowed: false, overCapacity: true, cloneImperfect: false },
    });
  });

  it('parses RESP(OPTIONS, MOVE_RIDE) into a window in ms (0 = off)', () => {
    expect(parseResp(new Uint8Array([9, 1, 5, 0]))).toEqual({ kind: 'movementRiding', windowMs: 5 });
    expect(parseResp(new Uint8Array([9, 1, 0, 0]))).toEqual({ kind: 'movementRiding', windowMs: 0 });
  });

  it('emitPayload packs [id=2][mode u8][rate_hz u16 LE]', () => {
    expect(Array.from(emitPayload(EmitMode.Learned))).toEqual([2, 0, 0, 0]);
    expect(Array.from(emitPayload(EmitMode.Interval))).toEqual([2, 1, 0, 0]);
    expect(Array.from(emitPayload(EmitMode.Fixed, 500))).toEqual([2, 2, 0xf4, 0x01]);
  });

  it('namePayload packs [id=3][name ascii], filters non-printable, caps at 32; clear is the id alone', () => {
    expect(Array.from(namePayload('AB'))).toEqual([3, 0x41, 0x42]);
    expect(Array.from(clearNamePayload())).toEqual([3]); // clear = OPTION(NAME) with no value
    // non-printable / non-ASCII bytes are dropped so only a valid name reaches the wire
    expect(Array.from(namePayload('A\tB\u{1f600}C'))).toEqual([3, 0x41, 0x42, 0x43]);
    // capped at 32 bytes
    expect(namePayload('x'.repeat(40)).length).toBe(1 + 32);
  });

  it('parses RESP(OPTIONS, EMIT) into mode / fixed_hz / resolved_hz', () => {
    // Learned, nothing resolved yet: [9][2][mode=0][fixed=0][resolved=0].
    expect(parseResp(new Uint8Array([9, 2, 0, 0, 0, 0, 0]))).toEqual({
      kind: 'emitPace',
      emit: { mode: EmitMode.Learned, fixedHz: 0, resolvedHz: 0 },
    });
    // Interval resolved to the 1000 Hz poll rate: [9][2][1][0,0][0xe8,0x03].
    expect(parseResp(new Uint8Array([9, 2, 1, 0, 0, 0xe8, 0x03]))).toEqual({
      kind: 'emitPace',
      emit: { mode: EmitMode.Interval, fixedHz: 0, resolvedHz: 1000 },
    });
    // Fixed 500 Hz, resolved to 500: [9][2][2][0xf4,0x01][0xf4,0x01].
    expect(parseResp(new Uint8Array([9, 2, 2, 0xf4, 0x01, 0xf4, 0x01]))).toEqual({
      kind: 'emitPace',
      emit: { mode: EmitMode.Fixed, fixedHz: 500, resolvedHz: 500 },
    });
    // A mode this build doesn't know -> mode null, the rates still decode.
    expect(parseResp(new Uint8Array([9, 2, 3, 0, 0, 0xe8, 0x03]))).toEqual({
      kind: 'emitPace',
      emit: { mode: null, fixedHz: 0, resolvedHz: 1000 },
    });
  });

  it('returns null for a truncated or unknown OPTIONS payload', () => {
    expect(parseResp(new Uint8Array([9, 0, 1, 1]))).toBeNull(); // imperfect needs 5 bytes
    expect(parseResp(new Uint8Array([9, 1, 0]))).toBeNull(); // move_ride needs 4 bytes
    expect(parseResp(new Uint8Array([9, 2, 0, 0, 0, 0]))).toBeNull(); // emit needs 7 bytes
    expect(parseResp(new Uint8Array([9, 0xff, 0, 0]))).toBeNull(); // unknown option id
  });
});

describe('device-info RESP decoding (v1.4.0)', () => {
  it('DEVICE_INFO (§4.3): 11-byte header, kind, and the product tail', () => {
    // vid 046D, pid C08B, bcdDevice 0110, bcdUSB 0200, flags = serial|bos, kind = mouse, product "G502".
    const p = new Uint8Array([
      2, 0x6d, 0x04, 0x8b, 0xc0, 0x10, 0x01, 0x00, 0x02, 0x03, 0x02, 0x47, 0x35, 0x30, 0x32,
    ]);
    const resp = parseResp(p);
    expect(resp).toEqual({
      kind: 'deviceInfo',
      deviceInfo: {
        vid: 0x046d,
        pid: 0xc08b,
        bcdDevice: 0x0110,
        bcdUsb: 0x0200,
        hasSerial: true,
        hasBos: true,
        kind: DeviceKind.Mouse,
        product: 'G502',
      },
    });
    if (resp?.kind === 'deviceInfo') expect(vidPid(resp.deviceInfo)).toBe('046D:C08B');
  });

  it('DEVICE_INFO with an empty product tail (exactly the 11-byte header)', () => {
    // A keyboard clone that serves no product string, no serial, no BOS.
    const p = new Uint8Array([2, 0xe3, 0x31, 0x32, 0x12, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]);
    expect(parseResp(p)).toEqual({
      kind: 'deviceInfo',
      deviceInfo: {
        vid: 0x31e3,
        pid: 0x1232,
        bcdDevice: 0x0000,
        bcdUsb: 0x0200,
        hasSerial: false,
        hasBos: false,
        kind: DeviceKind.Keyboard,
        product: '',
      },
    });
  });

  it('CAPS (§4.4) unified mouse + keyboard', () => {
    // 5 buttons, X|Y|WHEEL, 2 ifaces; 6-key board, Consumer + report-id; keyboard class change-driven
    const resp = parseResp(new Uint8Array([3, 5, 0x07, 2, 6, 0x0a, 0x02]));
    expect(resp).toEqual({
      kind: 'caps',
      caps: {
        mouse: { nButtons: 5, hasX: true, hasY: true, hasWheel: true, hasReportId: false, nHid: 2 },
        keyboard: { nKeys: 6, nkro: false, hasConsumer: true, hasSystem: false, hasReportId: true },
        mouseChangeDriven: false,
        kbdChangeDriven: true,
      },
    });
    if (resp?.kind === 'caps') expect(isComposite(resp.caps.mouse)).toBe(true);
  });

  it('RATE (§4.5) confident, with Hz', () => {
    const resp = parseResp(new Uint8Array([4, 0xe8, 0x03, 0xe8, 0x03, 0x01]));
    expect(resp).toEqual({
      kind: 'rate',
      rate: { nativePeriodUs: 1000, pollPeriodUs: 1000, confident: true, changeDriven: false },
    });
    if (resp?.kind === 'rate') expect(nativeHz(resp.rate)).toBe(1000);
  });

  it('RATE unlearned period yields null Hz (truthful)', () => {
    const resp = parseResp(new Uint8Array([4, 0x00, 0x00, 0xe8, 0x03, 0x00]));
    if (resp?.kind !== 'rate') throw new Error('expected rate');
    expect(resp.rate.nativePeriodUs).toBe(0);
    expect(nativeHz(resp.rate)).toBeNull();
  });

  it('RATE change-driven (keyboard) sets the flag and reports no cadence', () => {
    const resp = parseResp(new Uint8Array([4, 0x00, 0x00, 0xe8, 0x03, 0x02]));
    if (resp?.kind !== 'rate') throw new Error('expected rate');
    expect(resp.rate.changeDriven).toBe(true);
    expect(resp.rate.confident).toBe(false);
    expect(resp.rate.nativePeriodUs).toBe(0);
    expect(nativeHz(resp.rate)).toBeNull();
  });

  it('STATS (§4.6) with saturated fields and a 32-bit count', () => {
    const p = new Uint8Array([
      5, 0x04, 0x03, 0x02, 0x01, 0xff, 0xff, 0x0a, 0x00, 0xff, 0x02, 0xff, 0xff, 0x07, 0x00, 0x09,
      0x00,
    ]);
    expect(parseResp(p)).toEqual({
      kind: 'stats',
      stats: {
        injectEmits: 0x01020304,
        txDrops: 0xffff,
        txMerges: 10,
        txMaxdepth: 0xff,
        txWedges: 2,
        wakeups: 0xffff,
        resetCount: 7,
        configCount: 9,
      },
    });
  });

  it('returns null for truncated device-info payloads', () => {
    expect(parseResp(new Uint8Array([2, 0, 0]))).toBeNull(); // DEVICE_INFO needs an 11-byte header
    expect(parseResp(new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull(); // 10 bytes, one short of the header
    expect(parseResp(new Uint8Array([3, 5]))).toBeNull(); // CAPS needs 4
    expect(parseResp(new Uint8Array([4, 0xe8, 0x03]))).toBeNull(); // RATE needs 6
    expect(parseResp(new Uint8Array([5, 0, 0, 0]))).toBeNull(); // STATS needs 17
  });
});

// key/media inject (via the class-tagged INJECT) + the unified USAGE_EVENT catch stream + the keyboard
// half of CAPS. Byte vectors mirror the firmware packers/decoders in ctrl_proto.h so the JS side is
// pinned to the wire format.
describe('keyboard + media (v2.0.0)', () => {
  it('injectPayload (key) packs [class][usage u16 LE][action] (§3.2)', () => {
    // Press the 'A' keycode (0x04); release Left Shift (modifier 0xE1). class key = 1.
    expect(Array.from(injectPayload(INJ_KEY, 0x04, 1))).toEqual([1, 0x04, 0x00, 1]);
    expect(Array.from(injectPayload(INJ_KEY, 0xe1, 0))).toEqual([1, 0xe1, 0x00, 0]);
  });

  it('injectPayload (media) keeps the 16-bit usage little-endian (§3.2)', () => {
    // Press Volume Up (0x00E9); force-release Play/Pause (0x00CD). class media = 2.
    expect(Array.from(injectPayload(INJ_MEDIA, 0xe9, 1))).toEqual([2, 0xe9, 0x00, 1]);
    expect(Array.from(injectPayload(INJ_MEDIA, 0xcd, 2))).toEqual([2, 0xcd, 0x00, 2]);
    expect(Array.from(injectPayload(INJ_MEDIA, 0x0123, 1))).toEqual([2, 0x23, 0x01, 1]);
  });

  it('CAPS keyboard half: NKRO bitmap implies nkro, change-driven (§4.4)', () => {
    // no mouse; NKRO board (n_keys 0xff) with Consumer; keyboard class change-driven
    const resp = parseResp(new Uint8Array([3, 0, 0, 0, 0xff, 0x02, 0x02]));
    expect(resp?.kind).toBe('caps');
    if (resp?.kind !== 'caps') throw new Error('expected caps');
    expect(resp.caps.keyboard).toEqual({
      nKeys: 0xff,
      nkro: true,
      hasConsumer: true,
      hasSystem: false,
      hasReportId: false,
    });
    expect(resp.caps.kbdChangeDriven).toBe(true);
    expect(resp.caps.mouseChangeDriven).toBe(false);
  });

  it('returns null for a truncated CAPS payload', () => {
    expect(parseResp(new Uint8Array([3, 5, 0x07, 2]))).toBeNull(); // unified CAPS needs 7 bytes
  });

  it('parseUsageEvent decodes [ts][clk][cls][dir][n] then [class][id u16 LE] usages (§4.10)', () => {
    // cls and dir come from the frame header, not from the entries: the snapshot that most needs
    // them is the EMPTY one, which lists nothing to read a class or an edge from.
    const hdr = (cls: number, dir: number) => [0, 0, 0, 0, 0, cls, dir];
    // Two held buttons: Left (class 0, id 0) and Side2 (class 0, id 4), on the press edge.
    expect(
      parseUsageEvent(new Uint8Array([...hdr(0, Direction.Positive), 2, 0, 0, 0, 0, 4, 0])),
    ).toEqual({
      tsUs: 0,
      clk: ClockDomain.Host,
      cls: 0,
      dir: Direction.Positive,
      usages: [
        { cls: 0, id: 0 },
        { cls: 0, id: 4 },
      ],
    });
    // One held key ('A', class 1, id 0x04) and one held media usage (Volume Up, class 2, id 0x00E9),
    // each in its own event; the id stays little-endian.
    expect(
      parseUsageEvent(new Uint8Array([...hdr(1, Direction.Positive), 1, 1, 0x04, 0x00])),
    ).toEqual({
      tsUs: 0,
      clk: ClockDomain.Host,
      cls: 1,
      dir: Direction.Positive,
      usages: [{ cls: 1, id: 0x04 }],
    });
    expect(
      parseUsageEvent(new Uint8Array([...hdr(2, Direction.Positive), 1, 2, 0xe9, 0x00])),
    ).toEqual({
      tsUs: 0,
      clk: ClockDomain.Host,
      cls: 2,
      dir: Direction.Positive,
      usages: [{ cls: 2, id: 0xe9 }],
    });
    // Empty (nothing held) on the release edge: the header is the only thing naming the class.
    expect(parseUsageEvent(new Uint8Array([...hdr(1, Direction.Negative), 0]))).toEqual({
      tsUs: 0,
      clk: ClockDomain.Host,
      cls: 1,
      dir: Direction.Negative,
      usages: [],
    });
  });

  it('parseUsageEvent returns null for a short or truncated payload', () => {
    expect(parseUsageEvent(new Uint8Array([]))).toBeNull(); // needs ts + clk + cls + dir + n
    expect(parseUsageEvent(new Uint8Array([0, 0, 0, 0, 0]))).toBeNull(); // no cls/dir/n
    expect(parseUsageEvent(new Uint8Array([0, 0, 0, 0, 0, 0, 1]))).toBeNull(); // no n byte
    expect(parseUsageEvent(new Uint8Array([0, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0]))).toBeNull(); // n=2, one entry
  });

  it('round-trips a USAGE_EVENT frame through the decoder', () => {
    // ts = 1 s on the host clock, two held keys: 'w' (class 1, id 0x1a) and 'd' (class 1, id 0x07).
    const payload = new Uint8Array([
      0x40, 0x42, 0x0f, 0x00, 0x00, 1, Direction.Positive, 2, 1, 0x1a, 0x00, 1, 0x07, 0x00,
    ]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.UsageEvent, 7, payload));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.UsageEvent);
    expect(frames[0].seq).toBe(7);
    expect(parseUsageEvent(frames[0].payload)).toEqual({
      tsUs: 1_000_000,
      clk: ClockDomain.Host,
      cls: 1,
      dir: Direction.Positive,
      usages: [
        { cls: 1, id: 0x1a },
        { cls: 1, id: 0x07 },
      ],
    });
  });
});
