import { For, Show, type JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { RESULTS, categoryOf } from '../../data/comparison';
import { pageFor } from '../../data/comparison/pages';
import { resultOf, showValue, span, type Result } from '../../data/comparison/result';
import type { Box, Defect, FeatureRow, MeasureRow, OutcomeRow, PairRow, Section, SettingsTable, Table, Value } from '../../data/comparison/types';

export const BOX: Record<Box, string> = { stock: 'Stock', medius: 'Medius' };
const BOXES: Box[] = ['stock', 'medius'];
const RESULT: Record<Exclude<Result, null>, string> = { stock: 'Stock', medius: 'Medius', equal: 'Equal', differs: 'Differs' };

export interface Item {
  table: Exclude<Table, SettingsTable>;
  row: PairRow;
  // On a page that gathers rows from several tables: what the row compares, in place of its label, and the
  // label under it.
  head?: JSX.Element;
  sub?: string;
}

// A value's bar on the stats page's track: solid to the low end of its range and fainter on to the high
// end, to the scale of the largest value it is drawn beside.
const Bar = (props: { v: Value; max: number }) => {
  // A value above zero always shows: no bar is drawn under 1.5% of its track.
  const at = (x: number) => (props.max > 0 && x > 0 ? Math.max(1.5, Math.min(100, (x / props.max) * 100)) : 0);
  const lo = () => at(span(props.v)[0]);
  const hi = () => at(span(props.v)[1]);
  return (
    <span class="t" aria-hidden="true">
      <i style={{ width: `${lo()}%` }} />
      <Show when={hi() > lo()}>
        <i class="hi" style={{ left: `${lo()}%`, width: `${hi() - lo()}%` }} />
      </Show>
    </span>
  );
};

const valueOf = (item: Item, box: Box) => (item.row as MeasureRow)[box];
// A command as the API spells it is code; a tool's or a site's name is words.
const COMMAND = /^(km\.[a-z_0-9]+(\(\))?|[A-Z][A-Z0-9_]+(\([A-Z_]+\))?)$/;

// A box's cell: a measure's value and its bar, an outcome's word, or a feature's command (as code) or tool
// (in words). The box that's behind is dimmed; where the two match, or neither is better, both stand.
const PairCell = (props: { item: Item; box: Box; result: Result; max: number }) => {
  // Behind the other box, or level with it on the worst outcome a table has.
  const worst = () => {
    const t = props.item.table;
    if (t.kind !== 'outcome' || t.ranked === false || props.result !== 'equal') return false;
    return (props.item.row as OutcomeRow)[props.box].is === t.outcomes[t.outcomes.length - 1];
  };
  const behind = () => props.result === (props.box === 'stock' ? 'medius' : 'stock') || worst();
  const t = props.item.table;
  const feature = () => (props.item.row as FeatureRow)[props.box];
  return (
    <td class={`v ${props.box}${behind() ? ' behind' : ''}`} data-label={BOX[props.box]}>
      {t.kind === 'measure' ? (
        <span class="meter">
          <span class="n">{showValue(valueOf(props.item, props.box), t.unit)}</span>
          <Bar v={valueOf(props.item, props.box)} max={props.max} />
        </span>
      ) : t.kind === 'outcome' ? (
        (props.item.row as OutcomeRow)[props.box].is
      ) : feature() ? (
        COMMAND.test(feature()!) ? <code>{feature()}</code> : feature()
      ) : (
        'No'
      )}
    </td>
  );
};

// Stock against Medius, a row per condition: what was varied, each box's value, and which box is ahead.
// Bars share one scale across a table, or, where the rows come from several tables, a scale per row.
export const PairTable = (props: { key: string; commands?: Record<Box, string>; items: Item[]; scale: 'table' | 'row'; defects: Defect[] }) => {
  const ranked = () => props.items.some((i) => resultOf(i.table, i.row) !== null);
  const measures = () => props.items.filter((i) => i.table.kind === 'measure');
  const top = (items: Item[]) => Math.max(0, ...items.flatMap((i) => BOXES.map((b) => span(valueOf(i, b))[1])));
  return (
    <div class="stack-box">
      <Show when={props.commands}>
        {(c) => (
          <p class="pair-cmds caps">
            <For each={BOXES}>
              {(b) => (
                <>
                  {BOX[b]} <code>{c()[b]}</code>
                </>
              )}
            </For>
          </p>
        )}
      </Show>
      <div class="table-scroll">
        <table class="api-params names pair stacked">
          <thead>
            <tr>
              <th>{props.key}</th>
              <For each={BOXES}>
                {(b) => (
                  <th>
                    <span class="hd">
                      {BOX[b]}
                      <Show when={props.commands?.[b]}>{(c) => <code class="cmd">{c()}</code>}</Show>
                    </span>
                  </th>
                )}
              </For>
              <Show when={ranked()}>
                <th class="res">Result</th>
              </Show>
            </tr>
          </thead>
          <tbody>
            <For each={props.items}>
              {(item) => {
                const result = resultOf(item.table, item.row);
                const max = item.table.kind !== 'measure' ? 0 : props.scale === 'row' ? top([item]) : top(measures());
                return (
                  <tr>
                    <td>
                      {item.head ?? item.row.label}
                      <Show when={item.sub}>
                        <span class="sub">{item.sub}</span>
                      </Show>
                      <Show when={item.row.note}>
                        <span class="sub">{item.row.note}</span>
                      </Show>
                    </td>
                    <For each={BOXES}>{(b) => <PairCell item={item} box={b} result={result} max={max} />}</For>
                    <Show when={ranked()}>
                      <td class="res">
                        <Show when={result}>{(r) => <span class={`status ${r()}`}>{RESULT[r()]}</span>}</Show>
                        <For each={props.defects.filter((d) => d.row === item.row.id)}>
                          {(d) => (
                            <A class="status bad" href="/comparison/defects" aria-label={`${BOX[d.box]} defect: ${d.text}`}>
                              {`${BOX[d.box]} defect`}
                            </A>
                          )}
                        </For>
                      </td>
                    </Show>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Each box's settings measured the same way: a row per setting, a bar per value to the scale of its column.
export const SettingsTableView = (props: { table: SettingsTable }) => {
  const max = (col: string) => Math.max(0, ...props.table.rows.map((r) => span(r.values[col])[1]));
  const rows = () => BOXES.flatMap((b) => props.table.rows.filter((r) => r.box === b));
  return (
    <div class="stack-box">
      <div class="table-scroll">
        <table class="api-params names pair settings stacked">
          <thead>
            <tr>
              <th>Box</th>
              <th>{props.table.key}</th>
              <For each={props.table.columns}>{(c) => <th>{c.label}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(r) => (
                <tr>
                  <td>{BOX[r.box]}</td>
                  <td>
                    {r.label}
                    <Show when={r.default}>
                      {' '}
                      <em>(default)</em>
                    </Show>
                  </td>
                  <For each={props.table.columns}>
                    {(c) => (
                      <td class={`v ${r.box}`} data-label={c.label}>
                        <span class="meter">
                          <span class="n">{showValue(r.values[c.id], c.unit)}</span>
                          <Bar v={r.values[c.id]} max={max(c.id)} />
                        </span>
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// One section of results: what was done, anything the page draws for it, then its tables, each under its
// label where it has one.
export const ResultSection = (props: { section: Section; defects: Defect[]; before?: JSX.Element }) => (
  <DocSection id={props.section.id} title={props.section.title}>
    <p>{props.section.about}</p>
    {props.before}
    <For each={props.section.tables}>
      {(t) => (
        <>
          <Show when={t.label}>
            <div class="api-response-label">{t.label}</div>
          </Show>
          {t.kind === 'settings' ? (
            <SettingsTableView table={t} />
          ) : (
            <PairTable
              key={t.key}
              commands={'commands' in t ? t.commands : undefined}
              items={(t.rows as PairRow[]).map((row) => ({ table: t, row }))}
              scale="table"
              defects={props.defects}
            />
          )}
        </>
      )}
    </For>
  </DocSection>
);

// A Comparison page drawn from its categories: the lead, then each section, with anything drawn by hand
// put in the section it belongs to.
export const ComparisonPage = (props: { path: string; lead: JSX.Element; before?: Record<string, JSX.Element> }) => {
  const sections = () => (pageFor(props.path)?.categories ?? []).flatMap((c) => categoryOf(c)?.sections ?? []);
  return (
    <>
      <PageHeader>{props.lead}</PageHeader>
      <For each={sections()}>{(s) => <ResultSection section={s} defects={RESULTS.defects} before={props.before?.[s.id]} />}</For>
    </>
  );
};
