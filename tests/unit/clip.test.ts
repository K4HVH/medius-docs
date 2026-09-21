import { describe, it, expect, vi } from 'vitest';
import {
  type ClipEntry,
  type ClipPacketTrigger,
  type ClipPacketTriggerBox,
  type ClipTrigger,
  Action,
  CATCH_ID_ANY,
  CLIP_PKT_CLASSES,
  CLIP_PKT_MATCH_MAX,
  CLIP_PKT_MATCH_POOL,
  CLIP_PKT_TRIG_MAX,
  CLIP_COND_ANY_CLASS,
  CLIP_COND_ANY_ID,
  CLIP_EDGES_MAX,
  CLIP_ENTRY_MAX,
  CLIP_RAW_MAX,
  CLIP_SET_AUTOLOCK,
  CLIP_SET_LOOP,
  CLIP_SET_RETAIN,
  CLIP_TRIG_F_CONSUME,
  CLIP_TRIG_F_PRESENT,
  CLIP_TRIG_F_RUN,
  CatchClass,
  ClipOp,
  ClipState,
  Direction,
  FrameDecoder,
  FrameType,
  Q_CLIP,
  REWRITE_CLASSES,
  clearClipTriggersPayload,
  clipAppendPayload,
  clipCtrlPayload,
  clipEntryFault,
  clipPacketKeyFault,
  clipPacketTriggerFault,
  clipPacketTriggerPayload,
  clipSetPayload,
  clipTriggerPayload,
  encode,
  encodeClipEntry,
  parseResp,
  samePacketTrigger,
  sameTrigger,
  transferPayload,
} from '../../src/dashboard/protocol';
import { SerialLink, UnreadableReplyError } from '../../src/dashboard/serial';
import { createRoot } from 'solid-js';
import { createPoller } from '../../src/app/pages/dashboard/poll';

const bytes = (e: ClipEntry) => Array.from(encodeClipEntry(e) ?? []);

// A scriptable fake SerialPort, matching serial-link.test.ts.
type PortArg = ConstructorParameters<typeof SerialLink>[0];

class MockSerialPort {
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  written: Uint8Array[] = [];
  frames: { ty: FrameType; seq: number; payload: Uint8Array }[] = [];
  responder: ((frame: { ty: FrameType; seq: number; payload: Uint8Array }) => void) | null = null;
  private dec = new FrameDecoder();

  constructor() {
    this.readable = new ReadableStream<Uint8Array>({
      start: (c) => {
        this.controller = c;
      },
    });
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => {
        this.written.push(chunk);
        this.dec.feed(chunk, (f) => {
          this.frames.push({ ty: f.ty, seq: f.seq, payload: f.payload });
          this.responder?.(f);
        });
      },
    });
  }

  async open(): Promise<void> {}
  async setSignals(): Promise<void> {}
  async close(): Promise<void> {
    try {
      this.controller.close();
    } catch {
      // already closed
    }
  }
  push(data: Uint8Array): void {
    this.controller.enqueue(data);
  }
}

const asPort = (m: MockSerialPort) => m as unknown as PortArg;

// The caps are the firmware's (clip_entry.h, rewrite_tab.h), so they are pinned as numbers: a test
// that only compares a constant with itself lets it drift.
describe('clip caps', () => {
  it('match the firmware', () => {
    expect(CLIP_EDGES_MAX).toBe(8);
    expect(CLIP_RAW_MAX).toBe(8);
    expect(CLIP_ENTRY_MAX).toBe(512);
  });

  it('match the firmware for packet triggers', () => {
    expect(CLIP_PKT_TRIG_MAX).toBe(8);
    expect(CLIP_PKT_MATCH_MAX).toBe(16);
    expect(CLIP_PKT_MATCH_POOL).toBe(112);
    expect([CLIP_TRIG_F_PRESENT, CLIP_TRIG_F_CONSUME, CLIP_TRIG_F_RUN]).toEqual([0x01, 0x02, 0x04]);
  });

  it('watch the six surfaces a rewrite rule addresses', () => {
    expect(CLIP_PKT_CLASSES).toEqual([4, 5, 6, 7, 8, 9]);
    expect(CLIP_PKT_CLASSES).toEqual(REWRITE_CLASSES);
  });

  it('keep a raw endpoint to its number', () => {
    const entry = encodeClipEntry({
      kind: 'tick',
      raw: [{ ep: 0x82, dir: Direction.Positive, bytes: new Uint8Array([7]) }],
    });
    expect(Array.from(entry!)).toEqual([0x10, 1, 0x02, Direction.Positive, 1, 0, 7]);
  });
});

describe('clip entry encoding (§3.11)', () => {
  it('encodes a gap run as tag 0 plus a u16 count', () => {
    expect(bytes({ kind: 'gap', ticks: 10 })).toEqual([0x00, 0x0a, 0x00]);
    expect(bytes({ kind: 'gap', ticks: 0x1234 })).toEqual([0x00, 0x34, 0x12]);
  });

  it('refuses a gap the box would misread', () => {
    // 0 ticks encodes fine but consumes an entry without consuming a tick, which desynchronises a
    // generator's entry count from its tick count.
    expect(encodeClipEntry({ kind: 'gap', ticks: 0 })).toBeNull();
    expect(encodeClipEntry({ kind: 'gap', ticks: 0x10000 })).toBeNull();
    expect(encodeClipEntry({ kind: 'gap', ticks: 1.5 })).toBeNull();
  });

  it('encodes fields in wire order: XY, then wheel, then edges', () => {
    expect(
      bytes({
        kind: 'tick',
        xy: { dx: 1, dy: 2 },
        wheel: -1,
        edges: [
          { cls: 0, id: 0, action: Action.Press },
          { cls: 0, id: 0, action: Action.ForceRelease },
        ],
      }),
    ).toEqual([0x07, 1, 0, 2, 0, 0xff, 0xff, 2, 0, 0, 0, 1, 0, 0, 0, 2]);
  });

  it('encodes a negative delta as little-endian two-complement', () => {
    expect(bytes({ kind: 'tick', xy: { dx: 5, dy: -3 } })).toEqual([0x01, 5, 0, 0xfd, 0xff]);
  });

  it('refuses a content tick with no fields', () => {
    // Its flags byte would be zero, which is the gap tag: the box would read it as a gap run and
    // then eat the next two bytes as a count.
    expect(encodeClipEntry({ kind: 'tick' })).toBeNull();
    expect(encodeClipEntry({ kind: 'tick', edges: [] })).toBeNull();
  });

  it('keeps a zero-valued move, which is a real one-tick no-op', () => {
    expect(bytes({ kind: 'tick', xy: { dx: 0, dy: 0 } })).toEqual([0x01, 0, 0, 0, 0]);
  });

  it('sets the edges flag for a single edge, and carries its id little-endian', () => {
    // With one edge the flag and the bytes are written by two separate checks.
    expect(bytes({ kind: 'tick', edges: [{ cls: 1, id: 0x1234, action: Action.Press }] })).toEqual([
      0x04, 0x01, 0x01, 0x34, 0x12, 0x01,
    ]);
  });

  it('encodes exactly the maximum number of edges', () => {
    const edges = Array.from({ length: CLIP_EDGES_MAX }, (_, i) => ({
      cls: 0,
      id: i,
      action: Action.Press,
    }));
    const b = encodeClipEntry({ kind: 'tick', xy: { dx: 1, dy: 1 }, wheel: 1, edges });
    // 1 flags + 4 xy + 2 wheel + 1 count + 8*4 edges.
    expect(b?.length).toBe(40);
  });

  it('refuses more edges than one tick can carry', () => {
    const edges = Array.from({ length: CLIP_EDGES_MAX + 1 }, () => ({ cls: 0, id: 0, action: Action.Press }));
    expect(encodeClipEntry({ kind: 'tick', edges })).toBeNull();
    expect(clipEntryFault({ kind: 'tick', edges })).toBe('edges');
  });

  it('rejects the whole append when one entry is unencodable', () => {
    // A partial append would land on the box as a valid but wrong clip rather than being refused.
    expect(clipAppendPayload([{ kind: 'tick', xy: { dx: 1, dy: 1 } }, { kind: 'tick' }])).toBeNull();
  });

  it('concatenates entries with no separator or count', () => {
    const p = clipAppendPayload([
      { kind: 'gap', ticks: 2 },
      { kind: 'tick', wheel: 1 },
    ]);
    expect(Array.from(p!)).toEqual([0x00, 0x02, 0x00, 0x02, 0x01, 0x00]);
  });
});

