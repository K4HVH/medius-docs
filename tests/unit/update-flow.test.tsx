import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

// `updateOverControl` has produced two of this branch's worst defects (claiming a verification that
// never ran, and losing the one instruction that fixes a box that did not come back) and every page
// test stubs it. This drives the real one, with only the serial link faked.
const mock = vi.hoisted(() => {
  const VERSION = { protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' };
  return {
    VERSION,
    // Whether the box answers a handshake after the activate. False = it never came back.
    comesBack: true,
    activateThrows: null as Error | null,
    // Full arguments, not just the target: recording the target alone made "the mouse-side image
    // goes first" prove only the order of two numbers, and a wrong-image bug passed.
    staged: [] as { target: number; tag: number }[],
    aborted: [] as { target: number; timeout?: number }[],
    // The box answers only at the rate its firmware runs the control link at.
    baud: 6_000_000,
    version: VERSION as typeof VERSION,
    // What the box runs once an activate that includes the main chip reboots it.
    after: null as { baud: number; version: typeof VERSION } | null,
    opens: [] as number[],
    // Whether the mouse-side chip answered before the update, and how many firmware reads before the
    // activate are lost.
    hostBefore: true,
    preLostFor: 0,
    activated: false,
    // Firmware reads after the activate that report a chip still on probation, or the mouse-side chip absent.
    devicePendingFor: 0,
    hostPendingFor: 0,
    hostSilentFor: 0,
    // The main chip reverts on firmware read `at`: the read before it catches the image already marked
    // invalid, as the firmware does just before it reboots. From `at` it answers nothing for `silent`
    // reads, then runs `version` at `baud`.
    revert: null as { at: number; baud: number; version: typeof VERSION; silent?: number } | null,
    // VERSION replies lost after the activate, and the firmware read from which every one is lost.
    versionLostFor: 0,
    lostFrom: 0,
    // The link fails on this firmware read (`closeAt`), or just after this one answers (`closeAfter`), as
    // on a platform that treats line noise as fatal.
    closeAt: 0,
    closeAfter: 0,
    firmwareQueries: 0,
    onFirmwareQuery: null as (() => void) | null,
  };
});

vi.mock('../../src/dashboard/serial', async () => {
  const link =
    await vi.importActual<typeof import('../../src/dashboard/serial/link')>(
      '../../src/dashboard/serial/link',
    );
  const connect =
    await vi.importActual<typeof import('../../src/dashboard/serial/connect')>(
      '../../src/dashboard/serial/connect',
    );
  const chip = (v: typeof mock.version, state: number) => ({
    major: v.fwMajor,
    minor: v.fwMinor,
    patch: v.fwPatch,
    slot: 0,
    state,
  });
  const info = (v: typeof mock.version, device: number, host: number | null) => ({
    device: chip(v, device),
    host: host === null ? null : chip(v, host),
    slotSize: 983040,
    deviceStaged: false,
    hostStaged: false,
  });
  class FakeLink {
    serialPort = {} as SerialPort;
    private baud = 0;
    constructor(
      _port: unknown,
      private readonly events: { onClose?: (reason?: Error) => void } = {},
    ) {}
    async open(baud: number) {
      this.baud = baud;
      mock.opens.push(baud);
    }
    async close() {}
    async handshake() {
      if (!mock.comesBack || this.baud !== mock.baud) throw new link.NoReplyError();
      return mock.version;
    }
    async queryVersion() {
      if (!mock.comesBack || this.baud !== mock.baud) throw new link.QueryTimeoutError();
      if (mock.activated && mock.versionLostFor > 0) {
        mock.versionLostFor--;
        throw new link.QueryTimeoutError();
      }
      return mock.version;
    }
    async stageFirmware(target: number, image: Uint8Array) {
      mock.staged.push({ target, tag: image[1] });
    }
    async activateFirmware() {
      if (mock.activateThrows) throw mock.activateThrows;
      mock.activated = true;
      // The main chip reboots only when its own image was part of the update.
      if (mock.after && mock.staged.some((s) => s.target === 0)) {
        mock.baud = mock.after.baud;
        mock.version = mock.after.version;
      }
    }
    async abortUpdate(target: number, timeout?: number) {
      mock.aborted.push({ target, timeout });
    }
    async queryFirmware() {
      if (!mock.activated) {
        if (!mock.comesBack || this.baud !== mock.baud) throw new link.QueryTimeoutError();
        if (mock.preLostFor > 0) {
          mock.preLostFor--;
          throw new link.QueryTimeoutError();
        }
        return info(mock.version, 2, mock.hostBefore ? 2 : null);
      }
      mock.firmwareQueries++;
      mock.onFirmwareQuery?.();
      if (mock.lostFrom && mock.firmwareQueries >= mock.lostFrom) throw new link.QueryTimeoutError();
      if (mock.closeAt === mock.firmwareQueries) {
        this.events.onClose?.(new Error('the read failed'));
        throw new link.QueryTimeoutError();
      }
      const r = mock.revert;
      const markedInvalid = r !== null && mock.firmwareQueries === r.at - 1;
      if (r && mock.firmwareQueries >= r.at) {
        if (mock.firmwareQueries < r.at + (r.silent ?? 0)) throw new link.QueryTimeoutError();
        mock.baud = r.baud;
        mock.version = r.version;
        mock.devicePendingFor = 0;
        mock.revert = null;
      }
      if (!mock.comesBack || this.baud !== mock.baud) throw new link.QueryTimeoutError();
      if (mock.closeAfter === mock.firmwareQueries) {
        setTimeout(() => this.events.onClose?.(new Error('the read failed')), 50);
      }
      const devicePending = mock.devicePendingFor > 0;
      if (devicePending) mock.devicePendingFor--;
      const hostPending = mock.hostPendingFor > 0;
      if (hostPending) mock.hostPendingFor--;
      const hostSilent = mock.hostSilentFor > 0;
      if (hostSilent) mock.hostSilentFor--;
      return info(
        mock.version,
        markedInvalid ? 3 : devicePending ? 1 : 2,
        hostSilent ? null : hostPending ? 1 : 2,
      );
    }
    async queryHealth() {
      return null;
    }
  }
  return {
    ...link,
    ...connect,
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
  mock.baud = 6_000_000;
  mock.version = mock.VERSION;
  mock.after = null;
  mock.opens = [];
  mock.hostBefore = true;
  mock.preLostFor = 0;
  mock.activated = false;
  mock.devicePendingFor = 0;
  mock.hostPendingFor = 0;
  mock.hostSilentFor = 0;
  mock.revert = null;
  mock.versionLostFor = 0;
  mock.lostFrom = 0;
  mock.closeAt = 0;
  mock.closeAfter = 0;
  mock.firmwareQueries = 0;
  mock.onFirmwareQuery = null;
});

// The second byte tags which image this is, so the fake can prove WHICH bytes went where.
const DEVICE_TAG = 0xd0;
const HOST_TAG = 0xa0;
const img = (tag: number) => new Uint8Array([0xe9, tag, 2, 3]);

const V3_3_4 = { protoVer: 6, fwMajor: 3, fwMinor: 3, fwPatch: 4, mac: [], name: '' };
const V3_4_0 = { protoVer: 7, fwMajor: 3, fwMinor: 4, fwPatch: 0, mac: [], name: '' };
const V3_4_1 = { protoVer: 8, fwMajor: 3, fwMinor: 4, fwPatch: 1, mac: [], name: '' };

const connected = async () => {
  mountProvider();
  await api.connect();
  await waitFor(() => expect(api.status()).toBe('connected'));
};

// Moves Date.now past the verdict deadline once the given firmware read has happened.
const pastDeadlineAfter = (read: number) => {
  const realNow = Date.now.bind(Date);
  let skew = 0;
  const now = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + skew);
  mock.onFirmwareQuery = () => {
    if (mock.firmwareQueries === read) skew = 120_000;
  };
  return () => now.mockRestore();
};

describe('updateOverControl', () => {
  it('reports verified only when the box actually came back and answered', async () => {
    await connected();
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(api.error()).toBeNull();
  }, 20000);

  it('a box that never comes back is "sent", and says so in the SHARED error', async () => {
    // Page-local was not enough: navigating to another tab destroyed the only instruction that
    // fixes it, and the next connect failure then gave advice about a cable that was already in.
    await connected();
    await api.readFirmwareInfo();
    expect(api.firmwareInfo()).not.toBeNull();
    mock.comesBack = false;
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('sent');
    expect(api.error()).toMatch(/did not come back on its own/i);
    expect(api.error()).toMatch(/unplug it, plug it back in/i);
    // It must not claim anything about what is running now, nor leave the old firmware read to compare.
    expect(api.error()).not.toMatch(/installed|verified/i);
    expect(api.firmwareInfo()).toBeNull();
    expect(api.status()).toBe('disconnected');
  }, 20000);

  it('only what was actually staged is disarmed', async () => {
    await connected();
    mock.activateThrows = new Error('the box refused');
    await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(mock.aborted.map((a) => a.target)).toEqual([0]);
  });

  it('a refused activate is "failed", and disarms what was staged so the chips cannot diverge', async () => {
    await connected();
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
    await connected();
    await api.updateOverControl({ device: img(DEVICE_TAG), host: img(HOST_TAG) });
    // OTA_TGT_HOST is 1, OTA_TGT_DEVICE is 0, and each target must get ITS OWN image.
    expect(mock.staged).toEqual([
      { target: 1, tag: HOST_TAG },
      { target: 0, tag: DEVICE_TAG },
    ]);
  }, 20000);

  it('refuses with no link rather than pretending', async () => {
    mountProvider();
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('failed');
    expect(api.error()).toMatch(/connect to the box/i);
  });

  it('waits until the main chip has confirmed the image it booted, still showing the update', async () => {
    await connected();
    const statuses: string[] = [];
    mock.onFirmwareQuery = () => statuses.push(api.status());
    mock.devicePendingFor = 3;
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.firmwareQueries).toBe(4);
    expect(statuses).toEqual(['flashing', 'flashing', 'flashing', 'flashing']);
    expect(api.status()).toBe('connected');
  }, 20000);

  it('waits for a mouse-side chip that reports late', async () => {
    await connected();
    mock.hostSilentFor = 3;
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG), host: img(HOST_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.firmwareQueries).toBe(4);
    const info = api.firmwareInfo();
    expect(info).not.toBeNull();
    expect(info!.host).not.toBeNull();
  }, 20000);

  it('waits for a mouse-side chip still on probation', async () => {
    await connected();
    mock.hostPendingFor = 3;
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG), host: img(HOST_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.firmwareQueries).toBe(4);
  }, 20000);

  it('a mouse-side only update is verified on the mouse-side chip', async () => {
    await connected();
    mock.hostPendingFor = 2;
    mock.opens = [];
    const outcome = await api.updateOverControl({ host: img(HOST_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.firmwareQueries).toBe(3);
    expect(mock.opens).toEqual([6_000_000]);
  }, 20000);

  it('waits for a mouse-side chip that was there before, even when only the main chip was sent', async () => {
    await connected();
    mock.hostSilentFor = 3;
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.firmwareQueries).toBe(4);
  }, 20000);

  it('one lost reply before the activate does not hide a mouse-side chip that was there', async () => {
    await connected();
    mock.preLostFor = 1;
    mock.hostSilentFor = 3;
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.firmwareQueries).toBe(4);
  }, 20000);

  it('does not wait on a mouse-side chip that was not there before the update', async () => {
    await connected();
    mock.hostBefore = false;
    mock.hostSilentFor = 100;
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.firmwareQueries).toBe(1);
  }, 20000);

  it('no verdict by the deadline is not a verification', async () => {
    await connected();
    const restore = pastDeadlineAfter(2);
    try {
      mock.devicePendingFor = 1000;
      const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
      expect(outcome).toBe('sent');
      expect(api.error()).toMatch(/did not come back on its own/i);
      expect(api.status()).toBe('disconnected');
      expect(api.link()).toBeNull();
      expect(api.version()).toBeNull();
      expect(api.firmwareInfo()).toBeNull();
    } finally {
      restore();
    }
  }, 20000);

  it('a main chip that came back without its mouse-side chip says which chip is missing', async () => {
    await connected();
    const restore = pastDeadlineAfter(2);
    try {
      mock.hostSilentFor = 1000;
      const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
      expect(outcome).toBe('sent');
      expect(api.error()).toMatch(/mouse-side chip/i);
      expect(api.error()).not.toMatch(/did not come back on its own/i);
      expect(api.status()).toBe('disconnected');
    } finally {
      restore();
    }
  }, 20000);

  it('a lost read at the deadline still names the mouse-side chip once the main chip was seen decided', async () => {
    await connected();
    const restore = pastDeadlineAfter(2);
    try {
      mock.hostSilentFor = 1000;
      mock.lostFrom = 2;
      const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
      expect(outcome).toBe('sent');
      expect(api.error()).toMatch(/mouse-side chip/i);
      expect(api.error()).not.toMatch(/did not come back on its own/i);
    } finally {
      restore();
    }
  }, 20000);

  it('reports what the main chip runs after it reverts on the same rate, not what the handshake said', async () => {
    mock.version = V3_4_0;
    await connected();
    mock.after = { baud: 6_000_000, version: V3_4_1 };
    mock.devicePendingFor = 5;
    mock.revert = { at: 4, baud: 6_000_000, version: V3_4_0 };
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(api.version()).toEqual(V3_4_0);
    expect(api.updateOnly()).toBe(true);
  }, 20000);

  it('a 3.4.0 box on protocol 7 connects for updating, and the 3.4.1 it updates to opens the rest', async () => {
    mock.version = V3_4_0;
    await connected();
    expect(api.updateOnly()).toBe(true);
    mock.after = { baud: 6_000_000, version: V3_4_1 };
    mock.opens = [];
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG), host: img(HOST_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.opens).toEqual([6_000_000]);
    expect(api.version()).toEqual(V3_4_1);
    expect(api.updateOnly()).toBe(false);
  }, 20000);

  it('still reports what runs after a same-rate revert when the version replies are lost', async () => {
    mock.version = V3_4_0;
    await connected();
    mock.after = { baud: 6_000_000, version: V3_4_1 };
    mock.devicePendingFor = 5;
    mock.revert = { at: 4, baud: 6_000_000, version: V3_4_0 };
    mock.versionLostFor = 10;
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(api.version()).toMatchObject({ fwMajor: 3, fwMinor: 4, fwPatch: 0 });
  }, 20000);

  it('reattaches across the silence a same-rate revert leaves', async () => {
    mock.version = V3_4_0;
    await connected();
    mock.after = { baud: 6_000_000, version: V3_4_1 };
    mock.devicePendingFor = 5;
    mock.revert = { at: 4, baud: 6_000_000, version: V3_4_0, silent: 2 };
    mock.opens = [];
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.opens).toEqual([6_000_000, 6_000_000]);
    expect(api.version()).toEqual(V3_4_0);
  }, 20000);

  it('a link that fails during a read of the verdict is reattached, and the update keeps its status', async () => {
    await connected();
    const statuses: string[] = [];
    mock.onFirmwareQuery = () => statuses.push(api.status());
    mock.devicePendingFor = 4;
    mock.closeAt = 2;
    mock.opens = [];
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.opens).toEqual([6_000_000, 6_000_000]);
    expect(statuses.every((s) => s === 'flashing')).toBe(true);
    expect(api.status()).toBe('connected');
  }, 20000);

  it('a link that fails between two reads of the verdict is reattached too', async () => {
    await connected();
    mock.devicePendingFor = 4;
    mock.closeAfter = 2;
    mock.opens = [];
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.opens).toEqual([6_000_000, 6_000_000]);
    expect(api.status()).toBe('connected');
  }, 20000);
});

