import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';

// Mutable mock state so each test can pose a different box.
const mock = vi.hoisted(() => ({
  setHealth: (_v: unknown) => {},
  sent: [] as { kind: string; args: number[] }[],
}));

vi.mock('../../src/app/pages/dashboard/context', async () => {
  // Health is a real signal, not a plain field: the card reconciles its held list against it, and
  // a plain property cannot drive that effect.
  const { createSignal } = await import('solid-js');
  const [health, setHealth] = createSignal<unknown>(null);
  mock.setHealth = setHealth;
  const link = {
    inject: async (cls: number, id: number, action: number) => {
      mock.sent.push({ kind: 'inject', args: [cls, id, action] });
    },
    moveRel: async (dx: number, dy: number) => {
      mock.sent.push({ kind: 'move', args: [dx, dy] });
    },
    wheel: async (dz: number) => {
      mock.sent.push({ kind: 'wheel', args: [dz] });
    },
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      health: () => health(),
      link: () => link,
    }),
  };
});

import DeviceInject from '../../src/app/pages/dashboard/DeviceInject';

const health = (over: Partial<Record<string, boolean>> = {}) => ({
  linkUp: true,
  mouseAttached: true,
  cloneConfigured: true,
  injectionActive: false,
  rateConfident: true,
  lockOn: false,
  catchOn: false,
  kbdAttached: true,
  ...over,
});

// SoftRelease 0 / Press 1 / ForceRelease 2.
const injects = () => mock.sent.filter((s) => s.kind === 'inject').map((s) => s.args);

afterEach(() => {
  cleanup();
  mock.sent = [];
});

