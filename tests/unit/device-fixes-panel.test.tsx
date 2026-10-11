import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { DEVICE_KIND_MOUSE, EmitMode, ImageState } from '../../src/dashboard/protocol';

const box = vi.hoisted(() => ({
  state: null as null | {
    imperfect: () => unknown;
    setImperfect: (v: unknown) => void;
    emit: () => unknown;
    device: () => unknown;
    setDevice: (v: unknown) => void;
    version: () => unknown;
    setVersion: (v: unknown) => void;
    link: () => unknown;
    setLink: (v: unknown) => void;
  },
  writes: [] as string[],
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));
vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    poll: (key: string) => () =>
      key === 'imperfect' ? box.state!.imperfect() : key === 'emit' ? box.state!.emit() : key === 'deviceInfo' ? box.state!.device() : null,
    version: () => box.state!.version(),
    link: () => box.state!.link(),
    refreshPoll: () => {},
  }),
}));

import DeviceFixes from '../../src/app/pages/dashboard/DeviceFixes';

const confirmedFirmware = { device: { state: ImageState.Valid }, host: { state: ImageState.Valid } };
const v = (fw: string) => {
  const [fwMajor, fwMinor, fwPatch] = fw.split('.').map(Number);
  return { protoVer: 9, fwMajor, fwMinor, fwPatch, mac: [], name: 'Desk' };
};
const mouse = (vid: number, pid: number) => ({ vid, pid, bcdDevice: 0, bcdUsb: 0x200, hasSerial: false, hasBos: false, kind: DEVICE_KIND_MOUSE, product: 'Mouse' });

const setup = (over: { fw?: string; device?: unknown; imperfect?: unknown; emit?: unknown } = {}) => {
  const [imperfect, setImperfect] = createSignal<unknown>(over.imperfect ?? { allowed: false, overCapacity: true, cloneImperfect: true });
  const [emit] = createSignal<unknown>(over.emit ?? { mode: EmitMode.Learned, fixedHz: 0, resolvedHz: 1000, forceHz: 0, advertisedHz: 0, forceActive: false });
  const [device, setDevice] = createSignal<unknown>(over.device ?? mouse(0, 0));
  const [version, setVersion] = createSignal<unknown>(v(over.fw ?? '3.4.5'));
  const link = {
    queryFirmware: async () => confirmedFirmware,
    queryImperfect: async () => imperfect(),
    queryEmitPace: async () => emit(),
    allowImperfectClones: async () => {
      box.writes.push('allow');
      setImperfect({ allowed: true, overCapacity: true, cloneImperfect: true });
    },
    setEmitPace: async () => {},
  };
  const [current, setLink] = createSignal<unknown>(link);
  box.state = { imperfect, setImperfect, emit, device, setDevice, version, setVersion, link: current, setLink };
};

beforeEach(() => {
  box.writes = [];
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DeviceFixes', () => {
  it('offers nothing for a box with no device and nothing flagged', () => {
    setup({ imperfect: { allowed: false, overCapacity: false, cloneImperfect: false } });
    expect(render(() => <DeviceFixes />).container.querySelector('#device-fix')).toBeNull();
  });

  it('allows imperfect clone for a refused device, and keeps the result up once the offer goes', async () => {
    setup();
    const { container, getByRole } = render(() => <DeviceFixes />);
    expect(container.querySelector('#device-fix h2')!.textContent).toBe('Imperfect clone needed');
    fireEvent.click(getByRole('button', { name: 'Allow imperfect' }));
    await waitFor(() => expect(container.textContent).toContain('Done. Imperfect clone is on'), { timeout: 3000 });
    expect(box.writes).toEqual(['allow']);
    fireEvent.click(getByRole('button', { name: 'Close' }));
    expect(container.querySelector('#device-fix')).toBeNull();
  });

  it('sends a device over capacity on firmware before v3.4.4 to Update, with nothing to allow', () => {
    setup({ fw: '3.4.3' });
    const { container, getByRole, queryByRole } = render(() => <DeviceFixes />);
    expect(container.textContent).toContain('needs v3.4.4 or later');
    expect(queryByRole('button', { name: 'Allow imperfect' })).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Update' }));
    expect(navigate).toHaveBeenCalledWith('/dashboard/update');
  });

  it('names the Logitech mouse by the rate it declares', () => {
    setup({
      device: mouse(0x046d, 0xc547),
      imperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
      emit: { mode: EmitMode.Learned, fixedHz: 0, resolvedHz: 125, forceHz: 0, advertisedHz: 100, forceActive: false },
    });
    const { container, getByRole } = render(() => <DeviceFixes />);
    expect(container.querySelector('#device-fix h2')!.textContent).toBe('Logitech mouse at 100 Hz');
    expect(getByRole('button', { name: 'Force 1000 Hz' })).toBeTruthy();
  });

  it('puts an offer away for that device, across a reload, and offers another device its own', () => {
    setup();
    const first = render(() => <DeviceFixes />);
    fireEvent.click(first.getByRole('button', { name: 'Keep as it is' }));
    expect(first.container.querySelector('#device-fix')).toBeNull();
    cleanup();
    setup();
    expect(render(() => <DeviceFixes />).container.querySelector('#device-fix')).toBeNull();
    cleanup();
    setup({
      device: mouse(0x046d, 0xc547),
      imperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
      emit: { mode: EmitMode.Learned, fixedHz: 0, resolvedHz: 125, forceHz: 0, advertisedHz: 125, forceActive: false },
    });
    expect(render(() => <DeviceFixes />).container.querySelector('#device-fix')).not.toBeNull();
  });

  it('still puts an offer away where the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    setup({ device: mouse(0x1111, 0x2222) });
    const r = render(() => <DeviceFixes />);
    fireEvent.click(r.getByRole('button', { name: 'Keep as it is' }));
    expect(r.container.querySelector('#device-fix')).toBeNull();
  });

  it('says the box is not answering when it is gone as the fix runs, and does not throw', async () => {
    vi.useFakeTimers();
    try {
      setup({ device: mouse(0x3333, 0x4444) });
      box.state!.setLink(null);
      const { container, getByRole } = render(() => <DeviceFixes />);
      fireEvent.click(getByRole('button', { name: 'Allow imperfect' }));
      expect(container.textContent).toContain('Applying...');
      await vi.advanceTimersByTimeAsync(61_000);
      expect(container.textContent).toContain("The box isn't answering.");
    } finally {
      vi.useRealTimers();
    }
  });
});