describe('control link rate', () => {
  it('connects to a box on the previous rate, for updating', async () => {
    mock.baud = 4_000_000;
    mock.version = V3_3_4;
    await connected();
    expect(mock.opens).toEqual([6_000_000, 4_000_000]);
    expect(api.updateOnly()).toBe(true);
  });

  it('verifies a box that updated onto the current rate from the previous one', async () => {
    mock.baud = 4_000_000;
    mock.version = V3_3_4;
    await connected();
    mock.after = { baud: 6_000_000, version: V3_4_1 };
    mock.opens = [];
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG), host: img(HOST_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.opens).toEqual([6_000_000]);
    expect(api.version()).toEqual(V3_4_1);
    expect(api.updateOnly()).toBe(false);
  }, 20000);

  it('reconnects to a box that reverted to firmware on the previous rate', async () => {
    mock.baud = 4_000_000;
    mock.version = V3_3_4;
    await connected();
    mock.after = { baud: 4_000_000, version: V3_3_4 };
    mock.opens = [];
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.opens).toEqual([6_000_000, 4_000_000]);
    // What reverted is visible in the version, which is what the Update page compares.
    expect(api.version()).toEqual(V3_3_4);
    expect(api.error()).toBeNull();
  }, 20000);

  it('finds a main chip again on the previous rate when it reverts after answering on the new one', async () => {
    mock.baud = 4_000_000;
    mock.version = V3_3_4;
    await connected();
    mock.after = { baud: 6_000_000, version: V3_4_0 };
    mock.devicePendingFor = 5;
    mock.revert = { at: 4, baud: 4_000_000, version: V3_3_4 };
    mock.opens = [];
    const outcome = await api.updateOverControl({ device: img(DEVICE_TAG) });
    expect(outcome).toBe('verified');
    expect(mock.opens).toEqual([6_000_000, 6_000_000, 4_000_000]);
    expect(api.version()).toEqual(V3_3_4);
    expect(api.updateOnly()).toBe(true);
  }, 20000);
});
