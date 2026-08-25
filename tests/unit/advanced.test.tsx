import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';

// This page had no tests at all, which is how a rejected release fetch froze it and how "Flash
// another" walked straight past the cable gate: both survived three review rounds.
const mock = vi.hoisted(() => ({
  status: 'disconnected' as string,
  releasesThrow: false,
  flashOk: true,
  flashes: 0,
  holdFlash: false,
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
      if (mock.holdFlash) await new Promise(() => {});
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
  grantedMediusPorts: async () => [],
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
  mock.holdFlash = false;
  navigate.mockClear();
});

// Switch SOURCE to the upload path and return the real file input.
const openUpload = async (r: ReturnType<typeof render>) => {
  const source = r.container.querySelectorAll('[role="combobox"]')[2] as HTMLElement;
  fireEvent.click(source);
  fireEvent.keyDown(source, { key: 'Enter' });
  await new Promise((res) => setTimeout(res, 20));
  const upload = [...document.querySelectorAll('[role="option"]')].find((o) =>
    /upload a file/i.test(o.textContent ?? ''),
  );
  if (!upload) throw new Error('no upload option');
  fireEvent.click(upload);
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
    await waitFor(() => expect(r.container.textContent).toMatch(/could not reach the firmware/i));
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
    const chip = r.container.querySelectorAll('[role="combobox"]')[0] as HTMLElement;
    fireEvent.click(chip);
    fireEvent.keyDown(chip, { key: 'Enter' });
    await new Promise((res) => setTimeout(res, 20));
    const mouseSide = [...document.querySelectorAll('[role="option"]')].find((o) =>
      /mouse-side/i.test(o.textContent ?? ''),
    );
    if (!mouseSide) throw new Error('no mouse-side option');
    fireEvent.click(mouseSide);
    await openGate(r);
    await waitFor(() => expect(r.container.textContent).toMatch(/button next to USB3/i));
    expect(r.container.textContent).not.toMatch(/button next to USB1/i);
  });

  it('a rejection from the file picker is not wiped by the empty selection it comes with', async () => {
    // FileUpload calls onError and THEN onChange([]), which re-enters onFiles: clearing there
    // unconditionally erased the reason in the same tick it was set.
    const r = render(() => <Advanced />);
    await openGate(r);
    const source = r.container.querySelectorAll('[role="combobox"]')[2] as HTMLElement;
    fireEvent.click(source);
    fireEvent.keyDown(source, { key: 'Enter' });
    await new Promise((res) => setTimeout(res, 20));
    const upload = [...document.querySelectorAll('[role="option"]')].find((o) =>
      /upload a file/i.test(o.textContent ?? ''),
    );
    if (!upload) throw new Error('no upload option');
    fireEvent.click(upload);
    const input = await waitFor(() => {
      const el = r.container.querySelector('input[type="file"]');
      if (!el) throw new Error('no file input');
      return el as HTMLInputElement;
    });
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
    const chip = r.container.querySelectorAll('[role="combobox"]')[0] as HTMLElement;
    fireEvent.click(chip);
    fireEvent.keyDown(chip, { key: 'Enter' });
    await new Promise((res) => setTimeout(res, 20));
    const mouseSide = [...document.querySelectorAll('[role="option"]')].find((o) =>
      /mouse-side/i.test(o.textContent ?? ''),
    );
    if (!mouseSide) throw new Error('no mouse-side option');
    fireEvent.click(mouseSide);
    await waitFor(() => expect(r.queryByRole('alert')).toBeNull());
  });

  it('the chip and image cannot be changed while a flash is in flight', async () => {
    // They were live across `requestRomPort` and `downloadAsset`, so a switch mid-download changed
    // which offset the bytes went to -- an app image at 0x0 takes the bootloader with it.
    mock.holdFlash = true;
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => {
      const boxes = [...r.container.querySelectorAll('.combobox--disabled')];
      // Chip, image and source: all three were live across the two awaits.
      expect(boxes).toHaveLength(3);
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
    const chip = r.container.querySelectorAll('[role="combobox"]')[0] as HTMLElement;
    fireEvent.click(chip);
    fireEvent.keyDown(chip, { key: 'Enter' });
    await new Promise((res) => setTimeout(res, 20));
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => expect(r.container.querySelectorAll('.combobox--disabled')).toHaveLength(3));
    const mouseSide = [...document.querySelectorAll('[role="option"]')].find((o) =>
      /mouse-side/i.test(o.textContent ?? ''),
    );
    if (mouseSide) fireEvent.click(mouseSide);
    // Still the main chip: the selection did not take.
    expect(r.container.textContent).toMatch(/Main chip/i);
  });



  it('the success screen offers a way onward, not just another flash', async () => {
    const r = render(() => <Advanced />);
    await openGate(r);
    r.getByRole('button', { name: /^flash$/i }).click();
    await waitFor(() => r.getByRole('button', { name: /go to my box/i }));
    r.getByRole('button', { name: /go to my box/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
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

    // The option list renders through a portal, so it is read off the document, and it only exists
    // once the combobox is open. SOURCE is the third one on the page.
    const source = r.container.querySelectorAll('[role="combobox"]')[2] as HTMLElement;
    fireEvent.click(source);
    fireEvent.keyDown(source, { key: 'Enter' });
    await new Promise((res) => setTimeout(res, 20));
    const upload = [...document.querySelectorAll('[role="option"]')].find((o) =>
      /upload a file/i.test(o.textContent ?? ''),
    );
    if (!upload) throw new Error('no upload option');
    fireEvent.click(upload);
    const input = await waitFor(() => {
      const el = r.container.querySelector('input[type="file"]');
      if (!el) throw new Error('no file input');
      return el as HTMLInputElement;
    });

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
});
