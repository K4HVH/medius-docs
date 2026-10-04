import { describe, it, expect, vi } from 'vitest';
import {
  BadProtoVerError,
  NoReplyError,
  classifyConnectError,
} from '../../src/dashboard/serial';
import { PROTO_VER, type Version } from '../../src/dashboard/protocol';

// Each protocol with the firmware that reports it: 3.1.0 is protocol 4, 3.4.2 is the current wire,
// and 3.5.0 stands for a later release on the protocol after it.
const FW: Record<number, [number, number, number]> = {
  4: [3, 1, 0],
  [PROTO_VER]: [3, 4, 2],
  [PROTO_VER + 1]: [3, 5, 0],
};
const version = (protoVer: number): Version => ({
  protoVer,
  fwMajor: FW[protoVer][0],
  fwMinor: FW[protoVer][1],
  fwPatch: FW[protoVer][2],
  mac: [0x58, 0x8c, 0x81, 0xdf, 0x1e, 0x28],
  name: 'Medius-1E28',
});
const cancel = () => new DOMException('No port selected', 'NotFoundError');

describe('classifyConnectError', () => {
  it('a refused protocol version is old firmware, and carries the version', () => {
    expect(classifyConnectError(new BadProtoVerError(version(4)))).toEqual({
      kind: 'old-firmware',
      version: version(4),
    });
  });

  it('a refused protocol above the page is new firmware, not old', () => {
    expect(classifyConnectError(new BadProtoVerError(version(PROTO_VER + 1)))).toEqual({
      kind: 'new-firmware',
      version: version(PROTO_VER + 1),
    });
  });

  it('an unanswered handshake is silent', () => {
    expect(classifyConnectError(new NoReplyError())).toEqual({ kind: 'silent' });
  });

  it('a cancelled or empty chooser is no-port', () => {
    expect(classifyConnectError(cancel())).toEqual({ kind: 'no-port' });
  });

  it('a port that will not open is busy, however Web Serial words it', () => {
    expect(classifyConnectError(new Error('Failed to open serial port.'))).toEqual({ kind: 'busy' });
    expect(classifyConnectError(new Error('The port is already open.'))).toEqual({ kind: 'busy' });
    // Keyed on the name, because a browser's DOMException extends Error and its message is the
    // bare text: reading the message alone only worked under the test environment's split realms.
    expect(classifyConnectError(new DOMException('x', 'NetworkError'))).toEqual({ kind: 'busy' });
    expect(classifyConnectError(new DOMException('y', 'InvalidStateError'))).toEqual({ kind: 'busy' });
    expect(classifyConnectError({ name: 'NotFoundError', message: 'nope' })).toEqual({
      kind: 'no-port',
    });
  });

  it('separates a browser that wants another click from a feature the page is not allowed', () => {
    // Transient activation expiring is fixed by pressing the button again; a permissions policy
    // blocking the whole feature is not, and telling someone to click again would be a loop.
    expect(
      classifyConnectError(
        new DOMException('Must be handling a user gesture to show a permission request.', 'SecurityError'),
      ),
    ).toEqual({ kind: 'needs-click' });
    const blocked = classifyConnectError(
      new DOMException("Access to the feature 'serial' is disallowed by permission policy.", 'SecurityError'),
    );
    expect(blocked.kind).toBe('other');
  });

  it('a thrown value with a hostile name getter does not take the attempt down', () => {
    const hostile = {
      get name(): string {
        throw new Error('gotcha');
      },
      message: 'weird',
    };
    expect(() => classifyConnectError(hostile)).not.toThrow();
  });

  it('a failure with nothing to say still says something', () => {
    expect(classifyConnectError(new Error(''))).toEqual({
      kind: 'other',
      message: 'The browser gave no reason',
    });
  });

  it('anything else keeps its own message', () => {
    expect(classifyConnectError(new Error('boom'))).toEqual({ kind: 'other', message: 'boom' });
    expect(classifyConnectError('boom')).toEqual({ kind: 'other', message: 'boom' });
  });
});
