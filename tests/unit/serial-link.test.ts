import { describe, it, expect } from 'vitest';
import {
  BadProtoVerError,
  QueryTimeoutError,
  SerialLink,
} from '../../src/dashboard/serial';
import { FrameDecoder, FrameType, encode } from '../../src/dashboard/protocol';

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
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 2, 0, 1, 0])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const version = await link.handshake();
    expect(version).toEqual({ protoVer: 2, fwMajor: 0, fwMinor: 1, fwPatch: 0 });
    await link.close();
  });

  it('queries health and decodes the flag bits', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0x03])));
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
    });
    await link.close();
  });

  it('decodes the kbd_att bit (all eight flags set)', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0xff])));
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

  it('rejects with BadProtoVerError on a mismatched protocol version', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 0) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 9, 9, 9, 9])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    await expect(link.handshake()).rejects.toBeInstanceOf(BadProtoVerError);
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
    mock.push(encode(FrameType.Resp, 0, new Uint8Array([0, 1, 0, 1, 0])));
    await new Promise((r) => setTimeout(r, 10));
    expect(hello).toEqual({ protoVer: 1, fwMajor: 0, fwMinor: 1, fwPatch: 0 });
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
    // A mouse, keyboard, then media snapshot.
    mock.push(encode(FrameType.MouseEvent, 10, new Uint8Array([0x01, 1, 0, 0, 0, 0, 0])));
    mock.push(encode(FrameType.KbEvent, 11, new Uint8Array([0x02, 1, 0x04])));
    mock.push(encode(FrameType.ConsEvent, 12, new Uint8Array([1, 0xe9, 0x00])));
    await new Promise((r) => setTimeout(r, 10));
    expect(events).toEqual([
      { kind: 'mouse', seq: 10 },
      { kind: 'keyboard', seq: 11 },
      { kind: 'media', seq: 12 },
    ]);
    await link.close();
  });

  it('does not resolve a query from a same-SEQ reply with the wrong selector', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        // A stale VERSION reply on the same SEQ must be ignored; the HEALTH reply wins.
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 1, 0, 1, 0])));
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0x0f])));
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
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 1, 2, 3, 4])));
      }
      if (f.ty === FrameType.Query && f.payload[0] === 1) {
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([1, 0x01])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const [v, h] = await Promise.all([link.queryVersion(), link.queryHealth()]);
    expect(v).toEqual({ protoVer: 1, fwMajor: 2, fwMinor: 3, fwPatch: 4 });
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
});
