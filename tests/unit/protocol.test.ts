import { describe, it, expect } from 'vitest';
import {
  type DecodedFrame,
  FrameDecoder,
  FrameType,
  LogLevel,
  PayloadTooLongError,
  RebootTarget,
  SOF,
  crc16Ccitt,
  encode,
  healthFromFlags,
  logLevelFromU8,
  parseLog,
  parseResp,
  queryPayload,
  rebootPayload,
  versionString,
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
      health: { linkUp: true, mouseAttached: true, cloneConfigured: true, injectionActive: true },
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
    const ty = 0x09;
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
    expect(parseResp(new Uint8Array([9]))).toBeNull(); // unknown selector
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

  it('healthFromFlags decodes individual bits', () => {
    expect(healthFromFlags(0x05)).toEqual({
      linkUp: true,
      mouseAttached: false,
      cloneConfigured: true,
      injectionActive: false,
    });
  });

  it('versionString formats major.minor.patch', () => {
    expect(versionString({ protoVer: 1, fwMajor: 0, fwMinor: 1, fwPatch: 0 })).toBe('0.1.0');
  });
});