// The same logical entries the firmware's own codec test encodes (tests/host/test_clip_entry.c), byte
// for byte: the box decodes what this writes, so the two encoders have to agree on every one.
describe('clip entry encoding against the firmware vectors (§3.11)', () => {
  const IN = Direction.Positive;
  const OUT = Direction.Negative;
  const SET_REPORT = { bmRequestType: 0x21, bRequest: 0x09, wValue: 0x0300, wIndex: 0, wLength: 2 };
  const GET_REPORT = { bmRequestType: 0xa1, bRequest: 0x01, wValue: 0x0300, wIndex: 0, wLength: 0x5a };

  it('matches the gap, move, wheel and edge vectors', () => {
    expect(bytes({ kind: 'gap', ticks: 500 })).toEqual([0x00, 0xf4, 0x01]);
    expect(bytes({ kind: 'tick', xy: { dx: 5, dy: -3 } })).toEqual([0x01, 0x05, 0x00, 0xfd, 0xff]);
    expect(bytes({ kind: 'tick', xy: { dx: 1, dy: 0 }, wheel: -1 })).toEqual([
      0x03, 0x01, 0x00, 0x00, 0x00, 0xff, 0xff,
    ]);
    expect(
      bytes({ kind: 'tick', xy: { dx: 1, dy: 0 }, edges: [{ cls: 0, id: 0, action: Action.Press }] }),
    ).toEqual([0x05, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]);
    expect(bytes({ kind: 'tick', edges: [{ cls: 1, id: 0x04, action: Action.Press }] })).toEqual([
      0x04, 0x01, 0x01, 0x04, 0x00, 0x01,
    ]);
  });

  it('writes pan ahead of the edges, whatever its bit says', () => {
    // PAN is 0x08 and EDGES 0x04, so bit order would put the edges first. The box reads pan with the
    // motion fields, and an encoder in bit order shifts every byte after the wheel.
    expect(
      bytes({ kind: 'tick', wheel: 2, pan: -2, edges: [{ cls: 0, id: 9, action: Action.Press }] }),
    ).toEqual([0x0e, 0x02, 0x00, 0xfe, 0xff, 0x01, 0x00, 0x09, 0x00, 0x01]);
    expect(bytes({ kind: 'tick', pan: 7 })).toEqual([0x08, 0x07, 0x00]);
  });

  it('writes raw items as [ep][dir][len u16][bytes], an empty one included', () => {
    expect(
      bytes({
        kind: 'tick',
        xy: { dx: 1, dy: 0 },
        raw: [
          { ep: 1, dir: IN, bytes: new Uint8Array([0xaa, 0xbb, 0xcc]) },
          { ep: 2, dir: OUT, bytes: new Uint8Array(0) },
        ],
      }),
    ).toEqual([
      0x11, 0x01, 0x00, 0x00, 0x00,
      0x02,
      0x01, 0x01, 0x03, 0x00, 0xaa, 0xbb, 0xcc,
      0x02, 0x02, 0x00, 0x00,
    ]);
  });

  it('writes transfer items as [ep][setup 8][OUT data], with no data behind an IN request', () => {
    const entry: ClipEntry = {
      kind: 'tick',
      transfers: [
        { ep: 0, setup: SET_REPORT, out: new Uint8Array([0x11, 0x22]) },
        { ep: 3, setup: GET_REPORT, out: new Uint8Array(0) },
      ],
    };
    expect(bytes(entry)).toEqual([
      0x20, 0x02,
      0x00, 0x21, 0x09, 0x00, 0x03, 0x00, 0x00, 0x02, 0x00, 0x11, 0x22,
      0x03, 0xa1, 0x01, 0x00, 0x03, 0x00, 0x00, 0x5a, 0x00,
    ]);
    // An item is TRANSFER's own payload, so the two builders have to agree.
    const s = SET_REPORT;
    expect(bytes(entry).slice(2, 13)).toEqual(
      Array.from(
        transferPayload(0, s.bmRequestType, s.bRequest, s.wValue, s.wIndex, s.wLength, new Uint8Array([0x11, 0x22])),
      ),
    );
  });

  it('writes every section at once in wire order', () => {
    expect(
      bytes({
        kind: 'tick',
        xy: { dx: 1, dy: 2 },
        wheel: 3,
        pan: 4,
        edges: [{ cls: 2, id: 0x1234, action: Action.Press }],
        raw: [{ ep: 5, dir: IN, bytes: new Uint8Array([0x7e]) }],
        transfers: [
          {
            ep: 0,
            setup: { bmRequestType: 0x80, bRequest: 0x06, wValue: 0x0100, wIndex: 0, wLength: 0x12 },
            out: new Uint8Array(0),
          },
        ],
      }),
    ).toEqual([
      0x3f,
      0x01, 0x00, 0x02, 0x00, // xy
      0x03, 0x00, // wheel
      0x04, 0x00, // pan
      0x01, 0x02, 0x34, 0x12, 0x01, // one media edge
      0x01, 0x05, 0x01, 0x01, 0x00, 0x7e, // one raw
      0x01, 0x00, 0x80, 0x06, 0x00, 0x01, 0x00, 0x00, 0x12, 0x00, // one IN transfer
    ]);
  });

  it('fills an entry exactly with the largest raw report one can hold', () => {
    const b = encodeClipEntry({
      kind: 'tick',
      raw: [{ ep: 2, dir: OUT, bytes: new Uint8Array(506).fill(0x5a) }],
    });
    expect(b?.length).toBe(CLIP_ENTRY_MAX);
    expect(Array.from(b!.subarray(0, 6))).toEqual([0x10, 0x01, 0x02, 0x02, 0xfa, 0x01]);
    expect(b![511]).toBe(0x5a);
  });
});

