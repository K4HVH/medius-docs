import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { MemoryRouter, Route } from '@solidjs/router';
import { DashboardContext, type DashboardContextValue } from '../../src/app/pages/dashboard/context';
import Control from '../../src/app/pages/dashboard/Control';
import { ClipOp, ClipState, Direction, EmitMode } from '../../src/dashboard/protocol';

// The Control page mounts five cards against one context. Each card has its own unit tests; this
// covers what those cannot: that the whole page composes, that every card reaches the connected
// branch, and that a card cannot throw during mount and take the page down with it.

const health = {
  linkUp: true,
  mouseAttached: true,
  cloneConfigured: true,
  injectionActive: false,
  rateConfident: true,
  lockOn: true,
  catchOn: true,
  kbdAttached: true,
};

const VALUES: Record<string, unknown> = {
  health,
  version: { protoVer: 5, fwMajor: 3, fwMinor: 2, fwPatch: 0, mac: [1, 2, 3, 4, 5, 6], name: 'Medius-1A2B' },
  locks: {
    entries: [
      { cls: 3, id: 0, direction: 1, scale: 0 },
      { cls: 3, id: 0, direction: 2, scale: 0 },
      { cls: 1, id: 0xffff, direction: 1, scale: 0 },
      // A weighed direction, which the list has to render as a percentage rather than a block.
      { cls: 3, id: 1, direction: 4, scale: 40 },
    ],
  },
  catch: {
    tableFull: false,
    dropped: 4,
    clock: { offsetUs: -12345, ratePpb: 0, delayUs: 83, ageMs: 340 },
    entries: [{ cls: 3, id: 0xffff, dir: 0, capture: 0, dropped: 1 }],
  },
  clip: {
    state: ClipState.Playing,
    freeBytes: 65000,
    totalBytes: 536,
    played: 240,
    ticks: 48,
    underruns: 1,
    overruns: 0,
    seqGaps: 0,
    held: [{ cls: 0, id: 0 }],
    autolock: 0x05,
    loop: true,
    retain: true,
    finalized: true,
    ride: false,
    triggers: [{ cls: 1, id: 0x3a, edge: Direction.Positive, action: ClipOp.Toggle, consume: true }],
  },
  imperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
  moveRide: 0,
  emit: { mode: EmitMode.Fixed, fixedHz: 250, resolvedHz: 250 },
};

const stub = (over: Partial<Record<string, unknown>> = {}): DashboardContextValue =>
  ({
    supported: true,
    secure: true,
    status: () => 'connected',
      updateOnly: () => false,
    version: () => VALUES.version,
    health: () => health,
    error: () => null,
    verdict: () => null,
    link: () => ({
      lock: async () => {},
      unlock: async () => {},
      inject: async () => {},
      moveRel: async () => {},
      wheel: async () => {},
      reset: async () => {},
      led: async () => {},
      catch: async () => {},
      uncatch: async () => {},
      clipCtrl: async () => {},
      clipSet: async () => {},
      clipAppend: async () => {},
      clipTrigger: async () => {},
      clipUntrigger: async () => {},
    }),
    connect: async () => {},
    disconnect: async () => {},
    flashProgress: () => null,
    flashLog: () => [],
    flashNative: async () => true,
    clearFlashResult: () => {},
    deviceLog: () => [],
    clearDeviceLog: () => {},
    inputEvents: () => [],
    clearInputEvents: () => {},
    poll: (key: string) => () => ({ ...VALUES, ...over })[key] ?? null,
    refreshPoll: () => {},
    ...over,
  }) as unknown as DashboardContextValue;

const mount = (value = stub()) =>
  render(() => (
    <MemoryRouter
      root={(props) => (
        <DashboardContext.Provider value={value}>{props.children}</DashboardContext.Provider>
      )}
    >
      <Route path="*" component={Control} />
    </MemoryRouter>
  ));

afterEach(cleanup);

