import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

const mock = vi.hoisted(() => ({
  status: 'disconnected' as string,
  releasesThrow: false,
  updates: 0,
  assets: [] as { name: string; size: number; url: string }[],
  outcome: 'verified' as 'verified' | 'sent' | 'failed',
  holdReleases: false,
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    supported: true,
    secure: true,
    status: () => mock.status,
    verdict: () => null,
    error: () => null,
    version: () => ({ protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' }),
    flashProgress: () => null,
    connect: async () => {},
    disconnect: async () => {},
    clearFlashResult: () => {},
    readFirmwareInfo: async () => null,
    updateOverControl: async () => {
      mock.updates += 1;
      return mock.outcome;
    },
  }),
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => {
    if (mock.holdReleases) await new Promise(() => {});
    if (mock.releasesThrow) throw new Error('Firmware fetch is not set up on this server.');
    return [{ tag: 'v3.2.0', assets: mock.assets }];
  },
  downloadAsset: async () => new Uint8Array([1]),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import Update from '../../src/app/pages/dashboard/Update';

afterEach(() => {
  cleanup();
  mock.status = 'disconnected';
  mock.releasesThrow = false;
  mock.updates = 0;
  mock.assets = [];
  mock.outcome = 'verified';
  mock.holdReleases = false;
  navigate.mockClear();
});

describe('Update', () => {
  it('no longer installs a new box; that lives in Setup', async () => {
    const { container } = render(() => <Update />);
    await waitFor(() => expect(container.textContent).toMatch(/plug in like this/i));
    expect(container.textContent).not.toMatch(/set up a new box/i);
    expect(container.textContent).not.toMatch(/step 1 of 2|step 2 of 2/i);
  });

  it('offers connecting through the shared panel while disconnected', async () => {
    const { getByRole } = render(() => <Update />);
    await waitFor(() => expect(getByRole('button', { name: /^connect$/i })).toBeTruthy());
  });

  it('a release fetch that failed leaves a message, not an Update button that does nothing', async () => {
    // The asset reads sat before the try, so a rejected resource threw straight past the button and
    // the click did nothing at all, silently.
    mock.status = 'connected';
    mock.releasesThrow = true;
    const r = render(() => <Update />);
    await waitFor(() => r.getByRole('button', { name: /update both chips/i }));
    r.getByRole('button', { name: /update both chips/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^update$/i }));
    r.getByRole('button', { name: /^update$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/no update available right now/i));
    expect(mock.updates).toBe(0);
  });

  // A release can be half-published, and the message has to name the chip the user asked about.
  const runUpdate = async (choice: RegExp) => {
    mock.status = 'connected';
    const r = render(() => <Update />);
    await waitFor(() => r.getByRole('button', { name: choice }));
    r.getByRole('button', { name: choice }).click();
    await waitFor(() => r.getByRole('button', { name: /^update$/i }));
    r.getByRole('button', { name: /^update$/i }).click();
    return r;
  };
  const dev = { name: 'medius_device.bin', size: 1, url: 'd' };
  const host = { name: 'medius_host.bin', size: 1, url: 'h' };

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
    // Both images missing: naming the main chip here answers a question the user did not ask, and
    // points at a button that dead-ends the same way.
    mock.assets = [];
  mock.outcome = 'verified';
  mock.holdReleases = false;
    const r = await runUpdate(/mouse-side only/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/no update available right now/i));
    expect(r.container.textContent).not.toMatch(/nothing for the main chip/i);
    expect(mock.updates).toBe(0);
  });

  it('a single-chip choice a half-published release DOES support just runs', async () => {
    // The `want*` half of each guard: main-only against a main-only release must not be refused,
    // and must not be answered about the chip the user did not ask for.
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

  it('a release with both images runs the update and says it was verified', async () => {
    mock.assets = [dev, host];
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(mock.updates).toBe(1));
    await waitFor(() => expect(r.container.textContent).toMatch(/updated and verified/i));
    expect(r.container.textContent).toMatch(/3\.2\.0/);
  });

  it('a box that never came back is NOT reported as verified on any version', async () => {
    // tryReconnect IS the verification. When it fails, the box has reverted whatever would not boot,
    // so naming a version here would assert something nothing checked.
    mock.assets = [dev, host];
    mock.outcome = 'sent';
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/did not come back on its own/i));
    expect(r.container.textContent).not.toMatch(/verified/i);
    expect(r.container.textContent).toMatch(/unplug it, plug it back in/i);
  });

  it('the Update button waits for the release list instead of claiming there is none', async () => {
    mock.assets = [dev, host];
    mock.status = 'connected';
    mock.holdReleases = true;
    const r = render(() => <Update />);
    await waitFor(() => r.getByRole('button', { name: /update both chips/i }));
    r.getByRole('button', { name: /update both chips/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^update$/i }));
    expect(r.getByRole('button', { name: /^update$/i })).toBeDisabled();
  });

  it('a connected box gets the three update choices and nothing about cables', async () => {
    mock.status = 'connected';
    const { getByRole, container } = render(() => <Update />);
    await waitFor(() => getByRole('button', { name: /update both chips/i }));
    expect(getByRole('button', { name: /main only/i })).toBeTruthy();
    expect(getByRole('button', { name: /mouse-side only/i })).toBeTruthy();
    expect(container.textContent).not.toMatch(/BOOT|unplug/i);
  });
});