// Each refusal is pinned by its reason as well as by the null, so a test cannot pass because some
// other check happened to refuse the entry first.
describe('clip entry refusals (§3.11)', () => {
  const raw = (n: number, dir = Direction.Positive) => ({ ep: 1, dir, bytes: new Uint8Array(n) });
  const refused = (e: ClipEntry, why: string) => {
    expect(clipEntryFault(e)).toBe(why);
    expect(encodeClipEntry(e)).toBeNull();
  };

  it('refuses a ninth raw report, and takes the eighth', () => {
    const items = (n: number) => Array.from({ length: n }, () => raw(1));
    refused({ kind: 'tick', raw: items(CLIP_RAW_MAX + 1) }, 'raw-count');
    expect(clipEntryFault({ kind: 'tick', raw: items(CLIP_RAW_MAX) })).toBeNull();
    expect(encodeClipEntry({ kind: 'tick', raw: items(CLIP_RAW_MAX) })?.[1]).toBe(CLIP_RAW_MAX);
  });

  it('refuses a raw report going neither In nor Out', () => {
    refused({ kind: 'tick', raw: [raw(1, Direction.Both)] }, 'raw-direction');
    refused({ kind: 'tick', raw: [raw(1, Direction.With)] }, 'raw-direction');
    refused({ kind: 'tick', raw: [raw(1, Direction.Against)] }, 'raw-direction');
  });

  it('refuses an entry one byte past the ceiling, from a raw report or from what rides beside it', () => {
    refused({ kind: 'tick', raw: [raw(507)] }, 'too-long');
    // 506 alone fills the entry, so the two bytes of a wheel beside it are two too many.
    expect(clipEntryFault({ kind: 'tick', raw: [raw(506)] })).toBeNull();
    refused({ kind: 'tick', wheel: 1, raw: [raw(506)] }, 'too-long');
  });

  it('refuses an entry whose transfers run past the ceiling', () => {
    // 57 IN transfers at 9 bytes each is 513 behind the flags and count bytes; 56 is 506.
    const get = { bmRequestType: 0x80, bRequest: 6, wValue: 0x0100, wIndex: 0, wLength: 18 };
    const items = (n: number) => Array.from({ length: n }, () => ({ ep: 0, setup: get, out: new Uint8Array(0) }));
    refused({ kind: 'tick', transfers: items(57) }, 'too-long');
    expect(encodeClipEntry({ kind: 'tick', transfers: items(56) })?.length).toBe(2 + 56 * 9);
  });

  it('refuses OUT data that is not wLength bytes', () => {
    const setup = { bmRequestType: 0x21, bRequest: 9, wValue: 0x0300, wIndex: 0, wLength: 2 };
    refused({ kind: 'tick', transfers: [{ ep: 0, setup, out: new Uint8Array(1) }] }, 'transfer-data');
    refused({ kind: 'tick', transfers: [{ ep: 0, setup, out: new Uint8Array(3) }] }, 'transfer-data');
    refused({ kind: 'tick', transfers: [{ ep: 0, setup, out: new Uint8Array(0) }] }, 'transfer-data');
    expect(clipEntryFault({ kind: 'tick', transfers: [{ ep: 0, setup, out: new Uint8Array(2) }] })).toBeNull();
  });

  it('refuses any data on an IN request, whatever its wLength', () => {
    // The box reads no OUT data behind a setup with bit 7 set, so these bytes would be parsed as the
    // next item and misalign everything after it.
    const setup = { bmRequestType: 0xa1, bRequest: 1, wValue: 0x0300, wIndex: 0, wLength: 2 };
    refused({ kind: 'tick', transfers: [{ ep: 0, setup, out: new Uint8Array(2) }] }, 'transfer-data');
    expect(clipEntryFault({ kind: 'tick', transfers: [{ ep: 0, setup, out: new Uint8Array(0) }] })).toBeNull();
  });

  it('names the gap and empty-tick refusals too', () => {
    refused({ kind: 'gap', ticks: 0 }, 'gap');
    refused({ kind: 'tick' }, 'empty');
    refused({ kind: 'tick', raw: [], transfers: [] }, 'empty');
  });
});

describe('clip command payloads (§3.11)', () => {
  it('CLIP_CTRL carries one op byte', () => {
    expect(Array.from(clipCtrlPayload(ClipOp.Restart))).toEqual([4]);
  });

  it('CLIP_SET carries id then value', () => {
    // Not LOOP alone: its id is 1, so a payload with the two bytes swapped reads the same and the
    // test cannot fail.
    expect(Array.from(clipSetPayload(CLIP_SET_AUTOLOCK, 0x1f))).toEqual([0x00, 0x1f]);
    expect(Array.from(clipSetPayload(CLIP_SET_RETAIN, 1))).toEqual([0x02, 0x01]);
    expect(Array.from(clipSetPayload(CLIP_SET_LOOP, 1))).toEqual([1, 1]);
  });

  it('CLIP_TRIGGER sets PRESENT to add and clears it to remove', () => {
    const t: ClipTrigger = { cls: 1, id: 0x3a, edge: Direction.Positive, action: ClipOp.Toggle, consume: true };
    expect(Array.from(clipTriggerPayload(t, true))).toEqual([
      1, 0x3a, 0, Direction.Positive, ClipOp.Toggle, CLIP_TRIG_F_PRESENT | CLIP_TRIG_F_CONSUME,
    ]);
    expect(Array.from(clipTriggerPayload(t, false))[5]).toBe(CLIP_TRIG_F_CONSUME);
  });

  it('sameTrigger keys on address alone, which is what the box overwrites on', () => {
    const a: ClipTrigger = { cls: 1, id: 4, edge: Direction.Positive, action: ClipOp.Start, consume: false };
    const b: ClipTrigger = { cls: 1, id: 4, edge: Direction.Positive, action: ClipOp.Stop, consume: true };
    expect(sameTrigger(a, b)).toBe(true);
    expect(sameTrigger(a, { ...a, edge: Direction.Negative })).toBe(false);
  });
});

const hex = (s: string) => new Uint8Array(s.split(' ').map((b) => parseInt(b, 16)));

// The trigger the firmware's wire vectors describe: HID in, interface 2, IN, start, consume and once
// per run, selector 1, match 07 20 under FF 20.
const vectorTrigger: ClipPacketTrigger = {
  cls: CatchClass.HidIn,
  id: 2,
  dir: Direction.Positive,
  action: ClipOp.Start,
  consume: true,
  oncePerRun: true,
  selectorLen: 1,
  match: hex('07 20'),
  mask: hex('FF 20'),
};

// A trigger that only watches: every packet on the address, nothing consumed.
const watching: ClipPacketTrigger = {
  cls: CatchClass.VendorInterrupt,
  id: CATCH_ID_ANY,
  dir: Direction.Both,
  action: ClipOp.Toggle,
  consume: false,
  oncePerRun: false,
  selectorLen: 0,
  match: new Uint8Array(0),
  mask: new Uint8Array(0),
};

