import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import type { ConnectVerdict } from '../../src/dashboard/serial';

const st = vi.hoisted(() => ({
  make: () => {
    const [status, setStatus] = createSignal<string>('disconnected');
    const [held, setHeld] = createSignal(false);
    const [present, setPresent] = createSignal(true);
    const [verdict, setVerdict] = createSignal<ConnectVerdict | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    return { status, setStatus, held, setHeld, present, setPresent, verdict, setVerdict, error, setError };
  },
}));

const mock = vi.hoisted(() => ({
  s: null as ReturnType<(typeof st)['make']> | null,
  supported: true,
  secure: true,
  connect: vi.fn(async () => {}),
  disconnects: 0,
  forgets: 0,
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    supported: mock.supported,
    secure: mock.secure,
    error: () => mock.s!.error(),
    status: () => mock.s!.status(),
    held: () => mock.s!.held(),
    present: () => mock.s!.present(),
    verdict: () => mock.s!.verdict(),
    connect: mock.connect,
    disconnect: async () => {
      mock.disconnects += 1;
      mock.s!.setHeld(false);
      mock.s!.setStatus('disconnected');
    },
    forget: async () => {
      mock.forgets += 1;
      mock.s!.setHeld(false);
      mock.s!.setStatus('disconnected');
    },
  }),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import { ConnectPanel } from '../../src/app/pages/dashboard/ConnectPanel';

beforeEach(() => {
  mock.s = st.make();
});

afterEach(() => {
  cleanup();
  mock.disconnects = 0;
  mock.forgets = 0;
  mock.supported = true;
  mock.secure = true;
  mock.connect.mockClear();
  navigate.mockClear();
});

// A 3.1.0 box: protocol 4, below the oldest the page opens.
const version = { protoVer: 4, fwMajor: 3, fwMinor: 1, fwPatch: 0, mac: [0, 0, 0, 0, 0, 0], name: '' };

describe('ConnectPanel', () => {
  it('says boxes that connect are counted, linking the stats page', () => {
    const { getByRole, container } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('Boxes that connect are counted on the public stats page.');
    const link = getByRole('link', { name: 'public stats page' });
    expect(link.getAttribute('href')).toBe('/dashboard/stats');
    link.click();
    expect(navigate).toHaveBeenCalledWith('/dashboard/stats');
  });

  it('offers one Connect button before anything has been tried', () => {
    const { getByRole, getAllByRole } = render(() => <ConnectPanel />);
    expect(getByRole('button', { name: /connect/i })).toBeTruthy();
    expect(getAllByRole('button')).toHaveLength(1);
  });

  it('an older box is named and sent to the install', () => {
    mock.s!.setVerdict({ kind: 'old-firmware', version });
    const { getByRole, container } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('3.1.0');
    getByRole('button', { name: /set up/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard/setup');
  });

  it('a port the browser cannot read says to replug USB2', () => {
    mock.s!.setVerdict({ kind: 'unreadable' });
    const { container, getByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain("This computer can't read from the box. Unplug USB2 and plug it back in.");
    expect(getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('no port names the cable and the computer', () => {
    mock.s!.setVerdict({ kind: 'no-port' });
    const { getByRole } = render(() => <ConnectPanel />);
    const alert = getByRole('alert');
    expect(alert.textContent).toContain('USB2');
    expect(alert.textContent).toMatch(/this computer/i);
    getByRole('button', { name: /try again/i }).click();
    expect(mock.connect).toHaveBeenCalled();
  });

  it('a silent box is told to plug the other cable in', () => {
    mock.s!.setVerdict({ kind: 'silent' });
    const { getByRole } = render(() => <ConnectPanel />);
    const alert = getByRole('alert');
    expect(alert.textContent).toContain('USB1');
    expect(alert.textContent).not.toContain('USB3');
    expect(getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('a held port says to close what is holding it', () => {
    mock.s!.setVerdict({ kind: 'busy' });
    const { container, getAllByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('Another tab or program has this box open. Close it.');
    expect(getAllByRole('button')).toHaveLength(1);
  });

  it('an unsupported browser is a dead end with nothing to press', () => {
    mock.supported = false;
    const { queryByRole, container } = render(() => <ConnectPanel />);
    expect(container.textContent).toMatch(/Chrome/);
    expect(queryByRole('button')).toBeNull();
  });

  it('an insecure page says what to open instead, with nothing to press', () => {
    mock.secure = false;
    const { queryByRole, container } = render(() => <ConnectPanel />);
    expect(container.textContent).toMatch(/isn't secure/i);
    expect(queryByRole('button')).toBeNull();
  });

  it('an unrecognised failure still shows its own message and a retry', () => {
    mock.s!.setVerdict({ kind: 'other', message: 'the port fell over' });
    const { container, getByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('the port fell over');
    expect(getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('only one button carries weight on a recoverable failure', () => {
    mock.s!.setVerdict({ kind: 'no-port' });
    const { container } = render(() => <ConnectPanel />);
    const primaries = container.querySelectorAll('.button--primary');
    expect(primaries).toHaveLength(1);
  });

  it('an update failure is shown while merely disconnected, not only in an error state', () => {
    // An update whose box never came back leaves status 'disconnected', so gating the callout on
    // 'error' hid the one message that says what to do.
    mock.s!.setStatus('disconnected');
    mock.s!.setError('the box did not come back');
    const { getByRole } = render(() => <ConnectPanel />);
    expect(getByRole('alert').textContent).toContain('the box did not come back');
  });

  it('a flash failure is shown even when an older connect verdict is still set', () => {
    // The verdict used to win and the flash reason was dropped: connect with no box, then fail an
    // update on another tab, then come back here.
    mock.s!.setStatus('error');
    mock.s!.setError('the image is too big for this box');
    mock.s!.setVerdict({ kind: 'no-port' });
    const { container } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('the image is too big for this box');
    expect(container.textContent).toContain('USB2');
  });

  it('a browser that wants another click is not told to unplug its hardware', () => {
    mock.s!.setVerdict({ kind: 'needs-click' });
    const { container, getByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toMatch(/one more click/i);
    expect(container.textContent).not.toMatch(/unplug everything/i);
    expect(getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('a setup handler given by the page wins over the route', () => {
    mock.s!.setVerdict({ kind: 'old-firmware', version });
    const onSetup = vi.fn();
    const { getByRole } = render(() => <ConnectPanel onSetup={onSetup} />);
    getByRole('button', { name: /set up/i }).click();
    expect(onSetup).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a box that stopped answering says so, reconnects by itself, and can be disconnected', async () => {
    mock.s!.setHeld(true);
    mock.s!.setStatus('lost');
    const { getByRole, queryByRole } = render(() => <ConnectPanel />);
    expect(getByRole('alert').textContent?.trim()).toBe("The box isn't answering. Check USB1 is plugged in too.");
    expect(queryByRole('button', { name: /^connect$/i })).toBeNull();
    expect((getByRole('button', { name: /reconnecting/i }) as HTMLButtonElement).disabled).toBe(true);
    getByRole('button', { name: /disconnect/i }).click();
    await waitFor(() => expect(getByRole('button', { name: /^connect$/i })).toBeTruthy());
    expect(mock.disconnects).toBe(1);
  });

  it('a held box that was unplugged asks for USB2, and can be forgotten', async () => {
    mock.s!.setHeld(true);
    mock.s!.setPresent(false);
    mock.s!.setStatus('lost');
    const { getByRole, queryByRole } = render(() => <ConnectPanel />);
    expect(getByRole('alert').textContent?.trim()).toBe("This computer can't see your box. Plug USB2 into it.");
    expect(queryByRole('button', { name: /reconnecting/i })).toBeNull();
    getByRole('button', { name: /forget/i }).click();
    expect(mock.forgets).toBe(1);
    expect(mock.disconnects).toBe(0);
    await waitFor(() => expect(queryByRole('alert')).toBeNull());
    expect(getByRole('button', { name: /^connect$/i })).toBeTruthy();
  });

  it('a verdict that lands after the panel is drawn replaces the Connect button with its reason', () => {
    const { getByRole, queryByRole } = render(() => <ConnectPanel />);
    expect(queryByRole('alert')).toBeNull();
    mock.s!.setVerdict({ kind: 'silent' });
    expect(getByRole('alert').textContent?.trim()).toBe("The box isn't answering. Check USB1 is plugged in too.");
    mock.s!.setError('the image is too big for this box');
    const alerts = [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent);
    expect(alerts.some((t) => t?.includes('the image is too big for this box'))).toBe(true);
  });

  it('Try again on a box that is not answering retries that box, without the chooser', () => {
    mock.s!.setVerdict({ kind: 'silent' });
    const { getByRole } = render(() => <ConnectPanel />);
    getByRole('button', { name: /try again/i }).click();
    expect(mock.connect).toHaveBeenCalledTimes(1);
    expect(mock.connect.mock.calls[0]).toEqual([]);
  });
});
