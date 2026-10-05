import { describe, it, expect } from 'vitest';
import { CTRL_BAUDS, SerialLink, UpdateError } from '../../src/dashboard/serial';
import {
  FrameDecoder,
  FrameType,
  MAX_PAYLOAD,
  MIN_PROTO_VER,
  OTA_CHUNK,
  OTA_OP_ABORT,
  OTA_OP_ACTIVATE,
  OTA_OP_BEGIN,
  OTA_OP_DATA,
  OTA_OP_END,
  OTA_TGT_DEVICE,
  OTA_TGT_HOST,
  Q_FIRMWARE,
  Q_VERSION,
  RESP_FIRMWARE_LEN,
  SOF,
  UPD_ACK,
  UPD_NAMES,
  UPD_OK,
  UPD_READY,
  UPD_RESP_LEN,
  UPD_STAGED,
  encode,
  parseResp,
} from '../../src/dashboard/protocol';

// This page's half of the update path that keeps its shape from protocol 5 on (control-protocol.md
// §2.3; the firmware's half is tests/host/test_update_wire.c). Every published dashboard updates boxes
// newer than itself through these.

type PortArg = ConstructorParameters<typeof SerialLink>[0];

class MockSerialPort {
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  readable = new ReadableStream<Uint8Array>({ start: (c) => (this.controller = c) });
  writable = new WritableStream<Uint8Array>({ write: (chunk) => this.dec.feed(chunk, (f) => this.responder?.(f)) });
  responder: ((f: { ty: FrameType; seq: number; payload: Uint8Array }) => void) | null = null;
  private dec = new FrameDecoder();
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

describe('the stable update path', () => {
  it('frames, rates and the protocol floor', () => {
    expect(SOF).toBe(0xa5);
    expect(MAX_PAYLOAD).toBe(512);
    expect([...CTRL_BAUDS]).toEqual([6_000_000, 4_000_000]);
    expect(MIN_PROTO_VER).toBe(5);
  });

  it('opcodes and selectors', () => {
    expect(FrameType.Query).toBe(0x05);
    expect(FrameType.Resp).toBe(0x06);
    expect(FrameType.Update).toBe(0x17);
    expect(FrameType.UpdateResp).toBe(0x18);
    expect(Q_VERSION).toBe(0);
    expect(Q_FIRMWARE).toBe(11);
  });

  it('UPDATE ops, targets, chunk, reply length and statuses', () => {
    expect([OTA_OP_BEGIN, OTA_OP_DATA, OTA_OP_END, OTA_OP_ABORT, OTA_OP_ACTIVATE]).toEqual([0, 1, 2, 3, 4]);
    expect([OTA_TGT_DEVICE, OTA_TGT_HOST]).toEqual([0, 1]);
    expect(OTA_CHUNK).toBe(504);
    expect(UPD_RESP_LEN).toBe(7);
    expect(RESP_FIRMWARE_LEN).toBe(17);
    expect([UPD_OK, UPD_READY, UPD_ACK, UPD_STAGED]).toEqual([0, 1, 2, 3]);
    expect(Object.keys(UPD_NAMES).map(Number)).toEqual([
      0x00, 0x01, 0x02, 0x03, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c,
    ]);
  });

  it('reads a version reply from a later protocol the same way', () => {
    const name = new TextEncoder().encode('Desk');
    const r = parseResp(new Uint8Array([Q_VERSION, 42, 4, 0, 1, 0x58, 0x8c, 0x81, 0xe0, 0x82, 0x44, ...name]));
    expect(r).toEqual({
      kind: 'version',
      version: { protoVer: 42, fwMajor: 4, fwMinor: 0, fwPatch: 1, mac: [0x58, 0x8c, 0x81, 0xe0, 0x82, 0x44], name: 'Desk' },
    });
  });

  it('reads the 17 bytes of a firmware reply, whatever follows them', () => {
    const body = [Q_FIRMWARE, 4, 0, 1, 1, 2, 1, 4, 0, 1, 0, 1, 0x00, 0x00, 0x0f, 0x00, 0x02];
    const want = {
      kind: 'firmware',
      firmware: {
        device: { major: 4, minor: 0, patch: 1, slot: 1, state: 2 },
        host: { major: 4, minor: 0, patch: 1, slot: 0, state: 1 },
        slotSize: 0xf0000,
        deviceStaged: false,
        hostStaged: true,
      },
    };
    expect(parseResp(new Uint8Array(body))).toEqual(want);
    expect(parseResp(new Uint8Array([...body, 9, 9, 9]))).toEqual(want);
  });

  it('stages an image the way every box from protocol 5 takes it', async () => {
    // A box asking for 3 chunks a window, as a relayed target may: the page must read the credit, not
    // assume 16.
    const mock = new MockSerialPort();
    const data: { seq: number; len: number; target: number }[] = [];
    const ops: number[] = [];
    let since = 0;
    let next = 0;
    const image = new Uint8Array(OTA_CHUNK * 7 + 100).map((_, i) => i & 0xff);
    const resp = (seq: number, op: number, target: number, status: number, arg: number) =>
      mock.push(
        encode(FrameType.UpdateResp, seq, new Uint8Array([op, target, status, arg & 0xff, (arg >> 8) & 0xff, (arg >> 16) & 0xff, arg >>> 24])),
      );
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === Q_FIRMWARE) {
        const chip = [3, 4, 4, 0, 2];
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([Q_FIRMWARE, ...chip, 1, ...chip, 0x00, 0x00, 0x0f, 0x00, 0])));
        return;
      }
      if (f.ty !== FrameType.Update) return;
      const [op, target] = f.payload;
      ops.push(op);
      if (op === OTA_OP_BEGIN) {
        expect(f.payload.length).toBe(2 + 36);
        expect(new DataView(f.payload.buffer, f.payload.byteOffset).getUint32(2, true)).toBe(image.length);
        resp(f.seq, op, target, UPD_READY, 3);
      } else if (op === OTA_OP_DATA) {
        const seq = f.payload[2] | (f.payload[3] << 8);
        expect(seq).toBe(next);
        const bytes = f.payload.subarray(4);
        expect([...bytes]).toEqual([...image.subarray(seq * OTA_CHUNK, seq * OTA_CHUNK + bytes.length)]);
        data.push({ seq, len: bytes.length, target });
        next++;
        if (++since === 3 || next * OTA_CHUNK >= image.length) {
          since = 0;
          resp(0, op, target, UPD_ACK, next);
        }
      } else if (op === OTA_OP_END) resp(f.seq, op, target, UPD_STAGED, image.length);
    };
    const link = new SerialLink(mock as unknown as PortArg);
    await link.open();
    await link.stageFirmware(OTA_TGT_HOST, image);
    expect(ops[0]).toBe(OTA_OP_BEGIN);
    expect(ops.at(-1)).toBe(OTA_OP_END);
    expect(data.map((d) => d.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(data.every((d) => d.target === OTA_TGT_HOST)).toBe(true);
    expect(data.map((d) => d.len)).toEqual([504, 504, 504, 504, 504, 504, 504, 100]);
    await link.close();
  });

