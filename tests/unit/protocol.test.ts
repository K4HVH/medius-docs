import { describe, it, expect } from 'vitest';
import {
  type DecodedFrame,

  CatchClass,
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
  LockDirection,
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
  parseUsageEvent,
  parseLog,
  parseResp,
  queryPayload,
  rebootPayload,
  versionString,
  vidPid,
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
    const ty = 0x12; // next free opcode past IMPERFECT (0x11)
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
    expect(frameTypeFromU8(0x12)).toBeNull();
    expect(frameTypeFromU8(0x00)).toBeNull();
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
      Array.from(lockPayload(LockClass.Axis, LockAxis.Wheel, LockDirection.Negative, 1)),
    ).toEqual([3, 2, 0, 2, 1]);
    // Unlock the X axis, both signs.
    expect(Array.from(lockPayload(LockClass.Axis, LockAxis.X, LockDirection.Both, 0))).toEqual([
      3, 0, 0, 0, 0,
    ]);
    // A button locks as class button (0), id = button id, with no +3 offset.
    expect(Array.from(lockPayload(LockClass.Button, 4, LockDirection.Positive, 1))).toEqual([
      0, 4, 0, 1, 1,
    ]);
    // A media-class lock keeps its 16-bit usage.
    expect(Array.from(lockPayload(LockClass.Media, 0x00e9, LockDirection.Both, 1))).toEqual([
      2, 0xe9, 0x00, 0, 1,
    ]);
    // The id sentinel 0xFFFF blanket-locks the whole class.
    expect(Array.from(lockPayload(LockClass.Key, LOCK_ID_ALL, LockDirection.Both, 1))).toEqual([
      1, 0xff, 0xff, 0, 1,
    ]);
  });

  it('LockClass wire values match ctrl_proto.h', () => {
    expect([LockClass.Button, LockClass.Key, LockClass.Media, LockClass.Axis]).toEqual([0, 1, 2, 3]);
  });

  it('LockDirection wire values match ctrl_proto.h', () => {
    expect([LockDirection.Both, LockDirection.Positive, LockDirection.Negative]).toEqual([0, 1, 2]);
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
    expect(isLocked(locks, lockAxis(LockAxis.Wheel), LockDirection.Negative)).toBe(true);
    expect(isLocked(locks, lockAxis(LockAxis.Wheel), LockDirection.Positive)).toBe(false);
    expect(isLocked(locks, lockAxis(LockAxis.Wheel), LockDirection.Both)).toBe(false);
    // X: both directions set means Both is true.
    expect(isLocked(locks, lockAxis(LockAxis.X), LockDirection.Both)).toBe(true);
    // A button not in the list reads unlocked.
    expect(isLocked(locks, lockButton(0), LockDirection.Positive)).toBe(false);
  });

  it('returns null for a truncated RESP(LOCKS) payload', () => {
    expect(parseResp(new Uint8Array([6]))).toBeNull(); // needs the n byte
    expect(parseResp(new Uint8Array([6, 1, 3, 2, 0]))).toBeNull(); // n=1 but only 3 entry bytes
  });
});

describe('CATCH command (§3.9)', () => {
  it('catchPayload packs [mask]', () => {
    // Motion + Buttons, no wheel.
    expect(Array.from(catchPayload(CatchClass.Motion | CatchClass.Buttons))).toEqual([0x05]);
    // Subscribe to everything (motion, wheel, buttons, keys, media), then unsubscribe.
    expect(Array.from(catchPayload(CatchClass.All))).toEqual([0x1f]);
    expect(Array.from(catchPayload(0))).toEqual([0x00]);
  });

  it('CatchClass wire values match ctrl_proto.h', () => {
    expect([
      CatchClass.Motion,
      CatchClass.Wheel,
      CatchClass.Buttons,
      CatchClass.Keys,
      CatchClass.Media,
    ]).toEqual([0x01, 0x02, 0x04, 0x08, 0x10]);
    expect(CatchClass.All).toBe(0x1f);
  });

  it('parses a CATCH RESP into mask + dropped', () => {
    // what = 7, mask = 0x05 (motion+buttons), dropped = 0x00000102 little-endian.
    const resp = parseResp(new Uint8Array([7, 0x05, 0x02, 0x01, 0x00, 0x00]));
    expect(resp).toEqual({ kind: 'catch', catch: { mask: 0x05, dropped: 0x00000102 } });
  });

  it('returns null for a truncated CATCH payload', () => {
    expect(parseResp(new Uint8Array([7, 0x05, 0x00, 0x00, 0x00]))).toBeNull(); // needs 6 bytes
  });

  it('parseMotionEvent decodes [dx][dy][dz] with i16 sign-extension', () => {
    // dx = +1, dy = -2, dz = -1.
    const ev = parseMotionEvent(new Uint8Array([0x01, 0x00, 0xfe, 0xff, 0xff, 0xff]));
    expect(ev).toEqual({ dx: 1, dy: -2, dz: -1 });
  });

  it('parseMotionEvent returns null for a short payload', () => {
    expect(parseMotionEvent(new Uint8Array([0, 0, 0, 0, 0]))).toBeNull(); // needs 6 bytes
  });

  it('round-trips a MOTION_EVENT frame through the decoder', () => {
    // dx = -1000, dy = +1000, dz = -120 (one notch up).
    const payload = new Uint8Array([0x18, 0xfc, 0xe8, 0x03, 0x88, 0xff]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.MotionEvent, 200, payload));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.MotionEvent);
    expect(frames[0].seq).toBe(200);
    expect(parseMotionEvent(frames[0].payload)).toEqual({ dx: -1000, dy: 1000, dz: -120 });
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

  it('parseUsageEvent decodes [n] then [class][id u16 LE] class-tagged usages (§4.10)', () => {
    // Two held buttons: Left (class 0, id 0) and Side2 (class 0, id 4).
    expect(parseUsageEvent(new Uint8Array([2, 0, 0, 0, 0, 4, 0]))).toEqual({
      usages: [
        { cls: 0, id: 0 },
        { cls: 0, id: 4 },
      ],
    });
    // One held key ('A', class 1, id 0x04) and one held media usage (Volume Up, class 2, id 0x00E9),
    // each in its own event; the id stays little-endian.
    expect(parseUsageEvent(new Uint8Array([1, 1, 0x04, 0x00]))).toEqual({
      usages: [{ cls: 1, id: 0x04 }],
    });
    expect(parseUsageEvent(new Uint8Array([1, 2, 0xe9, 0x00]))).toEqual({
      usages: [{ cls: 2, id: 0xe9 }],
    });
    // Empty (nothing held).
    expect(parseUsageEvent(new Uint8Array([0]))).toEqual({ usages: [] });
  });

  it('parseUsageEvent returns null for a short or truncated payload', () => {
    expect(parseUsageEvent(new Uint8Array([]))).toBeNull(); // needs the n byte
    expect(parseUsageEvent(new Uint8Array([2, 0, 0, 0]))).toBeNull(); // n=2 but one entry
  });

  it('round-trips a USAGE_EVENT frame through the decoder', () => {
    // Two held keys: 'w' (class 1, id 0x1a) and 'd' (class 1, id 0x07).
    const payload = new Uint8Array([2, 1, 0x1a, 0x00, 1, 0x07, 0x00]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.UsageEvent, 7, payload));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.UsageEvent);
    expect(frames[0].seq).toBe(7);
    expect(parseUsageEvent(frames[0].payload)).toEqual({
      usages: [
        { cls: 1, id: 0x1a },
        { cls: 1, id: 0x07 },
      ],
    });
  });
});
