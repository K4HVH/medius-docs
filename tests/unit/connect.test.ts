import { describe, it, expect, vi } from 'vitest';
import {
  BadProtoVerError,
  NoReplyError,
  type ConnectDeps,
  attemptConnect,
  classifyConnectError,
} from '../../src/dashboard/serial';
import type { Version } from '../../src/dashboard/protocol';

const version = (protoVer: number): Version => ({
  protoVer,
  fwMajor: 3,
  fwMinor: 1,
  fwPatch: 0,
  mac: [0x58, 0x8c, 0x81, 0xdf, 0x1e, 0x28],
  name: 'Medius-1E28',
});
const cancel = () => new DOMException('No port selected', 'NotFoundError');
const port = (tag: string) => ({ tag }) as unknown as SerialPort;

const deps = (over: Partial<ConnectDeps<'L'>> = {}): ConnectDeps<'L'> => ({
  supported: () => true,
  secure: () => true,
  granted: async () => [],
  choose: async () => {
    throw cancel();
  },
  attach: async () => {
    throw new NoReplyError();
  },
  detach: async () => {},
  ...over,
});

describe('classifyConnectError', () => {
  it('a refused protocol version is old firmware, and carries the version', () => {
    expect(classifyConnectError(new BadProtoVerError(version(4)))).toEqual({
      kind: 'old-firmware',
      version: version(4),
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
    expect(classifyConnectError(new DOMException('x', 'NetworkError'))).toEqual({ kind: 'busy' });
  });

  it('anything else keeps its own message', () => {
    expect(classifyConnectError(new Error('boom'))).toEqual({ kind: 'other', message: 'boom' });
    expect(classifyConnectError('boom')).toEqual({ kind: 'other', message: 'boom' });
  });
});

describe('attemptConnect', () => {
  it('refuses before touching a port when the browser cannot reach one', async () => {
    const choose = vi.fn();
    const r = await attemptConnect(deps({ supported: () => false, choose }));
    expect(r).toEqual({ ok: false, verdict: { kind: 'unsupported' } });
    expect(choose).not.toHaveBeenCalled();
  });

  it('refuses an insecure context before touching a port', async () => {
    const choose = vi.fn();
    const r = await attemptConnect(deps({ secure: () => false, choose }));
    expect(r).toEqual({ ok: false, verdict: { kind: 'insecure' } });
    expect(choose).not.toHaveBeenCalled();
  });

  it('opens a port already granted without asking for it again', async () => {
    const p = port('granted');
    const choose = vi.fn();
    const r = await attemptConnect(
      deps({
        granted: async () => [p],
        choose,
        attach: async () => ({ link: 'L', version: version(5) }),
      }),
    );
    expect(r).toEqual({ ok: true, port: p, link: 'L', version: version(5) });
    expect(choose).not.toHaveBeenCalled();
  });

  it('a granted port that will not open falls through to the chooser', async () => {
    const stale = port('stale');
    const picked = port('picked');
    const detach = vi.fn(async () => {});
    const r = await attemptConnect(
      deps({
        granted: async () => [stale],
        choose: async () => picked,
        detach,
        attach: async (p) => {
          if (p === stale) throw new Error('Failed to open serial port.');
          return { link: 'L', version: version(5) };
        },
      }),
    );
    expect(r).toEqual({ ok: true, port: picked, link: 'L', version: version(5) });
    expect(detach).toHaveBeenCalledWith(stale);
  });

  it('a granted port that opens and stays silent is the answer, not a reason to ask again', async () => {
    const choose = vi.fn();
    const r = await attemptConnect(
      deps({
        granted: async () => [port('a')],
        choose,
        attach: async () => {
          throw new NoReplyError();
        },
      }),
    );
    expect(r).toEqual({ ok: false, verdict: { kind: 'silent' } });
    expect(choose).not.toHaveBeenCalled();
  });

  it('tries every granted port before falling through', async () => {
    const a = port('a');
    const b = port('b');
    const r = await attemptConnect(
      deps({
        granted: async () => [a, b],
        attach: async (p) => {
          if (p === a) throw new Error('Failed to open serial port.');
          return { link: 'L', version: version(5) };
        },
      }),
    );
    expect(r).toEqual({ ok: true, port: b, link: 'L', version: version(5) });
  });

  it('an empty chooser is no-port', async () => {
    expect(await attemptConnect(deps())).toEqual({ ok: false, verdict: { kind: 'no-port' } });
  });

  it('a box on an older protocol reports the version that answered', async () => {
    const r = await attemptConnect(
      deps({
        choose: async () => port('p'),
        attach: async () => {
          throw new BadProtoVerError(version(4));
        },
      }),
    );
    expect(r).toEqual({ ok: false, verdict: { kind: 'old-firmware', version: version(4) } });
  });

  it('closes the port it could not use', async () => {
    const p = port('p');
    const detach = vi.fn(async () => {});
    await attemptConnect(deps({ choose: async () => p, detach }));
    expect(detach).toHaveBeenCalledWith(p);
  });
});
