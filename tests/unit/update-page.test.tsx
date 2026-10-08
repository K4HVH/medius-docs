import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { PROTO_VER } from '../../src/dashboard/protocol';

// The stand-in is built on REAL signals. Plain-object accessors meant the page never observed a
// state change the context made, so mutations that broke whole screens left every test green.
const st = vi.hoisted(() => ({
  make: () => {
    const [status, setStatus] = createSignal<string>('disconnected');
    const [error, setError] = createSignal<string | null>(null);
    const [version, setVersion] = createSignal<{
      protoVer: number;
      fwMajor: number;
      fwMinor: number;
      fwPatch: number;
      mac: number[];
      name: string;
    } | null>(null);
    const [firmwareInfo, setFirmwareInfo] = createSignal<unknown>({
      device: { major: 3, minor: 4, patch: 2, slot: 0, state: 1 },
      host: { major: 3, minor: 4, patch: 2, slot: 0, state: 1 },
      slotSize: 1,
      deviceStaged: false,
      hostStaged: false,
    });
    const [update, setUpdate] = createSignal<{ device: boolean; host: boolean; page: string; outcome: string } | null>(null);
    return {
      status,
      setStatus,
      error,
      setError,
      version,
      setVersion,
      firmwareInfo,
      setFirmwareInfo,
      update,
      setUpdate,
    };
  },
}));

const mock = vi.hoisted(() => ({
  s: null as ReturnType<(typeof st)['make']> | null,
  releasesThrow: false,
  holdReleases: false,
  updates: 0,
  assets: [] as { name: string; size: number; url: string }[],
  outcome: 'verified' as 'verified' | 'sent' | 'failed',
  hold: null as Promise<void> | null,
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    supported: true,
    secure: true,
    status: () => mock.s!.status(),
    verdict: () => null,
    error: () => mock.s!.error(),
    version: () => mock.s!.version(),
    firmwareInfo: () => mock.s!.firmwareInfo(),
    updateProgress: () => null,
    update: () => mock.s!.update(),
    clearUpdate: () => mock.s!.setUpdate(null),
    held: () => true,
    present: () => true,
    connect: async () => {
      mock.s!.setError(null);
      mock.s!.setStatus('connected');
    },
    disconnect: async () => {},
    readFirmwareInfo: async () => null,
    // Mirrors the real one's observable effects, so the page is driven by state transitions rather
    // than by the test asserting an answer it also supplied.
    updateOverControl: async (images: { device?: Uint8Array; host?: Uint8Array }, page: string) => {
      const s = mock.s!;
      const run = { device: images.device !== undefined, host: images.host !== undefined, page };
      mock.updates += 1;
      s.setUpdate({ ...run, outcome: 'running' });
      s.setStatus('flashing');
      if (mock.hold) await mock.hold;
      if (mock.outcome === 'verified') s.setStatus('connected');
      if (mock.outcome === 'sent') {
        s.setError('The update was sent, but the box did not come back. Replug it, then connect.');
        s.setStatus('disconnected');
      }
      if (mock.outcome === 'failed') {
        s.setError('The box refused that.');
        s.setStatus('error');
      }
      s.setUpdate({ ...run, outcome: mock.outcome });
      return mock.outcome;
    },
  }),
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => {
    if (mock.holdReleases) await new Promise(() => {});
    if (mock.releasesThrow) throw new Error('Firmware fetch is not set up on this server.');
    return [{ tag: 'v3.4.2', assets: mock.assets }];
  },
  downloadAsset: async () => new Uint8Array([1]),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: '/dashboard/update', hash: '' }),
  A: (p: { children: unknown }) => p.children,
}));

import Update from '../../src/app/pages/dashboard/Update';

// The box runs the release it is offered: 3.4.2 on the current wire. One that reverts lands on 3.4.1,
// protocol 8.
const ON_RELEASE = { protoVer: PROTO_VER, fwMajor: 3, fwMinor: 4, fwPatch: 2, mac: [], name: '' };
const REVERTED = { protoVer: 8, fwMajor: 3, fwMinor: 4, fwPatch: 1, mac: [], name: '' };

const mount = () => {
  mock.s = st.make();
  mock.s.setVersion(ON_RELEASE);
  return render(() => <Update />);
};

afterEach(() => {
  cleanup();
  mock.releasesThrow = false;
  mock.holdReleases = false;
  mock.updates = 0;
  mock.assets = [];
  mock.outcome = 'verified';
  mock.hold = null;
  navigate.mockClear();
});

const dev = { name: 'medius_device.bin', size: 1, url: 'd' };
const host = { name: 'medius_host.bin', size: 1, url: 'h' };
const reverted = { major: 3, minor: 4, patch: 1, slot: 0, state: 1 };
const onRelease = { major: 3, minor: 4, patch: 2, slot: 0, state: 1 };
const fw = (h: typeof reverted, d = onRelease) => ({
  device: d,
  host: h,
  slotSize: 1,
  deviceStaged: false,
  hostStaged: false,
});

