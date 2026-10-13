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
    // The wrong chip a stock flash reported, as the real runner keeps it.
    const [wrong, setWrong] = createSignal<{ found: string; sure: boolean } | null>(null);
    // A ROM flash's progress, as the real runner reports it.
    const [rom, setRom] = createSignal<{ phase: string; written?: number; total?: number } | null>(null);
    // What the selected box runs, as the registry tells it, and which box it is.
    const [kind, setKind] = createSignal<'medius' | 'other' | null>('medius');
    const [selKey, setSelKey] = createSignal('588c81df1e28');
    return { running, setRunning, status, setStatus, progress, setProgress, update, setUpdate, wrong, setWrong, rom, setRom, kind, setKind, selKey, setSelKey };
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
  stock: [] as { chip: string; pkg: number; boot: number; anyway?: boolean; knownMain?: (mac: string) => boolean }[],
  // A chip MAKCU's bootloader names as the other one, which the page asks about.
  wrong: null as null | { found: string; sure: boolean },
  // What a failed flash left the progress at, and its error.
  failedAt: null as string | null,
  error: null as string | null,
  // What connecting the box just flashed comes to: null when it connected; the snapshot each connect was from.
  verdict: null as null | { kind: string },
  connects: 0,
  snaps: 0,
  befores: [] as number[],
  downloaded: [] as string[],
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  // The selected box's session, read through the registry: Advanced is not inside BoxScope.
  useBoxes: () => ({
    supported: mock.supported,
    secure: mock.secure,
    entries: () => [{ key: '588c81df1e28' }],
    selectedKind: () => mock.s!.kind(),
    selected: () => ({ key: mock.s!.selKey() }),
    snapshot: () => ({ n: ++mock.snaps }),
    connectNew: async (before: { n: number }) => {
      mock.connects += 1;
      mock.befores.push(before.n);
      return mock.verdict;
    },
    scope: () => ({
      status: () => mock.s!.status(),
      name: () => 'Desk',
      updateProgress: () => mock.s!.progress(),
      update: () => mock.s!.update(),
    }),
  }),
  BoxScope: (p: { children: unknown }) => p.children,
  useNativeFlash: () => ({
    progress: () => mock.s!.rom() ?? (mock.failedAt ? { phase: mock.failedAt } : null),
    error: () => mock.error,
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
    wrongChip: () => mock.s!.wrong(),
    flashStock: async (_port: unknown, chip: string, pkg: Uint8Array, boot: Uint8Array, _page: string, opts: { anyway?: boolean; knownMain?: (mac: string) => boolean } = {}) => {
      mock.stock.push({ chip, pkg: pkg.length, boot: boot.length, ...opts });
      mock.s!.setWrong(null);
      if (mock.wrong && !opts.anyway) {
        mock.s!.setWrong(mock.wrong);
        return false;
      }
      mock.wrong = null;
      return mock.flashOk;
    },
  }),
}));

vi.mock('../../src/dashboard/firmware', async () => ({
  ...(await vi.importActual<typeof import('../../src/dashboard/firmware')>('../../src/dashboard/firmware')),
  fetchReleases: async () => {
    if (mock.releasesThrow) throw new Error('Firmware fetch is not set up on this server.');
    // The latest, then the releases before it.
    return ['3.4.5', '3.4.4', '3.3.2'].map((v, i) => ({
      tag: `v${v}`,
      prerelease: false,
      publishedAt: `2026-10-0${5 - i}T12:00:00Z`,
      assets: [
        { name: 'medius_device-factory.bin', size: 400000 + i, url: `${v}/d` },
        { name: 'medius_host-factory.bin', size: 400000 + i, url: `${v}/h` },
      ],
    }));
  },
  downloadAsset: async (a: { url: string }) => {
    mock.downloaded.push(a.url);
    return new Uint8Array([0xe9, 1, 2, 3]);
  },
}));

vi.mock('../../src/dashboard/serial', () => ({
  requestRomPort: async () => ({}) as SerialPort,
}));

