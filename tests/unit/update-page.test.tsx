import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

const mock = vi.hoisted(() => ({
  status: 'disconnected' as string,
  releasesThrow: false,
  updates: 0,
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
    return [{ tag: 'v3.2.0', assets: [] }];
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

  it('a connected box gets the three update choices and nothing about cables', async () => {
    mock.status = 'connected';
    const { getByRole, container } = render(() => <Update />);
    await waitFor(() => getByRole('button', { name: /update both chips/i }));
    expect(getByRole('button', { name: /main only/i })).toBeTruthy();
    expect(getByRole('button', { name: /mouse-side only/i })).toBeTruthy();
    expect(container.textContent).not.toMatch(/BOOT|unplug/i);
  });
});
