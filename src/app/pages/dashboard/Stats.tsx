import { For, Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { Button } from '../../../components/inputs/Button';
import { type Count as Counted, type StatsSummary, type WeekFlashes, fetchStats } from '../../../dashboard/stats';
import { PageHeader } from '../../shell/PageHeader';
import { PageTabs, Pane } from '../../shell/PageTabs';
import { Panel, Panels } from '../../shell/Panel';
import { Count } from '../../shell/Count';

// Longer lists end in one row summing the rest.
const MAX_ROWS = 12;

const num = (n: number) => n.toLocaleString();

// Series are UTC days, so they are shown in UTC: a reader west of it would see the day before.
const shortDate = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

const OS: Record<string, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  chromeos: 'ChromeOS',
  android: 'Android',
  other: 'Other',
};
const BROWSER: Record<string, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  opera: 'Opera',
  brave: 'Brave',
  chromium: 'Other Chromium',
};
const RESULT: Record<keyof Omit<WeekFlashes, 'week'>, string> = {
  verified: 'Verified',
  written: 'Written (ROM download)',
  reverted: 'Reverted',
  sent: 'Unconfirmed',
  failed: 'Failed',
};
// Flashes from the Manual tab still record the page it replaced.
const PAGE: Record<string, string> = { update: 'Update', advanced: 'Manual flash', setup: 'Set up' };
const ROUTE: Record<string, string> = { usb2: 'USB2', rom: 'ROM download' };
const CHIPS: Record<string, string> = { both: 'Both chips', device: 'Main chip', host: 'Mouse-side chip' };
const SOURCE: Record<string, string> = { release: 'Release', file: 'File' };
const KIND: Record<number, string> = { 2: 'Mouse', 1: 'Keyboard', 0: 'Unknown' };

const route = (key: string) => {
  const [page, via] = key.split(' ');
  return `${PAGE[page] ?? page}, ${ROUTE[via] ?? via}`;
};

