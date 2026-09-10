import { describe, it, expect } from 'vitest';
import {
  BadProtoVerError,
  QueryTimeoutError,
  SerialLink,
} from '../../src/dashboard/serial';
import {
  CatchClass,
  EmitMode,
  RenderMode,
  FrameDecoder,
  FrameType,
  Direction,
  RewriteAction,
  PatchSection,
  TransferStatus,
  encode,
} from '../../src/dashboard/protocol';

type PortArg = ConstructorParameters<typeof SerialLink>[0];

// A scriptable fake SerialPort: a readable stream we can push bytes into and a
// writable stream that captures frames and lets a responder reply.
class MockSerialPort {
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  written: Uint8Array[] = [];
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
        this.dec.feed(chunk, (f) => this.responder?.(f));
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

describe('SerialLink', () => {
  it('handshakes: QUERY(VERSION) gets a SEQ-matched RESP(VERSION)', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 0) {
        // [what=0][proto=6][major=0][minor=1][patch=0][mac 6B]
        mock.push(
          encode(FrameType.Resp, f.seq, new Uint8Array([0, 6, 0, 1, 0, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff])),
        );
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const version = await link.handshake();
    expect(version).toEqual({
      protoVer: 6,
      fwMajor: 0,
      fwMinor: 1,
      fwPatch: 0,
      mac: [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff],
      name: '',
    });
    await link.close();
  });

  it('flushes a wedged box decoder, then handshakes on retry', async () => {
    const mock = new MockSerialPort();
    const gotFlush = () =>
      mock.written.some((c) => c.length >= 256 && c.every((b) => b === 0));
    // A wedged box: it ignores QUERY(VERSION) until a flush (a long run of 0x00) has arrived.
    mock.responder = (f) => {
      if (gotFlush() && f.ty === FrameType.Query && f.payload[0] === 0) {
        mock.push(
          encode(FrameType.Resp, f.seq, new Uint8Array([0, 6, 0, 1, 0, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff])),
        );
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const version = await link.handshake();
    expect(version.protoVer).toBe(6);
    expect(gotFlush()).toBe(true); // the flush was sent before the successful handshake
    await link.close();
  });

  it('queries health and decodes the flag bits', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0x03, 0x00])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const health = await link.queryHealth();
    expect(health).toEqual({
      linkUp: true,
      mouseAttached: true,
      cloneConfigured: false,
      injectionActive: false,
      rateConfident: false,
      lockOn: false,
      catchOn: false,
      kbdAttached: false,
      rewriteOn: false,
      patchOn: false,
      transformOn: false,
    });
    await link.close();
  });