describe('packet trigger payloads against the firmware vectors (§3.11)', () => {
  it('binds with the match behind the six bytes every binding has', () => {
    expect(Array.from(clipPacketTriggerPayload(vectorTrigger, true)!)).toEqual(
      Array.from(hex('04 02 00 01 00 07 01 02 07 20 FF 20')),
    );
  });

  it('removes by key, with the action, flags and selector zero', () => {
    const toggling = { ...vectorTrigger, action: ClipOp.Toggle as const };
    expect(Array.from(clipPacketTriggerPayload(toggling, false)!)).toEqual(
      Array.from(hex('04 02 00 01 00 00 00 02 07 20 FF 20')),
    );
  });

  it('carries the id little-endian', () => {
    const t = { ...vectorTrigger, id: 0x0102 };
    expect(Array.from(clipPacketTriggerPayload(t, true)!).slice(0, 3)).toEqual([4, 0x02, 0x01]);
  });

  it('sets consume and once per run as separate bits over present', () => {
    const flagsOf = (over: Partial<ClipPacketTrigger>) =>
      clipPacketTriggerPayload({ ...vectorTrigger, ...over }, true)![5];
    expect(flagsOf({ consume: false })).toBe(0x05);
    expect(flagsOf({ oncePerRun: false, selectorLen: 0 })).toBe(0x03);
    expect(flagsOf({ consume: false, oncePerRun: false, selectorLen: 0 })).toBe(0x01);
  });

  it('writes a trigger with no match as the eight header bytes', () => {
    expect(Array.from(clipPacketTriggerPayload(watching, true)!)).toEqual([6, 0xff, 0xff, 0, 5, 0x01, 0, 0]);
  });

  it('clears both kinds of trigger with the one sentinel frame', () => {
    expect(Array.from(clearClipTriggersPayload())).toEqual([0xff, 0xff, 0xff, 0, 0, 0]);
  });

  it('keys a packet trigger on its address, match and mask', () => {
    const other = { ...vectorTrigger, action: ClipOp.Stop as const, consume: false, oncePerRun: false, selectorLen: 0 };
    expect(samePacketTrigger(vectorTrigger, other)).toBe(true);
    expect(samePacketTrigger(vectorTrigger, { ...vectorTrigger, dir: Direction.Negative })).toBe(false);
    expect(samePacketTrigger(vectorTrigger, { ...vectorTrigger, id: 3 })).toBe(false);
    expect(samePacketTrigger(vectorTrigger, { ...vectorTrigger, cls: CatchClass.Emit })).toBe(false);
    expect(samePacketTrigger(vectorTrigger, { ...vectorTrigger, match: hex('07 21') })).toBe(false);
    expect(samePacketTrigger(vectorTrigger, { ...vectorTrigger, mask: hex('FF FF') })).toBe(false);
    expect(samePacketTrigger(vectorTrigger, { ...vectorTrigger, match: hex('07'), mask: hex('FF') })).toBe(false);
  });
});

