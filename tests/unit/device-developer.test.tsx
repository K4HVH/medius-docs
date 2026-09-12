import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import {
  CATCH_ID_ANY,
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
  useNavigate: () => () => {},
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
    expect(getByText('Rewrite rules')).toBeTruthy();
    expect(getByText('Descriptor patches')).toBeTruthy();
    expect(getByText('Raw report')).toBeTruthy();
    expect(getByText('Control transfer')).toBeTruthy();
  });

  // The box drops a rule and a raw report that arrive with the opt-in off, so those two cards stand
  // their controls down entirely. A patch is stored either way, so only its apply is withheld.
  it('stands the gated controls down while imperfect clones are off', () => {
    mock.poll = {
      imperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
      rewrite: { tableFull: false, gen: 0, entries: [] },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    const { getByText, container } = render(() => <DeviceDeveloper />);
    expect(getByText(/Rewrite rules need/)).toBeTruthy();
    expect(getByText(/Raw reports need/)).toBeTruthy();
    expect(getByText(/Control transfers need/)).toBeTruthy();
    const button = (name: string) =>
      [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
    expect(button('Add rule')).toBeUndefined();
    expect(button('Send')).toBeUndefined();
    expect(button('Set patch')).toBeTruthy();
    expect((button('Apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers the gated controls once imperfect clones are on', () => {
    on();
    const { getByText } = render(() => <DeviceDeveloper />);
    expect(getByText('Add rule')).toBeTruthy();
    expect(getByText('Send')).toBeTruthy();
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

  // The box ranks id == CATCH_ID_ANY as a class blanket, which the bare number field cannot reach.
  it('sends the class blanket when the id is every id', async () => {
    on();
    const { getByText, container } = render(() => <DeviceDeveloper />);
    const every = [...container.querySelectorAll('input[type=radio]')].find(
      (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === 'Every id',
    );
    fireEvent.click(every!);
    fireEvent.click(getByText('Add rule'));
    await settle();
    expect(mock.rewrites[0]).toMatchObject({ cls: CatchClass.Control, id: CATCH_ID_ANY, state: 1 });
  });

  // Scoped to the card: the patch card carries a Clear all of its own, and an empty table stands
  // this one down.
  it('clears the whole rewrite table', async () => {
    mock.poll = {
      imperfect: { allowed: true, overCapacity: false, cloneImperfect: false },
      rewrite: {
        tableFull: false,
        gen: 0,
        entries: [
          { cls: CatchClass.Control, id: 0, dir: Direction.Both, action: RewriteAction.Pass, mlen: 0, off: 0, plen: 0, hits: 0 },
        ],
      },
      patches: { applied: false, pending: false, refused: false, tableFull: false, entries: [] },
    };
    const { container } = render(() => <DeviceDeveloper />);
    const card = container.querySelector('#rewrite-rules')!;
    const clear = [...card.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Clear all');
    fireEvent.click(clear!);
    await settle();
    expect(mock.cleared).toBe(1);
  });

  it('describes each live rewrite rule by what it does', () => {
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
    expect(getByText('Patch control 0 both, 9 hits')).toBeTruthy();
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

  // The helper copy on every sibling card is a function of the live selection, not a fixed string.
  // These pin that: pick another option, get another sentence.
  const radio = (container: HTMLElement, name: string): HTMLInputElement => {
    const el = [...container.querySelectorAll('input[type=radio]')].find(
      (i) => (i.closest('label') ?? i.parentElement)?.textContent?.trim() === name,
    );
    if (!el) throw new Error(`no radio labelled ${name}`);
    return el as HTMLInputElement;
  };

  it('blurbs the picked rewrite class, not a fixed sentence', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('Setup packets on a control endpoint.');
    expect(queryByText('Reports the game PC sends the device, by endpoint.')).toBeNull();

    fireEvent.click(radio(container, 'HID out'));
    await findByText('Reports the game PC sends the device, by endpoint.');
    expect(queryByText('Setup packets on a control endpoint.')).toBeNull();
  });

  it('blurbs the picked rewrite action', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('Leaves the packet untouched.');
    expect(queryByText('The packet becomes the payload.')).toBeNull();

    const box = container.querySelectorAll('[role="combobox"]')[0] as HTMLElement;
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 20));
    const replace = [...document.querySelectorAll('[role="option"]')].find(
      (o) => o.textContent?.trim() === 'Replace',
    );
    fireEvent.click(replace!);
    await waitFor(() => {
      if (!queryByText('The packet becomes the payload.')) throw new Error('blurb did not follow');
    });
    expect(queryByText('Leaves the packet untouched.')).toBeNull();
  });

  it('blurbs what the patch offset counts from, per descriptor', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('Offset into the 18-byte device descriptor.');

    fireEvent.click(radio(container, 'String descriptor'));
    await findByText('Offset into that string descriptor, its two-byte header included.');
    expect(queryByText('Offset into the 18-byte device descriptor.')).toBeNull();
  });

  // Scoped: the rewrite card carries an In/Out direction of its own.
  it('blurbs where a raw report lands, per direction', async () => {
    on();
    const { container, queryByText, findByText } = render(() => <DeviceDeveloper />);
    await findByText('The report reaches the game PC.');

    fireEvent.click(radio(container.querySelector('#raw-report') as HTMLElement, 'Out'));
    await findByText('The report reaches the device.');
    expect(queryByText('The report reaches the game PC.')).toBeNull();
  });

  // A class request's bRequest is not a standard one, so the standard name must not be claimed for it.
  it('names a standard request only when the type is standard', async () => {
    on();
    const { container, findByText, queryByText } = render(() => <DeviceDeveloper />);
    await findByText('Device to host, standard, to the device: GET_DESCRIPTOR.');
    const bm = [...container.querySelectorAll('input')].find(
      (i) => (i as HTMLInputElement).value === '0x80',
    ) as HTMLInputElement;
    fireEvent.input(bm, { target: { value: '0xa1' } });
    await findByText('Device to host, class, to an interface.');
    expect(queryByText(/GET_DESCRIPTOR/)).toBeNull();
  });

  it('reads the setup packet back in words as bmRequestType changes', async () => {
    on();
    const { container, findByText, queryByText } = render(() => <DeviceDeveloper />);
    await findByText('Device to host, standard, to the device: GET_DESCRIPTOR.');
    await findByText('Unused: this request reads, it does not write.');

    const field = [...container.querySelectorAll('input')].find(
      (i) => (i as HTMLInputElement).value === '0x80',
    ) as HTMLInputElement;
    fireEvent.input(field, { target: { value: '0x21' } });
    await findByText('Host to device, class, to an interface.');
    await findByText('The data stage this request carries to the device.');
    expect(queryByText('Device to host, standard, to the device: GET_DESCRIPTOR.')).toBeNull();
  });

  it('runs a control transfer and shows the device answer', async () => {
    on();
    mock.transferReply = { ep: 0, status: TransferStatus.Ok, data: new Uint8Array([0x12, 0x01]) };
    const { getByText } = render(() => <DeviceDeveloper />);
    fireEvent.click(getByText('Run'));
    await settle();
    // The default setup is GET_DESCRIPTOR for the 18-byte device descriptor.
    expect(mock.transfers[0]).toEqual([0, 0x80, 6, 0x0100, 0, 18]);
    expect(getByText('OK')).toBeTruthy();
    expect(getByText('2 B in')).toBeTruthy();
  });
});
