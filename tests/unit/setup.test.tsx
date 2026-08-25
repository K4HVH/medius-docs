import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

// Real signals, not plain-object accessors: a stub that cannot notify leaves mutations that break
// whole screens green.
const st = vi.hoisted(() => ({
  make: () => {
    const [status, setStatus] = createSignal<string>('disconnected');
    const [error, setError] = createSignal<string | null>(null);
    return { status, setStatus, error, setError };
  },
}));

const mock = vi.hoisted(() => ({
  s: null as ReturnType<(typeof st)['make']> | null,
  supported: true,
  flashOk: true,
  flashError: 'That port is still held by an earlier session.',
  chooserEmpty: false,
  releasesThrow: false,
  disconnects: 0,
  flashed: [] as string[],
  romCalls: 0,
  assets: [
    { name: 'medius_device-factory.bin', size: 1, url: 'd' },
    { name: 'medius_host-factory.bin', size: 1, url: 'h' },
  ] as { name: string; size: number; url: string }[],
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    supported: mock.supported,
    secure: true,
    status: () => mock.s!.status(),
    verdict: () => null,
    error: () => mock.s!.error(),
    version: () => ({ protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' }),
    flashProgress: () => null,
    connect: async () => mock.s!.setStatus('connected'),
    disconnect: async () => {
      mock.disconnects += 1;
      // The real one nulls `error` before its first await, which is what ate the reason.
      mock.s!.setError(null);
    },
    clearFlashResult: () => {},
    flashNative: async (_port: unknown, image: Uint8Array) => {
      mock.flashed.push(new TextDecoder().decode(image));
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
  grantedMediusPorts: async () => [],
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
  return render(() => <Setup />);
};

afterEach(() => {
  cleanup();
  mock.supported = true;
  mock.flashOk = true;
  mock.chooserEmpty = false;
  mock.releasesThrow = false;
  mock.disconnects = 0;
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
    await waitFor(() => expect(r.container.textContent).toMatch(/nothing to install to/i));
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

  it('drops the link after each install, so a stale one cannot answer for the new firmware', async () => {
    await walk();
    await waitFor(() => expect(mock.disconnects).toBe(2));
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
