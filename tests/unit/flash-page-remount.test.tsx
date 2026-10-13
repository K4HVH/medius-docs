import { it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { type Boxes, createBoxes } from '../../src/app/pages/dashboard/boxes';
import { createBoxStore } from '../../src/app/pages/dashboard/store';
import { BoxesContext, NativeFlashContext, type NativeFlash } from '../../src/app/pages/dashboard/context';
import { probePort } from '../../src/dashboard/serial';
import { FakeBox, FakePort, FakeSerial, makeFakeLink } from './fake-boxes';

vi.mock('../../src/dashboard/firmware', async () => ({
  ...(await vi.importActual<typeof import('../../src/dashboard/firmware')>('../../src/dashboard/firmware')),
  fetchReleases: async () => [
    {
      tag: 'v3.4.4',
      assets: [
        { name: 'medius_device-factory.bin', size: 4096, url: 'd' },
        { name: 'medius_host-factory.bin', size: 4096, url: 'h' },
      ],
    },
  ],
  downloadAsset: async () => new Uint8Array(4096),
}));
vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/dashboard/advanced', hash: '' }),
  A: (p: { children: unknown }) => p.children,
}));

import Advanced from '../../src/app/pages/dashboard/Flash';

afterEach(() => cleanup());

it('a ROM flash half set up keeps its choices when USB2 is unplugged, as its diagram asks', async () => {
  const desk = new FakeBox({ mac: [0x58, 0x8c, 0x81, 0xe0, 0x82, 1], name: 'Desk' });
  const port = new FakePort(desk);
  const serial = new FakeSerial([port]);
  const [running] = createSignal(false);
  const native = {
    progress: () => null,
    error: () => null,
    running,
    clear: () => {},
    flash: async () => true,
  } as unknown as NativeFlash;
  let boxes!: Boxes;
  const r = render(() => {
    boxes = createBoxes({
      serial,
      store: createBoxStore(null),
      supported: true,
      secure: true,
      nativeFlashing: running,
      probe: (p: SerialPort) => probePort(p, (pp) => makeFakeLink(pp, {})),
      makeLink: makeFakeLink,
    });
    boxes.start();
    return (
      <NativeFlashContext.Provider value={native}>
        <BoxesContext.Provider value={boxes}>
          <Advanced />
        </BoxesContext.Provider>
      </NativeFlashContext.Provider>
    );
  });
  await waitFor(() => expect(boxes.selected()?.session.name()).toBe('Desk'), { timeout: 3000 });
  // Not connected, so Via starts on ROM download, with the Chip choice under its label.
  const field = () =>
    [...r.container.querySelectorAll('.labelled')].find((el) => el.querySelector('.field-l')?.textContent === 'Chip');
  const chip = () => field()?.querySelector('[aria-checked="true"]')?.textContent ?? '';
  await waitFor(() => expect(field()).toBeTruthy());
  const mouseSide = [...field()!.querySelectorAll('[role="radio"]')].find((x) => /mouse-side/i.test(x.textContent ?? ''));
  fireEvent.click(mouseSide as HTMLElement);
  await waitFor(() => expect(chip()).toMatch(/Mouse-side chip/));
  serial.unplug(port);
  await waitFor(() => expect(boxes.selected()).toBeNull());
  expect(chip()).toMatch(/Mouse-side chip/);
});
