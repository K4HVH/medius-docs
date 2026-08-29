import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { BearingMode, EmitMode } from '../../src/dashboard/protocol';

const settle = () => new Promise((r) => setTimeout(r, 20));

const mock = vi.hoisted(() => ({
  bearing: { windowMs: 20, mode: 0 } as { windowMs: number; mode: number },
  emit: { mode: 0, fixedHz: 0, resolvedHz: 0 } as { mode: number; fixedHz: number; resolvedHz: number },
}));

vi.mock('../../src/app/pages/dashboard/context', () => {
  const values: Record<string, unknown> = {
    imperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
    moveRide: 0,
    version: { name: 'Medius-1A2B' },
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      updateOnly: () => false,
      link: () => ({
        setBearing: async () => {},
        setMovementRiding: async () => {},
        setEmitPace: async () => {},
      }),
      poll: (key: string) => () =>
        key === 'bearing' ? mock.bearing : key === 'emit' ? mock.emit : (values[key] ?? null),
      refreshPoll: () => {},
    }),
  };
});

import DeviceOptions from '../../src/app/pages/dashboard/DeviceOptions';

const button = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

afterEach(() => {
  cleanup();
  mock.bearing = { windowMs: 20, mode: 0 };
  mock.emit = { mode: 0, fixedHz: 0, resolvedHz: 0 };
});

describe('DeviceOptions', () => {
  // Each multi-option control used to describe every option at once. Only the selected one is a
  // statement about the box you are looking at.
  it('describes only the selected bearing geometry', async () => {
    const { container, queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Each axis is weighed against its own bearing.');
    expect(queryByText(/projected onto the injected XY vector/)).toBeNull();

    fireEvent.click(container.querySelector('input[value="1"]')!);
    await settle();
    await findByText(/projected onto the injected XY vector/);
    expect(queryByText('Each axis is weighed against its own bearing.')).toBeNull();
  });

  it('describes only the selected emit mode', async () => {
    mock.emit = { mode: EmitMode.Fixed, fixedHz: 500, resolvedHz: 500 };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Pins the rate to the number you pick.');
    expect(queryByText("Matches the mouse's own report rate.")).toBeNull();
    expect(queryByText("Follows the mouse's USB poll rate.")).toBeNull();
  });

  // Emit rate was the only control that offered Revert, so a pending bearing or riding edit looked
  // like it had already been applied.
  it('offers Revert and marks the chip on every unapplied edit', async () => {
    const { container, findAllByText } = render(() => <DeviceOptions />);
    expect(button(container, 'Revert')).toBeUndefined();

    fireEvent.click(container.querySelector('input[value="1"]')!);   // bearing geometry
    await settle();
    expect(button(container, 'Revert')).toBeTruthy();
    expect((await findAllByText('not applied yet')).length).toBe(1);

    fireEvent.click(button(container, 'Revert')!);
    await settle();
    expect(button(container, 'Revert')).toBeUndefined();
  });

  // window = 0 makes with/against inert without clearing them, so the readback still reports scales
  // that no longer weigh anything. It is a wire value, not a control.
});
