import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

// `updateOverControl` has produced two of this branch's worst defects — claiming a verification that
// never ran, and losing the one instruction that fixes a box that did not come back — and every page
// test stubs it. This drives the real one, with only the serial layer faked.
const mock = vi.hoisted(() => ({
  // Whether the box answers a handshake after the activate. False = it never came back.
  comesBack: true,
  activateThrows: null as Error | null,
  staged: [] as number[],
  aborted: [] as number[],
}));

const version = { protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' };

vi.mock('../../src/dashboard/serial', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/dashboard/serial/connect')>(
      '../../src/dashboard/serial/connect',
    );
  class FakeLink {
    serialPort = {} as SerialPort;
    async open() {}
    async close() {}
    async handshake() {
      if (!mock.comesBack) throw new Error('no reply');
      return version;
    }
    async stageFirmware(target: number) {
      mock.staged.push(target);
    }
    async activateFirmware() {
      if (mock.activateThrows) throw mock.activateThrows;
    }
    async abortUpdate(target: number) {
      mock.aborted.push(target);
    }
    async queryFirmware() {
      return null;
    }
    async queryHealth() {
      return null;
    }
  }
  return {
    ...actual,
    SerialLink: FakeLink,
    isWebSerialSupported: () => true,
    isSecureContextOk: () => true,
    grantedMediusPorts: async () => [{} as SerialPort],
    requestMediusPort: async () => ({}) as SerialPort,
  };
});

import { DashboardProvider, useDashboard } from '../../src/app/pages/dashboard/context';

type Api = ReturnType<typeof useDashboard>;
let api: Api;
const Probe = () => {
  api = useDashboard();
  return null;
};
const mountProvider = () =>
  render(() => (
    <DashboardProvider>
      <Probe />
    </DashboardProvider>
  ));

afterEach(() => {
  cleanup();
  mock.comesBack = true;
  mock.activateThrows = null;
  mock.staged = [];
  mock.aborted = [];
});

const img = () => new Uint8Array([0xe9, 1, 2, 3]);

describe('updateOverControl', () => {
  it('reports verified only when the box actually came back and answered', async () => {
    mountProvider();
    await api.connect();
    await waitFor(() => expect(api.status()).toBe('connected'));
    const outcome = await api.updateOverControl({ device: img() });
    expect(outcome).toBe('verified');
    expect(api.error()).toBeNull();
  });

  it('a box that never comes back is "sent", and says so in the SHARED error', async () => {
    // Page-local was not enough: navigating to another tab destroyed the only instruction that
    // fixes it, and the next connect failure then gave advice about a cable that was already in.
    mountProvider();
    await api.connect();
    await waitFor(() => expect(api.status()).toBe('connected'));
    mock.comesBack = false;
    const outcome = await api.updateOverControl({ device: img() });
    expect(outcome).toBe('sent');
    expect(api.error()).toMatch(/did not come back on its own/i);
    expect(api.error()).toMatch(/unplug it, plug it back in/i);
    // It must not claim anything about what is running now.
    expect(api.error()).not.toMatch(/installed|verified/i);
    expect(api.status()).toBe('disconnected');
  }, 20000);

  it('a refused activate is "failed", and disarms what was staged so the chips cannot diverge', async () => {
    mountProvider();
    await api.connect();
    await waitFor(() => expect(api.status()).toBe('connected'));
    mock.activateThrows = new Error('the box refused');
    const outcome = await api.updateOverControl({ device: img(), host: img() });
    expect(outcome).toBe('failed');
    expect(mock.aborted.length).toBe(2);
    expect(api.error()).toBeTruthy();
  });

  it('stages the mouse-side image first, while the chip that relays it is still running its old firmware', async () => {
    mountProvider();
    await api.connect();
    await waitFor(() => expect(api.status()).toBe('connected'));
    await api.updateOverControl({ device: img(), host: img() });
    // OTA_TGT_HOST is 1, OTA_TGT_DEVICE is 0.
    expect(mock.staged).toEqual([1, 0]);
  });

  it('refuses with no link rather than pretending', async () => {
    mountProvider();
    const outcome = await api.updateOverControl({ device: img() });
    expect(outcome).toBe('failed');
    expect(api.error()).toMatch(/connect to the box/i);
  });
});
