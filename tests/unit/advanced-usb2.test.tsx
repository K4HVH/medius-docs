import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { PROTO_VER } from '../../src/dashboard/protocol';

type Chip = { major: number; minor: number; patch: number; slot: number; state: number };
type Info = { device: Chip; host: Chip | null; slotSize: number; deviceStaged: boolean; hostStaged: boolean };
type Run = {
  device: boolean;
  host: boolean;
  page: string;
  outcome: string;
  landed?: { device?: boolean; host?: boolean };
};

const chip = (v: string): Chip => {
  const [major, minor, patch] = v.split('.').map(Number);
  return { major, minor, patch, slot: 0, state: 2 };
};
const info = (device: string, host: string | null): Info => ({
  device: chip(device),
  host: host === null ? null : chip(host),
  slotSize: 983040,
  deviceStaged: false,
  hostStaged: false,
});

// Built on real signals, so the page sees every change the session makes.
const st = vi.hoisted(() => ({
  make: () => {
    const [status, setStatus] = createSignal('connected');
    const [error, setError] = createSignal<string | null>(null);
    const [version, setVersion] = createSignal({ protoVer: 9, fwMajor: 3, fwMinor: 4, fwPatch: 2, mac: [], name: 'Desk' });
    const [firmwareInfo, setFirmwareInfo] = createSignal<unknown>(null);
    const [update, setUpdate] = createSignal<unknown>(null);
    return { status, setStatus, error, setError, version, setVersion, firmwareInfo, setFirmwareInfo, update, setUpdate };
  },
}));

const mock = vi.hoisted(() => ({
  s: null as ReturnType<(typeof st)['make']> | null,
  sent: [] as { images: { device?: Uint8Array; host?: Uint8Array }; page: string }[],
  outcome: 'verified' as 'verified' | 'sent' | 'failed',
  landed: undefined as { device?: boolean; host?: boolean } | undefined,
  // What the box runs once a verified run ends.
  after: null as unknown,
  releasesThrow: false,
  assets: [] as { name: string; size: number; url: string }[],
  bytes: {} as Record<string, Uint8Array>,
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => {
    const s = mock.s!;
    return {
      status: () => s.status(),
      error: () => s.error(),
      version: () => s.version(),
      firmwareInfo: () => s.firmwareInfo(),
      update: () => s.update(),
      clearUpdate: () => s.setUpdate(null),
      readFirmwareInfo: async () => s.firmwareInfo(),
      // Mirrors the real one's observable effects.
      updateOverControl: async (images: { device?: Uint8Array; host?: Uint8Array }, page: string) => {
        mock.sent.push({ images, page });
        const run = { device: images.device !== undefined, host: images.host !== undefined, page };
        s.setUpdate({ ...run, outcome: 'running' });
        s.setStatus('flashing');
        await Promise.resolve();
        if (mock.outcome === 'verified') {
          if (mock.after) s.setFirmwareInfo(mock.after);
          s.setStatus('connected');
          const landed = mock.landed ?? {
            ...(run.device ? { device: true } : {}),
            ...(run.host ? { host: true } : {}),
          };
          s.setUpdate({ ...run, outcome: 'verified', landed });
        } else if (mock.outcome === 'sent') {
          s.setError('The update was sent, but the box did not come back on its own. Replug it, then connect.');
          s.setStatus('disconnected');
          s.setUpdate({ ...run, outcome: 'sent' });
        } else {
          s.setError('The box refused that.');
          s.setStatus('error');
          s.setUpdate({ ...run, outcome: 'failed' });
        }
        return mock.outcome;
      },
    };
  },
}));

