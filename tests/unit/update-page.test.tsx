import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

const mock = vi.hoisted(() => ({
  status: 'disconnected' as string,
  releasesThrow: false,
  updates: 0,
  assets: [] as { name: string; size: number; url: string }[],
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
      return true;
    },
  }),
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => {
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
    const r = await runUpdate(/mouse-side only/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/no update available right now/i));
    expect(r.container.textContent).not.toMatch(/nothing for the main chip/i);
    expect(mock.updates).toBe(0);
  });

  it('a release with both images runs the update', async () => {
    mock.assets = [dev, host];
    const r = await runUpdate(/update both chips/i);
    await waitFor(() => expect(mock.updates).toBe(1));
    void r;
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
