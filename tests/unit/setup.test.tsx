import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';

const mock = vi.hoisted(() => ({
  supported: true,
  status: 'disconnected' as string,
  flashOk: true,
  chooserEmpty: false,
  releasesThrow: false,
  disconnects: 0,
  flashed: [] as string[],
  romCalls: 0,
  assets: [
    { name: 'medius_device-factory.bin', size: 1, url: 'd' },
    { name: 'medius_host-factory.bin', size: 1, url: 'h' },
  ] as { name: string; size: number; url: string }[],
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    supported: mock.supported,
    secure: true,
    status: () => mock.status,
    verdict: () => null,
    error: () => null,
    version: () => ({ protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' }),
    flashProgress: () => null,
    connect: async () => {},
    disconnect: async () => {
      mock.disconnects += 1;
    },
    clearFlashResult: () => {},
    flashNative: async (_port: unknown, image: Uint8Array) => {
      mock.flashed.push(new TextDecoder().decode(image));
      return mock.flashOk;
    },
  }),
}));

vi.mock('../../src/dashboard/firmware', () => ({
  fetchReleases: async () => {
    if (mock.releasesThrow) throw new Error('firmware fetch is not set up on this server');
    return [{ tag: 'v3.2.0', assets: mock.assets }];
  },
  downloadAsset: async (a: { name: string }) => new TextEncoder().encode(a.name),
}));

