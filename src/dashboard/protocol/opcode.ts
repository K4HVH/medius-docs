// Frame opcodes and wire constants, pinned to the medius crate and ctrl_proto.h.

export const SOF = 0xa5;
export const MAX_PAYLOAD = 512;
export const PROTO_VER = 1;

export const Q_VERSION = 0;
export const Q_HEALTH = 1;

export const H_LINK_UP = 0x01;
export const H_MOUSE_ATT = 0x02;
export const H_CLONE_CFG = 0x04;
export const H_INJECT_ON = 0x08;

export enum FrameType {
  Move = 0x01,
  Wheel = 0x02,
  Button = 0x03,
  Reset = 0x04,
  Query = 0x05,
  Resp = 0x06,
  RebootDl = 0x07,
  Log = 0x08,
}

export function frameTypeFromU8(value: number): FrameType | null {
  switch (value) {
    case 0x01:
      return FrameType.Move;
    case 0x02:
      return FrameType.Wheel;
    case 0x03:
      return FrameType.Button;
    case 0x04:
      return FrameType.Reset;
    case 0x05:
      return FrameType.Query;
    case 0x06:
      return FrameType.Resp;
    case 0x07:
      return FrameType.RebootDl;
    case 0x08:
      return FrameType.Log;
    default:
      return null;
  }
}
