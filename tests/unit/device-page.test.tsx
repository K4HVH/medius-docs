import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import type { ConnectVerdict } from '../../src/dashboard/serial';
import { PROTO_VER } from '../../src/dashboard/protocol';

// The dashboard's landing page had no test file, so its browser-support wording could drift from
// every other page's without anything noticing.
const mock = vi.hoisted(() => ({
  identifies: 0,
  identifying: false,
  identifyRefused: false,
  setLink: (_l: object | null) => {},
  supported: true,
  secure: true,
  status: 'disconnected' as string,
  updateOnly: false,
  // The protocol an update-only box speaks.
  protoVer: 5,
  verdict: null as ConnectVerdict | null,
  // The page that started the update in flight.
  runPage: 'update',
  error: null as string | null,
}));

vi.mock('../../src/app/pages/dashboard/context', async () => {
  const { createSignal } = await import('solid-js');
  const [link, setLink] = createSignal<object | null>({});
  mock.setLink = setLink;
  return {
  useDashboard: () => ({
    link,
    supported: mock.supported,
    secure: mock.secure,
    status: () => mock.status,
    held: () => mock.status === 'lost',
    present: () => true,
    updateOnly: () => mock.updateOnly,
    verdict: () => mock.verdict,
    error: () => mock.error,
    // Update-only is a 3.2.0 box on protocol 5 unless a test says otherwise; the full page is a 3.4.2
    // box on the current wire.
    version: () =>
      mock.updateOnly
        ? { protoVer: mock.protoVer, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [], name: '' }
        : { protoVer: PROTO_VER, fwMajor: 3, fwMinor: 4, fwPatch: 2, mac: [], name: '' },
    health: () => null,
    connect: async () => {},
    disconnect: async () => {},
    identify: async () => {
      mock.identifies += 1;
      if (mock.identifyRefused) throw new Error('The box refused that.');
    },
    identifying: () => mock.identifying,
    update: () => ({ device: true, host: true, page: mock.runPage, outcome: 'running' }),
    deviceLog: () => [],
    deviceLogAdded: () => 0,
    clearDeviceLog: () => {},
    poll: () => () => null,
    refreshPoll: () => {},
  }),
  };
});

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
  A: (p: { children: unknown }) => p.children,
  useLocation: () => ({ pathname: '/dashboard', hash: '' }),
}));

import Device from '../../src/app/pages/dashboard/Device';

afterEach(() => {
  cleanup();
  mock.supported = true;
  mock.secure = true;
  mock.status = 'disconnected';
  mock.updateOnly = false;
  mock.protoVer = 5;
  mock.runPage = 'update';
  mock.verdict = null;
  mock.error = null;
});

