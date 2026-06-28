import { describe, it, expect } from 'vitest';
import {
  type DecodedFrame,

  CatchClass,
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
  LockClass,
  LockDirection,
  LockTarget,
  isComposite,
  imperfectPayload,
  ledPayload,
  lockPayload,
  moveRidePayload,
  lockSet,
  logLevelFromU8,
  nativeHz,
  parseConsEvent,
  parseKbEvent,
  parseMouseEvent,
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
  resp_version: 'a5 06 00 05 00 00 01 00 01 00 d8 7e',
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
    expect(toHex(encode(FrameType.Resp, 0, new Uint8Array([0, 1, 0, 1, 0])))).toBe(VEC.resp_version);
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
      version: { protoVer: 1, fwMajor: 0, fwMinor: 1, fwPatch: 0 },
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
    expect(parseResp(new Uint8Array([0, 1, 0, 1]))).toBeNull(); // version needs 5 bytes
    expect(parseResp(new Uint8Array([1]))).toBeNull(); // health needs 2 bytes
    expect(parseResp(new Uint8Array([9]))).toBeNull(); // OPTIONS needs an id byte
    expect(parseResp(new Uint8Array([8]))).toBeNull(); // selector 8 retired
  });

  it('ignores trailing bytes past a complete RESP(VERSION)', () => {
    expect(parseResp(new Uint8Array([0, 1, 2, 3, 4, 99, 99]))).toEqual({
      kind: 'version',
      version: { protoVer: 1, fwMajor: 2, fwMinor: 3, fwPatch: 4 },
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
    expect(frameTypeFromU8(0x0c)).toBe(FrameType.MouseEvent);
    expect(frameTypeFromU8(0x0f)).toBe(FrameType.KbEvent);
    expect(frameTypeFromU8(0x10)).toBe(FrameType.ConsEvent);
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
    expect(versionString({ protoVer: 1, fwMajor: 0, fwMinor: 1, fwPatch: 0 })).toBe('0.1.0');
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
  it('lockPayload packs [class][usage u16 LE][direction][state]', () => {
    // Lock the mouse wheel's negative (scroll-down) direction.
    expect(
      Array.from(lockPayload(LockClass.Mouse, LockTarget.Wheel, LockDirection.Negative, 1)),
    ).toEqual([0, 2, 0, 2, 1]);
    // Unlock the X axis, both signs.
    expect(Array.from(lockPayload(LockClass.Mouse, LockTarget.X, LockDirection.Both, 0))).toEqual([
      0, 0, 0, 0, 0,
    ]);
    // A media-class lock keeps its 16-bit usage.
    expect(Array.from(lockPayload(LockClass.Media, 0x00e9, LockDirection.Both, 1))).toEqual([
      2, 0xe9, 0x00, 0, 1,
    ]);
  });

  it('LockTarget wire values match ctrl_proto.h', () => {
    expect([
      LockTarget.X,
      LockTarget.Y,
      LockTarget.Wheel,
      LockTarget.Left,
      LockTarget.Right,
      LockTarget.Middle,
      LockTarget.Side1,
      LockTarget.Side2,
    ]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('LockDirection wire values match ctrl_proto.h', () => {
    expect([LockDirection.Both, LockDirection.Positive, LockDirection.Negative]).toEqual([0, 1, 2]);
  });

  it('parses a LOCKS RESP into the 16-bit mask', () => {
    // what = 6, mask = 0x0020 little-endian (wheel negative / scroll-down locked).
    const resp = parseResp(new Uint8Array([6, 0x20, 0x00]));
    expect(resp).toEqual({ kind: 'locks', locks: { mask: 0x0020 } });
  });

  it('lockSet reads a per-direction bit out of the mask', () => {
    // bit(Wheel*2 + 1) = bit 5 = 0x20 = wheel negative (scroll-down).
    const locks = { mask: 0x0020 };
    expect(lockSet(locks, LockTarget.Wheel, LockDirection.Negative)).toBe(true);
    expect(lockSet(locks, LockTarget.Wheel, LockDirection.Positive)).toBe(false);
    expect(lockSet(locks, LockTarget.Wheel, LockDirection.Both)).toBe(false);
    // Side2 release = bit 15 = 0x8000.
    expect(lockSet({ mask: 0x8000 }, LockTarget.Side2, LockDirection.Negative)).toBe(true);
    // X positive = bit 0; both directions set means Both is true.
    expect(lockSet({ mask: 0x0003 }, LockTarget.X, LockDirection.Both)).toBe(true);
  });

  it('returns null for a truncated LOCKS payload', () => {
    expect(parseResp(new Uint8Array([6, 0x20]))).toBeNull(); // needs 3 bytes
  });
});

describe('CATCH command (§3.9)', () => {
  it('catchPayload packs [mask]', () => {
    // Motion + Buttons, no wheel.
    expect(Array.from(catchPayload(CatchClass.Motion | CatchClass.Buttons))).toEqual([0x05]);
    // Subscribe to everything (now includes the keys class), then unsubscribe.
    expect(Array.from(catchPayload(CatchClass.All))).toEqual([0x0f]);
    expect(Array.from(catchPayload(0))).toEqual([0x00]);
  });

  it('CatchClass wire values match ctrl_proto.h', () => {
    expect([CatchClass.Motion, CatchClass.Wheel, CatchClass.Buttons, CatchClass.Keys]).toEqual([
      0x01, 0x02, 0x04, 0x08,
    ]);
    expect(CatchClass.All).toBe(0x0f);
  });

  it('parses a CATCH RESP into mask + dropped', () => {
    // what = 7, mask = 0x05 (motion+buttons), dropped = 0x00000102 little-endian.
    const resp = parseResp(new Uint8Array([7, 0x05, 0x02, 0x01, 0x00, 0x00]));
    expect(resp).toEqual({ kind: 'catch', catch: { mask: 0x05, dropped: 0x00000102 } });
  });

  it('returns null for a truncated CATCH payload', () => {
    expect(parseResp(new Uint8Array([7, 0x05, 0x00, 0x00, 0x00]))).toBeNull(); // needs 6 bytes
  });

  it('parseMouseEvent decodes [buttons][dx][dy][wheel] with i16 sign-extension', () => {
    // buttons = Left + Side2 (0x11), dx = +1, dy = -2, wheel = -1.
    const resp = parseMouseEvent(new Uint8Array([0x11, 0x01, 0x00, 0xfe, 0xff, 0xff, 0xff]));
    expect(resp).toEqual({ buttons: 0x11, dx: 1, dy: -2, wheel: -1 });
  });

  it('parseMouseEvent returns null for a short payload', () => {
    expect(parseMouseEvent(new Uint8Array([0, 0, 0, 0, 0, 0]))).toBeNull(); // needs 7 bytes
  });

  it('round-trips a MOUSE_EVENT frame through the decoder', () => {
    // buttons = 0x04 (Middle), dx = -1000, dy = +1000, wheel = -120 (one notch up).
    const payload = new Uint8Array([0x04, 0x18, 0xfc, 0xe8, 0x03, 0x88, 0xff]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.MouseEvent, 200, payload));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.MouseEvent);
    expect(frames[0].seq).toBe(200);
    expect(parseMouseEvent(frames[0].payload)).toEqual({
      buttons: 0x04,
      dx: -1000,
      dy: 1000,
      wheel: -120,
    });
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

  it('returns null for a truncated or unknown OPTIONS payload', () => {
    expect(parseResp(new Uint8Array([9, 0, 1, 1]))).toBeNull(); // imperfect needs 5 bytes
    expect(parseResp(new Uint8Array([9, 1, 0]))).toBeNull(); // move_ride needs 4 bytes
    expect(parseResp(new Uint8Array([9, 0xff, 0, 0]))).toBeNull(); // unknown option id
  });
});

describe('device-info RESP decoding (v1.4.0)', () => {
  it('MOUSE_INFO (§4.3)', () => {
    const p = new Uint8Array([2, 0x6d, 0x04, 0x8b, 0xc0, 0x10, 0x01, 0x00, 0x02, 0x03]);
    const resp = parseResp(p);
    expect(resp).toEqual({
      kind: 'mouseInfo',
      mouseInfo: {
        vid: 0x046d,
        pid: 0xc08b,
        bcdDevice: 0x0110,
        bcdUsb: 0x0200,
        hasSerial: true,
        hasBos: true,
      },
    });
    if (resp?.kind === 'mouseInfo') expect(vidPid(resp.mouseInfo)).toBe('046D:C08B');
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
    expect(parseResp(new Uint8Array([2, 0, 0]))).toBeNull(); // MOUSE_INFO needs 10
    expect(parseResp(new Uint8Array([3, 5]))).toBeNull(); // CAPS needs 4
    expect(parseResp(new Uint8Array([4, 0xe8, 0x03]))).toBeNull(); // RATE needs 6
    expect(parseResp(new Uint8Array([5, 0, 0, 0]))).toBeNull(); // STATS needs 17
  });
});

// KEY/CONSUMER inject + the keyboard/media catch stream + KBD_CAPS. Byte vectors mirror the firmware
// packers/decoders in ctrl_proto.h so the JS side is pinned to the wire format.
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

  it('parseKbEvent decodes [modifiers][n][keycodes] (§4.12)', () => {
    // Left Ctrl held (0x01), keys A (0x04) and C (0x06) pressed.
    expect(parseKbEvent(new Uint8Array([0x01, 2, 0x04, 0x06]))).toEqual({
      modifiers: 0x01,
      keys: [0x04, 0x06],
    });
    // No keys, only a modifier.
    expect(parseKbEvent(new Uint8Array([0x02, 0]))).toEqual({ modifiers: 0x02, keys: [] });
  });

  it('parseKbEvent returns null for a short payload or a truncated key array', () => {
    expect(parseKbEvent(new Uint8Array([0x01]))).toBeNull(); // needs the n byte
    expect(parseKbEvent(new Uint8Array([0x00, 3, 0x04, 0x05]))).toBeNull(); // n=3 but only 2 keys
  });

  it('round-trips a KB_EVENT frame through the decoder', () => {
    // mod = Left Shift (0x02), keys = [0x1a 'w', 0x07 'd'].
    const payload = new Uint8Array([0x02, 2, 0x1a, 0x07]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.KbEvent, 7, payload));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.KbEvent);
    expect(frames[0].seq).toBe(7);
    expect(parseKbEvent(frames[0].payload)).toEqual({ modifiers: 0x02, keys: [0x1a, 0x07] });
  });

  it('parseConsEvent decodes [n][usage u16 LE x n] (§4.13)', () => {
    // One active usage: Volume Up (0x00E9).
    expect(parseConsEvent(new Uint8Array([1, 0xe9, 0x00]))).toEqual({ usages: [0xe9] });
    // Two usages, little-endian: 0x00E9 and 0x0123.
    expect(parseConsEvent(new Uint8Array([2, 0xe9, 0x00, 0x23, 0x01]))).toEqual({
      usages: [0xe9, 0x0123],
    });
    // Empty (nothing held).
    expect(parseConsEvent(new Uint8Array([0]))).toEqual({ usages: [] });
  });

  it('parseConsEvent returns null for a short or truncated payload', () => {
    expect(parseConsEvent(new Uint8Array([]))).toBeNull(); // needs the n byte
    expect(parseConsEvent(new Uint8Array([2, 0xe9, 0x00]))).toBeNull(); // n=2 but one usage
  });

  it('round-trips a CONS_EVENT frame through the decoder', () => {
    // One usage: Mute (0x00E2).
    const payload = new Uint8Array([1, 0xe2, 0x00]);
    const frames = decodeAll(new FrameDecoder(), encode(FrameType.ConsEvent, 9, payload));
    expect(frames).toHaveLength(1);
    expect(frames[0].ty).toBe(FrameType.ConsEvent);
    expect(frames[0].seq).toBe(9);
    expect(parseConsEvent(frames[0].payload)).toEqual({ usages: [0xe2] });
  });
});
