import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { BearingMode, EmitMode, RenderMode } from '../../src/dashboard/protocol';

const settle = () => new Promise((r) => setTimeout(r, 20));

const mock = vi.hoisted(() => ({
  bearing: { windowMs: 20, mode: 0 } as { windowMs: number; mode: number },
  emit: { mode: 0, fixedHz: 0, resolvedHz: 0 } as { mode: number; fixedHz: number; resolvedHz: number },
  render: { mode: 2, full: false, ready: false } as { mode: number; full: boolean; ready: boolean },
  spread: { percent: 100, spanUs: 8000 } as { percent: number; spanUs: number },
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
        setRender: async () => {},
        setSpread: async () => {},
      }),
      poll: (key: string) => () =>
        key === 'bearing' ? mock.bearing
          : key === 'emit' ? mock.emit
          : key === 'render' ? mock.render
          : key === 'spread' ? mock.spread
          : (values[key] ?? null),
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
  mock.render = { mode: 2, full: false, ready: false };
  mock.spread = { percent: 100, spanUs: 8000 };
});

describe('DeviceOptions', () => {
  // Each multi-option control used to describe every option at once. Only the selected one is a
  // statement about the box you are looking at.
  it('describes only the selected bearing geometry', async () => {
    const { container, queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Each axis is weighed against its own bearing.');
    expect(queryByText(/along the injected vector is weighed/)).toBeNull();

    fireEvent.click(container.querySelector('input[value="1"]')!);
    await settle();
    await findByText(/along the injected vector is weighed/);
    expect(queryByText('Each axis is weighed against its own bearing.')).toBeNull();
  });

  it('describes only the selected emit mode', async () => {
    mock.emit = { mode: EmitMode.Fixed, fixedHz: 500, resolvedHz: 500 };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Pins the rate to the number you pick.');
    expect(queryByText("Matches native report rate.")).toBeNull();
    expect(queryByText('Follows the declared poll rate.')).toBeNull();
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

  it('describes only the selected texture, and only the setting in force', async () => {
    mock.render = { mode: RenderMode.Despiked, full: true, ready: true };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Native texture, ramped onset.');
    expect(queryByText('Even fill at the paced rate.')).toBeNull();
    await findByText('Both go through the model as one stream.');
    expect(queryByText("Native motion is relayed untouched.")).toBeNull();
  });

  // `full` stores and reads back with the texture off, but nothing is rendered in that state: there is
  // no model in the path. Saying "rendered too" there reads as active when it is not.
  it('does not claim the mouse own motion is rendered while the mode is off', async () => {
    mock.render = { mode: RenderMode.Off, full: true, ready: true };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Renders nothing while the mode is off.');
    await findByText('Native motion relayed');
    expect(queryByText('Native motion rendered')).toBeNull();
  });

  // The option can read back set while the box is still relaying, so the chip has to follow `ready`
  // and not the stored bytes.
  it('does not claim the mouse own motion is rendered before a profile arms', async () => {
    mock.render = { mode: RenderMode.Despiked, full: true, ready: false };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Native motion relayed');
    await findByText('Move the mouse to start');
    expect(queryByText('Native motion rendered')).toBeNull();
  });

  it('describes only the selected spread, and shows the interval in force', async () => {
    mock.spread = { percent: 50, spanUs: 4000 };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Injected motion over half the command interval.');
    expect(queryByText('Injected motion on one report.')).toBeNull();
    await findByText('Half · 4.0 ms');
  });

  // The percent reads back set while the box is still releasing a delta whole: it releases nothing
  // across an interval until it has learned the host's command period. Showing an interval there
  // would read as spreading when nothing is.
  it('says it is waiting while no command period has been learned', async () => {
    mock.spread = { percent: 100, spanUs: 0 };
    const waiting = render(() => <DeviceOptions />);
    await waiting.findByText('Waiting for injection');
    cleanup();

    mock.spread = { percent: 100, spanUs: 8002 };
    const learned = render(() => <DeviceOptions />);
    await learned.findByText('Full · 8.0 ms');
    expect(learned.queryByText('Waiting for injection')).toBeNull();
  });

  // Off is not "waiting": there is no interval to wait for, and a warning chip there reads as a fault.
  it('shows no interval chip at all with spreading off', async () => {
    mock.spread = { percent: 0, spanUs: 0 };
    const { container, queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Injected motion on one report.');
    expect(queryByText('Waiting for injection')).toBeNull();
    // Scoped to this section: the riding and bearing chips carry the same "Name . N ms" shape.
    expect(container.querySelector('#spread')!.textContent).not.toMatch(/ ms/);
  });

  // Nothing is rendered until the box has learned a profile, so a box set to a mode and a box rendering
  // with it are different states and the card has to say which one it is looking at.
  it('says the mouse has to move while no profile has armed', async () => {
    mock.render = { mode: RenderMode.Despiked, full: false, ready: false };
    const unarmed = render(() => <DeviceOptions />);
    await unarmed.findByText('Move the mouse to start');
    cleanup();

    mock.render = { mode: RenderMode.Despiked, full: false, ready: true };
    const armed = render(() => <DeviceOptions />);
    await armed.findByText('Native texture, ramped onset.');
    expect(armed.queryByText('Move the mouse to start')).toBeNull();
  });

  // Off means the renderer is not in the path at all, so there is nothing waiting on a profile.
  it('does not ask for a profile while the renderer is off', async () => {
    mock.render = { mode: RenderMode.Off, full: false, ready: false };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Even fill at the paced rate.');
    expect(queryByText('Move the mouse to start')).toBeNull();
  });

  // window = 0 makes with/against inert without clearing them, so the readback still reports scales
  // that no longer weigh anything. It is a wire value, not a control.
});