describe('Device', () => {
  it('keeps the page in a browser without Web Serial, with the reason where Connect was', async () => {
    mock.supported = false;
    const { container, queryByRole } = render(() => <Device />);
    await waitFor(() => expect(container.textContent).toContain('Your box'));
    expect(container.textContent).toMatch(/can't talk to your box/i);
    expect(container.textContent).not.toMatch(/Browser not supported/);
    expect(queryByRole('button', { name: /^connect$/i })).toBeNull();
  });

  it('keeps the page on an insecure origin, with the reason where Connect was', async () => {
    mock.secure = false;
    const { container } = render(() => <Device />);
    await waitFor(() => expect(container.textContent).toContain('Your box'));
    expect(container.textContent).toMatch(/isn't secure/i);
    expect(container.textContent).not.toMatch(/Page not secure/);
  });

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
      expect(container.querySelector('#status')).toBeNull();
    });
  });

  it('a box newer than the page is called newer and pointed at Reload and the manual flash, never told to update', async () => {
    mock.status = 'connected';
    mock.updateOnly = true;
    mock.protoVer = PROTO_VER + 1;
    const reload = vi.fn();
    const real = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...real, reload } });
    try {
      const { container, getByRole } = render(() => <Device />);
      await waitFor(() => expect(container.textContent).toMatch(/Newer firmware/));
      const text = container.textContent ?? '';
      expect(text).toContain(`This box speaks protocol ${PROTO_VER + 1} and this page protocol ${PROTO_VER}.`);
      expect(text).toContain("It can still be flashed by hand, on Update's Manual tab.");
      expect(text).not.toMatch(/Update needed/i);
      expect(container.querySelector('#status')).toBeNull();
      getByRole('button', { name: 'Manual flash' }).click();
      expect(navigate).toHaveBeenCalledWith('/dashboard/update#manual');
      getByRole('button', { name: /reload/i }).click();
      expect(reload).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: real });
    }
  });

  it('a box on the current wire keeps the whole page', async () => {
    mock.status = 'connected';
    mock.updateOnly = false;
    const { container } = render(() => <Device />);
    await waitFor(() => {
      const text = container.textContent ?? '';
      expect(text).not.toMatch(/Update needed/i);
      expect(container.querySelector('#status')).not.toBeNull();
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

  it('a box that stopped answering keeps its card, with the reason and Disconnect', async () => {
    mock.status = 'lost';
    const { getByRole, queryByRole } = render(() => <Device />);
    expect(getByRole('alert').textContent).toMatch(/isn't answering/i);
    expect(getByRole('button', { name: /disconnect/i })).toBeTruthy();
    expect(queryByRole('button', { name: /^connect$/i })).toBeNull();
  });

  it('while this box updates, the card takes you to its progress', async () => {
    mock.status = 'flashing';
    const { getByRole } = render(() => <Device />);
    const go = getByRole('button', { name: /go to update/i }) as HTMLButtonElement;
    expect(go.disabled).toBe(false);
    go.click();
    expect(navigate).toHaveBeenCalledWith('/dashboard/update');
  });

  it('names the box as updating in the header, not as disconnected, while it updates', async () => {
    mock.status = 'flashing';
    const { container } = render(() => <Device />);
    expect(container.querySelector('.conn')!.textContent).toMatch(/^Updating/);
    mock.status = 'lost';
    cleanup();
    const lost = render(() => <Device />);
    expect(lost.container.querySelector('.conn')!.textContent).toMatch(/^Not answering/);
  });

  it('while the manual flash runs on this box, the card takes you to it', async () => {
    mock.status = 'flashing';
    mock.runPage = 'advanced';
    const { getByRole } = render(() => <Device />);
    getByRole('button', { name: /go to manual flash/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard/update#manual');
  });

  it('offers no Identify for a box newer than the page: the light command may have changed', () => {
    mock.status = 'connected';
    mock.updateOnly = true;
    mock.protoVer = PROTO_VER + 1;
    const { queryByRole, getByRole } = render(() => <Device />);
    expect(queryByRole('button', { name: 'Identify' })).toBeNull();
    expect(getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('an older box still gets Identify: the light command is the same from protocol 5 on', () => {
    mock.status = 'connected';
    mock.updateOnly = true;
    mock.protoVer = 5;
    const { getByRole } = render(() => <Device />);
    expect(getByRole('button', { name: 'Identify' })).toBeTruthy();
  });

  it('Identify on the card blinks the box, beside Disconnect', () => {
    mock.status = 'connected';
    const { getAllByRole, getByRole } = render(() => <Device />);
    const names = getAllByRole('button').map((b) => b.textContent?.trim());
    expect(names.indexOf('Identify')).toBe(names.indexOf('Disconnect') - 1);
    getByRole('button', { name: 'Identify' }).click();
    expect(mock.identifies).toBe(1);
  });

  it('a refused identify says so under the buttons that sent it', async () => {
    mock.status = 'connected';
    mock.identifyRefused = true;
    const { getByRole, findByRole } = render(() => <Device />);
    getByRole('button', { name: 'Identify' }).click();
    expect((await findByRole('alert')).textContent).toBe('The box refused that.');
    mock.identifyRefused = false;
  });

  it('drops a refused identify once the box is reached over a new link', async () => {
    mock.status = 'connected';
    mock.identifyRefused = true;
    const { getByRole, findByRole, queryByRole } = render(() => <Device />);
    getByRole('button', { name: 'Identify' }).click();
    await findByRole('alert');
    mock.identifyRefused = false;
    mock.setLink({});
    await waitFor(() => expect(queryByRole('alert')).toBeNull());
  });

  it('says it is identifying while the light blinks', () => {
    mock.status = 'connected';
    mock.identifying = true;
    const { getByRole } = render(() => <Device />);
    expect(getByRole('button', { name: /identifying\.\.\./i })).toBeTruthy();
    mock.identifying = false;
  });
});
