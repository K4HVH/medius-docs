import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import type { ConnectVerdict } from '../../src/dashboard/serial';
import { PROTO_VER } from '../../src/dashboard/protocol';

// The dashboard's landing page had no test file, so its browser-support wording could drift from
// every other page's without anything noticing.
const mock = vi.hoisted(() => ({
  supported: true,
  secure: true,
  status: 'disconnected' as string,
  updateOnly: false,
  verdict: null as ConnectVerdict | null,
  error: null as string | null,
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    supported: mock.supported,
    secure: mock.secure,
    status: () => mock.status,
    updateOnly: () => mock.updateOnly,
    verdict: () => mock.verdict,
    error: () => mock.error,
    // Update-only is a 3.2.0 box on protocol 5; the full page is a 3.4.2 box on the current wire.
    version: () =>
      mock.updateOnly
        ? { protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' }
        : { protoVer: PROTO_VER, fwMajor: 3, fwMinor: 4, fwPatch: 2, mac: [], name: '' },
    health: () => null,
    connect: async () => {},
    disconnect: async () => {},
    deviceLog: () => [],
    clearDeviceLog: () => {},
    poll: () => () => null,
    refreshPoll: () => {},
  }),
}));

vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
  A: (p: { children: unknown }) => p.children,
}));

import Device from '../../src/app/pages/dashboard/Device';

afterEach(() => {
  cleanup();
  mock.supported = true;
  mock.secure = true;
  mock.status = 'disconnected';
  mock.updateOnly = false;
  mock.verdict = null;
  mock.error = null;
});

describe('Device', () => {
  it('uses the same browser wording as every other page, not its own', async () => {
    mock.supported = false;
    const { container } = render(() => <Device />);
    await waitFor(() => expect(container.textContent).toMatch(/can't talk to your box/i));
    // The old wording named three browsers and said "reach USB devices"; one condition, one sentence.
    expect(container.textContent).not.toMatch(/reach USB devices|Edge, or Opera/i);
  });

  it('uses the same insecure-context wording, without naming Web Serial', async () => {
    mock.secure = false;
    const { container } = render(() => <Device />);
    await waitFor(() => expect(container.textContent).toMatch(/isn't secure/i));
    expect(container.textContent).not.toMatch(/Web Serial|secure context|HTTPS/i);
  });

  it('a failed connect says why, through the shared panel', async () => {
    mock.verdict = { kind: 'no-port' };
    const { getByRole } = render(() => <Device />);
    await waitFor(() => expect(getByRole('alert').textContent).toContain('USB2'));
  });

  it('a box on the older wire is told to update, not shown controls it cannot drive', async () => {
    // The box connects so that one-click update can reach it; the rest of the page speaks the
    // current wire. Showing those panels anyway would put controls in front of the user that
    // silently do nothing, so the page has to say why they are gone.
    mock.status = 'connected';
    mock.updateOnly = true;
    const { container } = render(() => <Device />);
    await waitFor(() => {
      const text = container.textContent ?? '';
      expect(text).toMatch(/Update needed/i);
      expect(text).toMatch(/use the rest of the dashboard/i);
      // the live-health panel belongs to the current wire and must not be offered
      expect(text).not.toMatch(/Live device health/i);
    });
  });

  it('a box on the current wire keeps the whole page', async () => {
    mock.status = 'connected';
    mock.updateOnly = false;
    const { container } = render(() => <Device />);
    await waitFor(() => {
      const text = container.textContent ?? '';
      expect(text).not.toMatch(/Update needed/i);
      expect(text).toMatch(/Live device health/i);
    });
  });

  it('offers the factory reset beside the settings it erases, and says what goes', async () => {
    // It sits on this tab and not with the momentary controls, because what it erases is the
    // persistent half. The copy has to name that cost: the button is not undoable.
    mock.status = 'connected';
    mock.updateOnly = false;
    const { container } = render(() => <Device />);
    await waitFor(() => {
      const text = container.textContent ?? '';
      expect(text).toMatch(/Factory reset/i);
      expect(text).toMatch(/Erase everything saved/i);
      expect(text).toMatch(/box name/i);
      expect(text).toMatch(/learned/i);
      expect(text).toMatch(/then restarts/i);
      // it neither disconnects nor acknowledges: the port stays enumerated and RESET has no reply
      expect(text).not.toMatch(/reconnects on its own/i);
      expect(text).not.toMatch(/Erased\./i);
    });
    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      /Erase and restart/i.test(b.textContent ?? ''),
    );
    expect(button, 'the factory reset needs a button, not just prose').toBeTruthy();
  });

  it('keeps the factory reset off a box that cannot take the frame', async () => {
    // An update-only box speaks an older wire with no flags byte on RESET, so the button would
    // silently do a plain reset instead of what it says.
    mock.status = 'connected';
    mock.updateOnly = true;
    const { container } = render(() => <Device />);
    await waitFor(() => {
      expect(container.textContent ?? '').not.toMatch(/Factory reset/i);
    });
  });
});
