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
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 1, 0, 1, 0])));
      }
    };
    const link = new SerialLink(asPort(mock));
    await link.open();
    const version = await link.handshake();
    expect(version).toEqual({ protoVer: 1, fwMajor: 0, fwMinor: 1, fwPatch: 0 });
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
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([0, 2, 9, 9, 9])));
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