// The USB2 form is tested in advanced-usb2.test.tsx; here it only has to be the one shown, and say when
// it is busy.
vi.mock('../../src/app/pages/dashboard/FlashUsb2', () => ({
  Usb2Flash: (p: { onBusy?: (b: boolean) => void }) => (
    <div>
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

import Advanced from '../../src/app/pages/dashboard/Flash';

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
  mock.stock = [];
  mock.wrong = null;
  mock.failedAt = null;
  mock.error = null;
  mock.verdict = null;
  mock.connects = 0;
  mock.snaps = 0;
  mock.befores = [];
  mock.downloaded = [];
  navigate.mockClear();
  vi.unstubAllGlobals();
});

// Each control sits in a field under its label; Via, Chip, Image and Source are each a choice of a few.
const field = (r: ReturnType<typeof render>, label: string) => {
  const f = [...r.container.querySelectorAll('.labelled')].find((el) => el.querySelector('.field-l')?.textContent === label);
  if (!f) throw new Error(`no ${label} field`);
  return f as HTMLElement;
};
// A field's choice: a row of radio buttons, one picked.
const group = (r: ReturnType<typeof render>, label: string) =>
  field(r, label).querySelector('[role="radiogroup"]') as HTMLElement;
const radioOf = (r: ReturnType<typeof render>, label: string, option: RegExp) =>
  [...group(r, label).querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((o) => option.test(o.textContent ?? ''));
const picked = (r: ReturnType<typeof render>, label: string) =>
  group(r, label).querySelector('[aria-checked="true"]')?.textContent ?? '';
const off = (r: ReturnType<typeof render>, label: string) => group(r, label).getAttribute('aria-disabled') === 'true';
// Picks from a choice, or from a dropdown (Version, a list), opening it first.
const choose = async (r: ReturnType<typeof render>, label: string, option: RegExp) => {
  const list = field(r, label).querySelector<HTMLElement>('.dd-b');
  if (list) fireEvent.click(list);
  const o = await waitFor(() => {
    const el = [...field(r, label).querySelectorAll<HTMLButtonElement>('[role="radio"], [role="option"]')].find((x) =>
      option.test(x.textContent ?? ''),
    );
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

  it('the badge and the drawing name the socket this chip uses', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    // The lit chip and the sockets drawn plugged in.
    const drawn = () => ({
      chip: r.container.querySelector('.ic.on')?.getAttribute('data-chip'),
      plugged: [...r.container.querySelectorAll('.key li.in b')].map((b) => b.textContent),
    });
    // Default chip is the main one: USB1.
    expect(r.container.textContent).toMatch(/button next to USB1/i);
    expect(r.container.textContent).not.toMatch(/button next to USB3/i);
    expect(drawn()).toEqual({ chip: 'main', plugged: ['USB1'] });

    // Switch to the mouse-side chip and both must follow the socket, not stay put.
    await choose(r, 'Chip', /mouse-side/i);
    await openGate(r);
    await waitFor(() => expect(r.container.textContent).toMatch(/button next to USB3/i));
    expect(r.container.textContent).not.toMatch(/button next to USB1/i);
    expect(drawn()).toEqual({ chip: 'mouse', plugged: ['USB3'] });
    await choose(r, 'Chip', /main chip/i);
    await waitFor(() => expect(drawn()).toEqual({ chip: 'main', plugged: ['USB1'] }));
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
      for (const label of ['Via', 'Chip', 'Image']) expect(off(r, label)).toBe(true);
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


  it('a file that is no firmware image is refused, not also called an image of the other kind', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    const input = await openUpload(r);
    const bytes = new Uint8Array(3000).fill(0x5a);
    const junk = new File([bytes], 'junk.bin');
    Object.defineProperty(junk, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer as ArrayBuffer) });
    Object.defineProperty(input, 'files', { value: [junk], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(r.getByRole('alert').textContent).toMatch(/not an esp32-s3 firmware image/i));
    expect(r.container.textContent).not.toMatch(/looks like/i);
  });

  it('a disabled chip choice cannot be picked from, not merely styled', async () => {
    mock.holdFlash = true;
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(off(r, 'Chip')).toBe(true));
    fireEvent.click(radioOf(r, 'Chip', /mouse-side/i)!);
    // Still the main chip: the pick did not take.
    expect(picked(r, 'Chip')).toBe('Main chip');
  });



  // Both chips from one release, then the way onward.
  const flashBoth = async (r: ReturnType<typeof render>) => {
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Main chip flashed and verified.'));
    fireEvent.click(r.getByRole('button', { name: /^flash the mouse-side chip$/i }));
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).not.toBeDisabled());
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => r.getByRole('button', { name: /go to my box/i }));
  };

  it('after one chip offers the other, and with both on one release a way onward', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.getAllByRole('button').map((b) => b.textContent)).toEqual(['Flash the mouse-side chip', 'Flash another']));
    fireEvent.click(r.getByRole('button', { name: /^flash another$/i }));
    await flashBoth(r);
    expect(r.container.querySelector('.state')?.textContent).toBe('Flashed and verified.');
    r.getByRole('button', { name: /go to my box/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
    expect(mock.connects).toBe(0);
    expect(mock.metas.slice(1)).toEqual([
      { page: 'advanced', chip: 'device', source: 'release' },
      { page: 'advanced', chip: 'host', source: 'release' },
    ]);
    expect(mock.downloaded.slice(1)).toEqual(['3.4.5/d', '3.4.5/h']);
  });

  it('connects the box just flashed before going to it, when no Medius box is selected', async () => {
    mock.s!.setKind('other');
    const r = render(() => <Advanced />);
    await flashBoth(r);
    mock.verdict = { kind: 'no-port' };
    r.getByRole('button', { name: /go to my box/i }).click();
    await waitFor(() => expect(r.getByRole('alert').textContent).toBe("This computer can't see your box. Plug USB2 into it."));
    expect(navigate).not.toHaveBeenCalled();
    mock.verdict = null;
    r.getByRole('button', { name: /go to my box/i }).click();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'));
    expect(mock.connects).toBe(2);
  });

  it('goes to the box just flashed when the selection moved to another box during the flash', async () => {
    mock.s!.setKind('other');
    mock.s!.setSelKey('port:2');
    const r = render(() => <Advanced />);
    await flashBoth(r);
    // USB2 unplugged for the flash: the list falls back to a Medius box still plugged in.
    mock.s!.setKind('medius');
    mock.s!.setSelKey('588c81df1e28');
    r.getByRole('button', { name: /go to my box/i }).click();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'));
    expect(mock.connects).toBe(1);
  });

  it('starts afresh on Flash another: a new snapshot, and no words left from the last box', async () => {
    mock.s!.setKind('other');
    const r = render(() => <Advanced />);
    await flashBoth(r);
    mock.verdict = { kind: 'no-port' };
    r.getByRole('button', { name: /go to my box/i }).click();
    await waitFor(() => r.getByRole('alert'));
    fireEvent.click(r.getByRole('button', { name: /^flash another$/i }));
    await flashBoth(r);
    expect(r.queryByRole('alert')).toBeNull();
    r.getByRole('button', { name: /go to my box/i }).click();
    await waitFor(() => expect(mock.befores).toHaveLength(2));
    expect(mock.befores[1]).toBeGreaterThan(mock.befores[0]);
  });

  it('keeps a button-held flash on its form when the selection moves to a Medius box', async () => {
    mock.s!.setStatus('connected');
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
    // Another box picked, one that doesn't run Medius: its button-held flash.
    mock.s!.setKind('other');
    mock.s!.setStatus('disconnected');
    await openGate(r);
    // The selected port unplugged to hold its button: the list falls back to a Medius box.
    mock.s!.setKind('medius');
    mock.s!.setStatus('connected');
    await new Promise((res) => setTimeout(res, 20));
    expect(r.container.textContent).not.toContain('usb2 form');
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Main chip flashed and verified.'));
    expect(r.container.textContent).not.toContain('usb2 form');
  });

  it('turns to the control port when a Medius box is told after the page opened', async () => {
    mock.s!.setKind(null);
    const r = render(() => <Advanced />);
    await openGate(r);
    expect(() => field(r, 'Via')).toThrow();
    mock.s!.setKind('medius');
    mock.s!.setStatus('connected');
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
  });

  // A factory image whose application names its project and version, as a Medius build stamps it.
  const mediusFactory = (project: string, version: string) => {
    const b = new Uint8Array(0x11000);
    b[0] = 0xe9;
    b[0x8000] = 0xaa;
    b[0x8001] = 0x50;
    b[0x10000] = 0xe9;
    const v = new DataView(b.buffer);
    v.setUint16(0x10000 + 12, 9, true);
    v.setUint32(0x10000 + 32, 0xabcd5432, true);
    new TextEncoder().encodeInto(version, b.subarray(0x10000 + 48));
    new TextEncoder().encodeInto(project, b.subarray(0x10000 + 80));
    return b;
  };
  const flashFile = async (r: ReturnType<typeof render>, bytes: Uint8Array) => {
    const input = await openUpload(r);
    const file = new File([bytes as Uint8Array<ArrayBuffer>], 'image.bin');
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer as ArrayBuffer) });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).not.toBeDisabled());
    r.getByRole('button', { name: /^flash$/i }).click();
  };

  it('counts two files as both chips only when they carry one version', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    await flashFile(r, mediusFactory('medius_device', '3.4.4'));
    fireEvent.click(await waitFor(() => r.getByRole('button', { name: /^flash the mouse-side chip$/i })));
    await flashFile(r, mediusFactory('medius_host', '3.4.5'));
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Mouse-side chip flashed and verified.'));
    fireEvent.click(r.getByRole('button', { name: /^flash the main chip$/i }));
    await flashFile(r, mediusFactory('medius_device', '3.4.5'));
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Flashed and verified.'));
    expect(r.getByRole('button', { name: /go to my box/i })).toBeTruthy();
  });

  it('counts the latest release and a file of the same version as one', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    fireEvent.click(await waitFor(() => r.getByRole('button', { name: /^flash the mouse-side chip$/i })));
    await flashFile(r, mediusFactory('medius_host', '3.4.5'));
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Flashed and verified.'));
  });

  it('ends firmware that is not Medius on both chips without sending anyone to the box', async () => {
    const foreign = () => {
      const b = new Uint8Array(0x11000);
      b[0] = 0xe9;
      b[0x8000] = 0xaa;
      b[0x8001] = 0x50;
      b[0x10000] = 0xe9;
      return b;
    };
    const r = render(() => <Advanced />);
    await openGate(r);
    await flashFile(r, foreign());
    fireEvent.click(await waitFor(() => r.getByRole('button', { name: /^flash the mouse-side chip$/i })));
    await flashFile(r, foreign());
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Flashed and verified.'));
    expect(r.getAllByRole('button').map((b) => b.textContent)).toEqual(['Flash another']);
  });

  it('offers no Via for a box not running Medius: it is flashed with its button held', async () => {
    mock.s!.setKind('other');
    mock.s!.setStatus('connected');
    const r = render(() => <Advanced />);
    await openGate(r);
    expect(() => field(r, 'Via')).toThrow();
    expect(r.container.textContent).not.toContain('usb2 form');
  });

  it('flashes an older release picked by its version, then the other chip from it', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    fireEvent.click(field(r, 'Source').querySelector('[role="radio"][data-v="older"]') as HTMLElement);
    await waitFor(() => expect(r.container.textContent).toContain('from v3.4.4'));
    await choose(r, 'Version', /^v3\.3\.2/);
    await waitFor(() => expect(r.container.textContent).toContain('medius_device-factory.bin (391 KB) from v3.3.2'));
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Main chip flashed and verified.'));
    fireEvent.click(r.getByRole('button', { name: /^flash the mouse-side chip$/i }));
    await waitFor(() => expect(r.container.textContent).toContain('medius_host-factory.bin (391 KB) from v3.3.2'));
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Flashed and verified.'));
    expect(mock.downloaded).toEqual(['3.3.2/d', '3.3.2/h']);
  });

  it('asks for the other chip again when the two were flashed from different releases', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^flash the mouse-side chip$/i }));
    fireEvent.click(r.getByRole('button', { name: /^flash the mouse-side chip$/i }));
    fireEvent.click(await waitFor(() => field(r, 'Source').querySelector('[role="radio"][data-v="older"]') as HTMLElement));
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).not.toBeDisabled());
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Mouse-side chip flashed and verified.'));
    expect(r.getByRole('button', { name: /^flash the main chip$/i })).toBeTruthy();
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

  it('says why a flash failed under the Flash button, where the reader is looking', async () => {
    mock.flashOk = false;
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    const alert = await r.findByRole('alert');
    expect(alert.previousElementSibling?.querySelector('button')?.textContent).toBe('Flash');
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

  it('puts Image under Source, so picking MAKCU stock takes nothing away above the choice', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    expect(field(r, 'Source').compareDocumentPosition(field(r, 'Image')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('starts on ROM download while the box is not connected', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    expect(picked(r, 'Via')).toBe('ROM download');
    expect(r.getByText('Over USB1 or USB3, a chip at a time with its button held.')).toBeTruthy();
    expect(r.container.textContent).not.toContain('usb2 form');
  });

  it('starts on the control port, naming the box, while it is connected', async () => {
    mock.s!.setStatus('connected');
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
    expect(picked(r, 'Via')).toBe('Control port');
    expect(field(r, 'Via').nextElementSibling?.textContent).toBe('Over USB2 to Desk, with no button to hold.');
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

  it('keeps keyboard focus on Via when the arrows switch between the two ways', async () => {
    mock.s!.setStatus('connected');
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
    const port = radioOf(r, 'Via', /control port/i)!;
    port.focus();
    fireEvent.keyDown(port, { key: 'ArrowRight' });
    await waitFor(() => expect(picked(r, 'Via')).toBe('ROM download'));
    await new Promise((res) => setTimeout(res, 30));
    expect(document.activeElement).toBe(radioOf(r, 'Via', /rom download/i));
  });

  it('shows Via over a control-port update that did not come back, and not over one that did', async () => {
    mock.s!.setStatus('disconnected');
    mock.s!.setUpdate({ page: 'advanced', outcome: 'sent' });
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
    expect(group(r, 'Via')).toBeTruthy();
    mock.s!.setStatus('connected');
    await waitFor(() => expect(() => field(r, 'Via')).toThrow());
  });

  it("keeps the Via choice still while the control port's flash is busy", async () => {
    mock.s!.setStatus('connected');
    const r = render(() => <Advanced />);
    await waitFor(() => expect(r.container.textContent).toContain('usb2 form'));
    expect(off(r, 'Via')).toBe(false);
    r.getByRole('button', { name: 'usb2 busy' }).click();
    await waitFor(() => expect(off(r, 'Via')).toBe(true));
    expect(field(r, 'Via').querySelector('.seg--disabled')).not.toBeNull();
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

// MAKCU's stock firmware through this site's relay: the catalog, then a file per name.
const relay = (over: { catalog?: Response; files?: Record<string, Response> } = {}) => {
  const asked: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    asked.push(url);
    if (url === '/api/stock/catalog')
      return (
        over.catalog ??
        new Response(
          JSON.stringify({
            id: 'v4.094',
            files: { package: { name: 'makcu-update-v4.094.bin', size: 5000 }, usb1: { name: 'boot-usb1.bin', size: 600 }, usb3: { name: 'boot-usb3.bin', size: 600 } },
          }),
        )
      );
    const name = url.replace('/api/stock/file/', '');
    return over.files?.[name] ?? new Response(new Uint8Array(name.startsWith('makcu') ? 5000 : name === 'boot-usb1.bin' ? 800 : 700));
  });
  return asked;
};
const pickStock = async (r: ReturnType<typeof render>) => {
  fireEvent.click(field(r, 'Source').querySelector('[role="radio"][data-v="stock"]') as HTMLElement);
};

describe("MAKCU's stock firmware on the Flash page", () => {
  it('names the image as the release does, and asks no image kind', async () => {
    relay();
    const r = render(() => <Advanced />);
    await pickStock(r);
    await waitFor(() => expect(r.container.textContent).toContain('makcu-update-v4.094.bin (5 KB) from v4.094'));
    expect(() => field(r, 'Image')).toThrow();
    expect(r.container.querySelector('.callout')).toBeNull();
  });

  it("flashes MAKCU's package with the picked chip's bootloader, then asks for the other chip", async () => {
    const asked = relay();
    const r = render(() => <Advanced />);
    await pickStock(r);
    await openGate(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(mock.stock).toMatchObject([{ chip: 'device', pkg: 5000, boot: 800, anyway: false }]));
    expect(asked).toContain('/api/stock/file/boot-usb1.bin');
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Main chip flashed and verified.'));
    fireEvent.click(r.getByRole('button', { name: /flash the mouse-side chip/i }));
    await openGate(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(mock.stock[1]).toMatchObject({ chip: 'host', pkg: 5000, boot: 700 }));
    // Both done: one line and the box wired for use, as a Medius flash ends.
    await waitFor(() => expect(r.container.querySelectorAll('.key li.in')).toHaveLength(3));
    expect(r.container.querySelector('.state')?.textContent).toBe('Flashed and verified.');
    expect(r.container.querySelector('.cue')).toBeNull();
    expect(mock.stock[0].knownMain?.('588c81df1e28')).toBe(true);
    expect(mock.stock[0].knownMain?.('000000000001')).toBe(false);
    expect(r.getAllByRole('button').map((b) => b.textContent)).toEqual(['Flash another']);
    fireEvent.click(r.getByRole('button', { name: /^flash another$/i }));
    await waitFor(() => expect(r.getByRole('button', { name: /^flash$/i })).toBeTruthy());
  });

  it('names the chip it flashes over the one count', async () => {
    const r = render(() => <Advanced />);
    await pickStock(r);
    mock.s!.setRunning(true);
    const shown = () => [r.container.querySelector('#flashing .cue')?.textContent, r.container.querySelector('.pct')?.textContent];
    mock.s!.setRom({ phase: 'connecting' });
    await waitFor(() => expect(shown()).toEqual(['Flashing the main chip', 'Connecting']));
    mock.s!.setRom({ phase: 'writing', written: 0x100000, total: 0x400000 });
    await waitFor(() => expect(shown()).toEqual(['Flashing the main chip', '25%']));
    expect(r.container.querySelector('.track.wait')).toBeNull();
    // An erase with no count names itself where the figure goes, not twice.
    mock.s!.setRom({ phase: 'erasing' });
    await waitFor(() => expect(shown()).toEqual(['Flashing the main chip', 'Erasing']));
  });

  it('names the mouse-side chip when that is the one picked', async () => {
    const r = render(() => <Advanced />);
    await choose(r, 'Chip', /mouse-side/i);
    await pickStock(r);
    mock.s!.setRunning(true);
    mock.s!.setRom({ phase: 'writing', written: 1, total: 4 });
    await waitFor(() => expect(r.container.querySelector('#flashing .cue')?.textContent).toBe('Flashing the mouse-side chip'));
  });

  it('says why a catalog failed its check, and offers nothing to flash', async () => {
    relay({ catalog: new Response(JSON.stringify({ error: "MAKCU's catalog signature doesn't check out" }), { status: 502 }) });
    const r = render(() => <Advanced />);
    await pickStock(r);
    await waitFor(() => expect(r.container.textContent).toContain("MAKCU's catalog signature doesn't check out"));
    expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('flashes nothing when a file does not arrive, and says which', async () => {
    relay({ files: { 'boot-usb1.bin': new Response(JSON.stringify({ error: "boot-usb1.bin doesn't match MAKCU's signed catalog" }), { status: 502 }) } });
    const r = render(() => <Advanced />);
    await pickStock(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(r.container.textContent).toContain("boot-usb1.bin doesn't match MAKCU's signed catalog"));
    expect(mock.stock).toEqual([]);
  });

  it('shows the failure as the flash words it, under the Flash button, with nothing added', async () => {
    relay();
    mock.flashOk = false;
    mock.failedAt = 'writing';
    mock.error = "The box went away partway through. The main chip may not start until it's flashed again. Replug it with the button held, then try again.";
    const r = render(() => <Advanced />);
    await pickStock(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(r.getByRole('alert').textContent).toBe(mock.error));
  });

  it('passes on which chip is really plugged in', async () => {
    relay();
    mock.flashOk = false;
    mock.failedAt = 'connecting';
    mock.error = 'This is the mouse-side chip. Pick it above, or plug in USB1 with the button beside it held.';
    const r = render(() => <Advanced />);
    await pickStock(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(r.container.textContent).toContain('This is the mouse-side chip.'));
    expect(r.container.textContent).not.toMatch(/may not start/);
  });

  it("asks before flashing a chip MAKCU's bootloader names as the other, and flashes it when told", async () => {
    relay();
    mock.wrong = { found: 'host', sure: false };
    mock.error = "MAKCU's bootloader on this chip is the mouse-side chip's, not the main chip's.";
    const r = render(() => <Advanced />);
    await pickStock(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    const anyway = await waitFor(() => r.getByRole('button', { name: 'Flash anyway' }));
    fireEvent.click(anyway);
    await waitFor(() => expect(mock.stock.at(-1)).toMatchObject({ chip: 'device', anyway: true }));
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Main chip flashed and verified.'));
    // A later flash asks again.
    fireEvent.click(r.getByRole('button', { name: /flash the mouse-side chip/i }));
    await choose(r, 'Chip', /main chip/i);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(mock.stock.at(-1)).toMatchObject({ chip: 'device', anyway: false }));
  });

  it("forgets a chip's stock flash once Medius goes back on it", async () => {
    relay();
    const r = render(() => <Advanced />);
    await pickStock(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(r.container.querySelector('.state')?.textContent).toBe('Main chip flashed and verified.'));
    fireEvent.click(r.getByRole('button', { name: /flash the mouse-side chip/i }));
    await choose(r, 'Chip', /main chip/i);
    fireEvent.click(field(r, 'Source').querySelector('[role="radio"][data-v="release"]') as HTMLElement);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(mock.flashes).toBe(1));
    fireEvent.click(await waitFor(() => r.getByRole('button', { name: /^flash the mouse-side chip$/i })));
    await pickStock(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    // One chip of two: the next is the main chip again, and the box is not drawn wired for use.
    await waitFor(() => expect(r.getByRole('button', { name: /^flash the main chip$/i })).toBeTruthy());
    expect(r.container.querySelectorAll('.key li.in')).toHaveLength(0);
  });

  it('reads the catalog again when a file is not one it lists any more', async () => {
    const asked = relay({ files: { 'boot-usb1.bin': new Response(JSON.stringify({ error: 'Not a file the catalog lists' }), { status: 404 }) } });
    const r = render(() => <Advanced />);
    await pickStock(r);
    await waitFor(() => expect((r.getByRole('button', { name: /^flash$/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(r.getByRole('button', { name: /^flash$/i }));
    await waitFor(() => expect(asked.filter((u) => u === '/api/stock/catalog')).toHaveLength(2));
  });
});