describe('packet trigger refusals (§3.11)', () => {
  const on: ClipPacketTriggerBox = { imperfect: true, held: [] };
  const off: ClipPacketTriggerBox = { imperfect: false, held: [] };
  const fault = (over: Partial<ClipPacketTrigger>, box?: ClipPacketTriggerBox) =>
    clipPacketTriggerFault({ ...vectorTrigger, ...over }, box);
  // `n` held triggers of `len` match bytes each, every key distinct.
  const heldSet = (n: number, len: number): ClipPacketTrigger[] =>
    Array.from({ length: n }, (_, i) => ({
      ...watching,
      id: i,
      match: new Uint8Array(len).fill(i),
      mask: new Uint8Array(len).fill(0xff),
    }));

  it('takes the vector trigger and a watching one', () => {
    expect(fault({}, on)).toBeNull();
    expect(clipPacketTriggerFault(watching, on)).toBeNull();
  });

  it('refuses a class that is no traffic surface', () => {
    for (const cls of [CatchClass.Button, CatchClass.Axis, CatchClass.Bus, CatchClass.ClipTransfer, CatchClass.Any]) {
      expect(fault({ cls })).toBe('class');
    }
    for (const cls of [4, 6, 7, 9]) expect(fault({ cls })).toBeNull();
    expect(fault({ cls: 5, dir: Direction.Negative })).toBeNull();
  });

  it('refuses a direction past Out', () => {
    expect(fault({ dir: Direction.With })).toBe('direction');
    expect(fault({ cls: CatchClass.VendorBulk, dir: Direction.Negative })).toBeNull();
  });

  it('refuses a direction its class never carries, on a set and on a removal', () => {
    const plain = { oncePerRun: false, selectorLen: 0 };
    expect(fault({ ...plain, cls: CatchClass.HidIn, dir: Direction.Negative })).toBe('class-direction');
    expect(fault({ ...plain, cls: CatchClass.Emit, dir: Direction.Negative })).toBe('class-direction');
    expect(fault({ ...plain, cls: CatchClass.HidOut, dir: Direction.Positive })).toBe('class-direction');
    expect(clipPacketKeyFault({ ...vectorTrigger, dir: Direction.Negative })).toBe('class-direction');
    expect(clipPacketTriggerPayload({ ...vectorTrigger, dir: Direction.Negative }, false)).toBeNull();
    // Both is a wildcard every class takes, and the vendor and control classes travel both ways.
    for (const cls of CLIP_PKT_CLASSES) expect(fault({ ...plain, cls, consume: false, dir: Direction.Both })).toBeNull();
    for (const cls of [CatchClass.VendorInterrupt, CatchClass.VendorBulk, CatchClass.Control]) {
      expect(fault({ ...plain, cls, consume: false, dir: Direction.Positive })).toBeNull();
      expect(fault({ ...plain, cls, consume: false, dir: Direction.Negative })).toBeNull();
    }
    expect(fault({ ...plain, cls: CatchClass.HidOut, dir: Direction.Negative })).toBeNull();
    expect(fault({ ...plain, cls: CatchClass.Emit, dir: Direction.Positive })).toBeNull();
  });

  it('refuses a match bit outside its mask, on a set and on a removal', () => {
    // 0x21 under 0x20 asks for bit 0, which the mask throws away: no packet can meet it.
    const stray = { match: hex('07 21'), mask: hex('FF 20') };
    expect(fault(stray)).toBe('match-outside-mask');
    expect(clipPacketKeyFault({ ...vectorTrigger, ...stray })).toBe('match-outside-mask');
    expect(clipPacketTriggerPayload({ ...vectorTrigger, ...stray }, true)).toBeNull();
    expect(clipPacketTriggerPayload({ ...vectorTrigger, ...stray }, false)).toBeNull();
    // The stray bit in the last byte alone, and in the first alone.
    expect(fault({ match: hex('07 20 80'), mask: hex('FF 20 7F') })).toBe('match-outside-mask');
    expect(fault({ match: hex('17 20'), mask: hex('0F 20') })).toBe('match-outside-mask');
    expect(fault({ match: hex('07 20'), mask: hex('FF 20') })).toBeNull();
    expect(fault({ match: hex('00 00'), mask: hex('FF 20') })).toBeNull();
  });

  it('refuses once per run whose condition has no masked bit', () => {
    // Selector 1 leaves byte 1 as the condition, and a zero mask there is met by every packet.
    expect(fault({ match: hex('07 00'), mask: hex('FF 00') }, on)).toBe('run-condition');
    expect(fault({ match: hex('07 00 00'), mask: hex('FF 00 00') }, on)).toBe('run-condition');
    expect(fault({ match: hex('07 00 00'), mask: hex('FF 00 01') }, on)).toBeNull();
    // With no selector the first byte is condition too.
    expect(fault({ selectorLen: 0, match: hex('00 00'), mask: hex('00 00') }, on)).toBe('run-condition');
    expect(fault({ selectorLen: 0, match: hex('07 00'), mask: hex('FF 00') }, on)).toBeNull();
    // Without once per run a trigger that matches every packet is a legal one.
    expect(fault({ oncePerRun: false, selectorLen: 0, match: hex('07 00'), mask: hex('FF 00') }, on)).toBeNull();
  });

  it('names the first refusal in the order the box checks them', () => {
    const stray = { match: hex('07 21'), mask: hex('FF 20') };
    expect(fault({ ...stray, dir: Direction.Negative })).toBe('class-direction');
    expect(fault({ ...stray, mask: hex('FF') })).toBe('mask-length');
    expect(fault({ ...stray, action: ClipOp.Clear as never })).toBe('match-outside-mask');
    expect(fault({ match: hex('00'), mask: hex('00'), selectorLen: 1 }, on)).toBe('run-selector');
    expect(fault({ match: hex('07 00'), mask: hex('FF 00'), id: CATCH_ID_ANY }, on)).toBe('run-stream');
  });

  it('refuses a verb past Toggle', () => {
    expect(fault({ action: ClipOp.Clear as never })).toBe('verb');
    expect(fault({ action: ClipOp.Toggle })).toBeNull();
  });

  it('refuses a mask unlike its match in length', () => {
    expect(fault({ mask: hex('FF') })).toBe('mask-length');
    expect(fault({ mask: hex('FF 20 00') })).toBe('mask-length');
  });

  it('refuses a seventeenth match byte, and takes the sixteenth', () => {
    const wide = (n: number) => ({ match: new Uint8Array(n), mask: new Uint8Array(n).fill(0xff) });
    expect(fault(wide(17))).toBe('match-length');
    expect(fault(wide(16))).toBeNull();
  });

  it('refuses consume on control, opt-in or not', () => {
    const control = { cls: CatchClass.Control, oncePerRun: false, selectorLen: 0 };
    expect(fault(control, on)).toBe('consume-control');
    expect(fault(control)).toBe('consume-control');
    expect(fault({ ...control, consume: false }, on)).toBeNull();
  });

  it('refuses consume while imperfect clones are off, and takes a watching trigger then', () => {
    expect(fault({}, off)).toBe('consume-opt-in');
    expect(fault({ consume: false }, off)).toBeNull();
    expect(clipPacketTriggerFault(watching, off)).toBeNull();
    // Without the box state the opt-in is unknown, so it is the read-back that shows this refusal.
    expect(fault({})).toBeNull();
  });

  it('refuses once per run over anything wider than one stream', () => {
    expect(fault({ cls: CatchClass.Control, consume: false }, on)).toBe('run-stream');
    expect(fault({ id: CATCH_ID_ANY }, on)).toBe('run-stream');
    expect(fault({ dir: Direction.Both }, on)).toBe('run-stream');
    expect(fault({ cls: CatchClass.Emit }, on)).toBeNull();
  });

  it('refuses a selector that leaves no condition byte', () => {
    expect(fault({ selectorLen: 2 }, on)).toBe('run-selector');
    expect(fault({ selectorLen: 3 }, on)).toBe('run-selector');
    expect(fault({ selectorLen: 0 }, on)).toBeNull();
    expect(fault({ selectorLen: 0, match: new Uint8Array(0), mask: new Uint8Array(0) }, on)).toBe('run-selector');
  });

  it('refuses a selector without once per run', () => {
    expect(fault({ oncePerRun: false, selectorLen: 1 }, on)).toBe('selector');
    expect(fault({ oncePerRun: false, selectorLen: 0 }, on)).toBeNull();
  });

  it('refuses a ninth packet trigger, takes the eighth, and overwrites on a full set', () => {
    expect(fault({}, { imperfect: true, held: heldSet(7, 2) })).toBeNull();
    const full = heldSet(8, 2);
    expect(fault({}, { imperfect: true, held: full })).toBe('full');
    expect(clipPacketTriggerFault({ ...full[3], action: ClipOp.Stop }, { imperfect: true, held: full })).toBeNull();
  });

  it('refuses the match byte past the pool of 112, and takes the 112th', () => {
    const held = heldSet(7, 16); // 112 bytes
    expect(held.reduce((n, h) => n + h.match.length, 0)).toBe(112);
    expect(fault({ match: hex('07'), mask: hex('FF'), selectorLen: 0 }, { imperfect: true, held })).toBe('pool');
    expect(clipPacketTriggerFault(watching, { imperfect: true, held: heldSet(7, 16) })).toBeNull();
    const room = [...heldSet(6, 16), { ...watching, id: 6, match: new Uint8Array(14), mask: new Uint8Array(14) }];
    expect(fault({}, { imperfect: true, held: room })).toBeNull();
    expect(fault({ match: hex('07 20 01'), mask: hex('FF 20 FF') }, { imperfect: true, held: room })).toBe('pool');
    // An overwrite brings no new match bytes.
    expect(clipPacketTriggerFault({ ...held[0], action: ClipOp.Stop }, { imperfect: true, held })).toBeNull();
  });

  it('encodes nothing for a trigger the box would refuse on its own bytes', () => {
    expect(clipPacketTriggerPayload({ ...vectorTrigger, cls: CatchClass.Control }, true)).toBeNull();
    expect(clipPacketTriggerPayload({ ...vectorTrigger, selectorLen: 2 }, true)).toBeNull();
    expect(clipPacketTriggerPayload({ ...vectorTrigger, mask: hex('FF') }, true)).toBeNull();
    expect(clipPacketTriggerPayload({ ...vectorTrigger, mask: hex('FF') }, false)).toBeNull();
    expect(clipPacketTriggerPayload({ ...vectorTrigger, cls: CatchClass.Bus }, false)).toBeNull();
  });

  it('reads only the key on a removal', () => {
    const stale = { ...vectorTrigger, cls: CatchClass.Control, selectorLen: 9, action: ClipOp.Clear as never };
    expect(clipPacketKeyFault(stale)).toBeNull();
    expect(Array.from(clipPacketTriggerPayload(stale, false)!)).toEqual(
      Array.from(hex('08 02 00 01 00 00 00 02 07 20 FF 20')),
    );
  });
});