  it("says what an out-of-order refusal's arg is, whichever it carries", () => {
    expect(new UpdateError(OTA_OP_DATA, 0x1a, OTA_OP_BEGIN).message).toContain('The box wanted op 0.');
    // A chunk of the wrong length carries 504, a short END the bytes still missing: neither is an op.
    expect(new UpdateError(OTA_OP_DATA, 0x1a, 504).message).not.toContain('op 504');
    expect(new UpdateError(OTA_OP_END, 0x1a, 1200).message).not.toContain('op 1200');
  });

  it('a write to a port that went away leaves no reply wait behind to time out unheard', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (r: unknown) => unhandled.push(r);
    process.on('unhandledRejection', onUnhandled);
    try {
      const mock = new MockSerialPort();
      mock.writable = new WritableStream<Uint8Array>({
        write: () => {
          throw new DOMException('The device has been lost.', 'NetworkError');
        },
      });
      const link = new SerialLink(mock as unknown as PortArg);
      await link.open();
      await expect(link.abortUpdate(OTA_TGT_DEVICE, 50)).rejects.toBeTruthy();
      await new Promise((r) => setTimeout(r, 150));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('a session a dropped client left open on the box is aborted, and the transfer starts again', async () => {
    // Only one client holds the port, so BUSY at our own BEGIN is a session nobody will finish.
    const mock = new MockSerialPort();
    const ops: number[] = [];
    let busy = true;
    const image = new Uint8Array(100).fill(7);
    const resp = (seq: number, op: number, target: number, status: number, arg: number) =>
      mock.push(encode(FrameType.UpdateResp, seq, new Uint8Array([op, target, status, arg & 0xff, (arg >> 8) & 0xff, 0, 0])));
    mock.responder = (f) => {
      if (f.ty === FrameType.Query && f.payload[0] === Q_FIRMWARE) {
        const chip = [3, 4, 4, 0, 2];
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([Q_FIRMWARE, ...chip, 1, ...chip, 0x00, 0x00, 0x0f, 0x00, 0])));
        return;
      }
      if (f.ty !== FrameType.Update) return;
      const [op, target] = f.payload;
      ops.push(op);
      if (op === OTA_OP_BEGIN) resp(f.seq, op, target, busy ? 0x10 : UPD_READY, busy ? 0 : 16);
      else if (op === OTA_OP_ABORT) {
        busy = false;
        resp(f.seq, op, target, UPD_OK, 0);
      } else if (op === OTA_OP_DATA) resp(0, op, target, UPD_ACK, 1);
      else if (op === OTA_OP_END) resp(f.seq, op, target, UPD_STAGED, image.length);
    };
    const link = new SerialLink(mock as unknown as PortArg);
    await link.open();
    await link.stageFirmware(OTA_TGT_DEVICE, image);
    expect(ops).toEqual([OTA_OP_BEGIN, OTA_OP_ABORT, OTA_OP_BEGIN, OTA_OP_DATA, OTA_OP_END]);
    await link.close();
  });

  it('reads a status it does not know as a refusal', async () => {
    const mock = new MockSerialPort();
    mock.responder = (f) => {
      // Both chips confirmed, so staging goes on to BEGIN.
      if (f.ty === FrameType.Query && f.payload[0] === Q_FIRMWARE) {
        const chip = [3, 4, 4, 0, 2];
        mock.push(encode(FrameType.Resp, f.seq, new Uint8Array([Q_FIRMWARE, ...chip, 1, ...chip, 0x00, 0x00, 0x0f, 0x00, 0])));
      }
      if (f.ty === FrameType.Update && f.payload[0] === OTA_OP_BEGIN) {
        mock.push(encode(FrameType.UpdateResp, f.seq, new Uint8Array([OTA_OP_BEGIN, OTA_TGT_DEVICE, 0x1d, 0, 0, 0, 0])));
      }
    };
    const link = new SerialLink(mock as unknown as PortArg);
    await link.open();
    const err = await link.stageFirmware(OTA_TGT_DEVICE, new Uint8Array(2048)).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(UpdateError);
    expect((err as UpdateError).status).toBe(0x1d);
    await link.close();
  });
});