vi.mock('../../src/dashboard/serial', () => ({
  requestRomPort: async () => {
    mock.romCalls += 1;
    if (mock.chooserEmpty) throw new DOMException('No port selected', 'NotFoundError');
    return {} as SerialPort;
  },
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import Setup from '../../src/app/pages/dashboard/Setup';

afterEach(() => {
  cleanup();
  mock.supported = true;
  mock.status = 'disconnected';
  mock.flashOk = true;
  mock.chooserEmpty = false;
  mock.releasesThrow = false;
  mock.disconnects = 0;
  mock.flashed = [];
  mock.romCalls = 0;
  mock.assets = [
    { name: 'medius_device-factory.bin', size: 1, url: 'd' },
    { name: 'medius_host-factory.bin', size: 1, url: 'h' },
  ];
  navigate.mockClear();
});

// Walk the wizard: pick a topology, install the main chip, confirm USB1 is out, install the
// mouse-side chip. Returns the render result sitting on the last screen.
const walk = async (topology: RegExp) => {
  const r = render(() => <Setup />);
  await waitFor(() => r.getByRole('button', { name: topology }));
  r.getByRole('button', { name: topology }).click();
  await waitFor(() => r.getByRole('button', { name: /^install$/i }));
  r.getByRole('button', { name: /^install$/i }).click();
  await waitFor(() => r.getByRole('button', { name: /unplugged/i }));
  r.getByRole('button', { name: /unplugged/i }).click();
  await waitFor(() => r.getByRole('button', { name: /^install$/i }));
  r.getByRole('button', { name: /^install$/i }).click();
  await waitFor(() => r.getByRole('button', { name: /unplugged/i }));
  r.getByRole('button', { name: /unplugged/i }).click();
  return r;
};

describe('Setup', () => {
  it('starts by asking which computer this is', async () => {
    const { container } = render(() => <Setup />);
    await waitFor(() => expect(container.textContent).toMatch(/which computer is this/i));
  });

  it('every install screen asks for both buttons, and names no chip', async () => {
    const r = render(() => <Setup />);
    r.getByRole('button', { name: /just one computer/i }).click();
    await waitFor(() => expect(r.container.textContent).toContain('BOTH'));
    expect(r.container.textContent).not.toMatch(/left button|right button|main chip|mouse-side chip/i);
  });

  it('an empty chooser lands on a retry that says what to fix, not on nothing', async () => {
    mock.chooserEmpty = true;
    const r = render(() => <Setup />);
    r.getByRole('button', { name: /just one computer/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    r.getByRole('button', { name: /^install$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/hold both/i));
    expect(r.getByRole('button', { name: /^install$/i })).toBeTruthy();
    expect(mock.flashed).toEqual([]);
  });

  it('a flash that fails stays on the same step', async () => {
    mock.flashOk = false;
    const r = render(() => <Setup />);
    r.getByRole('button', { name: /just one computer/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    r.getByRole('button', { name: /^install$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/did not finish/i));
    expect(r.queryByRole('button', { name: /unplugged/i })).toBeNull();
  });

  it('a release with no factory image never reaches the chooser', async () => {
    mock.assets = [];
    const r = render(() => <Setup />);
    r.getByRole('button', { name: /just one computer/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    r.getByRole('button', { name: /^install$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/isn't ready yet/i));
    expect(mock.romCalls).toBe(0);
  });

  it('the mouse-side step is gated on USB1 being out', async () => {
    const r = render(() => <Setup />);
    r.getByRole('button', { name: /just one computer/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    r.getByRole('button', { name: /^install$/i }).click();
    await waitFor(() => r.getByRole('button', { name: /unplugged/i }));
    expect(r.container.textContent).toMatch(/can kill it/i);
    expect(r.queryByRole('button', { name: /^install$/i })).toBeNull();
  });

  it('writes the main chip image first and the mouse-side image second, never the other way', async () => {
    await walk(/just one computer/i);
    await waitFor(() =>
      expect(mock.flashed).toEqual(['medius_device-factory.bin', 'medius_host-factory.bin']),
    );
  });

  it('will not let the user reach USB3 without taking USB1 out, or USB1 back without taking USB3 out', async () => {
    const r = render(() => <Setup />);
    r.getByRole('button', { name: /just one computer/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    r.getByRole('button', { name: /^install$/i }).click();
    // First gate: USB1 out before the USB3 install.
    await waitFor(() => expect(r.container.textContent).toMatch(/take usb1 out/i));
    r.getByRole('button', { name: /unplugged/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    r.getByRole('button', { name: /^install$/i }).click();
    // Second gate: USB3 out before anything invites USB1 back in.
    await waitFor(() => expect(r.container.textContent).toMatch(/take usb3 out/i));
    expect(r.queryByRole('button', { name: /^connect$/i })).toBeNull();
  });

  it('a release fetch that failed leaves a message, not a button that does nothing', async () => {
    mock.releasesThrow = true;
    const r = render(() => <Setup />);
    r.getByRole('button', { name: /just one computer/i }).click();
    await waitFor(() => r.getByRole('button', { name: /^install$/i }));
    r.getByRole('button', { name: /^install$/i }).click();
    await waitFor(() => expect(r.container.textContent).toMatch(/isn't ready yet/i));
    expect(mock.romCalls).toBe(0);
  });

  it('drops a live link before touching the chips, so Done cannot show the old version', async () => {
    render(() => <Setup />).getByRole('button', { name: /just one computer/i }).click();
    expect(mock.disconnects).toBe(1);
  });

  it('tells a two-computer owner where USB2 goes, and offers no connect here', async () => {
    const r = await walk(/one I play on/i);
    await waitFor(() => expect(r.container.textContent).toMatch(/other computer/i));
    expect(r.queryByRole('button', { name: /^connect$/i })).toBeNull();
    expect(r.getByRole('button', { name: /finish/i })).toBeTruthy();
  });

  it('a one-computer owner finishes on connect', async () => {
    const r = await walk(/just one computer/i);
    await waitFor(() => r.getByRole('button', { name: /^connect$/i }));
    expect(r.container.textContent).toMatch(/plug in like this/i);
  });

  it('an owner setting up from the control PC is told the gaming PC takes USB1', async () => {
    const r = await walk(/on the other one/i);
    await waitFor(() => r.getByRole('button', { name: /^connect$/i }));
    expect(r.container.textContent).toContain('Gaming PC');
  });

  it('once connected it says so and stops', async () => {
    const r = await walk(/just one computer/i);
    await waitFor(() => r.getByRole('button', { name: /^connect$/i }));
    mock.status = 'connected';
    cleanup();
    const again = await walk(/just one computer/i);
    await waitFor(() => expect(again.container.textContent).toMatch(/3\.2\.0/));
    again.getByRole('button', { name: /finish/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('an unsupported browser gets the reason and no wizard at all', async () => {
    mock.supported = false;
    const { container, queryByRole } = render(() => <Setup />);
    expect(container.textContent).toMatch(/Chrome/);
    expect(queryByRole('button')).toBeNull();
  });
});
