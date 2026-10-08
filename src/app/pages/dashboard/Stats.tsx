import { For, type JSX, Match, Show, Switch, createResource } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { type Count, type StatsSummary, type WeekFlashes, fetchStats } from '../../../dashboard/stats';
import { Section } from './Section';
import { PageHeader } from '../../shell/PageHeader';

// Longer lists end in one row summing the rest.
const MAX_ROWS = 12;

const SCOPE = 'All boxes, all time';

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
const PAGE: Record<string, string> = { update: 'Update', advanced: 'Advanced', setup: 'Set up' };
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
  label: string;
  n: number;
  // The row summing the rest, which doesn't set the scale.
  rest?: boolean;
}

const rows = (counts: Count[], label: (key: string) => string): Row[] => {
  const all = counts.map((c) => ({ label: label(c.key), n: c.n }));
  if (all.length <= MAX_ROWS) return all;
  const rest = all.slice(MAX_ROWS - 1);
  return [
    ...all.slice(0, MAX_ROWS - 1),
    { label: `Others (${rest.length})`, n: rest.reduce((a, r) => a + r.n, 0), rest: true },
  ];
};

const Empty = () => <p class="stat-empty">None.</p>;

const Bars = (props: { rows: Row[] }) => {
  const max = () => Math.max(0, ...props.rows.filter((r) => !r.rest).map((r) => r.n));
  return (
    <Show when={max() > 0} fallback={<Empty />}>
      <div class="stat-bars">
        <For each={props.rows}>
          {(r) => (
            <>
              <span class="stat-bars__label" title={r.label}>
                {r.label}
              </span>
              <span class="stat-bars__track">
                <span class="stat-bars__fill" style={{ width: `${Math.min(100, (r.n / max()) * 100)}%` }} />
              </span>
              <span class="stat-bars__value">{num(r.n)}</span>
            </>
          )}
        </For>
      </div>
    </Show>
  );
};

