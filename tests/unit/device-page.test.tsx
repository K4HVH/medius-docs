import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import type { ConnectVerdict } from '../../src/dashboard/serial';

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
    version: () => ({ protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' }),
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
      expect(text).toMatch(/previous control protocol/i);
      expect(text).toMatch(/one-click update still works/i);
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
      expect(text).not.toMatch(/previous control protocol/i);
      expect(text).toMatch(/Live device health/i);
    });
  });
});
