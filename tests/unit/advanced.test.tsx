import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

// This page had no tests at all, which is how a rejected release fetch froze it and how "Flash
// another" walked straight past the cable gate: both survived three review rounds.
const mock = vi.hoisted(() => ({
  status: 'disconnected' as string,
  releasesThrow: false,
  flashOk: true,
  flashes: 0,
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    supported: true,
    secure: true,
    status: () => mock.status,
    verdict: () => null,
    error: () => null,
    flashProgress: () => null,
    clearFlashResult: () => {},
    flashNative: async () => {
      mock.flashes += 1;
      return mock.flashOk;
    },
  }),
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => {
    if (mock.releasesThrow) throw new Error('Firmware fetch is not set up on this server.');
    return [
      {
        tag: 'v3.2.0',
        assets: [
          { name: 'medius_device-factory.bin', size: 400000, url: 'd' },
          { name: 'medius_host-factory.bin', size: 400000, url: 'h' },
        ],
      },
    ];
  },
  downloadAsset: async () => new Uint8Array([0xe9, 1, 2, 3]),
}));

vi.mock('../../src/dashboard/serial', () => ({
  requestRomPort: async () => ({}) as SerialPort,
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import Advanced from '../../src/app/pages/dashboard/Advanced';

afterEach(() => {
  cleanup();
  mock.status = 'disconnected';
  mock.releasesThrow = false;
  mock.flashOk = true;
  mock.flashes = 0;
  navigate.mockClear();
});

// Walk past the unplug gate to the Flash button.
const openGate = async (r: ReturnType<typeof render>) => {
  await waitFor(() => r.getByRole('button', { name: /unplugged/i }));
  r.getByRole('button', { name: /they're all unplugged/i }).click();
  await waitFor(() => r.getByRole('button', { name: /every cable is unplugged/i }));
  r.getByRole('button', { name: /every cable is unplugged/i }).click();
};

describe('Advanced', () => {
  it('a release fetch that failed leaves the page usable, not frozen', async () => {
    mock.releasesThrow = true;
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toMatch(/could not reach the firmware/i));
    // The crash was in a `disabled=` prop reading the rejected resource, so it only fired once the
    // Flash button rendered: walk all the way to it.
    await openGate(r);
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).toBeTruthy());
  });

  it('both chips pass the cable gate, not just the mouse-side one', async () => {
    const r = render(() => <Advanced />);
    // Default chip is the main one, which used to skip the gate outright.
    await waitFor(() => expect(r.container.textContent).toMatch(/unplug every cable/i));
    expect(r.queryByRole('button', { name: /^flash$/i })).toBeNull();
  });

  it('Flash another re-arms the gate instead of going straight back to Flash', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    await waitFor(() => r.getByRole('button', { name: /^flash$/i }));
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(mock.flashes).toBe(1));
    await waitFor(() => r.getByRole('button', { name: /flash another/i }));
    r.getByRole('button', { name: /flash another/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/unplug every cable/i));
    expect(r.queryByRole('button', { name: /^flash$/i })).toBeNull();
  });

  it('the success screen says to take the cable just used out before plugging anything back', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    await waitFor(() => r.getByRole('button', { name: /^flash$/i }));
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/take the cable you just used out/i));
    expect(r.container.textContent).toMatch(/can kill it/i);
    r.getByRole('button', { name: /go to my box/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('never names one of the two buttons', async () => {
    mock.flashOk = false;
    const r = render(() => <Advanced />);
    await openGate(r);
    await waitFor(() => r.getByRole('button', { name: /^flash$/i }));
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/BOTH/));
    expect(r.container.textContent).not.toMatch(/the BOOT button|left button|right button/i);
  });
});
