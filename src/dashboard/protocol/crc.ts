// CRC16-CCITT-FALSE frame integrity check (poly 0x1021, init 0xFFFF, MSB-first).

export function crc16Ccitt(data: Uint8Array): number {
  let crc = 0xffff;
  for (const b of data) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc & 0xffff;
}
