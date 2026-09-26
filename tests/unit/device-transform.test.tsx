import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { LockAxis, LockClass, TransformOp } from '../../src/dashboard/protocol';

// The card addresses the whole space the box takes, which is the part a radio of fixed axes could
// not reach: a button onto a key or a media usage, and a scale on a swap or an axis remap.

const settle = () => new Promise((r) => setTimeout(r, 20));

type Frame = Record<string, number>;

const mock = vi.hoisted(() => ({ sent: [] as Frame[], entries: [] as Frame[] }));

vi.mock('../../src/app/pages/dashboard/context', () => {
  const link = {
    setTransform: async (t: Frame) => {
      mock.sent.push(t);
    },
    removeTransform: async () => {},
    clearTransforms: async () => {},
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      updateOnly: () => false,
      health: () => null,
      link: () => link,
      poll: (k: string) => () =>
        k === 'transforms' ? { tableFull: false, entries: mock.entries } : null,
      refreshPoll: () => {},
    }),
  };
});

import DeviceTransform from '../../src/app/pages/dashboard/DeviceTransform';

afterEach(() => {
  cleanup();
  mock.sent = [];
  mock.entries = [];
});

// The usage list renders through a portal, so it is read off the document rather than the
// container, and it only exists once the combobox is open. `which` picks source or destination.
const openOptions = async (container: HTMLElement, which: number): Promise<string[]> => {
  const trigger = [...container.querySelectorAll('[role="combobox"]')][which] as HTMLElement;
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Enter' });
  await settle();
  return [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '');
};

describe('DeviceTransform', () => {
  it('swaps the two axes, which is what the card opens on', async () => {
    const { getByText } = render(() => <DeviceTransform />);
    fireEvent.click(getByText('Apply'));
    await settle();
    expect(mock.sent).toEqual([
      {
        op: TransformOp.Swap,
        sclass: LockClass.Axis,
        sid: LockAxis.X,
        dclass: LockClass.Axis,
        did: LockAxis.Y,
      },
    ]);
  });

  it('reaches a button to key remap, which no fixed axis list could address', async () => {
    const { getByText, container } = render(() => <DeviceTransform />);
    fireEvent.click(getByText('Remap'));
    await settle();
    fireEvent.click(getByText('Button'));
    await settle();
    expect(() => getByText('Key')).not.toThrow();
    expect(() => getByText('Media')).not.toThrow();
    fireEvent.click(getByText('Key'));
    await settle();
    // The whole keyboard page, not a shortlist.
    expect((await openOptions(container as HTMLElement, 1)).length).toBeGreaterThan(20);
    fireEvent.click(getByText('Apply'));
    await settle();
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0].op).toBe(TransformOp.Remap);
    expect(mock.sent[0].sclass).toBe(LockClass.Button);
    expect(mock.sent[0].dclass).toBe(LockClass.Key);
    // A transform carries no percent at all: weighing a field is the lock card's.
    expect('scale' in mock.sent[0]).toBe(false);
  });

  it('sends a remap with both fields, so the destination is not the source', async () => {
    const { getByText } = render(() => <DeviceTransform />);
    fireEvent.click(getByText('Remap'));
    await settle();
    fireEvent.click(getByText('Apply'));
    await settle();
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0].op).toBe(TransformOp.Remap);
    expect(mock.sent[0].sid).not.toBe(mock.sent[0].did);
  });

  it('refuses a field named as both ends before it reaches the wire', async () => {
    const { getByText, container, findByRole } = render(() => <DeviceTransform />);
    const options = await openOptions(container as HTMLElement, 1);
    const same = options.findIndex((o) => /left\/right/i.test(o));
    expect(same).toBeGreaterThanOrEqual(0);
    fireEvent.click(document.querySelectorAll('[role="option"]')[same] as HTMLElement);
    await settle();
    fireEvent.click(getByText('Apply'));
    await settle();
    expect(mock.sent).toHaveLength(0);
    expect((await findByRole('alert')).textContent).toMatch(/two different axes/i);
  });

  it('points a remap of a field onto itself at the lock card instead', async () => {
    const { getByText, container, findByRole } = render(() => <DeviceTransform />);
    fireEvent.click(getByText('Remap'));
    await settle();
    const options = await openOptions(container as HTMLElement, 1);
    const same = options.findIndex((o) => /left\/right/i.test(o));
    fireEvent.click(document.querySelectorAll('[role="option"]')[same] as HTMLElement);
    await settle();
    fireEvent.click(getByText('Apply'));
    await settle();
    expect(mock.sent).toHaveLength(0);
    expect((await findByRole('alert')).textContent).toMatch(/Input locks/i);
  });

  it('names a read-back entry by its fields', async () => {
    mock.entries = [
      { op: TransformOp.Swap, sclass: 3, sid: 0, dclass: 3, did: 1 },
      { op: TransformOp.Remap, sclass: 0, sid: 3, dclass: 1, did: 4 },
    ];
    const { findByText } = render(() => <DeviceTransform />);
    expect(await findByText(/Swap X \(left\/right\) and Y \(up\/down\)/)).toBeTruthy();
    expect(await findByText(/Side 1 to A/)).toBeTruthy();
  });
});