describe('RESP(CLIP) decoding (§4.15)', () => {
  const header = (state: number, nHeld: number) => [
    Q_CLIP,
    state,
    0x00, 0x00, 0x01, 0x00, // free = 65536
    0x40, 0x00, 0x00, 0x00, // total = 64
    0x20, 0x00, 0x00, 0x00, // played = 32
    0x05, 0x00, 0x00, 0x00, // ticks = 5
    0x01, 0x00, // underruns
    0x02, 0x00, // overruns
    0x03, 0x00, // seq gaps
    0x04, 0x01, // xfers = 260
    0x05, 0x00, // xfer errs
    0x06, 0x00, // gated
    nHeld,
  ];

  it('decodes the scalar prefix, config, and triggers with no held usages', () => {
    const payload = new Uint8Array([
      ...header(ClipState.Playing, 0),
      0x1f, // autolock: every class
      0x0b, // loop + retain + ride
      1, // one trigger
      1, 0x3a, 0x00, Direction.Positive, ClipOp.Toggle, 1,
      0, // no packet triggers
    ]);
    const r = parseResp(payload);
    expect(r?.kind).toBe('clip');
    expect(r!.kind === 'clip' && r.clip).toEqual({
      state: ClipState.Playing,
      freeBytes: 65536,
      totalBytes: 64,
      played: 32,
      ticks: 5,
      underruns: 1,
      overruns: 2,
      seqGaps: 3,
      xfers: 260,
      xferErrs: 5,
      gated: 6,
      held: [],
      autolock: 0x1f,
      loop: true,
      retain: true,
      finalized: false,
      ride: true,
      triggers: [
        { cls: 1, id: 0x3a, edge: Direction.Positive, action: ClipOp.Toggle, consume: true },
      ],
      packetTriggers: [],
    });
  });

  it('reads the held count from behind the three transfer counters', () => {
    // held_n is the prefix's last byte, behind xfers, xfer_errs and gated. A parser still reading it
    // at the old offset takes the low byte of xfers for the count: 4 here, with 2 actually held.
    const payload = new Uint8Array([
      ...header(ClipState.Playing, 2),
      0, 0x01, 0x00,
      2, 0xe9, 0x00,
      0x02, 0x01, 0,
      0,
    ]);
    const r = parseResp(payload);
    if (r?.kind !== 'clip') throw new Error('expected clip');
    expect(r.clip.held).toEqual([
      { cls: 0, id: 1 },
      { cls: 2, id: 0xe9 },
    ]);
    expect([r.clip.xfers, r.clip.xferErrs, r.clip.gated]).toEqual([260, 5, 6]);
    expect(r.clip.autolock).toBe(0x02);
    expect(r.clip.loop).toBe(true);
  });

  it('finds the config section after a variable-length held list', () => {
    // The config offset is 31 + 3*held_n, and held_n changes between polls as injection changes.
    // A parser that assumed 31 would read a held usage's bytes as autolock and flags.
    const payload = new Uint8Array([
      ...header(ClipState.Paused, 2),
      0, 0x01, 0x00, // held: button 1
      1, 0x04, 0x00, // held: key 0x04
      0x04, // autolock: buttons
      0x04, // finalized
      0,
      0,
    ]);
    const r = parseResp(payload);
    expect(r!.kind === 'clip' && r.clip.held).toEqual([
      { cls: 0, id: 1 },
      { cls: 1, id: 4 },
    ]);
    expect(r!.kind === 'clip' && r.clip.autolock).toBe(0x04);
    expect(r!.kind === 'clip' && r.clip.finalized).toBe(true);
    expect(r!.kind === 'clip' && r.clip.loop).toBe(false);
    expect(r!.kind === 'clip' && r.clip.ride).toBe(false);
  });

  it('reads the trigger read-back byte 5 as consume, not as a flags byte', () => {
    // On the write side that byte is flags (bit0 present, bit1 consume). Reading it as flags would
    // decode a consuming trigger as non-consuming, and echoing it back would delete the binding.
    const payload = new Uint8Array([
      ...header(ClipState.Idle, 0),
      0, 0, 2,
      CLIP_COND_ANY_CLASS, 0xff, 0xff, Direction.Both, ClipOp.Start, 0,
      1, 0x05, 0x00, Direction.Negative, ClipOp.Stop, 1,
      0,
    ]);
    const r = parseResp(payload);
    const trig = r!.kind === 'clip' ? r.clip.triggers : [];
    expect(trig[0]).toEqual({
      cls: CLIP_COND_ANY_CLASS,
      id: CLIP_COND_ANY_ID,
      edge: Direction.Both,
      action: ClipOp.Start,
      consume: false,
    });
    expect(trig[1].consume).toBe(true);
  });

  it('rejects a reply truncated inside the config section', () => {
    expect(parseResp(new Uint8Array([...header(ClipState.Idle, 0), 0x00, 0x00]))).toBeNull();
  });

  it('rejects a reply truncated inside the trigger list', () => {
    expect(parseResp(new Uint8Array([...header(ClipState.Idle, 0), 0, 0, 1, 1, 2]))).toBeNull();
  });

  it('rejects counts the box cannot have produced', () => {
    // Each reply is exactly as long as its count implies, so the length checks pass and the bound
    // is what rejects it.
    const overHeld = [...header(ClipState.Idle, 41), ...new Array(3 * 41).fill(0), 0, 0, 0, 0];
    expect(parseResp(new Uint8Array(overHeld))).toBeNull();

    const overTrig = [...header(ClipState.Idle, 0), 0, 0, 9, ...new Array(6 * 9).fill(0), 0];
    expect(parseResp(new Uint8Array(overTrig))).toBeNull();

    // The limits themselves are legal.
    const atHeld = [...header(ClipState.Idle, 40), ...new Array(3 * 40).fill(0), 0, 0, 0, 0];
    expect(parseResp(new Uint8Array(atHeld))?.kind).toBe('clip');
    const atTrig = [...header(ClipState.Idle, 0), 0, 0, 8, ...new Array(6 * 8).fill(0), 0];
    expect(parseResp(new Uint8Array(atTrig))?.kind).toBe('clip');
  });

  it('rejects a reply one byte short of the fixed prefix', () => {
    expect(parseResp(new Uint8Array(header(ClipState.Idle, 0).slice(0, 30)))).toBeNull();
  });

  // One RESP(CLIP) packet trigger entry. The flag bits are written as numbers, not the constants.
  const pktEntry = (t: ClipPacketTrigger, hits: number) => [
    t.cls, t.id & 0xff, t.id >> 8, t.dir, t.action,
    (t.consume ? 0x02 : 0) | (t.oncePerRun ? 0x04 : 0),
    t.selectorLen, t.match.length, hits & 0xff, hits >> 8,
    ...t.match, ...t.mask,
  ];
  // Two held usages and two input bindings ahead of the packet triggers.
  const front = [
    ...header(ClipState.Playing, 2),
    0, 0x01, 0x00,
    1, 0x04, 0x00,
    0x04, 0x02, 2,
    1, 0x3a, 0x00, Direction.Positive, ClipOp.Toggle, 1,
    0, 0x02, 0x00, Direction.Both, ClipOp.Stop, 0,
  ];
  const packetTriggersOf = (payload: number[]) => {
    const r = parseResp(new Uint8Array(payload));
    if (r?.kind !== 'clip') throw new Error('expected clip');
    expect(r.clip.held).toHaveLength(2);
    expect(r.clip.triggers).toHaveLength(2);
    return r.clip.packetTriggers;
  };

  it('decodes the firmware vector entry, hits saturated', () => {
    const entry = Array.from(hex('04 02 01 01 05 06 01 02 FF FF 07 20 FF 20'));
    expect(packetTriggersOf([...front, 1, ...entry])).toEqual([
      {
        cls: CatchClass.HidIn,
        id: 0x0102,
        dir: Direction.Positive,
        action: ClipOp.Toggle,
        consume: true,
        oncePerRun: true,
        selectorLen: 1,
        hits: 65535,
        match: hex('07 20'),
        mask: hex('FF 20'),
      },
    ]);
  });

  it('decodes no packet triggers behind a held list and input bindings', () => {
    expect(packetTriggersOf([...front, 0])).toEqual([]);
  });

  it('reads consume and once per run from their own bits', () => {
    const consuming = { ...vectorTrigger, oncePerRun: false, selectorLen: 0 };
    const running = { ...vectorTrigger, consume: false };
    const got = packetTriggersOf([...front, 2, ...pktEntry(consuming, 3), ...pktEntry(running, 0x0201)]);
    expect([got[0].consume, got[0].oncePerRun, got[0].hits]).toEqual([true, false, 3]);
    expect([got[1].consume, got[1].oncePerRun, got[1].hits]).toEqual([false, true, 0x0201]);
  });

  it('decodes eight packet triggers of unlike lengths, the match pool full', () => {
    const set: ClipPacketTrigger[] = Array.from({ length: 8 }, (_, i) => {
      const len = i === 0 ? 0 : 16; // 0 + 7 x 16 = 112
      return { ...watching, id: i, match: new Uint8Array(len).fill(i), mask: new Uint8Array(len).fill(0xf0 | i) };
    });
    const payload = [...front, 8, ...set.flatMap((t, i) => pktEntry(t, i))];
    expect(payload.length).toBeLessThanOrEqual(512);
    const got = packetTriggersOf(payload);
    expect(got).toHaveLength(8);
    got.forEach((g, i) => expect(g).toEqual({ ...set[i], hits: i }));
  });

  it('decodes an entry that replays as the command that set it', () => {
    const [got] = packetTriggersOf([...front, 1, ...pktEntry(vectorTrigger, 9)]);
    expect(clipPacketTriggerPayload(got, true)).toEqual(clipPacketTriggerPayload(vectorTrigger, true));
  });

  it('rejects a reply that stops before the packet trigger count', () => {
    expect(parseResp(new Uint8Array(front))).toBeNull();
  });

  it('rejects a reply truncated inside a packet trigger', () => {
    const whole = [...front, 1, ...pktEntry(vectorTrigger, 1)];
    expect(parseResp(new Uint8Array(whole))?.kind).toBe('clip');
    // Inside the mask, inside the match, and inside the ten bytes ahead of them.
    for (const cut of [1, 3, 5, 13]) expect(parseResp(new Uint8Array(whole.slice(0, -cut)))).toBeNull();
    // One whole entry short of the count.
    expect(parseResp(new Uint8Array([...front, 2, ...pktEntry(vectorTrigger, 1)]))).toBeNull();
  });

  it('rejects a byte past the last packet trigger', () => {
    expect(parseResp(new Uint8Array([...front, 0, 0]))).toBeNull();
    expect(parseResp(new Uint8Array([...front, 1, ...pktEntry(vectorTrigger, 1), 0]))).toBeNull();
  });

  it('rejects packet trigger counts the box cannot have produced', () => {
    // Each reply is exactly as long as its counts imply, so the bound is what rejects it.
    const nine = Array.from({ length: 9 }, (_, i) => pktEntry({ ...watching, id: i }, 0)).flat();
    expect(parseResp(new Uint8Array([...front, 9, ...nine]))).toBeNull();
    expect(parseResp(new Uint8Array([...front, 8, ...nine.slice(0, 8 * 10)]))?.kind).toBe('clip');

    const wide = { ...watching, match: new Uint8Array(17), mask: new Uint8Array(17) };
    expect(parseResp(new Uint8Array([...front, 1, ...pktEntry(wide, 0)]))).toBeNull();

    // Eight entries of 15 bytes is 120, past the pool of 112, with every entry legal on its own.
    const over = Array.from({ length: 8 }, (_, i) =>
      pktEntry({ ...watching, id: i, match: new Uint8Array(15), mask: new Uint8Array(15) }, 0),
    ).flat();
    expect(parseResp(new Uint8Array([...front, 8, ...over]))).toBeNull();
  });

  it('reads an unknown state as faulted, not as idle', () => {
    // Idle is the one state a UI offers Start on, so an unrecognised state must not land there.
    const r = parseResp(new Uint8Array([...header(9, 0), 0, 0, 0, 0]));
    expect(r!.kind === 'clip' && r.clip.state).toBe(ClipState.Faulted);
  });
});

