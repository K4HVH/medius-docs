import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import type { StatsSummary } from '../../src/dashboard/stats';
import Stats from '../../src/app/pages/dashboard/Stats';

const InRoute = () => {
  const history = createMemoryHistory();
  history.set({ value: '/dashboard/stats' });
  return (
    <MemoryRouter history={history}>
      <Route path="*" component={Stats} />
    </MemoryRouter>
  );
};

const weeks = (n: number, at: (i: number) => number = () => 0) =>
  Array.from({ length: 26 }, (_, i) => ({ key: `2026-04-${String(i + 1).padStart(2, '0')}`, n: i < n ? at(i) : 0 }));

const EMPTY: StatsSummary = {
  boxes: {
    total: 0,
    active7: 0,
    active30: 0,
    newPerWeek: weeks(0),
    activePerDay: Array.from({ length: 90 }, (_, i) => ({ key: `d${i}`, n: 0 })),
  },
  firmware: { versions: [] },
  devices: { unique: 0, byKind: [], top: [] },
  flashes: {
    total: 0,
    succeeded: 0,
    byResult: [],
    byRoute: [],
    byChips: [],
    bySource: [],
    byVersion: [],
    perWeek: weeks(0).map((w) => ({ week: w.key, verified: 0, reverted: 0, sent: 0, failed: 0, written: 0 })),
  },
  countries: [],
  os: [],
  browsers: [],
};

const FULL: StatsSummary = {
  ...EMPTY,
  boxes: { ...EMPTY.boxes, total: 1204, active7: 310, active30: 822, newPerWeek: weeks(26, (i) => i * 3) },
  firmware: { versions: [{ key: '3.4.4', n: 700 }, { key: '3.4.2', n: 122 }] },
  devices: {
    unique: 412,
    byKind: [
      { kind: 2, devices: 300, boxes: 1000 },
      { kind: 1, devices: 100, boxes: 180 },
      { kind: 0, devices: 12, boxes: 24 },
    ],
    top: [{ vid: 0x046d, pid: 0xc08b, kind: 2, product: 'G502 HERO Gaming Mouse', boxes: 211 }],
  },
  flashes: {
    ...EMPTY.flashes,
    total: 3881,
    succeeded: 3800,
    byResult: [
      { key: 'verified', n: 3000 },
      { key: 'written', n: 800 },
      { key: 'sent', n: 50 },
      { key: 'failed', n: 20 },
      { key: 'reverted', n: 11 },
    ],
    byRoute: [{ key: 'update usb2', n: 2900 }, { key: 'setup rom', n: 700 }, { key: 'advanced rom', n: 281 }],
    byChips: [{ key: 'both', n: 3000 }, { key: 'device', n: 600 }, { key: 'host', n: 281 }],
    bySource: [{ key: 'release', n: 3800 }, { key: 'file', n: 81 }],
    byVersion: [{ key: '3.4.4', n: 2000 }],
  },
  countries: [{ key: 'AU', n: 600 }, { key: 'unknown', n: 4 }],
  os: [{ key: 'windows', n: 1100 }, { key: 'linux', n: 104 }],
  browsers: [{ key: 'chrome', n: 1000 }, { key: 'chromium', n: 204 }],
};

