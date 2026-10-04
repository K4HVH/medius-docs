import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import type { ConnectVerdict } from '../../src/dashboard/serial';

// Real signals, not plain-object accessors: a stub that cannot notify leaves mutations that break
// whole screens green.
const st = vi.hoisted(() => ({
  make: () => {
    const [running, setRunning] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [found, setFound] = createSignal<string>('disconnected');
    return { running, setRunning, error, setError, found, setFound };
  },
}));

const mock = vi.hoisted(() => ({
  s: null as ReturnType<(typeof st)['make']> | null,
  supported: true,
  flashOk: true,
  flashError: 'That port is still held by an earlier session.',
  chooserEmpty: false,
  releasesThrow: false,
  flashed: [] as string[],
  romCalls: 0,
  // Boxes answering on the current wire, as the registry reports them now.
  answering: ['aaaaaaaaaaaa'] as string[],
  befores: [] as string[][],
  disconnects: 0,
  findVerdict: null as ConnectVerdict | null,
  assets: [
    { name: 'medius_device-factory.bin', size: 1, url: 'd' },
    { name: 'medius_host-factory.bin', size: 1, url: 'h' },
  ] as { name: string; size: number; url: string }[],
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useBoxes: () => ({
    supported: mock.supported,
    secure: true,
    snapshot: () => ({ answering: new Set(mock.answering), all: new Set(mock.answering) }),
    // Mirrors the real one: the box that answers now and did not before is selected and connected.
    connectNew: async (before: { answering: ReadonlySet<string> }) => {
      mock.befores.push([...before.answering]);
      if (mock.findVerdict) return mock.findVerdict;
      mock.s!.setFound('connected');
      return null;
    },
    add: async () => ({ ok: false, verdict: { kind: 'no-port' } }),
    selected: () => ({
      key: 'bbbbbbbbbbbb',
      session: {
        status: () => mock.s!.found(),
        disconnect: async () => {
          mock.disconnects += 1;
        },
      },
    }),
  }),
  useNativeFlash: () => ({
    progress: () => null,
    log: () => [],
    error: () => mock.s!.error(),
    running: () => mock.s!.running(),
    clear: () => {},
    flash: async (_port: unknown, image: Uint8Array) => {
      mock.flashed.push(new TextDecoder().decode(image));
      mock.s!.setError(null);
      if (!mock.flashOk) mock.s!.setError(mock.flashError);
      return mock.flashOk;
    },
  }),
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => {
    if (mock.releasesThrow) throw new Error('firmware fetch is not set up on this server');
    return [{ tag: 'v3.2.0', assets: mock.assets }];
  },
  // The stand-in returns the asset's own name, so the image identifies where it came from.
  downloadAsset: async (a: { name: string }) => new TextEncoder().encode(a.name),
}));