describe('clipAppend on the link', () => {
  it('numbers appends on their own sequence, not the shared command sequence', async () => {
    // The box faults the engine when an append's SEQ is not exactly one past the last append's.
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === Q_CLIP) {
        mock.push(
          encode(
            FrameType.Resp,
            f.seq,
            // The 31-byte prefix with nothing held, the three config bytes, and the packet trigger count.
            new Uint8Array([Q_CLIP, 0, 0, 0, 1, 0, ...new Array(25).fill(0), 0, 0, 0, 0]),
          ),
        );
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();

    await link.clipAppend([{ kind: 'gap', ticks: 1 }]);
    await link.queryClip();
    await link.clipAppend([{ kind: 'gap', ticks: 2 }]);
    await link.reset();
    await link.clipAppend([{ kind: 'gap', ticks: 3 }]);

    const appends = mock.frames.filter((f) => f.ty === FrameType.ClipAppend);
    expect(appends.map((f) => f.seq)).toEqual([0, 1, 2]);
    await link.close();
  });

  it('splits a long clip on entry boundaries', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();

    // 5-byte entries: 512 / 5 = 102 per frame, so 150 entries is two frames, not one cut mid-entry.
    const entries: ClipEntry[] = Array.from({ length: 150 }, (_, i) => ({
      kind: 'tick' as const,
      xy: { dx: i, dy: 0 },
    }));
    await link.clipAppend(entries);

    const appends = mock.frames.filter((f) => f.ty === FrameType.ClipAppend);
    expect(appends).toHaveLength(2);
    expect(appends[0].payload.length).toBe(102 * 5);
    expect(appends[1].payload.length).toBe(48 * 5);
    // Consecutive, or the box treats the second frame as a lost append.
    expect(appends[1].seq).toBe((appends[0].seq + 1) & 0xff);
    // Every frame starts on an entry boundary: a 5-byte entry always leads with its flags byte.
    for (const f of appends) expect(f.payload[0]).toBe(0x01);
    await link.close();
  });

  it('never splits an entry when a frame-sized one sits among small ticks', async () => {
    // A 506-byte raw report is an entry of exactly one frame. Entries of 3 to 512 bytes share the
    // stream, so a chunker that counted entries or assumed a width would cut this one in two.
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    const small: ClipEntry = { kind: 'tick', xy: { dx: 1, dy: 1 } };
    const big: ClipEntry = {
      kind: 'tick',
      raw: [{ ep: 2, dir: Direction.Negative, bytes: new Uint8Array(506).fill(0xa5) }],
    };
    const entries: ClipEntry[] = [small, small, big, small, { kind: 'gap', ticks: 9 }, big, big, small];
    await link.clipAppend(entries);

    const appends = mock.frames.filter((f) => f.ty === FrameType.ClipAppend);
    // Frame by frame: the two small ticks, each big entry alone, and the small ones between packed.
    expect(appends.map((f) => f.payload.length)).toEqual([10, 512, 8, 512, 512, 5]);
    expect(appends.map((f) => f.seq)).toEqual([0, 1, 2, 3, 4, 5]);
    // Every frame is whole entries: walking it entry by entry lands exactly on its end.
    const entryLen = (p: Uint8Array, at: number): number => {
      if (p[at] === 0x00) return 3;
      if (p[at] === 0x01) return 5;
      if (p[at] === 0x10) return 2 + 4 + (p[at + 4] | (p[at + 5] << 8));
      throw new Error(`frame does not start an entry at ${at}`);
    };
    for (const f of appends) {
      let at = 0;
      while (at < f.payload.length) at += entryLen(f.payload, at);
      expect(at).toBe(f.payload.length);
    }
    // And nothing was lost or reordered across the cuts.
    const sent = appends.flatMap((f) => Array.from(f.payload));
    expect(sent).toEqual(entries.flatMap((e) => Array.from(encodeClipEntry(e)!)));
    await link.close();
  });

  it('sends a batch that lands exactly on the payload ceiling as one frame', async () => {
    // 8-byte entries divide 512 exactly, which is the case that separates "split when it would
    // overflow" from "split when it would fill".
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    const entries: ClipEntry[] = Array.from({ length: 64 }, () => ({
      kind: 'tick' as const,
      wheel: 1,
      edges: [{ cls: 0, id: 0, action: Action.Press }],
    }));
    expect(encodeClipEntry(entries[0])?.length).toBe(8);
    await link.clipAppend(entries);
    const appends = mock.frames.filter((f) => f.ty === FrameType.ClipAppend);
    expect(appends).toHaveLength(1);
    expect(appends[0].payload.length).toBe(512);
    await link.close();
  });

  it('sends nothing when an entry cannot be encoded', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await expect(link.clipAppend([{ kind: 'tick' }])).rejects.toThrow();
    expect(mock.frames.filter((f) => f.ty === FrameType.ClipAppend)).toHaveLength(0);
    await link.close();
  });

  it('sends CLIP_TRIGGER for a bind and an unbind', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    const t: ClipTrigger = { cls: 1, id: 0x3a, edge: Direction.Positive, action: ClipOp.Start, consume: false };
    await link.clipTrigger(t);
    await link.clipUntrigger(t);
    const sent = mock.frames.filter((f) => f.ty === FrameType.ClipTrigger);
    expect(sent).toHaveLength(2);
    expect(sent[0].payload[5] & CLIP_TRIG_F_PRESENT).toBe(CLIP_TRIG_F_PRESENT);
    expect(sent[1].payload[5] & CLIP_TRIG_F_PRESENT).toBe(0);
    await link.close();
  });

  it('sends CLIP_TRIGGER for a packet bind, a packet unbind and the clear', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await link.clipPacketTrigger(vectorTrigger);
    await link.clipPacketUntrigger(vectorTrigger);
    await link.clipClearTriggers();
    const sent = mock.frames.filter((f) => f.ty === FrameType.ClipTrigger).map((f) => Array.from(f.payload));
    expect(sent).toEqual([
      Array.from(hex('04 02 00 01 00 07 01 02 07 20 FF 20')),
      Array.from(hex('04 02 00 01 00 00 00 02 07 20 FF 20')),
      Array.from(hex('FF FF FF 00 00 00')),
    ]);
    await link.close();
  });

  it('sends nothing for a packet trigger the box would refuse', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await expect(link.clipPacketTrigger({ ...vectorTrigger, cls: CatchClass.Control })).rejects.toThrow();
    await expect(link.clipPacketUntrigger({ ...vectorTrigger, mask: hex('FF') })).rejects.toThrow();
    expect(mock.frames.filter((f) => f.ty === FrameType.ClipTrigger)).toHaveLength(0);
    await link.close();
  });
});

