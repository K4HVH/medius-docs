import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'solid-js';

// The flasher's chunk failing to load, as a deploy since the page opened leaves it.
vi.mock('../../src/dashboard/flash/flasher', () => {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/flasher-old.js');
});

import { createNativeFlash } from '../../src/app/pages/dashboard/nativeFlash';

describe('a flasher that does not load', () => {
  it('says to reload the page, and nothing about the chip it never reached', async () => {
    const f = createRoot(() => createNativeFlash());
    expect(await f.flashStock({} as SerialPort, 'device', new Uint8Array(1), new Uint8Array(1), 'advanced')).toBe(false);
    expect(f.error()).toBe("The flasher didn't load. Reload the page, then try again.");
  });
});
