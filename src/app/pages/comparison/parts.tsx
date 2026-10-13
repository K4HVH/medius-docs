import { For, Show, type JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { RESULTS, categoryOf } from '../../data/comparison';
import { pageFor } from '../../data/comparison/pages';
import type { Cell, Chart, Defect, Group, Row, Verdict } from '../../data/comparison/types';

export const VERDICT: Record<Verdict, string> = {
  medius: 'Medius',
  stock: 'Stock',
  equal: 'Equal',
  mixed: 'Mixed',
  design: 'By design',
  unranked: 'Unranked',
};
const TONE: Partial<Record<Verdict, string>> = { medius: 'medius', stock: 'stock' };
export const BOX = { stock: 'Stock', medius: 'Medius' } as const;

export const cellText = (c: Cell) => (typeof c === 'string' ? c : c.text);

// A value a narrow column may break between its parts: after a slash or an underscore and before a bracket,
// never inside a word or a range (0.93-0.98).
export const Breakable = (props: { text: string }) =>
  props.text
    .split(/(\d[\d,.]*-\d[\d,.]*)/)
    .flatMap((part, i) =>
      i % 2 ? [<span class="nw">{part}</span>] : part.split(/(?<=[/_])|(?=\()/).flatMap((bit, j) => (j ? [<wbr />, bit] : [bit])),
    );
const amount = (v: number, unit: string) => `${v.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unit}`;

// A pair of bars per point, stock above Medius, to the scale of the largest value. A box that wasn't measured
// gets no bar.
export const PairBars = (props: { chart: Chart }) => {
  const max = () => Math.max(0, ...props.chart.points.flatMap((p) => [p.stock ?? 0, p.medius ?? 0]));
  const width = (v: number | null) => `${v != null && max() > 0 ? (Math.max(0, v) / max()) * 100 : 0}%`;
  return (
    <figure class="pairs-fig">
      <figcaption class="caps">{props.chart.label}</figcaption>
      <div class="pairs">
        <For each={props.chart.points}>
          {(p) => (
            <div class="pt">
              <span class="x">{p.x}</span>
              <For each={['stock', 'medius'] as const}>
                {(box) => (
                  <>
                    <span class="k">{BOX[box]}</span>
                    <span class={`t ${box}`}>
                      <i style={{ width: width(p[box]) }} />
                    </span>
                    <b>{p[box] == null ? 'Not measured' : amount(p[box]!, props.chart.unit)}</b>
                  </>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </figure>
  );
};

// Under a test: its caveat, then how many, the layer it was timed on and the hubs it was measured behind.
const RowNote = (props: { row: Row }) => {
  const hubs = () => props.row.hubs && (props.row.hubs === 'both' ? 'both hubs' : `behind ${props.row.hubs}`);
  const facts = () => [props.row.n, props.row.layer && `${props.row.layer} timing`, hubs()].filter(Boolean).join(' · ');
  return (
    <>
      <Show when={props.row.note}>
        <span class="sub">{props.row.note}</span>
      </Show>
      <Show when={facts()}>
        <span class="sub">{facts()}</span>
      </Show>
    </>
  );
};

const Result = (props: { row: Row; defects: Defect[] }) => (
  <>
    <span class={`status${TONE[props.row.verdict] ? ` ${TONE[props.row.verdict]}` : ''}`}>{VERDICT[props.row.verdict]}</span>
    <Show when={props.row.verdict === 'unranked' && props.row.reason}>
      <span class="sub">{props.row.reason}</span>
    </Show>
    <For each={props.defects}>
      {(d) => (
        <A class="vs-d" href={`/comparison#defect-${d.id}`} aria-label={`${BOX[d.box]} defect: ${d.text}`}>
          {`${BOX[d.box]} defect`}
        </A>
      )}
    </For>
  </>
);

// Results as stock against Medius: the test, each box's value, and which is ahead.
export const ResultRows = (props: { label?: string; rows: Row[]; defects: Defect[] }) => (
  <div class="table-scroll">
    <table class="api-params names fixed vs">
      <colgroup>
        <col class="vs-t" />
        <col />
        <col />
        <col class="vs-r" />
      </colgroup>
      <thead>
        <tr>
          <th>{props.label ?? 'Test'}</th>
          <th>Stock</th>
          <th>Medius</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.rows}>
          {(r) => (
            <tr>
              <td>
                <Breakable text={r.test} />
                <RowNote row={r} />
              </td>
              <td>
                <Breakable text={cellText(r.stock)} />
              </td>
              <td>
                <Breakable text={cellText(r.medius)} />
              </td>
              <td>
                <Result row={r} defects={props.defects.filter((d) => d.row === r.id)} />
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
);

const GridTable = (props: { columns: string[]; rows: { cells: Cell[] }[] }) => (
  <div class="table-scroll">
    <table class="api-params names vs-grid">
      <thead>
        <tr>
          <For each={props.columns}>{(c) => <th>{c}</th>}</For>
        </tr>
      </thead>
      <tbody>
        <For each={props.rows}>
          {(r) => (
            <tr>
              <For each={r.cells}>
                {(c, i) => (
                  <td data-label={i() ? props.columns[i()] : undefined}>
                    <Breakable text={cellText(c)} />
                  </td>
                )}
              </For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
);

// One group of results as a section of its page: what was done, anything the page draws by hand for it,
// its chart, its table, and a defect that names no row.
export const GroupSection = (props: { group: Group; defects: Defect[]; layers: Record<string, string>; before?: JSX.Element }) => {
  const mine = () => props.defects.filter((d) => d.group === props.group.id);
  return (
    <DocSection id={props.group.id} title={props.group.title}>
      <p>{props.group.about}</p>
      {props.before}
      <Show when={props.group.chart}>{(c) => <PairBars chart={c()} />}</Show>
      {props.group.kind === 'rows' ? (
        <ResultRows label={props.group.label} rows={props.group.rows} defects={mine()} />
      ) : (
        <GridTable columns={props.group.columns} rows={props.group.rows} />
      )}
      <For each={mine().filter((d) => !d.row)}>{(d) => <p class="vs-dl">{`${BOX[d.box]} defect: ${d.text}`}</p>}</For>
    </DocSection>
  );
};

// The foot of every Comparison page: the versions, how it was measured, and the page's data. Method, which
// holds no results and is the method, gives the versions alone.
export const SourceLine = (props: { path: string; bare?: boolean }) => (
  <p class="src">
    <Show when={!props.bare} fallback={<>Stock {RESULTS.firmware.stock} and Medius v{RESULTS.firmware.medius}.</>}>
      Stock {RESULTS.firmware.stock} and Medius v{RESULTS.firmware.medius}, measured as{' '}
      <A href="/comparison/method">Method</A> describes. This page's results:{' '}
      <a href={`${props.path}.json`} download="">
        {props.path.slice(props.path.lastIndexOf('/') + 1)}.json
      </a>
      .
    </Show>
  </p>
);

// A Comparison page drawn from its categories: the lead, then each group, with anything drawn by hand put
// in the group it belongs to.
export const ComparisonPage = (props: { path: string; lead: JSX.Element; before?: Record<string, JSX.Element> }) => {
  const groups = () => (pageFor(props.path)?.categories ?? []).flatMap((c) => categoryOf(c)?.groups ?? []);
  return (
    <>
      <PageHeader>{props.lead}</PageHeader>
      <For each={groups()}>
        {(g) => <GroupSection group={g} defects={RESULTS.defects} layers={RESULTS.layers} before={props.before?.[g.id]} />}
      </For>
      <SourceLine path={props.path} />
    </>
  );
};