const runUpdate = async (choice: RegExp) => {
  const r = mount();
  mock.s!.setStatus('connected');
  await waitFor(() => r.getByRole('button', { name: choice }));
  r.getByRole('button', { name: choice }).click();
  await waitFor(() => r.getByRole('button', { name: /^update$/i }));
  r.getByRole('button', { name: /^update$/i }).click();
  return r;
};

describe('Update', () => {
  it('no longer installs a new box; that lives in Setup', async () => {
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toMatch(/USB1/));
    expect(container.textContent).not.toMatch(/set up a new box/i);
  });

  it('offers connecting through the shared panel while disconnected', async () => {
    const r = mount();
    await waitFor(() => expect(r.getByRole('button', { name: /^connect$/i })).toBeTruthy());
  });

  it('a release fetch that failed leaves a message, not an Update button that does nothing', async () => {
    mock.releasesThrow = true;
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/no update available right now/i));
    expect(mock.updates).toBe(0);
  });

  it('a release missing the main image points at the choice that works', async () => {
    mock.assets = [host];
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/nothing for the main chip/i));
    expect(r.container.textContent).toMatch(/mouse-side only/i);
    expect(mock.updates).toBe(0);
  });

  it('a release missing the mouse-side image points at the choice that works', async () => {
    mock.assets = [dev];
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/nothing for the mouse-side chip/i));
    expect(r.container.textContent).toMatch(/main only/i);
    expect(mock.updates).toBe(0);
  });

  it('asking for the mouse-side chip is never answered about the main one', async () => {
    mock.assets = [];
    const r = await runUpdate(/mouse-side only/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/no update available right now/i));
    expect(r.container.textContent).not.toMatch(/nothing for the main chip/i);
  });

  it('a single-chip choice a half-published release DOES support just runs', async () => {
    mock.assets = [dev];
    const r = await runUpdate(/main only/i);
    await waitFor(() => expect(mock.updates).toBe(1));
    expect(r.container.textContent).not.toMatch(/nothing for the/i);
  });

  it('the mirror: mouse-side only against a mouse-side-only release runs', async () => {
    mock.assets = [host];
    const r = await runUpdate(/mouse-side only/i);
    await waitFor(() => expect(mock.updates).toBe(1));
    expect(r.container.textContent).not.toMatch(/nothing for the/i);
  });

  it('the Back button the refusal messages name is actually on that screen', async () => {
    mock.assets = [host];
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/press back and choose/i));
    expect(r.getByRole('button', { name: /^back$/i })).toBeTruthy();
  });

  it('both chips landing on the release is what verified means', async () => {
    mock.assets = [dev, host];
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/updated and verified/i));
    expect(r.container.textContent).toMatch(/3\.4\.2/);
  });

  it('the mouse-side chip reverting is not verified, even though the main chip moved', async () => {
    // The device version alone cannot speak for the chip behind the link, and a chip that reverts
    // answers a handshake perfectly well.
    mock.assets = [dev, host];
    const r = await runUpdate(/update both chips/i);
    mock.s!.setFirmwareInfo(fw(reverted));
    await waitFor(() =>
      expect(r.container.textContent).toMatch(/not on the version sent/i),
    );
    expect(r.container.textContent).not.toMatch(/updated and verified/i);
  });

  it('a mouse-side update is judged on the mouse-side chip, not the one it never touched', async () => {
    mock.assets = [host];
    const r = await runUpdate(/mouse-side only/i);
    mock.s!.setFirmwareInfo(fw(reverted));
    await waitFor(() =>
      expect(r.container.textContent).toMatch(/not on the version sent/i),
    );
  });

  it('a main-only update is judged on the main chip, whatever the mouse-side chip runs', async () => {
    mock.assets = [dev];
    const r = await runUpdate(/main only/i);
    mock.s!.setFirmwareInfo(fw(reverted));
    await waitFor(() => expect(r.container.textContent).toMatch(/updated and verified/i));
  });

  it('a box that comes back on the old version is not called updated', async () => {
    mock.assets = [dev, host];
    const r = await runUpdate(/update both chips/i);
    mock.s!.setVersion(REVERTED);
    await waitFor(() =>
      expect(r.container.textContent).toMatch(/not on the version sent/i),
    );
    expect(r.container.textContent).not.toMatch(/updated and verified/i);
  });

  it('a box that never came back is NOT reported as verified on any version', async () => {
    mock.assets = [dev, host];
    mock.outcome = 'sent';
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/box did not come back/i));
    expect(r.container.textContent).not.toMatch(/verified/i);
    expect(r.container.textContent).toMatch(/replug it, then connect/i);
  });

  it('reconnecting after a never-came-back update does not sign off a box that reverted', async () => {
    // "Your box is back on v3.4.1" with a Finish button here would present a failed update as the end
    // of the flow.
    mock.assets = [dev, host];
    mock.outcome = 'sent';
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/box did not come back/i));
    mock.s!.setVersion(REVERTED);
    r.getByRole('button', { name: /^connect$/i }).click();
    await waitFor(() =>
      expect(r.container.textContent).toMatch(/not on the version sent/i),
    );
    expect(r.container.textContent).not.toMatch(/updated and verified/i);
  });

  it('an update that ends while the page is away shows its result when the page comes back', async () => {
    // Switching to another box, or another tab, unmounts this page while the box updates.
    mock.assets = [dev, host];
    let release = () => {};
    mock.hold = new Promise<void>((r) => (release = r));
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/updating/i));
    expect(r.container.textContent).toContain("Don't unplug or close this tab");
    cleanup();
    mock.s!.setFirmwareInfo(fw(onRelease));
    release();
    await waitFor(() => expect(mock.s!.update()?.outcome).toBe('verified'));
    const back = render(() => <Update />);
    await waitFor(() => expect(back.container.textContent).toMatch(/updated and verified/i));
    back.getByRole('button', { name: /finish/i }).click();
    expect(mock.s!.update()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('asks for its runs as the Update page, and shows no result from a flash Advanced ran', async () => {
    mock.assets = [dev, host];
    await runUpdate(/update both chips/i);
    await waitFor(() => expect(mock.s!.update()).toMatchObject({ page: 'update', outcome: 'verified' }));
    cleanup();
    mock.s!.setUpdate({ device: true, host: false, page: 'advanced', outcome: 'verified' });
    const r = render(() => <Update />);
    await waitFor(() => expect(r.getByRole('button', { name: /update both chips/i })).toBeTruthy());
    expect(r.container.textContent).not.toMatch(/verified|came back/i);
  });

  it('Back is a normal secondary button beside the primary, not a tiny one below it', async () => {
    mock.assets = [dev, host];
    const r = mount();
    mock.s!.setStatus('connected');
    await waitFor(() => r.getByRole('button', { name: /update both chips/i }));
    r.getByRole('button', { name: /update both chips/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^back$/i }));
    const back = r.getByRole('button', { name: /^back$/i });
    expect(back.className).toContain('button--secondary');
    expect(back.className).not.toContain('compact');
    // Same row as Update, so it reads as the pair it is.
    const update = r.getByRole('button', { name: /^update$/i });
    expect(back.parentElement).toBe(update.parentElement);
  });

  it('a failed update keeps a way back to the chip choice', async () => {
    mock.assets = [dev, host];
    mock.outcome = 'failed';
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.getByRole('button', { name: /^back$/i })).toBeTruthy());
  });

  it('a failed update says why once, not twice', async () => {
    mock.assets = [dev, host];
    mock.outcome = 'failed';
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/the box refused that/i));
    const alerts = [...r.container.querySelectorAll('[role="alert"]')].filter((a) =>
      /the box refused that/i.test(a.textContent ?? ''),
    );
    expect(alerts).toHaveLength(1);
  });

  it('the Update button waits for the release list instead of claiming there is none', async () => {
    mock.assets = [dev, host];
    mock.holdReleases = true;
    const r = mount();
    mock.s!.setStatus('connected');
    await waitFor(() => r.getByRole('button', { name: /update both chips/i }));
    r.getByRole('button', { name: /update both chips/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^update$/i }));
    expect(r.getByRole('button', { name: /^update$/i })).toBeDisabled();
  });

  it("choosing an update leaves a result Advanced is still showing alone", async () => {
    const r = mount();
    mock.s!.setStatus('connected');
    mock.s!.setUpdate({ device: true, host: false, page: 'advanced', outcome: 'verified' });
    await waitFor(() => r.getByRole('button', { name: /update both chips/i }));
    r.getByRole('button', { name: /update both chips/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^back$/i }));
    r.getByRole('button', { name: /^back$/i }).click();
    expect(mock.s!.update()).toMatchObject({ page: 'advanced', outcome: 'verified' });
  });

  it('a connected box gets the three update choices and nothing about cables', async () => {
    const r = mount();
    mock.s!.setStatus('connected');
    await waitFor(() => r.getByRole('button', { name: /update both chips/i }));
    expect(r.getByRole('button', { name: /main only/i })).toBeTruthy();
    expect(r.getByRole('button', { name: /mouse-side only/i })).toBeTruthy();
    expect(r.container.textContent).not.toMatch(/BOOT|unplug/i);
  });
});
