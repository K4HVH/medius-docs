import { describe, it, expect } from 'vitest';
import { SlipDecoder, slipEncode } from '../../src/dashboard/flash/rom/slip';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('SLIP', () => {
  it('ends a frame with 0xC0 at both ends and escapes 0xC0 and 0xDB inside it', () => {
    expect([...slipEncode(bytes(1, 0xc0, 2, 0xdb, 3))]).toEqual([0xc0, 1, 0xdb, 0xdc, 2, 0xdb, 0xdd, 3, 0xc0]);
  });

  it('decodes what it encodes', () => {
    const frame = bytes(0xc0, 0xdb, 0xdc, 0xdd, 0, 255);
    expect([...new SlipDecoder().push(slipEncode(frame))]).toEqual([frame]);
  });

  it('joins a frame split across reads, escape included, and returns frames that arrive together', () => {
    const d = new SlipDecoder();
    const wire = [...slipEncode(bytes(7, 0xc0, 8)), ...slipEncode(bytes(9))];
    expect(d.push(new Uint8Array(wire.slice(0, 3)))).toEqual([]);
    expect(d.push(new Uint8Array(wire.slice(3)))).toEqual([bytes(7, 0xc0, 8), bytes(9)]);
  });

  it('drops bytes outside a frame, such as the boot text, and empty frames', () => {
    const d = new SlipDecoder();
    const text = new TextEncoder().encode('ESP-ROM:esp32s3-20210327\r\n');
    expect(d.push(new Uint8Array([...text, 0xc0, 0xc0, ...slipEncode(bytes(5))]))).toEqual([bytes(5)]);
  });

  it('ends a frame whose escape an END cuts, and keeps the next frame whole', () => {
    expect(new SlipDecoder().push(bytes(0xc0, 0xdb, 0xc0, 0xc0, 1, 2, 0xc0))).toEqual([bytes(1, 2)]);
  });

  it('drops a frame with a broken escape', () => {
    const d = new SlipDecoder();
    expect(d.push(bytes(0xc0, 1, 0xdb, 0x01, 2, 0xc0, 0xc0, 3, 0xc0))).toEqual([bytes(3)]);
  });
});