// One column per entry, oldest first, each split into stacked parts. The last is still counting, so it
// is drawn fainter and named by `now`.
const Columns = (props: {
  keys: string[];
  parts: { name: string; cls: string; values: number[] }[];
  label: (key: string) => string;
  what: string;
  now: string;
}) => {
  const totals = () => props.keys.map((_, i) => props.parts.reduce((a, p) => a + p.values[i], 0));
  const max = () => Math.max(0, ...totals());
  const w = 10;
  return (
    <Show when={max() > 0} fallback={<Empty />}>
      <svg
        class="stat-columns"
        viewBox={`0 0 ${props.keys.length * w} 100`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${props.what}, ${props.label(props.keys[0])} to ${props.now.toLowerCase()}, peak ${num(max())}`}
      >
        <For each={props.keys}>
          {(key, i) => {
            let y = 100;
            const split = () =>
              props.parts.length > 1
                ? ` (${props.parts.filter((p) => p.values[i()] > 0).map((p) => `${p.name} ${num(p.values[i()])}`).join(', ')})`
                : '';
            return (
              <g class={i() === props.keys.length - 1 ? 'stat-col--now' : undefined}>
                <title>{`${i() === props.keys.length - 1 ? props.now : props.label(key)}: ${num(totals()[i()])}${totals()[i()] ? split() : ''}`}</title>
                <For each={props.parts}>
                  {(p) => {
                    // A count too small for the scale still shows.
                    const n = p.values[i()];
                    const h = n > 0 ? Math.max(1.5, (n / max()) * 100) : 0;
                    y -= h;
                    return <rect class={p.cls} x={i() * w + 1} y={y} width={w - 2} height={h} />;
                  }}
                </For>
              </g>
            );
          }}
        </For>
        <line class="stat-columns__base" x1="0" y1="100" x2={props.keys.length * w} y2="100" vector-effect="non-scaling-stroke" />
      </svg>
      <div class="stat-axis">
        <span>{props.label(props.keys[0])}</span>
        <span>Peak {num(max())}</span>
        <span>{props.now}</span>
      </div>
    </Show>
  );
};

const series = (counts: Count[], what: string, now: string) => (
  <Columns
    keys={counts.map((c) => c.key)}
    parts={[{ name: what, cls: 'stat-fill--primary', values: counts.map((c) => c.n) }]}
    label={shortDate}
    what={what}
    now={now}
  />
);

const RESULT_PARTS: { key: keyof typeof RESULT; cls: string }[] = [
  { key: 'verified', cls: 'stat-fill--success' },
  { key: 'written', cls: 'stat-fill--written' },
  { key: 'reverted', cls: 'stat-fill--warning' },
  { key: 'sent', cls: 'stat-fill--muted' },
  { key: 'failed', cls: 'stat-fill--danger' },
];

// Line height 1, as Section's label has.
const Group = (props: { title: string; children: JSX.Element }) => (
  <div>
    <div class="api-response-label" style={{ 'line-height': '1' }}>
      {props.title}
    </div>
    {props.children}
  </div>
);

const Figure = (props: { value: string; label: string }) => (
  <div class="stat-figure">
    <div class="stat-figure__value">{props.value}</div>
    <div class="stat-figure__label">{props.label}</div>
  </div>
);

const Summary = (props: { s: StatsSummary }) => {
  const s = () => props.s;
  // Rounded down, so 199 of 200 is not 100%.
  const rate = () => (s().flashes.total ? `${Math.floor((s().flashes.succeeded / s().flashes.total) * 100)}%` : 'None');
  return (
    <>
      <div id="stats" data-search-target>
        <Card>
          <div class="stat-figures" data-testid="figures">
            <Figure value={num(s().boxes.total)} label="Unique boxes" />
            <Figure value={num(s().boxes.newPerWeek.at(-1)?.n ?? 0)} label="New this week" />
            <Figure value={num(s().boxes.active7)} label="Active in 7 days" />
            <Figure value={num(s().boxes.active30)} label="Active in 30 days" />
            <Figure value={num(s().devices.unique)} label="Unique devices" />
            <Figure value={num(s().flashes.total)} label="Flashes" />
            <Figure value={rate()} label="Success rate" />
            <Figure value={num(s().countries.filter((c) => c.key !== 'unknown').length)} label="Countries" />
          </div>
        </Card>
      </div>

      <div id="boxes-over-time" data-search-target>
        <Card>
          <CardHeader title="Boxes over time" subtitle="Last 26 weeks and 90 days" />
          <Section title="New per week" first>
            {series(s().boxes.newPerWeek, 'New boxes per week', 'This week')}
          </Section>
          <Section title="Active per day">{series(s().boxes.activePerDay, 'Active boxes per day', 'Today')}</Section>
        </Card>
      </div>

      <div id="firmware" data-search-target>
        <Card>
          <CardHeader title="Firmware in use" subtitle="Last 30 days" />
          <Section title="Main chip" first>
            <Bars rows={rows(s().firmware.versions, (v) => `v${v}`)} />
          </Section>
        </Card>
      </div>

      <div id="devices" data-search-target>
        <Card>
          <CardHeader title="Devices" subtitle="Cloned by the boxes" />
          <Section title="By kind" first>
            <Show when={s().devices.byKind.length > 0} fallback={<Empty />}>
              <div class="table-scroll">
                <table class="api-params">
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Devices</th>
                      <th>Boxes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={s().devices.byKind}>
                      {(k) => (
                        <tr>
                          <td>{KIND[k.kind] ?? 'Unknown'}</td>
                          <td>{num(k.devices)}</td>
                          <td>{num(k.boxes)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Section>
          <Section title="Most used">
            <Show when={s().devices.top.length > 0} fallback={<Empty />}>
              <div class="table-scroll">
                <table class="api-params">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>VID:PID</th>
                      <th>Boxes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={s().devices.top}>
                      {(d) => (
                        <tr>
                          <td class="stat-wrap">
                            <Show when={d.product} fallback={KIND[d.kind] ?? 'Unknown'}>
                              {d.product}
                              <div class="stat-sub">{KIND[d.kind] ?? 'Unknown'}</div>
                            </Show>
                          </td>
                          <td>
                            {hex4(d.vid)}:{hex4(d.pid)}
                          </td>
                          <td>{num(d.boxes)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Section>
        </Card>
      </div>

      <div id="flashes" data-search-target>
        <Card>
          <CardHeader title="Flashes" subtitle="Update, Advanced and Set up" />
          <Section title="Per week" first>
            <Columns
              keys={s().flashes.perWeek.map((w) => w.week)}
              parts={RESULT_PARTS.map((p) => ({ name: RESULT[p.key], cls: p.cls, values: s().flashes.perWeek.map((w) => w[p.key]) }))}
              label={shortDate}
              what="Flashes per week"
              now="This week"
            />
            <Show when={s().flashes.total > 0}>
              <div class="stat-legend">
                <For each={RESULT_PARTS}>
                  {(p) => (
                    <span>
                      <span class={`stat-swatch ${p.cls}`} />
                      {RESULT[p.key]}
                    </span>
                  )}
                </For>
              </div>
            </Show>
          </Section>
          <Section>
            <div class="stat-split">
              <Group title="Result">
                <Bars rows={rows(s().flashes.byResult, (k) => RESULT[k as keyof typeof RESULT] ?? k)} />
              </Group>
              <Group title="Page and route">
                <Bars rows={rows(s().flashes.byRoute, route)} />
              </Group>
              <Group title="Chips">
                <Bars rows={rows(s().flashes.byChips, (k) => CHIPS[k] ?? k)} />
              </Group>
              <Group title="Source">
                <Bars rows={rows(s().flashes.bySource, (k) => SOURCE[k] ?? k)} />
              </Group>
              <Group title="Version flashed">
                <Bars rows={rows(s().flashes.byVersion, (v) => `v${v}`)} />
              </Group>
            </div>
          </Section>
        </Card>
      </div>

      <div id="countries" data-search-target>
        <Card>
          <CardHeader title="Countries and systems" subtitle="Each box as last seen" />
          <Section first>
            <div class="stat-split">
              <Group title="Country">
                <Bars rows={rows(s().countries, country)} />
              </Group>
              <Group title="System">
                <Bars rows={rows(s().os, (k) => OS[k] ?? k)} />
              </Group>
              <Group title="Browser">
                <Bars rows={rows(s().browsers, (k) => BROWSER[k] ?? k)} />
              </Group>
            </div>
          </Section>
        </Card>
      </div>
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
      <PageHeader lead={SCOPE} />
      <Switch
        fallback={
          <div id="stats" data-search-target>
            <Card>
              <div data-fill="stats"><p>Loading...</p></div>
            </Card>
          </div>
        }
      >
        <Match when={summary.state === 'errored'}>
          <div id="stats" data-search-target>
            <Card>
              <div class="callout callout--warning" role="alert">
                {(summary.error as Error).message}
              </div>
              <Button variant="secondary" onClick={() => void refetch()}>
                Retry
              </Button>
            </Card>
          </div>
        </Match>
        <Match when={value()}>{(s) => <Summary s={s()} />}</Match>
      </Switch>
    </>
  );
};

export default Stats;
