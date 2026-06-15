// Frame encoding and a streaming decoder - the wire packet codec.

import { crc16Ccitt } from './crc';
import { FrameType, MAX_PAYLOAD, SOF, frameTypeFromU8 } from './opcode';

export interface DecodedFrame {
  ty: FrameType;
  seq: number;
  payload: Uint8Array;
}

export class PayloadTooLongError extends Error {
  constructor(readonly len: number) {
    super(`payload too long: ${len} bytes (max ${MAX_PAYLOAD})`);
    this.name = 'PayloadTooLongError';
  }
}

// Encode a frame: [SOF][TYPE][SEQ][LEN_LO][LEN_HI][PAYLOAD..][CRC_LO][CRC_HI].
export function encode(ty: FrameType, seq: number, payload: Uint8Array): Uint8Array {
  if (payload.length > MAX_PAYLOAD) {
    throw new PayloadTooLongError(payload.length);
  }
  const len = payload.length;
  const lenLo = len & 0xff;
  const lenHi = (len >> 8) & 0xff;

  const crcInput = new Uint8Array(4 + len);
  crcInput[0] = ty;
  crcInput[1] = seq;
  crcInput[2] = lenLo;
  crcInput[3] = lenHi;
  crcInput.set(payload, 4);
  const crc = crc16Ccitt(crcInput);

  const frame = new Uint8Array(7 + len);
  frame[0] = SOF;
  frame[1] = ty;
  frame[2] = seq;
  frame[3] = lenLo;
  frame[4] = lenHi;
  frame.set(payload, 5);
  frame[5 + len] = crc & 0xff;
  frame[6 + len] = (crc >> 8) & 0xff;
  return frame;
}

enum State {
  Sof,
  Type,
  Seq,
  LenLo,
  LenHi,
  Payload,
  CrcLo,
  CrcHi,
}

// A streaming frame decoder that invokes a callback per valid, CRC-checked, known-opcode frame.
export class FrameDecoder {
  private state: State = State.Sof;
  private ty = 0;
  private seq = 0;
  private len = 0;
  private buf: number[] = [];
  private crcRx = 0;
  private crcErrors = 0;

  get crcErrorCount(): number {
    return this.crcErrors;
  }

  feed(data: Uint8Array, onFrame: (frame: DecodedFrame) => void): void {
    for (const b of data) {
      this.feedByte(b, onFrame);
    }
  }

  private feedByte(b: number, onFrame: (frame: DecodedFrame) => void): void {
    switch (this.state) {
      case State.Sof:
        if (b === SOF) this.state = State.Type;
        break;
      case State.Type:
        this.ty = b;
        this.state = State.Seq;
        break;
      case State.Seq:
        this.seq = b;
        this.state = State.LenLo;
        break;
      case State.LenLo:
        this.len = b;
        this.state = State.LenHi;
        break;
      case State.LenHi:
        this.len |= b << 8;
        this.buf = [];
        if (this.len > MAX_PAYLOAD) this.state = State.Sof;
        else if (this.len === 0) this.state = State.CrcLo;
        else this.state = State.Payload;
        break;
      case State.Payload:
        this.buf.push(b);
        if (this.buf.length >= this.len) this.state = State.CrcLo;
        break;
      case State.CrcLo:
        this.crcRx = b;
        this.state = State.CrcHi;
        break;
      case State.CrcHi:
        this.crcRx |= b << 8;
        this.finishFrame(onFrame);
        this.state = State.Sof;
        break;
    }
  }

  private finishFrame(onFrame: (frame: DecodedFrame) => void): void {
    const len = this.buf.length;
    const crcInput = new Uint8Array(4 + len);
    crcInput[0] = this.ty;
    crcInput[1] = this.seq;
    crcInput[2] = len & 0xff;
    crcInput[3] = (len >> 8) & 0xff;
    crcInput.set(this.buf, 4);

    if (crc16Ccitt(crcInput) !== this.crcRx) {
      this.crcErrors += 1;
      return;
    }

    const ty = frameTypeFromU8(this.ty);
    if (ty !== null) {
      onFrame({ ty, seq: this.seq, payload: new Uint8Array(this.buf) });
    }
  }
}
