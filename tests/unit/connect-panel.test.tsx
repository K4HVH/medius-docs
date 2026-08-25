import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import type { ConnectVerdict } from '../../src/dashboard/serial';

const mock = vi.hoisted(() => ({
  supported: true,
  secure: true,
  error: null as string | null,
  status: 'disconnected' as string,
  verdict: null as ConnectVerdict | null,
  connect: vi.fn(async (_force?: boolean) => {}),
}));

vi.mock('../../src/app/pages/dashboard/context', () => ({
  useDashboard: () => ({
    supported: mock.supported,
    secure: mock.secure,
    error: () => mock.error,
    status: () => mock.status,
    verdict: () => mock.verdict,
    connect: mock.connect,
  }),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));

import { ConnectPanel } from '../../src/app/pages/dashboard/ConnectPanel';

afterEach(() => {
  cleanup();
  mock.verdict = null;
  mock.status = 'disconnected';
  mock.supported = true;
  mock.secure = true;
  mock.error = null;
  mock.connect.mockClear();
  navigate.mockClear();
});

const version = { protoVer: 4, fwMajor: 3, fwMinor: 1, fwPatch: 0, mac: [0, 0, 0, 0, 0, 0], name: '' };

describe('ConnectPanel', () => {
  it('offers one Connect button before anything has been tried', () => {
    const { getByRole, getAllByRole } = render(() => <ConnectPanel />);
    expect(getByRole('button', { name: /connect/i })).toBeTruthy();
    expect(getAllByRole('button')).toHaveLength(1);
  });

  it('an older box is named and sent to the install', () => {
    mock.verdict = { kind: 'old-firmware', version };
    const { getByRole, container } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('3.1.0');
    getByRole('button', { name: /set up/i }).click();
    expect(navigate).toHaveBeenCalledWith('/dashboard/setup');
  });

  it('no port names the cable and the computer', () => {
    mock.verdict = { kind: 'no-port' };
    const { container, getByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('USB2');
    expect(container.textContent).toMatch(/this computer/i);
    getByRole('button', { name: /try again/i }).click();
    expect(mock.connect).toHaveBeenCalled();
  });

  it('a silent box is told to plug the other cable in', () => {
    mock.verdict = { kind: 'silent' };
    const { container, getByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('USB1');
    expect(getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('a held port says to close what is holding it', () => {
    mock.verdict = { kind: 'busy' };
    const { container, getAllByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toMatch(/other tabs/i);
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
    mock.verdict = { kind: 'other', message: 'the port fell over' };
    const { container, getByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('the port fell over');
    expect(getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('only one button carries weight on a recoverable failure', () => {
    mock.verdict = { kind: 'no-port' };
    const { container } = render(() => <ConnectPanel />);
    const primaries = container.querySelectorAll('.button--primary');
    expect(primaries).toHaveLength(1);
  });

  it('a flash failure is shown even when an older connect verdict is still set', () => {
    // The verdict used to win and the flash reason was dropped: connect with no box, then fail an
    // update on another tab, then come back here.
    mock.status = 'error';
    mock.error = 'the image is too big for this box';
    mock.verdict = { kind: 'no-port' };
    const { container } = render(() => <ConnectPanel />);
    expect(container.textContent).toContain('the image is too big for this box');
    expect(container.textContent).toContain('USB2');
  });

  it('a browser that wants another click is not told to unplug its hardware', () => {
    mock.verdict = { kind: 'needs-click' };
    const { container, getByRole } = render(() => <ConnectPanel />);
    expect(container.textContent).toMatch(/one more click/i);
    expect(container.textContent).not.toMatch(/unplug everything/i);
    expect(getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('the retry on a silent box asks which device, so a remembered wrong one is escapable', () => {
    mock.verdict = { kind: 'silent' };
    const { getByRole } = render(() => <ConnectPanel />);
    getByRole('button', { name: /try again/i }).click();
    expect(mock.connect).toHaveBeenCalledWith(true);
  });

  it('a setup handler given by the page wins over the route', () => {
    mock.verdict = { kind: 'old-firmware', version };
    const onSetup = vi.fn();
    const { getByRole } = render(() => <ConnectPanel onSetup={onSetup} />);
    getByRole('button', { name: /set up/i }).click();
    expect(onSetup).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
