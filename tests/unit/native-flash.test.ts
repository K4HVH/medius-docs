import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';
import type { FlashProgress } from '../../src/dashboard/flash';

// How a ROM flash fails: the phase it reached, then what it throws.
const fail = vi.hoisted(() => ({ phase: 'writing' as FlashProgress['phase'], error: new Error('The chip stopped answering.') as unknown }));

vi.mock('../../src/dashboard/flash/flasher', async () => {
  const types = await vi.importActual<typeof import('../../src/dashboard/flash/types')>('../../src/dashboard/flash/types');
  const run = async (p: { onProgress?: (x: FlashProgress) => void }) => {
    p.onProgress?.({ phase: 'connecting' });
    if (fail.phase !== 'connecting') p.onProgress?.({ phase: fail.phase, written: 1, total: 2 });
    throw fail.error;
  };
  return { flashStock: run, flashNativePort: run, WrongChipError: types.WrongChipError };
});

import { createNativeFlash } from '../../src/app/pages/dashboard/nativeFlash';
import { NotTheBox, WrongChipError } from '../../src/dashboard/flash';

const port = {} as SerialPort;
const image = new Uint8Array(4096);
image[0] = 0xe9;
const stock = async () => {
  const f = createRoot(() => createNativeFlash());
  await f.flashStock(port, 'device', new Uint8Array(10), new Uint8Array(10), 'advanced');
  return f.error();
};

beforeEach(() => {
  fail.phase = 'writing';
  fail.error = new Error('The chip stopped answering.');
});

describe('a ROM flash that fails', () => {
  it('names the chip that may not start once the erase or the write began, then says what to do', async () => {
    for (const phase of ['erasing', 'writing'] as const) {
      fail.phase = phase;
      expect(await stock()).toBe("The chip stopped answering. The main chip may not start until it's flashed again. Replug it with the button held, then try again.");
    }
    const f = createRoot(() => createNativeFlash());
    await f.flash(port, image, 'factory', { page: 'setup', chip: 'host', source: 'release' });
    expect(f.error()).toBe("The chip stopped answering. The mouse-side chip may not start until it's flashed again. Replug it with the button held, then try again.");
  });

  it('before anything was written, says only what to do', async () => {
    fail.phase = 'connecting';
    fail.error = new Error("The chip didn't answer.");
    expect(await stock()).toBe("The chip didn't answer. Replug it with the button held, then try again.");
  });

  it('says the box went away when the device is lost', async () => {
    fail.error = new DOMException('The device has been lost.', 'NetworkError');
    expect(await stock()).toBe("The box went away partway through. The main chip may not start until it's flashed again. Replug it with the button held, then try again.");
  });

  it('keeps the action of a wrong chip and of a part that is not the box', async () => {
    fail.phase = 'connecting';
    fail.error = new WrongChipError('host', true);
    expect(await stock()).toBe(new WrongChipError('host', true).message);
    fail.error = new NotTheBox();
    expect(await stock()).toBe(new NotTheBox().message);
  });
});