describe('Control page', () => {
  // A failed connect used to fall into the same fallback as a clean disconnect, so the page showed
  // the Connect button again and said nothing. It says why now, through the shared panel.
  it('says why a connect failed rather than offering a bare Connect button', async () => {
    const { findByRole, queryByText } = mount(
      stub({ status: () => 'disconnected', verdict: () => ({ kind: 'no-port' }) }),
    );
    const alert = await findByRole('alert');
    expect(alert.textContent).toMatch(/USB2/);
    expect(queryByText('Connect')).toBeNull();
    expect(queryByText('Try again')).toBeTruthy();
  });

  it('still surfaces an update failure that left the page in an error state', async () => {
    const { findByRole } = mount(
      stub({ status: () => 'error', error: () => 'the mouse-side chip did not come back' }),
    );
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('the mouse-side chip did not come back');
  });

  it('says why the Connect button is disabled on an unsupported browser', async () => {
    const { findByText } = mount(stub({ status: () => 'disconnected', supported: false }));
    await findByText(/This browser can't talk to your box/);
  });

  it('shows a connecting state while the handshake runs', async () => {
    const { findByText, queryByText } = mount(stub({ status: () => 'connecting' }));
    await findByText('Connecting...');
    expect(queryByText('Connect')).toBeNull();
  });

  it('mounts every card when connected', async () => {
    const { findByText } = mount();
    await findByText('Injection');
    await findByText('Input locks');
    await findByText('Status light');
    await findByText('Input catch');
    await findByText('Clip playback');
    await findByText('Safety clear');
  });

  it('shows only the connect prompt when disconnected', async () => {
    const { findByText, queryByText } = mount(
      stub({ status: () => 'disconnected', health: () => null }),
    );
    await findByText('Controls');
    expect(queryByText('Injection')).toBeNull();
    expect(queryByText('Clip playback')).toBeNull();
  });

  it('names the safety clear by everything it drops, not just injection', async () => {
    // It is the box-wide clear: locks, the catch table and the loaded clip go with it. A button
    // labelled "release the keys" would be a trap next to a live event stream.
    const { findByText } = mount();
    // The card subtitle carries this now; the paragraph under it only restated the subtitle.
    const body = (await findByText(/Clear all injection/)).textContent ?? '';
    expect(body).toMatch(/lock/i);
    expect(body).toMatch(/subscription/i);
    expect(body).toMatch(/clip/i);
  });

  it('renders a blanket lock the picker cannot build but another client can set', async () => {
    // The active list has always been able to show these; only the picker was limited.
    const { findByText } = mount();
    await findByText('all keys press');
  });

  it('renders a weighed direction as its percentage, not as a lock', async () => {
    const { findByText } = mount();
    await findByText('Move up/down (Y) against injection at 40%');
  });

  it('surfaces the cross-chip clock estimate rather than dropping it', async () => {
    const { findByText, container } = mount();
    // The catch card only shows the clock while streaming, so start the stream first.
    (await findByText('Watch')).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toMatch(/Host clock leads the device clock/);
  });

  it('does not offer Start for a clip that is not loaded', async () => {
    const { findByText, container } = mount(
      stub({
        clip: { ...(VALUES.clip as Record<string, unknown>), totalBytes: 0, state: ClipState.Idle },
      }),
    );
    await findByText('Clip playback');
    const start = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Start');
    expect(start).toBeDefined();
    expect(start!.disabled).toBe(true);
  });

  it('warns about riding only when the clip is actually set to ride it', async () => {
    // The clip bypasses riding by default, so the option being on is not enough: warning on that alone
    // told the user their clip would be swallowed when it plays perfectly well.
    const riding = mount(stub({ moveRide: 20 })).container;
    expect(riding.textContent).not.toMatch(/Movement riding is on/);

    const { findByText } = mount(
      stub({ moveRide: 20, clip: { ...(VALUES.clip as object), ride: true } }),
    );
    await findByText(/Movement riding is on/);
  });
});