vi.mock('../../src/dashboard/serial', () => ({
  requestRomPort: async () => {
    mock.romCalls += 1;
    if (mock.chooserEmpty) throw new DOMException('No port selected', 'NotFoundError');
    return {} as SerialPort;
  },
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import Setup from '../../src/app/pages/dashboard/Setup';

const mount = () => {
  mock.s = st.make();
  mock.s.setFound('disconnected');
  return render(() => <Setup />);
};

afterEach(() => {
  cleanup();
  mock.supported = true;
  mock.flashOk = true;
  mock.chooserEmpty = false;
  mock.releasesThrow = false;
  mock.answering = ['aaaaaaaaaaaa'];
  mock.befores = [];
  mock.disconnects = 0;
  mock.findVerdict = null;
  mock.flashed = [];
  mock.romCalls = 0;
  mock.assets = [
    { name: 'medius_device-factory.bin', size: 1, url: 'd' },
    { name: 'medius_host-factory.bin', size: 1, url: 'h' },
  ];
  navigate.mockClear();
});

const install = (r: ReturnType<typeof render>) =>
  r.getByRole('button', { name: /^install$/i }).click();

// Install the main chip, clear USB1, install the mouse-side chip, clear USB3.
const walk = async () => {
  const r = mount();
  await waitFor(() => r.getByRole('button', { name: /^install$/i }));
  install(r);
  await waitFor(() => r.getByRole('button', { name: /^done$/i }));
  r.getByRole('button', { name: /^done$/i }).click();
  await waitFor(() => r.getByRole('button', { name: /^install$/i }));
  install(r);
  await waitFor(() => r.getByRole('button', { name: /^done$/i }));
  r.getByRole('button', { name: /^done$/i }).click();
  return r;
};

describe('Setup', () => {
  it('starts on the first install, with no questions to answer first', async () => {
    const r = mount();
    await waitFor(() => expect(r.container.textContent).toMatch(/step 1 of 5/i));
    expect(r.getByRole('button', { name: /^install$/i })).toBeTruthy();
  });

  it('names the button by its socket on BOTH install screens, and never names a chip', async () => {
    const r = mount();
    await waitFor(() => expect(r.container.textContent).toMatch(/button next to USB1/i));
    expect(r.container.textContent).not.toMatch(/button next to USB3/i);
    install(r);
    await waitFor(() => r.getByRole('button', { name: /^done$/i }));
    r.getByRole('button', { name: /^done$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/button next to USB3/i));
    expect(r.container.textContent).not.toMatch(/button next to USB1/i);
    expect(r.container.textContent).not.toMatch(/left button|right button|main chip|mouse-side chip/i);
  });

  it('an empty chooser lands on a retry that says what to fix, not on nothing', async () => {
    mock.chooserEmpty = true;
    const r = mount();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    const alert = await r.findByRole('alert');
    expect(alert.textContent).toMatch(/nothing to install to/i);
    expect(alert.textContent).not.toMatch(/button next to/i);
    // The badge is what carries the instruction.
    expect(r.container.textContent).toMatch(/button next to USB1/i);
    expect(mock.flashed).toEqual([]);
  });

  it('keeps the reason a failed flash gave instead of a message that cannot fix it', async () => {
    mock.flashOk = false;
    const r = mount();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    const alert = await r.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toContain('held by an earlier session'));
  });

  it('a flash that fails stays on the same step', async () => {
    mock.flashOk = false;
    const r = mount();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    await r.findByRole('alert');
    expect(r.queryByRole('button', { name: /^done$/i })).toBeNull();
    expect(r.getByRole('button', { name: /^install$/i })).toBeTruthy();
  });

  it('a release with no image never reaches the chooser', async () => {
    mock.assets = [];
    const r = mount();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    await waitFor(() => expect(r.container.textContent).toMatch(/isn't ready/i));
    expect(mock.romCalls).toBe(0);
  });

  it('a release fetch that failed leaves a message, not a button that does nothing', async () => {
    mock.releasesThrow = true;
    const r = mount();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    await waitFor(() => expect(r.container.textContent).toMatch(/isn't ready/i));
    expect(mock.romCalls).toBe(0);
  });

  it('writes the main chip image first and the mouse-side image second, never the other way', async () => {
    await walk();
    await waitFor(() =>
      expect(mock.flashed).toEqual(['medius_device-factory.bin', 'medius_host-factory.bin']),
    );
  });

  it('gates USB3 behind taking USB1 out, and the finish behind taking USB3 out', async () => {
    const r = mount();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    await waitFor(() => expect(r.container.textContent).toMatch(/can kill it/i));
    expect(r.queryByRole('button', { name: /^install$/i })).toBeNull();
    r.getByRole('button', { name: /^done$/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    await waitFor(() => expect(r.container.textContent).toMatch(/step 4 of 5/i));
    expect(r.queryByRole('button', { name: /^connect$/i })).toBeNull();
  });

  it('remembers which boxes answered before the install, and looks for one that answers after', async () => {
    const r = mount();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    await waitFor(() => r.getByRole('button', { name: /^done$/i }));
    // A box that starts answering while the wizard runs is still not one that answered before.
    mock.answering = ['aaaaaaaaaaaa', 'bbbbbbbbbbbb'];
    r.getByRole('button', { name: /^done$/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    install(r);
    await waitFor(() => r.getByRole('button', { name: /^done$/i }));
    r.getByRole('button', { name: /^done$/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^connect$/i }));
    r.getByRole('button', { name: /^connect$/i }).click();
    await waitFor(() => expect(mock.befores).toEqual([['aaaaaaaaaaaa']]));
  });

  it('an install leaves every box this page holds alone', async () => {
    await walk();
    expect(mock.flashed).toHaveLength(2);
    expect(mock.disconnects).toBe(0);
  });

  it('a connect that finds no box says why, and offers it again', async () => {
    mock.findVerdict = { kind: 'silent' };
    const r = await walk();
    await waitFor(() => r.getByRole('button', { name: /^connect$/i }));
    r.getByRole('button', { name: /^connect$/i }).click();
    const alert = await r.findByRole('alert');
    expect(alert.textContent).toMatch(/isn't answering/i);
    expect(r.container.textContent).not.toMatch(/installed\./i);
    expect(r.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('ends on connect, and says so once the box answers', async () => {
    const r = await walk();
    await waitFor(() => r.getByRole('button', { name: /^connect$/i }));
    r.getByRole('button', { name: /^connect$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/installed\./i));
    r.getByRole('button', { name: /finish/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('an unsupported browser gets the reason and no wizard at all', async () => {
    mock.supported = false;
    const r = mount();
    expect(r.container.textContent).toMatch(/Chrome/);
    expect(r.queryByRole('button')).toBeNull();
  });
});
