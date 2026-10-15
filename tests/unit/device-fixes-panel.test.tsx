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
      key === 'imperfect'
        ? box.state!.imperfect()
        : key === 'emit'
          ? box.state!.emit()
          : key === 'deviceInfo'
            ? box.state!.device()
            : key === 'rate'
              ? { nativePeriodUs: 8000, pollPeriodUs: 1000, confident: true, changeDriven: false }
              : null,
    version: () => box.state!.version(),
    link: () => box.state!.link(),
    refreshPoll: () => {},
  }),
}));

import DeviceFixes from '../../src/app/pages/dashboard/DeviceFixes';

const confirmedFirmware = { device: { state: ImageState.Valid }, host: { state: ImageState.Valid } };
// Each test a fresh box: a fix's state is kept per box.
let boxes = 0;
const v = (fw: string, mac = [1, 2, 3, 4, 5, ++boxes]) => {
  const [fwMajor, fwMinor, fwPatch] = fw.split('.').map(Number);
  return { protoVer: 9, fwMajor, fwMinor, fwPatch, mac, name: 'Desk' };
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
    queryDeviceInfo: async () => device(),
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
    expect(container.querySelector('#device-fix h2')!.textContent).toBe('Device not cloned');
    fireEvent.click(getByRole('button', { name: 'Allow imperfect' }));
    await waitFor(() => expect(container.textContent).toContain('Done. The device is cloned.'), { timeout: 3000 });
    expect(box.writes).toEqual(['allow']);
    fireEvent.click(getByRole('button', { name: 'Close' }));
    expect(container.querySelector('#device-fix')).toBeNull();
  });

  it('sends a device over capacity on firmware before v3.4.4 to Update, with nothing to allow', () => {
    setup({ fw: '3.4.3' });
    const { container, getByRole, queryByRole } = render(() => <DeviceFixes />);
    expect(container.textContent).toContain('Update first');
    expect(queryByRole('button', { name: 'Allow imperfect' })).toBeNull();
    expect(getByRole('button', { name: 'Allow imperfect anyway' })).toBeTruthy();
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

  it('puts an offer away for that device, across a reload, and still offers the fix to another device', () => {
    setup();
    const first = render(() => <DeviceFixes />);
    fireEvent.click(first.getByRole('button', { name: 'Dismiss' }));
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
    fireEvent.click(r.getByRole('button', { name: 'Dismiss' }));
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

  // A low-speed Logitech: 100 Hz as it is, 62 Hz at most forced.
  const lowSpeed = () => {
    const state = { allowed: false, mode: EmitMode.Learned, fixedHz: 0, forceHz: 0 };
    const emitNow = () => {
      const forced = state.forceHz > 0 && state.allowed;
      return { mode: state.mode, fixedHz: state.fixedHz, resolvedHz: 100, forceHz: state.forceHz, advertisedHz: forced ? 62 : 100, forceActive: forced };
    };
    setup({ device: mouse(0x046d, 0xc018), imperfect: { allowed: false, overCapacity: false, cloneImperfect: false }, emit: emitNow() });
    box.state!.setLink({
      queryFirmware: async () => confirmedFirmware,
      queryImperfect: async () => ({ allowed: state.allowed, overCapacity: false, cloneImperfect: false }),
      queryEmitPace: async () => emitNow(),
      queryDeviceInfo: async () => mouse(0x046d, 0xc018),
      allowImperfectClones: async (a: boolean) => {
        box.writes.push('allow');
        state.allowed = a;
      },
      setEmitPace: async (m: number, r: number, f: number) => {
        box.writes.push(`emit ${m} ${r} ${f}`);
        Object.assign(state, { mode: m, fixedHz: r, forceHz: f });
      },
    });
  };

  it("doesn't offer the Logitech fix again to a mouse it showed can't go faster", async () => {
    lowSpeed();
    const { container, getByRole } = render(() => <DeviceFixes />);
    fireEvent.click(getByRole('button', { name: 'Force 1000 Hz' }));
    await waitFor(() => expect(container.textContent).toContain("can't go faster through the box, so it stays at 100 Hz"), { timeout: 5000 });
    fireEvent.click(getByRole('button', { name: 'Close' }));
    expect(container.querySelector('#device-fix')).toBeNull();
    cleanup();
    lowSpeed();
    expect(render(() => <DeviceFixes />).container.querySelector('#device-fix')).toBeNull();
  });

  // A page opened anew: nothing put away on this visit yet.
  const freshPage = async () => {
    vi.resetModules();
    return (await import('../../src/app/pages/dashboard/DeviceFixes')).default;
  };

  it("puts a refused device's offer away for this visit alone, apart from its Update-first form", async () => {
    const DeviceFixes = await freshPage();
    setup({ fw: '3.4.3' });
    const first = render(() => <DeviceFixes />);
    fireEvent.click(first.getByRole('button', { name: 'Dismiss' }));
    expect(first.container.querySelector('#device-fix')).toBeNull();
    expect(localStorage.getItem('medius.fixes.kept') ?? '').not.toContain('unread');
    cleanup();
    setup({ fw: '3.4.5' });
    expect(render(() => <DeviceFixes />).container.querySelector('#device-fix')).not.toBeNull();
  });

  it('offers Allow imperfect anyway beside Update on older firmware', async () => {
    const DeviceFixes = await freshPage();
    setup({ fw: '3.4.3' });
    const { getByRole } = render(() => <DeviceFixes />);
    expect(getByRole('button', { name: 'Update' })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Allow imperfect anyway' }));
    expect(getByRole('button', { name: /Applying/ })).toBeTruthy();
  });

  it('keeps a running fix through the panel going away and back, and starts no second one', async () => {
    setup({ device: mouse(0x5555, 0x6666) });
    const link = box.state!.link() as { allowImperfectClones: () => Promise<void> };
    let release: (() => void) | null = null;
    link.allowImperfectClones = () => new Promise<void>((r) => (release = () => (box.writes.push('allow'), box.state!.setImperfect({ allowed: true, overCapacity: true, cloneImperfect: true }), r())));
    const first = render(() => <DeviceFixes />);
    fireEvent.click(first.getByRole('button', { name: 'Allow imperfect' }));
    await waitFor(() => expect(release).not.toBeNull());
    cleanup();
    const again = render(() => <DeviceFixes />);
    const busy = again.getByRole('button', { name: /Applying/ }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    fireEvent.click(busy);
    release!();
    await waitFor(() => expect(again.container.textContent).toContain('Done. The device is cloned.'), { timeout: 3000 });
    expect(box.writes).toEqual(['allow']);
  });

  it('says the device changed when the box reads another just before writing, and writes nothing', async () => {
    setup({ device: mouse(0x7777, 0x8888) });
    const link = box.state!.link() as { queryImperfect: () => Promise<unknown> };
    link.queryImperfect = async () => ({ allowed: false, overCapacity: false, cloneImperfect: false });
    const { container, getByRole } = render(() => <DeviceFixes />);
    fireEvent.click(getByRole('button', { name: 'Allow imperfect' }));
    await waitFor(() => expect(container.textContent).toContain('A different device is plugged in now'), { timeout: 3000 });
    expect(box.writes).toEqual([]);
  });

  it('has its status line ready before it speaks, and moves focus to it as the fix runs', async () => {
    setup({ device: mouse(0x9999, 0xaaaa) });
    const { container, getByRole } = render(() => <DeviceFixes />);
    const status = container.querySelector('#device-fix [role="status"]') as HTMLElement;
    expect(status).not.toBeNull();
    expect(status.textContent).toBe('');
    fireEvent.click(getByRole('button', { name: 'Allow imperfect' }));
    expect(document.activeElement).toBe(status);
    await waitFor(() => expect(status.textContent).toContain('Done. The device is cloned.'), { timeout: 3000 });
  });

  it('tells a Razer owner to raise the polling rate in Razer Synapse', () => {
    setup({ device: mouse(0x1532, 0x00c1), imperfect: { allowed: false, overCapacity: false, cloneImperfect: false } });
    box.state!.setDevice(mouse(0x1532, 0x00c1));
    const { container } = render(() => <DeviceFixes />);
    expect(container.textContent ?? '').toContain('set its highest polling rate in Razer Synapse');
  });
});