const answer = (...replies: (StatsSummary | number)[]) => {
  const f = vi.fn(async () => {
    const r = replies.length > 1 ? replies.shift()! : replies[0];
    return typeof r === 'number' ? new Response('{}', { status: r }) : new Response(JSON.stringify(r), { status: 200 });
  });
  vi.stubGlobal('fetch', f);
  return f;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Stats page', () => {
  it('shows the totals', async () => {
    answer(FULL);
    const r = render(() => <InRoute />);
    const figures = await r.findByTestId('figures');
    expect(figures.textContent).toContain('1,204');
    expect(figures.textContent).toContain('Unique boxes');
    expect(figures.textContent).toContain('412');
    expect(figures.textContent).toContain('3,881');
    // 3,800 of 3,881 is 97.9%, rounded down.
    expect(figures.textContent).toContain('97%');
  });

  it('draws each breakdown with its labels and numbers', async () => {
    answer(FULL);
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    const text = r.container.textContent!;
    for (const s of [
      'v3.4.4',
      'Mouse',
      'Keyboard',
      'G502 HERO Gaming Mouse',
      '046D:C08B',
      'Unconfirmed',
      'Update, USB2',
      'Set up, ROM download',
      'Mouse-side chip',
      'Australia',
      'Unknown',
      'Windows',
      'Other Chromium',
    ])
      expect(text).toContain(s);
  });

  it('carries no notes, no lead and no subtitles; the two scopes sit at their panel headings', async () => {
    answer(FULL);
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    expect(r.container.querySelector('#collected')).toBeNull();
    expect(r.container.textContent).not.toMatch(/Counted since|recounts|different versions|Data collected/);
    expect(r.container.querySelector('.page-header h1')?.textContent).toBe('Usage stats');
    expect(r.container.querySelector('.page-header .lead')).toBeNull();
    expect(r.container.querySelector('.card__header small')).toBeNull();
    const asides = [...r.container.querySelectorAll('.ph .caps')].map((e) => [e.closest('.pn')!.querySelector('h2')!.textContent, e.textContent]);
    expect(asides).toEqual([
      ['Main chip', 'Last 30 days'],
      ['Country', 'As last seen'],
    ]);
  });

  it('puts the breakdowns on five tabs, the hash naming the one open', async () => {
    answer(FULL);
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    const tabs = [...r.container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['Boxes over time', 'Firmware in use', 'Devices', 'Flashes', 'Countries and systems']);
    expect(tabs.map((t) => (t as HTMLElement).dataset.tab)).toEqual(['boxes-over-time', 'firmware', 'devices', 'flashes', 'countries']);
    const open = () => r.container.querySelector('.pane:not([hidden])')?.getAttribute('data-pane');
    expect(open()).toBe('boxes-over-time');
    fireEvent.click(tabs[3]);
    await waitFor(() => expect(open()).toBe('flashes'));
  });

  it('shows the totals as figures, each a label over its value', async () => {
    answer(FULL);
    const r = render(() => <InRoute />);
    const figures = await r.findByTestId('figures');
    const tiles = [...figures.querySelectorAll(':scope > div')].map((t) => [t.querySelector('dd')!.textContent, t.querySelector('dt')!.textContent]);
    expect(tiles[0]).toEqual(['1,204', 'Unique boxes']);
    expect(tiles.map((x) => x[1])).toEqual([
      'Unique boxes',
      'New this week',
      'Active in 7 days',
      'Active in 30 days',
      'Unique devices',
      'Flashes',
      'Success rate',
      'Countries',
    ]);
  });

  it('rounds the success rate down, and says None with no flashes', async () => {
    answer({ ...FULL, flashes: { ...FULL.flashes, total: 200, succeeded: 199 } });
    const r = render(() => <InRoute />);
    const figures = await r.findByTestId('figures');
    expect(figures.textContent).toContain('99%');
    expect(figures.textContent).toContain('Success rate');
    cleanup();
    answer({ ...EMPTY, boxes: { ...EMPTY.boxes, total: 3 } });
    const e = render(() => <InRoute />);
    const f2 = await e.findByTestId('figures');
    expect(f2.textContent).toContain('None');
    expect(e.container.querySelector('[data-pane="firmware"]')!.textContent).toContain('None.');
  });

  it('names release or file as the source, as Advanced does, and kind 0 as Unknown', async () => {
    answer(FULL);
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    expect(r.container.querySelector('[data-pane="flashes"]')!.textContent).toContain('Source');
    expect(r.container.querySelector('[data-pane="flashes"]')!.textContent).not.toMatch(/\bImage\b/);
    expect(r.container.querySelector('[data-pane="devices"]')!.textContent).toContain('Unknown');
  });

  it('scales the bars to the largest named row, not to Others', async () => {
    const countries = [{ key: 'AU', n: 100 }, ...Array.from({ length: 30 }, (_, i) => ({ key: `Z${String.fromCharCode(65 + (i % 26))}${i}`, n: 90 }))];
    answer({ ...FULL, countries });
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    const fills = [...r.container.querySelector('[data-pane="countries"] .bars')!.querySelectorAll('.t i')] as HTMLElement[];
    expect(fills[0].style.width).toBe('100%');
    expect(fills.at(-1)!.style.width).toBe('100%');
  });

  it('reads the latest week over a chart, and the column pointed at instead, with its split by result', async () => {
    const perWeek = FULL.flashes.perWeek.map((w, i) =>
      i === 25 ? { ...w, verified: 20, written: 9, failed: 2 } : i === 3 ? { ...w, verified: 5, reverted: 1 } : w,
    );
    answer({ ...FULL, flashes: { ...FULL.flashes, perWeek } });
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    const pn = r.container.querySelector('#flashes-per-week')!;
    const readout = () => [pn.querySelector('.readout b')!.textContent, pn.querySelector('.readout span')!.textContent];
    const legend = () => [...pn.querySelectorAll('.legend span')].map((e) => e.textContent);
    expect(readout()).toEqual(['31', 'This week']);
    expect(legend()).toEqual(['Verified 20', 'Written (ROM download) 9', 'Reverted 0', 'Unconfirmed 0', 'Failed 2']);
    const cols = pn.querySelectorAll('.cols > span');
    expect(cols).toHaveLength(26);
    fireEvent.pointerEnter(cols[3]);
    expect(readout()).toEqual(['6', '4 Apr']);
    expect(legend()).toEqual(['Verified 5', 'Written (ROM download) 0', 'Reverted 1', 'Unconfirmed 0', 'Failed 0']);
    fireEvent.pointerLeave(pn.querySelector('.cols')!);
    expect(readout()).toEqual(['31', 'This week']);
    expect(pn.querySelector('.cols')!.getAttribute('aria-label')).toBe('Flashes per week, 1 Apr to this week, peak 31');
  });

  it('reads the largest entry over the firmware bars, and the row pointed at instead', async () => {
    answer(FULL);
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    const pn = r.container.querySelector('#firmware-versions')!;
    const readout = () => [pn.querySelector('.readout b')!.textContent, pn.querySelector('.readout span')!.textContent];
    expect(readout()).toEqual(['700', 'v3.4.4']);
    fireEvent.pointerEnter(pn.querySelectorAll('.br')[1]);
    expect(readout()).toEqual(['122', 'v3.4.2']);
    fireEvent.pointerLeave(pn.querySelector('.bars')!);
    expect(readout()).toEqual(['700', 'v3.4.4']);
  });

  it('colours each result bar as its part of the weekly columns', async () => {
    answer(FULL);
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    const tracks = [...r.container.querySelectorAll('#flash-results .br')].map((b) => [
      b.querySelector('span')!.textContent,
      b.querySelector('.t')!.className,
    ]);
    expect(tracks).toEqual([
      ['Verified', 't s-ok'],
      ['Written (ROM download)', 't s-wr'],
      ['Unconfirmed', 't s-mut'],
      ['Failed', 't s-bad'],
      ['Reverted', 't s-warn'],
    ]);
  });

  it('shows zeros and an empty note for each chart with nothing counted', async () => {
    answer(EMPTY);
    const r = render(() => <InRoute />);
    const figures = await r.findByTestId('figures');
    expect(figures.textContent).toContain('0');
    expect(figures.textContent).not.toContain('NaN');
    expect(r.getAllByText('None.').length).toBeGreaterThanOrEqual(5);
  });

  it('names a device with no product string by its kind, and no label says what something lacks', async () => {
    answer({ ...FULL, devices: { ...FULL.devices, top: [{ vid: 0x1915, pid: 0xaf28, kind: 1, product: null, boxes: 2 }] } });
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    // The second table, Most used; the first is By kind.
    const cell = r.container.querySelector('#top-devices table tbody td')!;
    expect(cell.textContent).toBe('Keyboard');
    expect(r.container.textContent).not.toMatch(/Unnamed|Didn't come back/);
  });

  it('an empty most used list says None', async () => {
    answer({ ...FULL, devices: { ...FULL.devices, top: [] } });
    const r = render(() => <InRoute />);
    await r.findByTestId('figures');
    expect(r.container.querySelector('#top-devices')!.textContent).toContain('None.');
  });

  it('a failed read says so, and Retry shows it reading again', async () => {
    let release = () => {};
    const f = vi.fn(async () => {
      if (f.mock.calls.length === 1) return new Response('{}', { status: 500 });
      await new Promise<void>((r) => (release = r));
      return new Response(JSON.stringify(FULL), { status: 200 });
    });
    vi.stubGlobal('fetch', f);
    const r = render(() => <InRoute />);
    await waitFor(() => expect(r.getByRole('alert').textContent).toContain("Couldn't load the stats (500)."));
    fireEvent.click(r.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(r.container.textContent).toContain('Loading...'));
    expect(r.queryByRole('alert')).toBeNull();
    release();
    await r.findByTestId('figures');
    expect(f).toHaveBeenCalledTimes(2);
  });
});
