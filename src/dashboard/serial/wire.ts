// Which wire a box speaks, apart from the link, so a page can tell without loading it.
import { MIN_PROTO_VER, PROTO_VER } from '../protocol/opcode';
import type { Version } from '../protocol';

/** Whether this page can reach a box at all: from MIN_PROTO_VER on, the update path is fixed (§2.3). */
export function canUpdate(version: Version): boolean {
  return version.protoVer >= MIN_PROTO_VER;
}

/** Whether a box speaks the current wire, or only enough of it to be updated. */
export function speaksCurrentWire(version: Version): boolean {
  return version.protoVer === PROTO_VER;
}
