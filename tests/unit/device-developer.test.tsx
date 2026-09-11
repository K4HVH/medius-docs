import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import {
  CatchClass,
  Direction,
  PatchSection,
  RewriteAction,
  TransferStatus,
} from '../../src/dashboard/protocol';

const settle = () => new Promise((r) => setTimeout(r, 20));

// One recording fake for the whole page: the link calls it records, and the poll values it reads.
const mock = vi.hoisted(() => ({
  rewrites: [] as { cls: number; id: number; dir: number; action: number; state: number }[],
  patches: [] as { section: number; cfg: number; index: number; offset: number; len: number }[],
  transfers: [] as number[][],
  applied: 0,
  cleared: 0,
  transferReply: { ep: 0, status: 0, data: new Uint8Array() },
  poll: {} as Record<string, unknown>,
}));

vi.mock('@solidjs/router', () => ({
  A: (p: { children: unknown }) => p.children,
}));

vi.mock('../../src/app/pages/dashboard/context', () => {
  const link = {
    setRewrite: async (r: { cls: number; id: number; dir: number; action: number }) => {
      mock.rewrites.push({ ...r, state: 1 });
    },
    removeRewrite: async (r: { cls: number; id: number; dir: number; action: number }) => {
      mock.rewrites.push({ ...r, state: 0 });
    },
    clearRewrite: async () => {
      mock.cleared++;
    },
    setPatch: async (section: number, cfg: number, index: number, offset: number, bytes: Uint8Array) => {
      mock.patches.push({ section, cfg, index, offset, len: bytes.length });
    },
    removePatch: async () => {},
    applyPatch: async () => {
      mock.applied++;
    },
    clearPatch: async () => {},
    raw: async () => {},
    transfer: async (
      ep: number,
      bmRequestType: number,
      bRequest: number,
      wValue: number,
      wIndex: number,
      wLength: number,
    ) => {
      mock.transfers.push([ep, bmRequestType, bRequest, wValue, wIndex, wLength]);
      return mock.transferReply;
    },
    queryRewriteEntry: async () => ({}),
    queryPatchEntry: async () => ({}),
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      updateOnly: () => false,
      link: () => link,
      poll: (key: string) => () => mock.poll[key],
      refreshPoll: () => {},
    }),
  };
});

import DeviceDeveloper from '../../src/app/pages/dashboard/DeviceDeveloper';

const on = () => {
  mock.poll = {
    imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
    rewrite: { tableFull: false, gen: 0, entries: [] },
    patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
  };
};

afterEach(() => {
  cleanup();
  mock.rewrites = [];
  mock.patches = [];
  mock.transfers = [];
  mock.applied = 0;
  mock.cleared = 0;
  mock.transferReply = { ep: 0, status: 0, data: new Uint8Array() };
  mock.poll = {};
});

describe('DeviceDeveloper', () => {
  it('renders every card of the advanced control layer', () => {
    on();
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Advanced control layer')).toBeTruthy();
    expect(getByText('Rewrite rules')).toBeTruthy();
    expect(getByText('Descriptor patches')).toBeTruthy();
    expect(getByText('Raw and control transfer')).toBeTruthy();
  });

  it('shows the opt-in banner and disables the writes while imperfect clones are off', () => {
    mock.poll = {
      imperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: false, gen: 0, entries: [] },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    const { getByText, container } = render(() => <DeviceDeveloper />);
    expect(getByText(/The layer is off/)).toBeTruthy();
    const add = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Add rule');
    expect(add).toBeTruthy();
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it('says the layer is active once imperfect clones are on', () => {
    on();
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Advanced control layer active')).toBeTruthy();
  });

  it('adds a rewrite rule from the form defaults (a control-class pass)', async () => {
    on();
    const { getByText } = render(() => <DeviceDeveloper />);
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(mock.rewrites).toHaveLength(1);
    expect(mock.rewrites[0]).toMatchObject({
      cls: CatchClass.Control,
      id: 0,
      dir: Direction.Both,
      action: RewriteAction.Pass,
      state: 1,
    });
  });

  it('clears the whole rewrite table', async () => {
    on();
    const { getByText } = render(() => <DeviceDeveloper />);
    fireEvent.click(getByText('Clear table'));
    await settle();
    expect(mock.cleared).toBe(1);
  });

  it('renders the live rewrite table with its generation and rules', () => {
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: {
        tableFull: false,
        gen: 4,
        entries: [
          { cls: CatchClass.Control, id: 0, dir: Direction.Both, action: RewriteAction.Patch, mlen: 2, off: 2, plen: 1, hits: 9 },
        ],
      },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Generation 4')).toBeTruthy();
    expect(getByText(/9 hits/)).toBeTruthy();
  });

  it('applies the stored patch set and renders its flags', async () => {
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: false, gen: 0, entries: [] },
      patches: {
        applied: true,
        pending: false,
        refused: false,
        tableFull: false,
        entries: [{ section: PatchSection.Device, cfg: 0, index: 0, offset: 8, len: 2 }],
      },
    };
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Applied')).toBeTruthy();
    fireEvent.click(getByText('Apply'));
    await settle();
    expect(mock.applied).toBe(1);
  });

  it('runs a control transfer and shows the device answer', async () => {
    on();
    mock.transferReply = { ep: 0, status: TransferStatus.Ok, data: new Uint8Array([0x12, 0x01]) };
    const { getByText } = render(() => <DeviceDeveloper />);
    fireEvent.click(getByText('Run'));
    await settle();
    // The default setup is GET_DESCRIPTOR for the 18-byte device descriptor.
    expect(mock.transfers[0]).toEqual([0, 0x80, 6, 0x0100, 0, 18]);
    expect(getByText('ok')).toBeTruthy();
    expect(getByText('2B in')).toBeTruthy();
  });
});
