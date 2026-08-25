import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

const mock = vi.hoisted(() => ({ status: 'disconnected' as string }));

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
    updateOverControl: async () => true,
  }),
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => [{ tag: 'v3.2.0', assets: [] }],
  downloadAsset: async () => new Uint8Array([1]),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import Update from '../../src/app/pages/dashboard/Update';

afterEach(() => {
  cleanup();
  mock.status = 'disconnected';
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

  it('a connected box gets the three update choices and nothing about cables', async () => {
    mock.status = 'connected';
    const { getByRole, container } = render(() => <Update />);
    await waitFor(() => getByRole('button', { name: /update both chips/i }));
    expect(getByRole('button', { name: /main only/i })).toBeTruthy();
    expect(getByRole('button', { name: /mouse-side only/i })).toBeTruthy();
    expect(container.textContent).not.toMatch(/BOOT|unplug/i);
  });
});