vi.mock('../../src/app/pages/dashboard/ConnectPanel', () => ({
  ConnectPanel: () => <p>connect panel: {String(mock.s!.error())}</p>,
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => {
    if (mock.releasesThrow) throw new Error('Firmware fetch is not set up on this server.');
    return [{ tag: 'v3.4.5', assets: mock.assets }];
  },
  downloadAsset: async (a: { name: string }) => mock.bytes[a.name],
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import { Usb2Flash } from '../../src/app/pages/dashboard/AdvancedUsb2';

// An application image naming its project and version, as a medius build's app descriptor does.
const app = (project: string, version: string): Uint8Array<ArrayBuffer> => {
  const b = new Uint8Array(4096);
  b[0] = 0xe9;
  const dv = new DataView(b.buffer);
  dv.setUint16(12, 9, true);
  dv.setUint32(32, 0xabcd5432, true);
  new TextEncoder().encodeInto(version, b.subarray(48, 80));
  new TextEncoder().encodeInto(project, b.subarray(80, 112));
  return b;
};
const DEVICE_345 = app('medius_device', '3.4.5');
const HOST_345 = app('medius_host', '3.4.5');

const release = () => {
  mock.assets = [
    { name: 'medius_device.bin', size: 494400, url: 'd' },
    { name: 'medius_host.bin', size: 408752, url: 'h' },
  ];
  mock.bytes = { 'medius_device.bin': DEVICE_345, 'medius_host.bin': HOST_345 };
};

beforeEach(() => {
  mock.s = st.make();
  mock.s.setFirmwareInfo(info('3.4.2', '3.4.2'));
  release();
});

afterEach(() => {
  cleanup();
  mock.sent = [];
  mock.outcome = 'verified';
  mock.landed = undefined;
  mock.after = null;
  mock.releasesThrow = false;
});

const mount = () => render(() => <Usb2Flash via={() => <p>via field</p>} />);
const combos = (r: ReturnType<typeof render>) => [...r.container.querySelectorAll('[role="combobox"]')] as HTMLElement[];
const options = async (box: HTMLElement) => {
  fireEvent.click(box);
  fireEvent.keyDown(box, { key: 'Enter' });
  await new Promise((res) => setTimeout(res, 20));
  return [...document.querySelectorAll('[role="option"]')] as HTMLElement[];
};
const pick = async (box: HTMLElement, label: RegExp) => {
  const o = (await options(box)).find((x) => label.test(x.textContent ?? ''));
  if (!o) throw new Error(`no option ${label}`);
  fireEvent.click(o);
  await new Promise((res) => setTimeout(res, 20));
};
const chips = (r: ReturnType<typeof render>, label: RegExp) => pick(combos(r)[0], label);
const upload = (r: ReturnType<typeof render>) => pick(combos(r)[1], /upload a file/i);
const flashButton = (r: ReturnType<typeof render>) => r.getByRole('button', { name: /^flash$/i });
// Drops a file on the picker with this label.
const drop = (r: ReturnType<typeof render>, label: string, bytes: Uint8Array<ArrayBuffer>) => {
  const field = [...r.container.querySelectorAll('.file-upload, [class*="file-upload"]')].find((el) =>
    (el.textContent ?? '').includes(label),
  );
  const input = (field ?? r.container).querySelector('input[type="file"]') as HTMLInputElement;
  const f = new File([bytes], `${label}.bin`);
  Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) });
  Object.defineProperty(input, 'files', { value: [f], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const inputs = (r: ReturnType<typeof render>) => [...r.container.querySelectorAll('input[type="file"]')] as HTMLInputElement[];
const dropOn = (input: HTMLInputElement, bytes: Uint8Array<ArrayBuffer>) => {
  const f = new File([bytes], 'image.bin');
  Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) });
  Object.defineProperty(input, 'files', { value: [f], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('Advanced over USB2', () => {
  it('a box that is not connected gets the shared connect panel, after the Via choice', async () => {
    mock.s!.setStatus('disconnected');
    const r = mount();
    expect(r.container.textContent).toContain('via field');
    expect(r.container.textContent).toContain('connect panel');
    expect(r.queryByRole('button', { name: /^flash$/i })).toBeNull();
  });

  it('offers both chips, the main chip or the mouse-side chip, both by default', async () => {
    const r = mount();
    expect(combos(r)[0].textContent).toContain('Both chips');
    const labels = (await options(combos(r)[0])).map((o) => o.textContent);
    expect(labels).toEqual(['Both chips', 'Main chip', 'Mouse-side chip']);
  });

  it('with no mouse-side chip answering, offers the main chip alone and says where the other is flashed', async () => {
    mock.s!.setFirmwareInfo(info('3.4.2', null));
    const r = mount();
    await waitFor(() => expect(combos(r)[0].textContent).toContain('Main chip'));
    expect(r.container.textContent).toContain("The mouse-side chip isn't answering. Flash it over USB3.");
    const opts = await options(combos(r)[0]);
    const disabled = opts.filter((o) => o.getAttribute('aria-disabled') === 'true').map((o) => o.textContent);
    expect(disabled).toEqual(['Both chips', 'Mouse-side chip']);
  });

  it('names each release file it will send, with its size and tag', async () => {
    const r = mount();
    await waitFor(() => expect(r.container.textContent).toContain('medius_host.bin'));
    expect(r.container.textContent).toContain('medius_device.bin (483 KB) from v3.4.5');
    expect(r.container.textContent).toContain('medius_host.bin (399 KB) from v3.4.5');
    expect(flashButton(r)).not.toBeDisabled();
  });

  it('a release missing a chip it needs says so, and Flash waits', async () => {
    // The mouse-side chip already runs the release, so the main chip alone doesn't split them.
    mock.s!.setFirmwareInfo(info('3.4.2', '3.4.5'));
    mock.assets = mock.assets.filter((a) => a.name !== 'medius_host.bin');
    const r = mount();
    await waitFor(() => expect(r.container.textContent).toContain('No medius_host.bin in the latest release. Upload one.'));
    expect(flashButton(r)).toBeDisabled();
    await chips(r, /^Main chip$/);
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
  });

  it('a release list that would not load leaves a message and no Flash', async () => {
    mock.releasesThrow = true;
    const r = mount();
    await waitFor(() => expect(r.container.textContent).toContain("Couldn't reach the firmware downloads. Choose Upload a file."));
    expect(flashButton(r)).toBeDisabled();
  });

  it('asks for one file per chip chosen, each named', async () => {
    const r = mount();
    await upload(r);
    await waitFor(() => expect(inputs(r)).toHaveLength(2));
    expect(r.container.textContent).toContain('Main chip .bin');
    expect(r.container.textContent).toContain('Mouse-side chip .bin');
    await chips(r, /^Mouse-side chip$/);
    await waitFor(() => expect(inputs(r)).toHaveLength(1));
    expect(r.container.textContent).not.toContain('Main chip .bin');
  });

  it("says under each picker why its file can't go, and Flash waits", async () => {
    const r = mount();
    await upload(r);
    await waitFor(() => expect(inputs(r)).toHaveLength(2));
    const [main, mouse] = inputs(r);
    // One version on both, so nothing but the refusals can hold Flash back.
    dropOn(main, HOST_345);
    dropOn(mouse, app('stock_fw', '3.4.5'));
    await waitFor(() => expect(r.container.textContent).toContain("This is the mouse-side chip's image."));
    expect(r.container.textContent).not.toMatch(/different versions/);
    expect(r.container.textContent).toContain("This isn't medius firmware. Flash it over USB3.");
    expect(flashButton(r)).toBeDisabled();
  });

  it('a refused mouse-side file stops blocking once only the main chip is chosen, and is never sent', async () => {
    const r = mount();
    await upload(r);
    await waitFor(() => expect(inputs(r)).toHaveLength(2));
    const [main, mouse] = inputs(r);
    dropOn(main, DEVICE_345);
    dropOn(mouse, app('stock_fw', '1.0.0'));
    await waitFor(() => expect(r.container.textContent).toContain("This isn't medius firmware."));
    expect(flashButton(r)).toBeDisabled();
    await chips(r, /^Main chip$/);
    // The main chip alone at 3.4.5 over a 3.4.2 mouse-side chip splits them.
    r.getByRole('checkbox', { name: /flash anyway/i }).click();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    flashButton(r).click();
    await waitFor(() => expect(mock.sent).toHaveLength(1));
    expect(mock.sent[0].images).toEqual({ device: DEVICE_345 });
    expect(mock.sent[0].page).toBe('advanced');
  });

  it("shows each chip's version now and after", async () => {
    const r = mount();
    await waitFor(() => expect(r.container.textContent).toContain('Main chip: v3.4.2 to v3.4.5'));
    expect(r.container.textContent).toContain('Mouse-side chip: v3.4.2 to v3.4.5');
    await chips(r, /^Main chip$/);
    await waitFor(() => expect(r.container.textContent).toContain('Mouse-side chip: v3.4.2, unchanged'));
  });

  it('a flash that would split the chips warns, and goes only once ticked', async () => {
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    expect(r.container.textContent).not.toMatch(/different versions/);
    await chips(r, /^Main chip$/);
    await waitFor(() =>
      expect(r.container.textContent).toContain(
        "The chips would be on different versions, v3.4.5 and v3.4.2. If they can't talk to each other, the mouse stops working and the mouse-side chip can only be flashed over USB3.",
      ),
    );
    expect(flashButton(r)).toBeDisabled();
    r.getByRole('checkbox', { name: /flash anyway/i }).click();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    // Back to both: no split, and the tick doesn't carry over to the next one.
    await chips(r, /^Both chips$/);
    await waitFor(() => expect(r.queryByRole('checkbox', { name: /flash anyway/i })).toBeNull());
    await chips(r, /^Main chip$/);
    await waitFor(() => expect(r.getByRole('checkbox', { name: /flash anyway/i })).not.toBeChecked());
    expect(flashButton(r)).toBeDisabled();
  });

  it('sends both release images as the Advanced page', async () => {
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    flashButton(r).click();
    await waitFor(() => expect(mock.sent).toHaveLength(1));
    expect(mock.sent[0]).toEqual({ images: { device: DEVICE_345, host: HOST_345 }, page: 'advanced' });
  });

  it('reads a release image like a file, and sends nothing when one is for the wrong chip', async () => {
    mock.bytes['medius_host.bin'] = DEVICE_345;
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    flashButton(r).click();
    await waitFor(() => expect(r.getByRole('alert').textContent).toBe("This is the main chip's image."));
    expect(mock.sent).toEqual([]);
  });

  it('a verified flash says so, with what each chip now runs', async () => {
    mock.after = info('3.4.5', '3.4.5');
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    flashButton(r).click();
    await waitFor(() =>
      expect(r.container.textContent).toContain('Flashed and verified. Main chip on v3.4.5, mouse-side chip on v3.4.5.'),
    );
    expect(r.container.textContent).not.toMatch(/protocol/);
  });

  it('a chip that came back on its old slot is reported as reverted, not verified', async () => {
    mock.after = info('3.4.2', '3.4.5');
    mock.landed = { device: false, host: true };
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    flashButton(r).click();
    await waitFor(() =>
      expect(r.container.textContent).toContain(
        "The main chip came back on the firmware it had. It reverts an image that won't run, so it still works.",
      ),
    );
    expect(r.container.textContent).not.toMatch(/verified/i);
    expect(r.container.textContent).toContain('Mouse-side chip on v3.4.5.');
  });

  it('a box now on another protocol says the page can flash it but not control it', async () => {
    mock.after = info('3.5.0', '3.5.0');
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    mock.s!.setVersion({ protoVer: PROTO_VER + 1, fwMajor: 3, fwMinor: 5, fwPatch: 0, mac: [], name: 'Desk' });
    flashButton(r).click();
    await waitFor(() =>
      expect(r.container.textContent).toContain(
        `This box speaks protocol ${PROTO_VER + 1} and this page protocol ${PROTO_VER}, so the page can flash it but not control it.`,
      ),
    );
  });

  it('a box that did not come back gets the connect panel and its instruction', async () => {
    mock.outcome = 'sent';
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    flashButton(r).click();
    await waitFor(() => expect(r.container.textContent).toContain('connect panel: The update was sent'));
    expect(r.queryByRole('button', { name: /^flash$/i })).toBeNull();
  });

  it('a failed flash shows the reason through the connect panel', async () => {
    mock.outcome = 'failed';
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    flashButton(r).click();
    await waitFor(() => expect(r.container.textContent).toContain('connect panel: The box refused that.'));
  });

  it('Flash another goes back to the form, and Go to my box to Device', async () => {
    const r = mount();
    await waitFor(() => expect(flashButton(r)).not.toBeDisabled());
    flashButton(r).click();
    await waitFor(() => r.getByRole('button', { name: /flash another/i }));
    r.getByRole('button', { name: /go to my box/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
    r.getByRole('button', { name: /flash another/i }).click();
    await waitFor(() => expect(flashButton(r)).toBeTruthy());
    expect(mock.s!.update()).toBeNull();
  });

  it("shows the form, not the Update page's result", async () => {
    mock.s!.setUpdate({ device: true, host: true, page: 'update', outcome: 'verified' } satisfies Run);
    const r = mount();
    await waitFor(() => expect(flashButton(r)).toBeTruthy());
    expect(r.container.textContent).not.toMatch(/verified/i);
  });
});
