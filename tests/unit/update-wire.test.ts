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
