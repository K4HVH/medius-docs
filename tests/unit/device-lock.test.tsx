import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { LOCK_ID_ALL, LockAxis, LockClass } from '../../src/dashboard/protocol';

const settle = () => new Promise((r) => setTimeout(r, 20));

const findByTextIn = async (root: HTMLElement, text: string): Promise<HTMLElement> => {
  const el = [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!el) throw new Error(`no button labelled ${text}`);
  return el;
};

const mock = vi.hoisted(() => ({
  sent: [] as { verb: string; cls: number; id: number; dir: number }[],
}));

vi.mock('../../src/app/pages/dashboard/context', () => {
  const link = {
    lock: async (t: { cls: number; id: number }, dir: number) => {
      mock.sent.push({ verb: 'lock', cls: t.cls, id: t.id, dir });
    },
    unlock: async (t: { cls: number; id: number }, dir: number) => {
      mock.sent.push({ verb: 'unlock', cls: t.cls, id: t.id, dir });
    },
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      health: () => null,
      link: () => link,
      poll: () => () => ({ entries: [] }),
      refreshPoll: () => {},
    }),
  };
});

import DeviceLock from '../../src/app/pages/dashboard/DeviceLock';

afterEach(() => {
  cleanup();
  mock.sent = [];
});

describe('DeviceLock', () => {
  it('locks the X axis by default', async () => {
    const { findByText } = render(() => <DeviceLock />);
    fireEvent.click(await findByText('Lock'));
    await settle();
    expect(mock.sent).toEqual([{ verb: 'lock', cls: LockClass.Axis, id: LockAxis.X, dir: 0 }]);
  });

  it('picking a class selects a real usage, never the class wildcard', async () => {
    // The box's axis branch only accepts ids 0 to 2, so a blanket axis lock is dropped on arrival:
    // defaulting the picker to the wildcard made the Lock button do nothing at all for axes, and
    // for the other classes made it quietly act on every usage in the class.
    const { findByText, getByText } = render(() => <DeviceLock />);
    for (const cls of ['Button', 'Key', 'Media', 'Axis']) {
      mock.sent = [];
      fireEvent.click(getByText(cls));
      fireEvent.click(await findByText('Lock'));
      await settle();
      expect(mock.sent).toHaveLength(1);
      expect(mock.sent[0].id).not.toBe(LOCK_ID_ALL);
    }
  });

  // The list renders through a portal, so it is read off the document rather than the container,
  // and it only exists once the combobox is open.
  const openOptions = async (container: HTMLElement): Promise<string[]> => {
    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 20));
    return [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '');
  };

  it('sends every-axis as one frame per axis, not as the class wildcard', async () => {
    // The box has no blanket representation for the mouse classes: it expands one into per-target
    // bits. Firmware that predates the axis blanket drops the wildcard on arrival, so the three
    // frames are both equivalent and the only form that works everywhere.
    const { getByText, container } = render(() => <DeviceLock />);
    fireEvent.click(getByText('Axis'));
    const options = await openOptions(container);
    expect(options[0]).toMatch(/every axis/i);
    fireEvent.click(document.querySelectorAll('[role="option"]')[0] as HTMLElement);
    mock.sent = [];
    fireEvent.click(await findByTextIn(container, 'Lock'));
    await settle();
    expect(mock.sent).toEqual([
      { verb: 'lock', cls: LockClass.Axis, id: LockAxis.X, dir: 0 },
      { verb: 'lock', cls: LockClass.Axis, id: LockAxis.Y, dir: 0 },
      { verb: 'lock', cls: LockClass.Axis, id: LockAxis.Wheel, dir: 0 },
    ]);
    expect(mock.sent.some((f) => f.id === LOCK_ID_ALL)).toBe(false);
  });

  it('still offers the blanket for the classes the box does implement it for', async () => {
    // Pins the test above to real content: if the option list came back empty for any reason, the
    // axis assertion would pass for the wrong reason.
    const { getByText, container } = render(() => <DeviceLock />);
    fireEvent.click(getByText('Button'));
    const options = await openOptions(container);
    expect(options.join('|')).toMatch(/every button/i);
  });

  it('the filter clear button empties the filter', async () => {
    // TextField's clear calls onChange only, never onInput, so wiring the narrower callback let the
    // controlled value snap straight back and the button looked dead.
    const { container } = render(() => <DeviceLock />);
    const input = container.querySelector('input[type=text]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'wheel' } });
    await settle();
    expect(input.value).toBe('wheel');

    const clear = [...container.querySelectorAll('button')].find(
      (b) => /clear/i.test(b.getAttribute('aria-label') ?? '') || b.classList.toString().includes('clear'),
    );
    expect(clear).toBeDefined();
    fireEvent.click(clear!);
    await settle();
    expect(input.value).toBe('');
  });

  it('unlocks the same target it would lock', async () => {
    const { findByText } = render(() => <DeviceLock />);
    fireEvent.click(await findByText('Unlock'));
    await settle();
    expect(mock.sent).toEqual([{ verb: 'unlock', cls: LockClass.Axis, id: LockAxis.X, dir: 0 }]);
  });
});
