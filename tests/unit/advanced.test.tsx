import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

// This page had no tests at all, which is how a rejected release fetch froze it and how "Flash
// another" walked straight past the cable gate: both survived three review rounds.
const st = vi.hoisted(() => ({
  make: () => {
    const [running, setRunning] = createSignal(false);
    const [status, setStatus] = createSignal('disconnected');
    const [progress, setProgress] = createSignal<{ phase: string; written?: number; total?: number } | null>(null);
    const [update, setUpdate] = createSignal<{ page: string; outcome: string } | null>(null);
    return { running, setRunning, status, setStatus, progress, setProgress, update, setUpdate };
  },
}));

const mock = vi.hoisted(() => ({
  s: null as ReturnType<(typeof st)['make']> | null,
  releasesThrow: false,
  flashOk: true,
  flashes: 0,
  holdFlash: false,
  metas: [] as unknown[],
  supported: true,
  secure: true,
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  // The selected box's session, read through the registry: Advanced is not inside BoxScope.
  useBoxes: () => ({
    supported: mock.supported,
    secure: mock.secure,
    scope: () => ({
      status: () => mock.s!.status(),
      name: () => 'Desk',
      updateProgress: () => mock.s!.progress(),
      update: () => mock.s!.update(),
    }),
  }),
  BoxScope: (p: { children: unknown }) => p.children,
  useNativeFlash: () => ({
    progress: () => null,
    log: () => [],
    error: () => null,
    running: () => mock.s!.running(),
    clear: () => {},
    flash: async (_port: unknown, _image: Uint8Array, _kind: string, meta: unknown) => {
      mock.flashes += 1;
      mock.metas.push(meta);
      mock.s!.setRunning(true);
      if (mock.holdFlash) await new Promise(() => {});
      mock.s!.setRunning(false);
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

// The USB2 form is tested in advanced-usb2.test.tsx; here it only has to be the one shown, and say when
// it is busy.
vi.mock('../../src/app/pages/dashboard/AdvancedUsb2', () => ({
  Usb2Flash: (p: { via: () => unknown; onBusy?: (b: boolean) => void }) => (
    <div>
      {p.via() as never}
      <p>usb2 form</p>
      <button onClick={() => p.onBusy?.(true)}>usb2 busy</button>
    </div>
  ),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: '/dashboard/advanced', hash: '' }),
  A: (p: { children: unknown }) => p.children,
}));

import Advanced from '../../src/app/pages/dashboard/Advanced';

beforeEach(() => {
  mock.s = st.make();
});

afterEach(() => {
  cleanup();
  mock.releasesThrow = false;
  mock.flashOk = true;
  mock.flashes = 0;
  mock.metas = [];
  mock.holdFlash = false;
  mock.supported = true;
  mock.secure = true;
  navigate.mockClear();
});

// Each control sits in a field under its label: Via, Chip and Image are dropdowns, Source a segmented
// choice.
const field = (r: ReturnType<typeof render>, label: string) => {
  const f = [...r.container.querySelectorAll('.labelled')].find((el) => el.querySelector('.field-l')?.textContent === label);
  if (!f) throw new Error(`no ${label} field`);
  return f as HTMLElement;
};
const dropdown = (r: ReturnType<typeof render>, label: string) =>
  field(r, label).querySelector('.dd-b') as HTMLButtonElement;
// The option list only exists once the dropdown is open.
const optionOf = (r: ReturnType<typeof render>, label: string, option: RegExp) =>
  [...field(r, label).querySelectorAll('[role="option"]')].find((o) => option.test(o.textContent ?? '')) as
    | HTMLElement
    | undefined;
const choose = async (r: ReturnType<typeof render>, label: string, option: RegExp) => {
  fireEvent.click(dropdown(r, label));
  const o = await waitFor(() => {
    const el = optionOf(r, label, option);
    if (!el) throw new Error(`no ${label} option ${option}`);
    return el;
  });
  fireEvent.click(o);
};
const sourceRadios = (r: ReturnType<typeof render>) =>
  [...field(r, 'Source').querySelectorAll('[role="radio"]')] as HTMLButtonElement[];

// Switch SOURCE to the upload path and return the real file input.
const openUpload = async (r: ReturnType<typeof render>) => {
  fireEvent.click(field(r, 'Source').querySelector('[role="radio"][data-v="upload"]') as HTMLElement);
  return waitFor(() => {
    const el = r.container.querySelector('input[type="file"]');
    if (!el) throw new Error('no file input');
    return el as HTMLInputElement;
  });
};

// Flash is on screen straight away now; there is no gate to walk past.
const openGate = async (r: ReturnType<typeof render>) => {
  await waitFor(() => r.getByRole('button', { name: /^flash$/i }));
};

describe('Advanced', () => {
  it('a release fetch that failed leaves the page usable, not frozen', async () => {
    mock.releasesThrow = true;
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toMatch(/couldn't reach the firmware/i));
    // The crash was in a `disabled=` prop reading the rejected resource, so it only fired once the
    // Flash button rendered: walk all the way to it.
    await openGate(r);
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).toBeTruthy());
  });

  it('the badge names the button beside the socket this chip actually uses', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    // Default chip is the main one: USB1.
    expect(r.container.textContent).toMatch(/button next to USB1/i);
    expect(r.container.textContent).not.toMatch(/button next to USB3/i);

    // Switch to the mouse-side chip and the badge must follow the socket, not stay put.
    await choose(r, 'Chip', /mouse-side/i);
    await openGate(r);
    await waitFor(() => expect(r.container.textContent).toMatch(/button next to USB3/i));
    expect(r.container.textContent).not.toMatch(/button next to USB1/i);
  });

  it('a rejection from the file picker is not wiped by the empty selection it comes with', async () => {
    // FileUpload calls onError and THEN onChange([]), which re-enters onFiles: clearing there
    // unconditionally erased the reason in the same tick it was set.
    const r = render(() => <Advanced />);
    await openGate(r);
    const input = await openUpload(r);
    // Over the 4 MB cap, so FileUpload rejects it and hands back an empty selection.
    const huge = new File([new Uint8Array(16)], 'huge.bin');
    Object.defineProperty(huge, 'size', { value: 8 * 1024 * 1024 });
    Object.defineProperty(input, 'files', { value: [huge], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // On the alert, not the container: FileUpload always renders a "Max size: 4.2 MB" helper line,
    // so a loose container match passed even when the message was being wiped.
    const alert = await waitFor(() => r.getByRole('alert'));
    expect(alert.textContent).toMatch(/exceeds the maximum size/i);
  });

  it('a failure from one chip does not stay on screen contradicting the other', async () => {
    mock.flashOk = false;
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    const alert = await r.findByRole('alert');
    expect(alert.textContent).toMatch(/did not finish/i);
    await choose(r, 'Chip', /mouse-side/i);
    await waitFor(() => expect(r.queryByRole('alert')).toBeNull());
  });

  it('the chip and image cannot be changed while a flash is in flight', async () => {
    // They were live across `requestRomPort` and `downloadAsset`, so a switch mid-download changed
    // which offset the bytes went to: an app image at 0x0 takes the bootloader with it.
    mock.holdFlash = true;
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => {
      // Via, chip, image and source: all four were live across the two awaits.
      for (const label of ['Via', 'Chip', 'Image']) expect(dropdown(r, label)).toBeDisabled();
      expect(field(r, 'Source').querySelector('.seg--disabled')).not.toBeNull();
      for (const radio of sourceRadios(r)) expect(radio).toBeDisabled();
    });
  });

  it('a good file after a rejected one clears the rejection', async () => {
    // The reset of the just-rejected flag had no coverage: without it every later good pick kept
    // the old rejection on screen for good.
    const r = render(() => <Advanced />);
    await openGate(r);
    const input = await openUpload(r);
    const huge = new File([new Uint8Array(16)], 'huge.bin');
    Object.defineProperty(huge, 'size', { value: 8 * 1024 * 1024 });
    const drop = (f: File) => {
      Object.defineProperty(input, 'files', { value: [f], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    drop(huge);
    await waitFor(() => expect(r.getByRole('alert').textContent).toMatch(/exceeds/i));

    const bytes = new Uint8Array(2048);
    bytes[0] = 0xe9;
    const good = new File([bytes], 'good.bin');
    Object.defineProperty(good, 'arrayBuffer', {
      value: () => Promise.resolve(bytes.buffer as ArrayBuffer),
    });
    drop(good);
    await waitFor(() => expect(r.queryByRole('alert')).toBeNull());
  });


  it('a disabled chip picker cannot be selected from, not merely styled', async () => {
    // The class was the only thing `disabled` did; a list already open could still be picked from.
    mock.holdFlash = true;
    const r = render(() => <Advanced />);
    await openGate(r);
    fireEvent.click(dropdown(r, 'Chip'));
    await waitFor(() => expect(optionOf(r, 'Chip', /mouse-side/i)).toBeTruthy());
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(dropdown(r, 'Chip')).toBeDisabled());
    const mouseSide = optionOf(r, 'Chip', /mouse-side/i);
    if (mouseSide) fireEvent.click(mouseSide);
    // Still the main chip: the selection did not take.
    expect(dropdown(r, 'Chip').textContent).toMatch(/Main chip/i);
  });



  it('the success screen offers a way onward, not just another flash', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => r.getByRole('button', { name: /go to my box/i }));
    r.getByRole('button', { name: /go to my box/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
    expect(mock.metas).toEqual([{ page: 'advanced', chip: 'device', source: 'release' }]);
  });

  it('a flash of an uploaded file tells the stats it was a file', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    const input = await openUpload(r);
    const bytes = new Uint8Array(2048);
    bytes[0] = 0xe9;
    const file = new File([bytes], 'own.bin');
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer as ArrayBuffer) });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).not.toBeDisabled());
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(mock.metas).toEqual([{ page: 'advanced', chip: 'device', source: 'file' }]));
  });

  it('a failed flash says the reason, and leaves the instruction to the badge', async () => {
    mock.flashOk = false;
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    // Assert the failure text itself: /BOTH/ is already on screen from the boot badge, so matching
    // it alone passed whether or not the click ever happened.
    const alert = await r.findByRole('alert');
    expect(alert.textContent).toMatch(/did not finish/i);
    // The badge already says it; repeating it in the alert is the same sentence twice on one screen.
    expect(alert.textContent).not.toMatch(/button next to/i);
    expect(r.container.textContent).toMatch(/button next to USB1/i);
    expect(r.container.textContent).not.toMatch(/the BOOT button|left button|right button/i);
  });

  it('a second file whose read fails cannot leave the first file armed to flash', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    const input = await openUpload(r);

    // validateImage wants >= 1024 bytes starting 0xE9.
    const bytes = new Uint8Array(2048);
    bytes[0] = 0xe9;
    const good = new File([bytes], 'good.bin');
    const bad = new File([bytes], 'bad.bin');
    // jsdom's File has no arrayBuffer(), which is the method the component reads through.
    Object.defineProperty(good, 'arrayBuffer', {
      value: () => Promise.resolve(bytes.buffer as ArrayBuffer),
    });
    // A read that rejects after selection is a real Chrome case: the file moved or changed on disk.
    Object.defineProperty(bad, 'arrayBuffer', {
      value: () => Promise.reject(new Error('NotReadableError')),
    });

    const drop = (f: File) => {
      Object.defineProperty(input, 'files', { value: [f], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    drop(good);
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).not.toBeDisabled());
    drop(bad);
    await waitFor(() => expect(r.container.textContent).toMatch(/could not be read/i));
    // The first file's bytes must not still be armed under the second file's name.
    expect(r.getByRole('button', { name: /^flash$/i })).toBeDisabled();
  });

  it('starts on ROM download while the box is not connected', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    expect(dropdown(r, 'Via').textContent).toContain('ROM download, USB1 or USB3');
    expect(r.container.textContent).not.toContain('usb2 form');
  });

  it('starts on the control port, naming the box, while it is connected', async () => {
    mock.s!.setStatus('connected');
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
    expect(dropdown(r, 'Via').textContent).toContain('Control port, USB2 (Desk)');
    expect(r.queryByRole('button', { name: /^flash$/i })).toBeNull();
  });

  it("refuses a medius file built for the other chip, and takes anyone else's firmware", async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    const input = await openUpload(r);
    const drop = (bytes: Uint8Array<ArrayBuffer>, name: string) => {
      const f = new File([bytes], name);
      Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer as ArrayBuffer) });
      Object.defineProperty(input, 'files', { value: [f], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    // A factory image is the default IMAGE: its application starts at 0x10000.
    const factory = (project: string | null) => {
      const b = new Uint8Array(0x11000);
      b[0] = 0xe9;
      b[0x8000] = 0xaa;
      b[0x8001] = 0x50;
      b[0x10000] = 0xe9;
      if (project) {
        new DataView(b.buffer).setUint32(0x10000 + 32, 0xabcd5432, true);
        new TextEncoder().encodeInto(project, b.subarray(0x10000 + 80));
      }
      return b;
    };
    drop(factory('medius_host'), 'host.bin');
    await waitFor(() => expect(r.container.textContent).toContain("This is the mouse-side chip's image."));
    expect(r.getByRole('button', { name: /^flash$/i })).toBeDisabled();
    drop(factory(null), 'other.bin');
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).not.toBeDisabled());
    expect(r.container.textContent).not.toContain("chip's image");
  });

  it('while the box updates over USB2, shows its progress and no form', async () => {
    mock.s!.setStatus('flashing');
    mock.s!.setProgress({ phase: 'writing', written: 50, total: 100 });
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toMatch(/Flashing/));
    expect(r.container.textContent).toContain('50%');
    expect(r.container.textContent).not.toContain('usb2 form');
    expect(r.queryByRole('button', { name: /^flash$/i })).toBeNull();
  });

  it('names the chip being written, so a two-chip flash does not count to 100 twice unexplained', async () => {
    mock.s!.setStatus('flashing');
    mock.s!.setProgress({ phase: 'writing', chip: 'host', written: 10, total: 100 } as never);
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.querySelector('#flashing .cue')?.textContent).toBe('Flashing the mouse-side chip'));
    mock.s!.setProgress({ phase: 'writing', chip: 'device', written: 10, total: 100 } as never);
    await waitFor(() => expect(r.container.querySelector('#flashing .cue')?.textContent).toBe('Flashing the main chip'));
    mock.s!.setProgress({ phase: 'restarting' });
    await waitFor(() => expect(r.container.querySelector('#flashing .cue')?.textContent).toBe('Flashing'));
  });

  it('names a phase with no count and runs the wait, never a 0% figure', async () => {
    mock.s!.setStatus('flashing');
    mock.s!.setProgress({ phase: 'connecting' });
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.querySelector('.pct')?.textContent).toBe('Connecting'));
    expect(r.container.querySelector('.track.wait')).not.toBeNull();
    mock.s!.setProgress({ phase: 'writing', written: 25, total: 100 });
    await waitFor(() => expect(r.container.querySelector('.pct')?.textContent).toBe('25%'));
    expect(r.container.querySelector('.track.wait')).toBeNull();
    for (const [phase, word] of [['restarting', 'Restarting'], ['verifying', 'Verifying']]) {
      mock.s!.setProgress({ phase });
      await waitFor(() => expect(r.container.querySelector('.pct')?.textContent).toBe(word));
      expect(r.container.querySelector('.track.wait')).not.toBeNull();
    }
  });

  it('comes back on the control port for a result Advanced started, whatever the box is doing now', async () => {
    mock.s!.setStatus('disconnected');
    mock.s!.setUpdate({ page: 'advanced', outcome: 'sent' });
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
  });

  it("keeps the Via choice still while the control port's flash is busy", async () => {
    mock.s!.setStatus('connected');
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
    expect(dropdown(r, 'Via')).not.toBeDisabled();
    expect(r.container.querySelector('.dd--disabled')).toBeNull();
    r.getByRole('button', { name: 'usb2 busy' }).click();
    await waitFor(() => expect(dropdown(r, 'Via')).toBeDisabled());
    expect(field(r, 'Via').querySelector('.dd.dd--disabled')).not.toBeNull();
  });

  it("says don't close the tab while the box updates over the control port", async () => {
    mock.s!.setStatus('flashing');
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain("Don't unplug or close this tab"));
  });

  it('refuses an application image of the other chip even with Image left on Factory', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    const input = await openUpload(r);
    const b = new Uint8Array(4096);
    b[0] = 0xe9;
    new DataView(b.buffer).setUint32(32, 0xabcd5432, true);
    new TextEncoder().encodeInto('medius_host', b.subarray(80));
    const f = new File([b], 'medius_host.bin');
    Object.defineProperty(f, 'arrayBuffer', { value: () => Promise.resolve(b.buffer) });
    Object.defineProperty(input, 'files', { value: [f], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(r.container.textContent).toContain("This is the mouse-side chip's image."));
    expect(r.getByRole('button', { name: /^flash$/i })).toBeDisabled();
  });

  it('keeps the form in a browser without Web Serial, with the reason where Flash was', async () => {
    mock.supported = false;
    const r = render(() => <Advanced />);
    await waitFor(() => ['Via', 'Chip', 'Image', 'Source'].forEach((label) => field(r, label)));
    expect(r.container.textContent).toMatch(/Open this page in Chrome/);
    expect(r.container.textContent).not.toMatch(/Browser not supported/);
    expect(r.queryByRole('button', { name: /^flash$/i })).toBeNull();
  });

  it('keeps the form on an insecure origin, with the reason where Flash was', async () => {
    mock.secure = false;
    const r = render(() => <Advanced />);
    await waitFor(() => ['Via', 'Chip', 'Image', 'Source'].forEach((label) => field(r, label)));
    expect(r.container.textContent).toMatch(/isn't secure/);
    expect(r.queryByRole('button', { name: /^flash$/i })).toBeNull();
  });
});
