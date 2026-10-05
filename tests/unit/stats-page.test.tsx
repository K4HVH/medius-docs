import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import type { StatsSummary } from '../../src/dashboard/stats';
import Stats from '../../src/app/pages/dashboard/Stats';

const weeks = (n: number, at: (i: number) => number = () => 0) =>
  Array.from({ length: 26 }, (_, i) => ({ key: `2026-04-${String(i + 1).padStart(2, '0')}`, n: i < n ? at(i) : 0 }));

const EMPTY: StatsSummary = {
  generatedAt: '2026-10-07T12:00:00.000Z',
  since: null,
  boxes: {
    total: 0,
    active7: 0,
    active30: 0,
    newPerWeek: weeks(0),
    activePerDay: Array.from({ length: 90 }, (_, i) => ({ key: `d${i}`, n: 0 })),
  },
  firmware: { versions: [], split: 0 },
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
  since: '2026-08-28',
  boxes: { ...EMPTY.boxes, total: 1204, active7: 310, active30: 822, newPerWeek: weeks(26, (i) => i * 3) },
  firmware: { versions: [{ key: '3.4.4', n: 700 }, { key: '3.4.2', n: 122 }], split: 9 },
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
  it('shows the totals and when counting began', async () => {
    answer(FULL);
    const r = render(() => <Stats />);
    const figures = await r.findByTestId('figures');
    expect(figures.textContent).toContain('1,204');
    expect(figures.textContent).toContain('Unique boxes');
    expect(figures.textContent).toContain('412');
    expect(figures.textContent).toContain('3,881');
    expect(figures.textContent).toContain('98%');
    expect(r.container.textContent).toMatch(/Counted since (28 Aug|Aug 28,) 2026\./);
  });

  it('draws each breakdown with its labels and numbers', async () => {
    answer(FULL);
    const r = render(() => <Stats />);
    await r.findByTestId('figures');
    const text = r.container.textContent!;
    for (const s of [
      'v3.4.4',
      '9 of them run different versions on the two chips.',
      'Mouse',
      'Keyboard',
      'G502 HERO Gaming Mouse',
      '046D:C08B',
      "Didn't come back",
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

  it('lists every field collected, and says how the MAC is kept', async () => {
    answer(FULL);
    const r = render(() => <Stats />);
    await r.findByTestId('figures');
    const card = r.container.querySelector('#collected')!;
    expect(card.textContent).toMatch(/keyed hash/);
    expect(card.textContent).toMatch(/No IP address is stored/);
    expect(card.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('shows zeros and an empty note for each chart with nothing counted', async () => {
    answer(EMPTY);
    const r = render(() => <Stats />);
    const figures = await r.findByTestId('figures');
    expect(figures.textContent).toContain('0');
    expect(figures.textContent).not.toContain('NaN');
    expect(r.container.textContent).not.toMatch(/Counted since/);
    expect(r.getAllByText('Nothing counted yet.').length).toBeGreaterThanOrEqual(5);
  });

  it('says why the most used list is empty while devices are counted', async () => {
    answer({ ...FULL, devices: { ...FULL.devices, top: [] } });
    const r = render(() => <Stats />);
    await r.findByTestId('figures');
    expect(r.container.querySelector('#devices')!.textContent).toContain('No device is on two boxes yet.');
  });

  it('a failed read says so, and Retry reads again', async () => {
    const f = answer(500, FULL);
    const r = render(() => <Stats />);
    await waitFor(() => expect(r.getByRole('alert').textContent).toContain("Couldn't load the stats (500)."));
    fireEvent.click(r.getByRole('button', { name: 'Retry' }));
    await r.findByTestId('figures');
    expect(f).toHaveBeenCalledTimes(2);
  });
});
