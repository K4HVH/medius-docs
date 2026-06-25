import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';

// Mutable mock state so each test can pose a different cloned device.
const mock = vi.hoisted(() => ({
  health: null as unknown,
  caps: null as unknown,
  mouse: null as unknown,
  rate: null as unknown,
  stats: null as unknown,
  imperfect: null as unknown,
}));

vi.mock('../../src/app/pages/dashboard/context', () => {
  // One stable link object — the component bails if dash.link() identity changes between polls.
  const link = {
    queryMouseInfo: async () => mock.mouse,
    queryCaps: async () => mock.caps,
    queryRate: async () => mock.rate,
    queryStats: async () => mock.stats,
    queryImperfect: async () => mock.imperfect,
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      health: () => mock.health,
      link: () => link,
    }),
  };
});

import DeviceInfo from '../../src/app/pages/dashboard/DeviceInfo';

const health = (over: Partial<Record<string, boolean>> = {}) => ({
  linkUp: true, mouseAttached: false, cloneConfigured: true, injectionActive: false,
  rateConfident: false, lockOn: false, catchOn: false, kbdAttached: false, ...over,
});
const rate = { nativePeriodUs: 0, pollPeriodUs: 1000, confident: false, changeDriven: true };
const stats = { injectEmits: 0, txDrops: 0, txMerges: 0, txMaxdepth: 0, txWedges: 0, wakeups: 0, resetCount: 0, configCount: 0 };

afterEach(cleanup);

describe('DeviceInfo — one Capabilities card', () => {
  it('over-capacity keyboard: keyboard caps + a "Full clone: No" row, no prose card', async () => {
    mock.health = health({ kbdAttached: true });
    mock.mouse = { vid: 0x31e3, pid: 0x1232, bcdDevice: 0, bcdUsb: 0x0200, hasSerial: true, hasBos: false };
    mock.caps = {
      mouse: { nButtons: 0, hasX: false, hasY: false, hasWheel: false, hasReportId: false, nHid: 5 },
      keyboard: { nKeys: 0xff, nkro: true, hasConsumer: true, hasSystem: false, hasReportId: true },
      mouseChangeDriven: false, kbdChangeDriven: true,
    };
    mock.rate = rate; mock.stats = stats;
    mock.imperfect = { allowed: false, overCapacity: true, cloneImperfect: false };

    const { findByText, queryByText } = render(() => <DeviceInfo />);
    await findByText('Capabilities');                 // one unified card
    await findByText(/NKRO/);                          // keyboard caps shown on the Device tab
    await findByText(/31E3:1232/);                     // the cloned device's USB id
    await findByText('Full clone');                    // over-capacity as a terse row...
    await findByText(/1 input can't be copied/);       // ...not a prose card
    // the junk I'm killing must be gone:
    expect(queryByText('Not a full copy')).toBeNull();
    expect(queryByText('Your mouse')).toBeNull();
    expect(queryByText('Your keyboard')).toBeNull();
    expect(queryByText(/more separate inputs/)).toBeNull();
  });

  it('plain mouse: Mouse row + "Full clone: Yes", no keyboard row', async () => {
    mock.health = health({ mouseAttached: true });
    mock.mouse = { vid: 0x046d, pid: 0xc08b, bcdDevice: 0, bcdUsb: 0x0200, hasSerial: false, hasBos: false };
    mock.caps = {
      mouse: { nButtons: 5, hasX: true, hasY: true, hasWheel: true, hasReportId: false, nHid: 1 },
      keyboard: { nKeys: 0, nkro: false, hasConsumer: false, hasSystem: false, hasReportId: false },
      mouseChangeDriven: false, kbdChangeDriven: false,
    };
    mock.rate = { ...rate, nativePeriodUs: 1000, changeDriven: false, confident: true };
    mock.stats = stats;
    mock.imperfect = { allowed: false, overCapacity: false, cloneImperfect: false };

    const { findByText, queryByText } = render(() => <DeviceInfo />);
    await findByText(/046D:C08B/);
    await findByText(/5 btn \/ wheel \/ 1 iface/);
    await findByText('Full clone');
    await findByText('Yes');
    expect(queryByText('Keyboard')).toBeNull();
  });
});
