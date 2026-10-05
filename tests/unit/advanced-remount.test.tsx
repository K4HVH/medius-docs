import { it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { type Boxes, createBoxes } from '../../src/app/pages/dashboard/boxes';
import { createBoxStore } from '../../src/app/pages/dashboard/store';
import { BoxesContext, NativeFlashContext, type NativeFlash } from '../../src/app/pages/dashboard/context';
import { probePort } from '../../src/dashboard/serial';
import { FakeBox, FakePort, FakeSerial, makeFakeLink } from './fake-boxes';

vi.mock('../../src/dashboard/firmware', () => ({
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
vi.mock('@solidjs/router', () => ({ useNavigate: () => vi.fn() }));

import Advanced from '../../src/app/pages/dashboard/Advanced';

afterEach(() => cleanup());

it('a ROM flash half set up keeps its choices when USB2 is unplugged, as its diagram asks', async () => {
  const desk = new FakeBox({ mac: [0x58, 0x8c, 0x81, 0xe0, 0x82, 1], name: 'Desk' });
  const port = new FakePort(desk);
  const serial = new FakeSerial([port]);
  const [running] = createSignal(false);
  const native = {
    progress: () => null,
    log: () => [],
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
  // Not connected, so Via starts on the chip's own USB: CHIP is the second dropdown.
  const chip = () => r.container.querySelectorAll('[role="combobox"]')[1] as HTMLElement;
  await waitFor(() => expect(chip()).toBeTruthy());
  fireEvent.click(chip());
  fireEvent.keyDown(chip(), { key: 'Enter' });
  await new Promise((x) => setTimeout(x, 20));
  fireEvent.click([...document.querySelectorAll('[role="option"]')].find((o) => /mouse-side/i.test(o.textContent ?? ''))!);
  await waitFor(() => expect(chip().textContent).toMatch(/Mouse-side chip/));
  serial.unplug(port);
  await waitFor(() => expect(boxes.selected()).toBeNull());
  expect(chip().textContent).toMatch(/Mouse-side chip/);
});