// RESP(CLIP) as 3.4.0 lays it out: the 25-byte prefix ends at held_n, with no transfer counters,
// then the config and one input binding, and no packet trigger list. Playing, replayable.
const CLIP_340 = new Uint8Array([
  Q_CLIP, ClipState.Playing,
  0x00, 0x00, 0x01, 0x00, // free
  0x40, 0x00, 0x00, 0x00, // used
  0x20, 0x00, 0x00, 0x00, // played
  0x05, 0x00, 0x00, 0x00, // ticks
  0, 0, 0, 0, 0, 0, // underruns, overruns, seq gaps
  0, // held_n
  0, 0x02, 1, // autolock, flags, n_trig
  1, 0x3a, 0x00, Direction.Positive, ClipOp.Toggle, 1,
]);

describe('a clip status in the 3.4.0 layout', () => {
  const answering = (payload: Uint8Array) => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === Q_CLIP) mock.push(encode(FrameType.Resp, f.seq, payload));
    };
    return new SerialLink(asPort(mock));
  };

  it('does not decode', () => {
    expect(CLIP_340.length).toBe(25 + 3 + 6);
    expect(parseResp(CLIP_340)).toBeNull();
  });

  it('is an unreadable reply on the link, not a missing one', async () => {
    const link = answering(CLIP_340);
    await link.open();
    await expect(link.queryClip()).rejects.toBeInstanceOf(UnreadableReplyError);
    await link.close();
  });

  it('marks the clip readback unreadable in the poller, and a decoded status clears it', async () => {
    let payload = CLIP_340;
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === Q_CLIP) mock.push(encode(FrameType.Resp, f.seq, payload));
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    await createRoot(async (dispose) => {
      const poller = createPoller(() => link);
      const clip = poller.subscribe('clip');
      const unreadable = poller.unreadable('clip');
      await vi.waitFor(() => expect(unreadable()).toBe(true));
      expect(clip()).toBeNull();

      payload = new Uint8Array([Q_CLIP, 0, 0, 0, 1, 0, ...new Array(25).fill(0), 0, 0, 0, 0]);
      poller.refresh('clip');
      await vi.waitFor(() => expect(unreadable()).toBe(false));
      expect(clip()?.freeBytes).toBe(65536);

      payload = CLIP_340;
      poller.refresh('clip');
      await vi.waitFor(() => expect(unreadable()).toBe(true));
      poller.reset();
      expect(unreadable()).toBe(false);
      dispose();
    });
    await link.close();
  });
});
