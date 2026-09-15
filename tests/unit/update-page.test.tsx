import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

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
    } | null>({ protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' });
    const [firmwareInfo, setFirmwareInfo] = createSignal<unknown>({
      device: { major: 3, minor: 2, patch: 0, slot: 0, state: 1 },
      host: { major: 3, minor: 2, patch: 0, slot: 0, state: 1 },
      slotSize: 1,
      deviceStaged: false,
      hostStaged: false,
    });
    return {
      status,
      setStatus,
      error,
      setError,
      version,
      setVersion,
      firmwareInfo,
      setFirmwareInfo,
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
  tag: 'v3.2.0',
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
    flashProgress: () => null,
    connect: async () => {
      mock.s!.setError(null);
      mock.s!.setStatus('connected');
    },
    disconnect: async () => {},
    clearFlashResult: () => {},
    readFirmwareInfo: async () => mock.s!.firmwareInfo(),
    // Mirrors the real one's observable effects, so the page is driven by state transitions rather
    // than by the test asserting an answer it also supplied.
    updateOverControl: async () => {
      mock.updates += 1;
      if (mock.outcome === 'sent') {
        mock.s!.setError(
          'The update was sent, but the box did not come back on its own. Unplug it, plug it back in, then connect.',
        );
        mock.s!.setStatus('disconnected');
      }
      if (mock.outcome === 'failed') {
        mock.s!.setError('The box refused that.');
        mock.s!.setStatus('error');
      }
      return mock.outcome;
    },
  }),
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => {
    if (mock.holdReleases) await new Promise(() => {});
    if (mock.releasesThrow) throw new Error('Firmware fetch is not set up on this server.');
    return [{ tag: mock.tag, assets: mock.assets }];
  },
  downloadAsset: async () => new Uint8Array([1]),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import Update from '../../src/app/pages/dashboard/Update';

const mount = () => {
  mock.s = st.make();
  return render(() => <Update />);
};

afterEach(() => {
  cleanup();
  mock.releasesThrow = false;
  mock.holdReleases = false;
  mock.updates = 0;
  mock.assets = [];
  mock.outcome = 'verified';
  mock.tag = 'v3.2.0';
  navigate.mockClear();
});

const dev = { name: 'medius_device.bin', size: 1, url: 'd' };
const host = { name: 'medius_host.bin', size: 1, url: 'h' };
const reverted = { major: 3, minor: 1, patch: 0, slot: 0, state: 1 };
const onRelease = { major: 3, minor: 2, patch: 0, slot: 0, state: 1 };
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

  // The chips' link changed rate in 3.4.0, and only a mouse-side chip from 3.4.0 finds the new one.
  const on340 = { major: 3, minor: 4, patch: 0, slot: 0, state: 2 };
  const runUpdateOn = async (choice: RegExp, setup: () => void) => {
    const r = mount();
    setup();
    mock.s!.setStatus('connected');
    await waitFor(() => r.getByRole('button', { name: choice }));
    r.getByRole('button', { name: choice }).click();
    await waitFor(() => r.getByRole('button', { name: /^update$/i }));
    r.getByRole('button', { name: /^update$/i }).click();
    return r;
  };

  it('the main chip alone is refused while the mouse-side chip predates the release that moved their link', async () => {
    mock.assets = [dev, host];
    mock.tag = 'v3.4.0';
    const r = await runUpdate(/main only/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/mouse-side chip needs this update too/i));
    expect(r.container.textContent).toMatch(/choose update both chips/i);
    expect(mock.updates).toBe(0);
  });

  it('a mouse-side chip that does not answer blocks the choices that need it, with one instruction', async () => {
    mock.assets = [dev, host];
    mock.tag = 'v3.4.0';
    for (const choice of [/update both chips/i, /mouse-side only/i, /main only/i]) {
      const r = await runUpdateOn(choice, () => mock.s!.setFirmwareInfo(fw(null as never)));
      await waitFor(
        () => expect(r.container.textContent).toMatch(/mouse-side chip isn't answering/i),
        { timeout: 5000 },
      );
      expect(r.container.textContent).toMatch(/open set up/i);
      cleanup();
    }
    expect(mock.updates).toBe(0);
  }, 20000);

  it('a mouse-side chip that answers a moment late is waited for', async () => {
    mock.assets = [dev, host];
    mock.tag = 'v3.4.1';
    await runUpdateOn(/main only/i, () => {
      mock.s!.setFirmwareInfo(fw(null as never));
      setTimeout(() => mock.s!.setFirmwareInfo(fw(on340)), 700);
    });
    await waitFor(() => expect(mock.updates).toBe(1), { timeout: 5000 });
  });

  it('the mouse-side chip alone onto that release is not refused on an older box', async () => {
    mock.assets = [dev, host];
    mock.tag = 'v3.4.0';
    await runUpdate(/mouse-side only/i);
    await waitFor(() => expect(mock.updates).toBe(1));
  });

  it('a release whose tag carries no version offers nothing', async () => {
    mock.assets = [dev, host];
    mock.tag = 'nightly';
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/no update available right now/i));
    expect(mock.updates).toBe(0);
  });

  it('after an update, a mouse-side chip that stays silent is reported as not answering, not as a revert', async () => {
    mock.assets = [dev, host];
    const r = await runUpdateOn(/main only/i, () => {
      mock.s!.setFirmwareInfo(fw(null as never));
    });
    await waitFor(() => expect(mock.updates).toBe(1), { timeout: 5000 });
    await waitFor(
      () => expect(r.container.textContent).toMatch(/mouse-side chip isn't answering/i),
      { timeout: 9000 },
    );
    expect(r.container.textContent).not.toMatch(/not on the version that was sent/i);
    expect(r.container.textContent).not.toMatch(/updated and verified/i);
  }, 20000);

  it('the main chip alone runs once the mouse-side chip is on that release', async () => {
    mock.assets = [dev, host];
    mock.tag = 'v3.4.1';
    await runUpdateOn(/main only/i, () => mock.s!.setFirmwareInfo(fw(on340)));
    await waitFor(() => expect(mock.updates).toBe(1));
  });

  it('both chips together are not refused on that box', async () => {
    mock.assets = [dev, host];
    mock.tag = 'v3.4.0';
    await runUpdate(/update both chips/i);
    await waitFor(() => expect(mock.updates).toBe(1));
  });

  it('a release that cannot go onto that box offers nothing, rather than two refusals pointing at each other', async () => {
    mock.assets = [dev];
    mock.tag = 'v3.4.0';
    const both = await runUpdate(/update both chips/i);
    await waitFor(() => expect(both.container.textContent).toMatch(/no update available right now/i));
    cleanup();
    const main = await runUpdate(/main only/i);
    await waitFor(() => expect(main.container.textContent).toMatch(/no update available right now/i));
    expect(mock.updates).toBe(0);
  });

  it('going back below that release starts with the main chip', async () => {
    mock.assets = [dev, host];
    mock.tag = 'v3.3.4';
    const newer = () => {
      mock.s!.setVersion({ protoVer: 7, fwMajor: 3, fwMinor: 4, fwPatch: 0, mac: [], name: '' });
      mock.s!.setFirmwareInfo(fw(on340, on340));
    };
    for (const choice of [/update both chips/i, /mouse-side only/i]) {
      const r = await runUpdateOn(choice, newer);
      await waitFor(() => expect(r.container.textContent).toMatch(/update the main chip first/i));
      expect(r.container.textContent).toMatch(/choose main only/i);
      cleanup();
    }
    expect(mock.updates).toBe(0);
    await runUpdateOn(/main only/i, newer);
    await waitFor(() => expect(mock.updates).toBe(1));
  });

  it('both chips landing on the release is what verified means', async () => {
    mock.assets = [dev, host];
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/updated and verified/i));
    expect(r.container.textContent).toMatch(/3\.2\.0/);
  });

  it('the mouse-side chip reverting is not verified, even though the main chip moved', async () => {
    // The device version alone cannot speak for the chip behind the link, and a chip that reverts
    // answers a handshake perfectly well.
    mock.assets = [dev, host];
    const r = await runUpdate(/update both chips/i);
    mock.s!.setFirmwareInfo(fw(reverted));
    await waitFor(() =>
      expect(r.container.textContent).toMatch(/not on the version that was sent/i),
    );
    expect(r.container.textContent).not.toMatch(/updated and verified/i);
  });

  it('a mouse-side update is judged on the mouse-side chip, not the one it never touched', async () => {
    mock.assets = [host];
    const r = await runUpdate(/mouse-side only/i);
    mock.s!.setFirmwareInfo(fw(reverted));
    await waitFor(() =>
      expect(r.container.textContent).toMatch(/not on the version that was sent/i),
    );
  });

  it('a box that comes back on the old version is not called updated', async () => {
    mock.assets = [dev, host];
    const r = await runUpdate(/update both chips/i);
    mock.s!.setVersion({ protoVer: 5, fwMajor: 3, fwMinor: 1, fwPatch: 0, mac: [], name: '' });
    await waitFor(() =>
      expect(r.container.textContent).toMatch(/not on the version that was sent/i),
    );
    expect(r.container.textContent).not.toMatch(/updated and verified/i);
  });

  it('a box that never came back is NOT reported as verified on any version', async () => {
    mock.assets = [dev, host];
    mock.outcome = 'sent';
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/did not come back on its own/i));
    expect(r.container.textContent).not.toMatch(/verified/i);
    expect(r.container.textContent).toMatch(/unplug it, plug it back in/i);
  });

  it('reconnecting after a never-came-back update does not sign off a box that reverted', async () => {
    // This arm used to say "Your box is back on v3.1.0" with a Finish button: the update having
    // failed, presented as the end of the flow.
    mock.assets = [dev, host];
    mock.outcome = 'sent';
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/did not come back on its own/i));
    mock.s!.setVersion({ protoVer: 5, fwMajor: 3, fwMinor: 1, fwPatch: 0, mac: [], name: '' });
    r.getByRole('button', { name: /^connect$/i }).click();
    await waitFor(() =>
      expect(r.container.textContent).toMatch(/not on the version that was sent/i),
    );
    expect(r.container.textContent).not.toMatch(/updated and verified/i);
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

  it('a connected box gets the three update choices and nothing about cables', async () => {
    const r = mount();
    mock.s!.setStatus('connected');
    await waitFor(() => r.getByRole('button', { name: /update both chips/i }));
    expect(r.getByRole('button', { name: /main only/i })).toBeTruthy();
    expect(r.getByRole('button', { name: /mouse-side only/i })).toBeTruthy();
    expect(r.container.textContent).not.toMatch(/BOOT|unplug/i);
  });
});
