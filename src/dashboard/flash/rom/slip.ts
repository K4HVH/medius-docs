// SLIP, as the ESP32-S3 boot ROM and the flasher stub frame every command and answer: 0xC0 at both ends,
// 0xC0 and 0xDB inside escaped.

const END = 0xc0;
const ESC = 0xdb;
const ESC_END = 0xdc;
const ESC_ESC = 0xdd;

export function slipEncode(frame: Uint8Array): Uint8Array {
  const out: number[] = [END];
  for (const b of frame) {
    if (b === END) out.push(ESC, ESC_END);
    else if (b === ESC) out.push(ESC, ESC_ESC);
    else out.push(b);
  }
  out.push(END);
  return new Uint8Array(out);
}

// Bytes outside a frame (the ROM's boot text) are dropped, and so are empty frames and frames with a
// broken escape.
export class SlipDecoder {
  private inside = false;
  private escaping = false;
  private broken = false;
  private buf: number[] = [];

  push(bytes: Uint8Array): Uint8Array[] {
    const frames: Uint8Array[] = [];
    for (const b of bytes) {
      if (!this.inside) {
        if (b === END) this.start();
        continue;
      }
      if (b === END) {
        const whole = !this.broken && !this.escaping;
        // An END with nothing before it opens the frame instead.
        if (whole && !this.buf.length) continue;
        if (whole) frames.push(new Uint8Array(this.buf));
        this.inside = false;
        continue;
      }
      if (this.broken) continue;
      if (this.escaping) {
        this.escaping = false;
        if (b === ESC_END) this.buf.push(END);
        else if (b === ESC_ESC) this.buf.push(ESC);
        else this.broken = true;
      } else if (b === ESC) {
        this.escaping = true;
      } else {
        this.buf.push(b);
      }
    }
    return frames;
  }

  private start() {
    this.inside = true;
    this.escaping = false;
    this.broken = false;
    this.buf = [];
  }
}
