import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

// `updateOverControl` has produced two of this branch's worst defects — claiming a verification that
// never ran, and losing the one instruction that fixes a box that did not come back — and every page
// test stubs it. This drives the real one, with only the serial layer faked.
const mock = vi.hoisted(() => ({
  // Whether the box answers a handshake after the activate. False = it never came back.
  comesBack: true,
  activateThrows: null as Error | null,
  // Full arguments, not just the target: recording the target alone made "the mouse-side image
  // goes first" prove only the order of two numbers, and a wrong-image bug passed.
  staged: [] as { target: number; tag: number }[],
  aborted: [] as { target: number; timeout?: number }[],
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
    async stageFirmware(target: number, image: Uint8Array) {
      mock.staged.push({ target, tag: image[1] });
    }
    async activateFirmware() {
      if (mock.activateThrows) throw mock.activateThrows;
    }
    async abortUpdate(target: number, timeout?: number) {
      mock.aborted.push({ target, timeout });
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

// The second byte tags which image this is, so the fake can prove WHICH bytes went where.
const DEVICE_TAG = 0xd0;
const HOST_TAG = 0xa0;
const img = (tag: number) => new Uint8Array([0xe9, tag, 2, 3]);

describe('updateOverControl', () => {
  it('reports verified only when the box actually came back and answered', async () => {
    mountProvider();
    await api.connect();
    await waitFor(() => expect(api.status()).toBe('connected'));
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
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
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('sent');
    expect(api.error()).toMatch(/did not come back on its own/i);
    expect(api.error()).toMatch(/unplug it, plug it back in/i);
    // It must not claim anything about what is running now.
    expect(api.error()).not.toMatch(/installed|verified/i);
    expect(api.status()).toBe('disconnected');
  }, 20000);

  it('only what was actually staged is disarmed', async () => {
    mountProvider();
    await api.connect();
    await waitFor(() => expect(api.status()).toBe('connected'));
    mock.activateThrows = new Error('the box refused');
    await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(mock.aborted.map((a) => a.target)).toEqual([0]);
  });

  it('a refused activate is "failed", and disarms what was staged so the chips cannot diverge', async () => {
    mountProvider();
    await api.connect();
    await waitFor(() => expect(api.status()).toBe('connected'));
    mock.activateThrows = new Error('the box refused');
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG), host: img(HOST_TAG) });
    expect(outcome).toBe('failed');
    // Host first, the order it was staged in, and each on the short timeout: the usual reason for
    // being here is a box that has stopped answering, and two full op timeouts is a frozen minute.
    expect(mock.aborted.map((a) => a.target)).toEqual([1, 0]);
    expect(mock.aborted.every((a) => a.timeout === 3000)).toBe(true);
    expect(api.error()).toBeTruthy();
  });

  it('stages the mouse-side image first, while the chip that relays it is still running its old firmware', async () => {
    mountProvider();
    await api.connect();
    await waitFor(() => expect(api.status()).toBe('connected'));
    await api.updateOverControl({ device: img(DEVICE_TAG), host: img(HOST_TAG) });
    // OTA_TGT_HOST is 1, OTA_TGT_DEVICE is 0 -- and each target must get ITS OWN image.
    expect(mock.staged).toEqual([
      { target: 1, tag: HOST_TAG },
      { target: 0, tag: DEVICE_TAG },
    ]);
  });

  it('refuses with no link rather than pretending', async () => {
    mountProvider();
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('failed');
    expect(api.error()).toMatch(/connect to the box/i);
  });
});
