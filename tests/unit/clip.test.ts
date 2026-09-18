import { describe, it, expect } from 'vitest';
import {
  type ClipEntry,
  type ClipTrigger,
  Action,
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
  ClipOp,
  ClipState,
  Direction,
  FrameDecoder,
  FrameType,
  Q_CLIP,
  clipAppendPayload,
  clipCtrlPayload,
  clipEntryFault,
  clipSetPayload,
  clipTriggerPayload,
  encode,
  encodeClipEntry,
  parseResp,
  sameTrigger,
  transferPayload,
} from '../../src/dashboard/protocol';
import { SerialLink } from '../../src/dashboard/serial';

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
    // With one edge the flag and the bytes are written by two separate checks. If they disagree,
    // the edge payload lands with no flag to announce it, the box reads 4 bytes short, and every
    // entry after it in the ring is misaligned with no framing to recover on.
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
    // test cannot fail. AUTOLOCK is the one where a swap is silent and destructive, because the
    // box drops an unknown id and the scope never engages.
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
    // Padded past what the count implies, so the length checks pass and the bound is what rejects
    // these. Without the padding both are caught by the length check instead and the bounds could
    // be deleted without a test noticing.
    const overHeld = [...header(ClipState.Idle, 41), ...new Array(3 * 41 + 3).fill(0)];
    expect(overHeld.length).toBeGreaterThan(31 + 3 * 41);
    expect(parseResp(new Uint8Array(overHeld))).toBeNull();

    const overTrig = [...header(ClipState.Idle, 0), 0, 0, 9, ...new Array(6 * 9).fill(0)];
    expect(parseResp(new Uint8Array(overTrig))).toBeNull();

    // The limits themselves are legal.
    const atHeld = [...header(ClipState.Idle, 40), ...new Array(3 * 40).fill(0), 0, 0, 0];
    expect(parseResp(new Uint8Array(atHeld))?.kind).toBe('clip');
    const atTrig = [...header(ClipState.Idle, 0), 0, 0, 8, ...new Array(6 * 8).fill(0)];
    expect(parseResp(new Uint8Array(atTrig))?.kind).toBe('clip');
  });

  it('rejects a reply one byte short of the fixed prefix', () => {
    expect(parseResp(new Uint8Array(header(ClipState.Idle, 0).slice(0, 30)))).toBeNull();
  });

  it('reads an unknown state as faulted, not as idle', () => {
    // Idle is the one state a UI offers Start on, so an unrecognised state must not land there.
    const r = parseResp(new Uint8Array([...header(9, 0), 0, 0, 0]));
    expect(r!.kind === 'clip' && r.clip.state).toBe(ClipState.Faulted);
  });
});

describe('clipAppend on the link', () => {
  it('numbers appends on their own sequence, not the shared command sequence', async () => {
    // The box faults the engine when an append's SEQ is not exactly one past the last append's.
    // Any other frame in between advances the shared counter, so sharing it would fault the clip
    // the first time anything else was sent.
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === Q_CLIP) {
        mock.push(
          encode(
            FrameType.Resp,
            f.seq,
            // The 31-byte prefix with nothing held, then the three config bytes.
            new Uint8Array([Q_CLIP, 0, 0, 0, 1, 0, ...new Array(25).fill(0), 0, 0, 0]),
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
});