  it('decodes the kbd_att bit (all eight flags set)', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0xff, 0x00])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const health = await link.queryHealth();
    expect(health).toEqual({
      linkUp: true,
      mouseAttached: true,
      cloneConfigured: true,
      injectionActive: true,
      rateConfident: true,
      lockOn: true,
      catchOn: true,
      kbdAttached: true,
      rewriteOn: false,
      patchOn: false,
      transformOn: false,
    });
    await link.close();
  });

  it('rejects with QueryTimeoutError when the box is silent', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await expect(link.queryVersion(40)).rejects.toBeInstanceOf(QueryTimeoutError);
    await link.close();
  });

  it('rejects a mismatched protocol version, and carries the firmware that answered', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 0) {
        // RESP(VERSION): [selector][proto][major][minor][patch][mac 6B]. A v3.1.0 box speaks 4.
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 4, 3, 1, 0, 1, 2, 3, 4, 5, 6])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const err = await link.handshake().then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(BadProtoVerError);
    expect((err as BadProtoVerError).version).toMatchObject({
      protoVer: 4,
      fwMajor: 3,
      fwMinor: 1,
      fwPatch: 0,
    });
    await link.close();
  });

  it('handshakes a box one protocol version behind, so it can still be updated', async () => {
    // One-click update arrived with proto 5 (firmware 3.2.0) and nothing it uses has changed since:
    // QUERY(VERSION), QUERY(FIRMWARE), UPDATE/UPDATE_RESP and LOG are all identical at 5 and 6. The
    // whole v5 to v6 delta is one new option id and its readback; OPTION(EMIT) is unchanged at 12
    // bytes. Refusing the handshake outright would lock a 3.2.x box out of the very mechanism that
    // brings it up to date, and leave USB setup as the only way forward.
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 0) {
        // a v3.2.1 box: proto 5
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 5, 3, 2, 1, 1, 2, 3, 4, 5, 6])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const version = await link.handshake();
    expect(version).toMatchObject({ protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 1 });
    await link.close();
  });

  it('refuses a box newer than the page, which speaks a wire it cannot know', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 0) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 8, 9, 0, 0, 1, 2, 3, 4, 5, 6])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const err = await link.handshake().then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(BadProtoVerError);
    await link.close();
  });

  it('delivers the unsolicited VERSION boot hello (SEQ 0)', async () => {
    const mock = new MockSerialPort();
    let hello = null as null | { fwMajor: number };
    const link = new SerialLink(asPort(mock), {
      onVersionHello: (v) => {
        hello = v;
      },
    });
    await link.open();
    mock.push(
      encode(FrameType.Resp, 0, new Uint8Array([0, 1, 0, 1, 0, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06])),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(hello).toEqual({
      protoVer: 1,
      fwMajor: 0,
      fwMinor: 1,
      fwPatch: 0,
      mac: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06],
      name: '',
    });
    await link.close();
  });

  it('gives each movement verb its own MOVE flags byte', async () => {
    // One level above the payload builders: this is where a verb wired to the wrong flag hides, since
    // every one of these produces a well-formed MOVE frame either way.
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await link.moveRel(7, -2);
    await link.moveRelNow(7, -2);
    await link.wheel(3);
    await link.wheelNow(3);
    await link.pan(3);
    await link.panNow(3);
    await link.flushMotion();
    await link.discardMotion();
    // payload starts at byte 5: [SOF][TYPE][SEQ][LEN lo][LEN hi]
    const payloads = mock.written.map((f) => Array.from(f.slice(5, f.length - 2)));
    expect(payloads).toEqual([
      [0, 7, 0, 0xfe, 0xff, 0x00],
      [0, 7, 0, 0xfe, 0xff, 0x01],
      [1, 3, 0, 0x00],
      [1, 3, 0, 0x01],
      [2, 3, 0, 0x00],
      [2, 3, 0, 0x01],
      [0, 0, 0, 0, 0, 0x02],
      [0, 0, 0, 0, 0, 0x04],
    ]);
    expect(mock.written.every((f) => f[1] === FrameType.Move)).toBe(true);
    await link.close();
  });

  it('sends a REBOOT(DeviceDownload) frame on reboot', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    const { RebootTarget } = await import('../../src/dashboard/protocol');
    await link.reboot(RebootTarget.DeviceDownload);
    expect(mock.written).toHaveLength(1);
    const frame = mock.written[0];
    expect(frame[1]).toBe(FrameType.RebootDl);
    expect(frame[5]).toBe(RebootTarget.DeviceDownload);
    await link.close();
  });

  it('queryCaps decodes the unified CAPS reply', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 3) {
        // no mouse; keyboard n_keys=6, kbd_flags=Consumer(0x02); keyboard class change-driven (0x02)
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([3, 0, 0, 0, 6, 0x02, 0x02])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const caps = await link.queryCaps();
    expect(caps.keyboard).toEqual({
      nKeys: 6,
      nkro: false,
      hasConsumer: true,
      hasSystem: false,
      hasReportId: false,
    });
    expect(caps.kbdChangeDriven).toBe(true);
    await link.close();
  });

  it('option queries send QUERY [9, id] and decode the RESP(OPTIONS) reply', async () => {
    const mock = new MockSerialPort();
    const reqs: number[][] = [];
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 9) {
        reqs.push(Array.from(f.payload));
        if (f.payload[1] === 0) {
          // RESP(OPTIONS, IMPERFECT): [9][0][allowed][over_capacity][clone_imperfect]
          mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([9, 0, 1, 0, 0])));
        } else if (f.payload[1] === 1) {
          // RESP(OPTIONS, MOVE_RIDE): [9][1][timeout u16 LE] = 5 ms
          mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([9, 1, 5, 0])));
        } else if (f.payload[1] === 2) {
          // RESP(OPTIONS, EMIT): [9][2][mode=fixed][fixed u16][resolved u16][force u16]
          //                      [advertised u16][force_active] = fixed 500 Hz, nothing forced
          mock.push(
            encode(
              FrameType.Resp,
              f.seq,
              new Uint8Array([9, 2, 2, 0xf4, 0x01, 0xf4, 0x01, 0x7d, 0x00, 0x64, 0x00, 0x01]),
            ),
          );
        } else if (f.payload[1] === 5) {
          // RESP(OPTIONS, RENDER): [9][5][mode=de-spiked][full][ready]
          mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([9, 5, 2, 1, 1])));
        } else if (f.payload[1] === 6) {
          // RESP(OPTIONS, SPREAD): [9][6][percent=100 u16 LE][span=8002 us u32 LE]
          mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([9, 6, 100, 0, 0x42, 0x1f, 0, 0])));
        }
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    expect(await link.queryImperfect()).toEqual({
      allowed: true,
      overCapacity: false,
      cloneImperfect: false,
    });
    expect(await link.queryMovementRiding()).toBe(5);
    expect(await link.queryEmitPace()).toEqual({
      mode: EmitMode.Fixed,
      fixedHz: 500,
      resolvedHz: 500,
      forceHz: 125,
      advertisedHz: 100,
      forceActive: true,
    });
    expect(await link.queryRender()).toEqual({
      mode: RenderMode.Despiked,
      full: true,
      ready: true,
    });
    expect(await link.querySpread()).toEqual({ percent: 100, spanUs: 8002 });
    expect(reqs).toEqual([
      [9, 0],
      [9, 1],
      [9, 2],
      [9, 5],
      [9, 6],
    ]); // each option query carries its id byte, correlated on the Q_OPTIONS selector
    await link.close();
  });

  it('sends a KEY frame on key()', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await link.key(0x04, 1); // press 'A' -> INJECT [class=key=1][id=0x04 u16][action=1]
    expect(mock.written).toHaveLength(1);
    const frame = mock.written[0];
    expect(frame[1]).toBe(FrameType.Inject);
    expect(frame[5]).toBe(1); // class = key
    expect(frame[6]).toBe(0x04); // id lo
    expect(frame[7]).toBe(0x00); // id hi
    expect(frame[8]).toBe(1); // action
    await link.close();
  });

  it('sends an INJECT (media) frame on consumer() with a little-endian usage', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await link.consumer(0xe9, 1); // press Volume Up -> INJECT [class=media=2][id=0x00E9][action=1]
    expect(mock.written).toHaveLength(1);
    const frame = mock.written[0];
    expect(frame[1]).toBe(FrameType.Inject);
    expect(frame[5]).toBe(2); // class = media
    expect(frame[6]).toBe(0xe9);
    expect(frame[7]).toBe(0x00);
    expect(frame[8]).toBe(1);
    await link.close();
  });

  it('routes catch-stream frames to onEvent tagged by kind', async () => {
    const mock = new MockSerialPort();
    const events: { kind: string; seq: number }[] = [];
    const link = new SerialLink(asPort(mock), {
      onEvent: (ev, seq) => events.push({ kind: ev.kind, seq }),
    });
    await link.open();
    // A motion event, a class-tagged held-usage snapshot (a held button), then a byte-oriented
    // traffic event. Each frame leads with [ts_us u32][clk u8].
    mock.push(
      encode(FrameType.MotionEvent, 10, new Uint8Array([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0])),
    );
    // [ts u32][clk u8][cls u8][dir u8][n u8] then n x [class][id u16 LE]: one held key on the press edge.
    mock.push(
      encode(
        FrameType.UsageEvent,
        11,
        new Uint8Array([0, 0, 0, 0, 0, 1, Direction.Positive, 1, 1, 0x04, 0x00]),
      ),
    );
    mock.push(
      encode(
        FrameType.TrafficEvent,
        12,
        new Uint8Array([0, 0, 0, 0, 1, 4, 0, 0, 1, 0, 2, 0, 0xab, 0xcd]),
      ),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(events).toEqual([
      { kind: 'motion', seq: 10 },
      { kind: 'usages', seq: 11 },
      { kind: 'traffic', seq: 12 },
    ]);
    await link.close();
  });

  it('sends one CATCH frame per table entry, and clears the table with the wildcard', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    // One vendor interrupt endpoint, IN only, first 16 bytes captured.
    await link.catch({
      cls: CatchClass.VendorInterrupt,
      id: 0x83,
      dir: Direction.Positive,
      capture: 16,
    });
    // Dropping one entry, rather than the whole table: state 0 with a real address.
    await link.unsubscribeCatch({
      cls: CatchClass.VendorInterrupt,
      id: 0x83,
      dir: Direction.Positive,
      capture: 16,
    });
    await link.uncatch();
    expect(mock.written).toHaveLength(3);
    // [SOF][TYPE][SEQ][LEN lo][LEN hi] then the payload.
    expect(mock.written[0][1]).toBe(FrameType.Catch);
    expect(Array.from(mock.written[0].slice(5, 11))).toEqual([0x06, 0x83, 0x00, 0x01, 0x01, 0x10]);
    // The same address with state 0 removes just that entry, leaving the rest of the table.
    expect(Array.from(mock.written[1].slice(5, 11))).toEqual([0x06, 0x83, 0x00, 0x01, 0x00, 0x10]);
    // uncatch is class 0xFF / id 0xFFFF / state 0: the whole table in one frame.
    expect(Array.from(mock.written[2].slice(5, 11))).toEqual([0xff, 0xff, 0xff, 0x00, 0x00, 0x00]);
    await link.close();
  });

  it('does not resolve a query from a same-SEQ reply with the wrong selector', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        // A stale VERSION reply on the same SEQ must be ignored; the HEALTH reply wins.
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0])));
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0x0f, 0x00])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const health = await link.queryHealth();
    expect(health.injectionActive).toBe(true);
    await link.close();
  });

  it('handles two concurrent queries without a writer race', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 0) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0])));
      }
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0x01, 0x00])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const [v, h] = await Promise.all([link.queryVersion(), link.queryHealth()]);
    expect(v).toEqual({ protoVer: 1, fwMajor: 2, fwMinor: 3, fwPatch: 4, mac: [0, 0, 0, 0, 0, 0], name: '' });
    expect(h.linkUp).toBe(true);
    await link.close();
  });

  it('rejects a pending query when the link closes', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    const pending = link.queryVersion(5000);
    await link.close();
    await expect(pending).rejects.toThrow();
  });

  // The v3.4.0 developer layer (§3.14): the fire-and-forget writes, TRANSFER's SEQ correlation on its
  // own opcode, and the readbacks.
  it('raw() sends a RAW frame of [ep_num][dir][bytes]', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await link.raw(1, 1, new Uint8Array([1, 0, 5, 0]));   // endpoint 1, dir 1 = IN
    const frame = mock.written[0];
    expect(frame[1]).toBe(FrameType.Raw);
    expect(Array.from(frame.slice(5, 11))).toEqual([1, 1, 1, 0, 5, 0]);
    await link.close();
  });

  it('transfer() correlates TRANSFER_RESP by SEQ on its own opcode', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Transfer) {
        // The request is [ep][setup 8][out..]; echo the SEQ back on TRANSFER_RESP with [ep][status][IN..].
        expect(Array.from(f.payload.slice(0, 9))).toEqual([0, 0x80, 6, 0, 1, 0, 0, 18, 0]);
        mock.push(encode(FrameType.TransferResp, f.seq, new Uint8Array([0, 0x00, 0x12, 0x01, 0x10, 0x01])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const r = await link.transfer(0, 0x80, 6, 0x0100, 0, 18);
    expect(r.status).toBe(TransferStatus.Ok);
    expect(Array.from(r.data)).toEqual([0x12, 0x01, 0x10, 0x01]);
    await link.close();
  });

  it('transfer() rejects when the device never answers', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await expect(link.transfer(0, 0x80, 6, 0x0100, 0, 18, new Uint8Array(0), 20)).rejects.toThrow();
    await link.close();
  });

  it('setRewrite() and clearRewrite() send REWRITE frames', async () => {
    const mock = new MockSerialPort();
    const link = new SerialLink(asPort(mock));
    await link.open();
    await link.setRewrite({
      cls: CatchClass.Control,
      id: 0,
      dir: Direction.Both,
      action: RewriteAction.Patch,
      off: 2,
      match: new Uint8Array([0x21, 0x09]),
      mask: new Uint8Array([0xff, 0xff]),
      payload: new Uint8Array([0xaa]),
    });
    let frame = mock.written[0];
    expect(frame[1]).toBe(FrameType.Rewrite);
    expect(Array.from(frame.slice(5, 5 + 14))).toEqual([8, 0, 0, 0, 1, 2, 2, 0, 2, 0x21, 0x09, 0xff, 0xff, 0xaa]);
    await link.clearRewrite();
    frame = mock.written[1];
    expect(frame[1]).toBe(FrameType.Rewrite);
    expect(Array.from(frame.slice(5, 5 + 9))).toEqual([0xff, 0xff, 0xff, 0, 0, 0, 0, 0, 0]);
    await link.close();
  });

  it('queryRewrite() decodes RESP(REWRITE)', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 12) {
        mock.push(
          encode(
            FrameType.Resp,
            f.seq,
            new Uint8Array([12, 1, 5, 1, 8, 0, 0, 0, 2, 2, 2, 0, 1, 0, 7, 0]),
          ),
        );
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const t = await link.queryRewrite();
    expect(t.tableFull).toBe(true);
    expect(t.gen).toBe(5);
    expect(t.entries[0]).toMatchObject({ cls: 8, action: RewriteAction.Patch, off: 2, plen: 1, hits: 7 });
    await link.close();
  });

  it('setPatch() and applyPatch() send PATCH frames, and queryPatches() decodes the set', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 14) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([14, 3, 1, 2, 0, 1, 9, 0, 1, 0])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    await link.setPatch(PatchSection.Report, 0, 1, 9, new Uint8Array([0x04]));
    expect(mock.written[0][1]).toBe(FrameType.Patch);
    expect(Array.from(mock.written[0].slice(5, 5 + 6))).toEqual([2, 0, 1, 9, 0, 0x04]);
    await link.applyPatch();
    expect(mock.written[1][1]).toBe(FrameType.Patch);
    expect(mock.written[1][5]).toBe(0xfe);
    const p = await link.queryPatches();
    expect(p).toMatchObject({ applied: true, pending: true, refused: false, tableFull: false });
    expect(p.entries[0]).toMatchObject({ section: PatchSection.Report, offset: 9, len: 1 });
    await link.close();
  });

  it('queryHealth() decodes the u16 flags, including the developer-layer bits', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        // [what=1][flags 0x0301 LE] = link up + rewrite on + patch on.
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0x01, 0x03])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const h = await link.queryHealth();
    expect(h.linkUp).toBe(true);
    expect(h.rewriteOn).toBe(true);
    expect(h.patchOn).toBe(true);
    expect(h.transformOn).toBe(false);
    await link.close();
  });
});