describe('DeviceInject', () => {
  it('presses on pointer down and releases on pointer up', async () => {
    mock.setHealth(health());
    const { findByText } = render(() => <DeviceInject />);
    const left = await findByText('Left');
    fireEvent.pointerDown(left);
    fireEvent.pointerUp(left);
    expect(injects()).toEqual([
      [0, 0, 1],
      [0, 0, 0],
    ]);
  });

  it('releases when the pointer leaves the button without a pointerup', async () => {
    // Dragging off a button never delivers pointerup to it, which is one of the ways a hold used
    // to be left down on the game PC with nothing able to clear it.
    mock.setHealth(health());
    const { findByText } = render(() => <DeviceInject />);
    const right = await findByText('Right');
    fireEvent.pointerDown(right);
    fireEvent.pointerLeave(right);
    expect(injects()).toEqual([
      [0, 1, 1],
      [0, 1, 0],
    ]);
  });

  it('does not send a release for a button it never pressed', async () => {
    // pointerleave fires on any pass over the button, so an unconditional release here would
    // clear an override another client owns.
    mock.setHealth(health());
    const { findByText } = render(() => <DeviceInject />);
    fireEvent.pointerLeave(await findByText('Middle'));
    expect(injects()).toEqual([]);
  });

  it('releases everything it is holding when the card unmounts', async () => {
    // Navigating away mid-hold is the other way a press outlived its release.
    mock.setHealth(health());
    const { findByText, unmount } = render(() => <DeviceInject />);
    const left = await findByText('Left');
    const side1 = await findByText('Side 1');
    fireEvent.pointerDown(left);
    fireEvent.pointerDown(side1);
    mock.sent = [];
    unmount();
    expect(injects()).toEqual([
      [0, 0, 0],
      [0, 3, 0],
    ]);
  });

  it('lists what it is holding and drops it from the list on release', async () => {
    mock.setHealth(health());
    const { findByText, queryByText, container } = render(() => <DeviceInject />);
    expect(queryByText('Nothing held.')).not.toBeNull();
    // Held once, the button's own label is joined by a chip carrying the same text, so hold the
    // element rather than looking it up again.
    const left = await findByText('Left');
    fireEvent.pointerDown(left);
    expect(queryByText('Nothing held.')).toBeNull();
    expect([...container.querySelectorAll('.chip__label')].map((e) => e.textContent)).toContain(
      'Left',
    );
    fireEvent.pointerUp(left);
    expect(queryByText('Nothing held.')).not.toBeNull();
  });

  it('releases each held usage one at a time rather than sending a box-wide clear', async () => {
    // RESET would also drop every lock, the whole catch subscription, and a loaded clip.
    mock.setHealth(health());
    const { findByText } = render(() => <DeviceInject />);
    const left = await findByText('Left');
    const right = await findByText('Right');
    fireEvent.pointerDown(left);
    fireEvent.pointerDown(right);
    mock.sent = [];
    fireEvent.click(await findByText('Release all'));
    expect(injects()).toEqual([
      [0, 0, 0],
      [0, 1, 0],
    ]);
    expect(mock.sent.some((s) => s.kind === 'reset')).toBe(false);
  });

  it('steps the cursor by the step size', async () => {
    mock.setHealth(health());
    const { findByText } = render(() => <DeviceInject />);
    fireEvent.click(await findByText('Move right'));
    fireEvent.click(await findByText('Move up'));
    expect(mock.sent.filter((s) => s.kind === 'move').map((s) => s.args)).toEqual([
      [20, 0],
      [0, -20],
    ]);
  });

  it('hides the cursor and button controls when no mouse is cloned', async () => {
    mock.setHealth(health({ cloneConfigured: false }));
    const { queryByText, findByText } = render(() => <DeviceInject />);
    await findByText('No mouse is cloned.');
    expect(queryByText('Scroll up')).toBeNull();
  });

  it('drops its held list when the box reports injection went away', async () => {
    // A backgrounded tab alone can starve the keepalive past the box's 1 s clear. Keeping the
    // chips up would claim holds the box already let go of.
    mock.setHealth(health({ injectionActive: false }));
    const { findByText, queryByText } = render(() => <DeviceInject />);
    fireEvent.pointerDown(await findByText('Left'));
    expect(queryByText('Nothing held.')).toBeNull();

    // The box acknowledges the hold, then drops it.
    mock.setHealth(health({ injectionActive: true }));
    expect(queryByText('Nothing held.')).toBeNull();
    mock.setHealth(health({ injectionActive: false }));
    await findByText(/The box cleared every injected hold/);
    expect(queryByText('Nothing held.')).not.toBeNull();
  });

  it('does not mistake the gap before the box confirms a press for a drop', async () => {
    // The flag is read from a poll, so it stays false for up to one interval after a press lands.
    // Treating that as a drop would clear the hold the user just made.
    mock.setHealth(health({ injectionActive: false }));
    const { findByText, queryByText } = render(() => <DeviceInject />);
    fireEvent.pointerDown(await findByText('Left'));
    mock.setHealth(health({ injectionActive: false }));
    mock.setHealth(health({ injectionActive: false }));
    expect(queryByText('Nothing held.')).toBeNull();
    expect(queryByText(/The box cleared every injected hold/)).toBeNull();
  });

  it('holds what the picker currently names, not what it named at first render', async () => {
    // The hold button spreads handlers built from the picked usage. If that expression is
    // evaluated once at setup, the button keeps injecting the usage the picker opened on and
    // silently ignores every later choice.
    mock.setHealth(health());
    const { findByText, container } = render(() => <DeviceInject />);
    const combos = container.querySelectorAll('[role="combobox"], select, .combobox__control');
    expect(combos.length).toBeGreaterThan(0);
    // Switch the picker's class to Key, which changes both the class byte and the id.
    fireEvent.click(await findByText('Key'));
    const holdBtn = await findByText(/^Hold /);
    mock.sent = [];
    fireEvent.pointerDown(holdBtn);
    expect(injects()).toHaveLength(1);
    // Class 1 is key; the default key is 'A' (0x04), not button 0.
    expect(injects()[0][0]).toBe(1);
    expect(injects()[0][1]).toBe(0x04);
  });

  it('says so when a keyboard is missing, without hiding the picker', async () => {
    // Key and media holds reach a keyboard interface that is not there, so the box drops them.
    mock.setHealth(health({ kbdAttached: false }));
    const { findByText } = render(() => <DeviceInject />);
    await findByText('No keyboard is attached, so the box discards key and media holds.');
    await findByText('Press');
  });
});