let regions: Intl.DisplayNames | null = null;
const country = (code: string) => {
  if (code === 'unknown') return 'Unknown';
  try {
    regions ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
};

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

interface Row {
  key: string;
  label: string;
  n: number;
  // The row summing the rest, which doesn't set the scale.
  rest?: boolean;
}

const rows = (counts: Counted[], label: (key: string) => string): Row[] => {
  const all = counts.map((c) => ({ key: c.key, label: label(c.key), n: c.n }));
  if (all.length <= MAX_ROWS) return all;
  const rest = all.slice(MAX_ROWS - 1);
  return [
    ...all.slice(0, MAX_ROWS - 1),
    { key: 'others', label: `Others (${rest.length})`, n: rest.reduce((a, r) => a + r.n, 0), rest: true },
  ];
};

const Empty = () => <p class="mut" data-search-skip>None.</p>;

// The figure over a chart: what the chart stands at, or the entry under the pointer.
const Readout = (props: { n: number; label: string }) => (
  <div class="readout">
    <b>{num(props.n)}</b>
    <span class="caps">{props.label}</span>
  </div>
);

// A row per entry, to the scale of the largest named one. With `readout`, the figure over the bars is the
// largest entry, or the row pointed at.
const Bars = (props: { rows: Row[]; tone?: Record<string, string>; readout?: boolean }) => {
  const max = () => Math.max(0, ...props.rows.filter((r) => !r.rest).map((r) => r.n));
  const [at, setAt] = createSignal<number | null>(null);
  const read = () => props.rows[at() ?? 0];
  return (
    <Show when={max() > 0} fallback={<Empty />}>
      <Show when={props.readout}>
        <Readout n={read().n} label={read().label} />
      </Show>
      <div class="bars chart" onPointerLeave={() => setAt(null)}>
        <For each={props.rows}>
          {(r, i) => (
            <div class="br" onPointerEnter={() => setAt(i())}>
              <span title={r.label}>{r.label}</span>
              <span class={`t${props.tone?.[r.key] ? ` ${props.tone[r.key]}` : ''}`}>
                <i style={{ width: `${Math.min(100, (r.n / max()) * 100)}%` }} />
              </span>
              <b>{num(r.n)}</b>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

// One column per entry, oldest first, each split into stacked parts. The last is still counting, so it
// is drawn fainter and named by `now`. The figure over the columns is the last one, or the one pointed
// at; with several parts, the legend gives that column's split.
const Columns = (props: {
  keys: string[];
  parts: { name: string; cls: string; values: number[] }[];
  label: (key: string) => string;
  what: string;
  now: string;
}) => {
  const totals = () => props.keys.map((_, i) => props.parts.reduce((a, p) => a + p.values[i], 0));
  const max = () => Math.max(0, ...totals());
  const last = () => props.keys.length - 1;
  const [at, setAt] = createSignal<number | null>(null);
  const shown = () => at() ?? last();
  const name = (i: number) => (i === last() ? props.now : props.label(props.keys[i]));
  return (
    <Show when={max() > 0} fallback={<Empty />}>
      <Readout n={totals()[shown()]} label={name(shown())} />
      <div
        class="cols chart"
        role="img"
        aria-label={`${props.what}, ${props.label(props.keys[0])} to ${props.now.toLowerCase()}, peak ${num(max())}`}
        onPointerLeave={() => setAt(null)}
      >
        <For each={props.keys}>
          {(_, i) => (
            <span classList={{ now: i() === last() }} onPointerEnter={() => setAt(i())}>
              <For each={props.parts}>
                {(p) => (
                  // A count too small for the scale still shows.
                  <Show when={p.values[i()] > 0}>
                    <i class={p.cls} style={{ height: `${Math.max(1.5, (p.values[i()] / max()) * 100)}%` }} />
                  </Show>
                )}
              </For>
            </span>
          )}
        </For>
      </div>
      <div class="axis caps">
        <span>{props.label(props.keys[0])}</span>
        <span>Peak {num(max())}</span>
        <span>{props.now}</span>
      </div>
      <Show when={props.parts.length > 1}>
        <div class="legend caps">
          <For each={props.parts}>
            {(p) => (
              <span class={p.cls}>
                {p.name} <b>{num(p.values[shown()])}</b>
              </span>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
};

const series = (counts: Counted[], what: string, now: string) => (
  <Columns
    keys={counts.map((c) => c.key)}
    parts={[{ name: what, cls: '', values: counts.map((c) => c.n) }]}
    label={shortDate}
    what={what}
    now={now}
  />
);

const RESULT_PARTS: { key: keyof typeof RESULT; cls: string }[] = [
  { key: 'verified', cls: 's-ok' },
  { key: 'written', cls: 's-wr' },
  { key: 'reverted', cls: 's-warn' },
  { key: 'sent', cls: 's-mut' },
  { key: 'failed', cls: 's-bad' },
];
const RESULT_TONE: Record<string, string> = Object.fromEntries(RESULT_PARTS.map((p) => [p.key, p.cls]));

const TABS = [
  { key: 'boxes-over-time', label: 'Boxes over time' },
  { key: 'firmware', label: 'Firmware in use' },
  { key: 'devices', label: 'Devices' },
  { key: 'flashes', label: 'Flashes' },
  { key: 'countries', label: 'Countries and systems' },
];

const Scope = (props: { children: string }) => <span class="caps">{props.children}</span>;

const Summary = (props: { s: StatsSummary }) => {
  const s = () => props.s;
  const figures = (): [string, number | null, (n: number) => string][] => [
    ['Unique boxes', s().boxes.total, num],
    ['New this week', s().boxes.newPerWeek.at(-1)?.n ?? 0, num],
    ['Active in 7 days', s().boxes.active7, num],
    ['Active in 30 days', s().boxes.active30, num],
    ['Unique devices', s().devices.unique, num],
    ['Flashes', s().flashes.total, num],
    // Rounded down, so 199 of 200 is not 100%.
    ['Success rate', s().flashes.total ? Math.floor((s().flashes.succeeded / s().flashes.total) * 100) : null, (n) => `${n}%`],
    ['Countries', s().countries.filter((c) => c.key !== 'unknown').length, num],
  ];
  return (
    <>
      <dl class="vit eight caps" id="stats" data-search-target data-testid="figures">
        <For each={figures()}>
          {([label, n, format]) => (
            <div>
              <dt>{label}</dt>
              <dd class="big">{n === null ? 'None' : <Count to={n} format={format} />}</dd>
            </div>
          )}
        </For>
      </dl>

      <PageTabs id="stats" tabs={TABS}>
        <Pane key="boxes-over-time">
          <Panels>
            <Panel id="new-boxes" title="New per week" wide>
              {series(s().boxes.newPerWeek, 'New boxes per week', 'This week')}
            </Panel>
            <Panel id="active-boxes" title="Active per day" wide>
              {series(s().boxes.activePerDay, 'Active boxes per day', 'Today')}
            </Panel>
          </Panels>
        </Pane>

        <Pane key="firmware">
          <Panels>
            <Panel id="firmware-versions" title="Main chip" aside={<Scope>Last 30 days</Scope>} wide>
              <Bars rows={rows(s().firmware.versions, (v) => `v${v}`)} readout />
            </Panel>
          </Panels>
        </Pane>

        <Pane key="devices">
          <Panels>
            <Panel id="device-kinds" title="By kind" wide>
              <Show when={s().devices.byKind.length > 0} fallback={<Empty />}>
                <div class="table-scroll">
                  <table class="api-params names">
                    <thead>
                      <tr>
                        <th>Kind</th>
                        <th class="num">Devices</th>
                        <th class="num">Boxes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={s().devices.byKind}>
                        {(k) => (
                          <tr>
                            <td>{KIND[k.kind] ?? 'Unknown'}</td>
                            <td class="num">{num(k.devices)}</td>
                            <td class="num">{num(k.boxes)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Panel>
            <Panel id="top-devices" title="Most used" wide>
              <Show when={s().devices.top.length > 0} fallback={<Empty />}>
                <div class="table-scroll">
                  <table class="api-params names">
                    <thead>
                      <tr>
                        <th>Device</th>
                        <th>VID:PID</th>
                        <th class="num">Boxes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={s().devices.top}>
                        {(d) => (
                          <tr>
                            <td class="wrap">
                              <Show when={d.product} fallback={KIND[d.kind] ?? 'Unknown'}>
                                {d.product}
                                <span class="sub">{KIND[d.kind] ?? 'Unknown'}</span>
                              </Show>
                            </td>
                            <td>
                              {hex4(d.vid)}:{hex4(d.pid)}
                            </td>
                            <td class="num">{num(d.boxes)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Panel>
          </Panels>
        </Pane>

        <Pane key="flashes">
          <Panels>
            <Panel id="flashes-per-week" title="Per week" wide>
              <Columns
                keys={s().flashes.perWeek.map((w) => w.week)}
                parts={RESULT_PARTS.map((p) => ({ name: RESULT[p.key], cls: p.cls, values: s().flashes.perWeek.map((w) => w[p.key]) }))}
                label={shortDate}
                what="Flashes per week"
                now="This week"
              />
            </Panel>
            <Panel id="flash-results" title="Result">
              <Bars rows={rows(s().flashes.byResult, (k) => RESULT[k as keyof typeof RESULT] ?? k)} tone={RESULT_TONE} />
            </Panel>
            <Panel id="flash-routes" title="Page and route">
              <Bars rows={rows(s().flashes.byRoute, route)} />
            </Panel>
            <Panel id="flash-chips" title="Chips">
              <Bars rows={rows(s().flashes.byChips, (k) => CHIPS[k] ?? k)} />
            </Panel>
            <Panel id="flash-sources" title="Source">
              <Bars rows={rows(s().flashes.bySource, (k) => SOURCE[k] ?? k)} />
            </Panel>
            <Panel id="flash-versions" title="Version flashed" wide>
              <Bars rows={rows(s().flashes.byVersion, (v) => `v${v}`)} />
            </Panel>
          </Panels>
        </Pane>

        <Pane key="countries">
          <Panels>
            <Panel id="country" title="Country" aside={<Scope>As last seen</Scope>} wide>
              <Bars rows={rows(s().countries, country)} readout />
            </Panel>
            <Panel id="system" title="System">
              <Bars rows={rows(s().os, (k) => OS[k] ?? k)} />
            </Panel>
            <Panel id="browser" title="Browser">
              <Bars rows={rows(s().browsers, (k) => BROWSER[k] ?? k)} />
            </Panel>
          </Panels>
        </Pane>
      </PageTabs>
    </>
  );
};

const Stats = () => {
  const [summary, { refetch }] = createResource(fetchStats);
  // A rejected resource re-throws on every read, render included.
  const value = () => {
    try {
      return summary();
    } catch {
      return undefined;
    }
  };
  return (
    <>
      <PageHeader />
      <Switch
        fallback={
          <Panels>
            <Panel id="stats" wide>
              {/* The server fills this for crawlers. */}
              <div data-fill="stats">
                <p class="mut" data-search-skip>Loading...</p>
              </div>
            </Panel>
          </Panels>
        }
      >
        <Match when={summary.state === 'errored'}>
          <Panels>
            <Panel id="stats" wide>
              <div class="callout callout--warning" role="alert">
                {(summary.error as Error).message}
              </div>
              <div class="acts">
                <Button variant="secondary" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            </Panel>
          </Panels>
        </Match>
        <Match when={value()}>{(v) => <Summary s={v()} />}</Match>
      </Switch>
    </>
  );
};

export default Stats;
