import { describe, it, expect } from 'vitest';
import {
  type ClipEntry,
  type ClipTrigger,
  Action,
  CLIP_COND_ANY_CLASS,
  CLIP_COND_ANY_ID,
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
  clipSetPayload,
  clipTriggerPayload,
  encode,
  encodeClipEntry,
  parseResp,
  sameTrigger,
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
    const edges = Array.from({ length: 8 }, (_, i) => ({
      cls: 0,
      id: i,
      action: Action.Press,
    }));
    const b = encodeClipEntry({ kind: 'tick', xy: { dx: 1, dy: 1 }, wheel: 1, edges });
    // 1 flags + 4 xy + 2 wheel + 1 count + 8*4 edges, which is the box's whole entry budget.
    expect(b?.length).toBe(40);
  });

  it('refuses more edges than one tick can carry', () => {
    const edges = Array.from({ length: 9 }, () => ({ cls: 0, id: 0, action: Action.Press }));
    expect(encodeClipEntry({ kind: 'tick', edges })).toBeNull();
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
    nHeld,
  ];

  it('decodes the scalar prefix, config, and triggers with no held usages', () => {
    const payload = new Uint8Array([
      ...header(ClipState.Playing, 0),
      0x1f, // autolock: every class
      0x03, // loop + retain
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
      held: [],
      autolock: 0x1f,
      loop: true,
      retain: true,
      finalized: false,
      triggers: [
        { cls: 1, id: 0x3a, edge: Direction.Positive, action: ClipOp.Toggle, consume: true },
      ],
    });
  });

  it('finds the config section after a variable-length held list', () => {
    // The config offset is 25 + 3*held_n, and held_n changes between polls as injection changes.
    // A parser that assumed 25 would read a held usage's bytes as autolock and flags.
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
    expect(overHeld.length).toBeGreaterThan(25 + 3 * 41);
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
    expect(parseResp(new Uint8Array(header(ClipState.Idle, 0).slice(0, 24)))).toBeNull();
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
            new Uint8Array([
              Q_CLIP, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ]),
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
