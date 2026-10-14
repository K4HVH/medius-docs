import { For, Show, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { FixLink } from '../../shell/Filter';
import { routeFor } from '../../routes';
import { RESULTS, defectPlace, placeOf } from '../../data/comparison';
import { CopyLink } from '../../shell/CopyLink';
import { COMPARISON_PAGES, KEY_ROWS, pageOfCategory } from '../../data/comparison/pages';
import type { Box } from '../../data/comparison/types';
import { BOX, PairTable, type Item } from './parts';

// An area's section here: its page's last word and -results, so the section's address differs from the page's.
const sectionOf = (path: string) => `${path.slice(path.lastIndexOf('/') + 1)}-results`;

// Where a row sits: its section, as a link.
const Where = (props: { row: string }) => {
  const at = () => placeOf(props.row);
  return (
    <Show when={at()}>
      {(p) => <A href={`${pageOfCategory(p().category.id)!.path}/${p().section.id}`}>{p().section.title}</A>}
    </Show>
  );
};

const Defects = () => {
  const rows = () =>
    (['stock', 'medius'] as Box[]).flatMap((box) => {
      const mine = RESULTS.defects.filter((d) => d.box === box);
      return mine.length
        ? mine.map((d) => ({ box, text: d.text, row: d.rows[0], id: defectPlace(d) }))
        : [{ box, text: 'None found', row: '', id: '' }];
    });
  return (
    <div class="stack-box">
      <div class="table-scroll">
        <table class="api-params names stacked">
          <thead>
            <tr>
              <th>Box</th>
              <th>Defect</th>
              <th>Section</th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(r) => (
                <tr id={r.id || undefined} data-search-target={r.id ? '' : undefined} data-search-title={r.id ? r.text : undefined}>
                  <td>{BOX[r.box]}</td>
                  <td class="long" data-label="Defect">
                    {r.text}
                    <Show when={r.id}>
                      <CopyLink id={r.id} label={r.text} />
                    </Show>
                  </td>
                  <td data-label={r.row ? 'Section' : undefined}>
                    <Show when={r.row}>
                      <Where row={r.row} />
                    </Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Overview: Component = () => (
  <>
    <PageHeader>
      <p>
        Stock MAKCU firmware {RESULTS.firmware.stock} and Medius {RESULTS.firmware.medius}, tested the same way on two MAKCU boxes. The
        main results from each area are below, and each area's page has the rest.
      </p>
    </PageHeader>

    <For each={COMPARISON_PAGES.filter((p) => KEY_ROWS[p.path])}>
      {(p) => (
        <DocSection
          id={sectionOf(p.path)}
          title={routeFor(p.path)!.title}
          aside={
            <span class="cross" data-search-skip data-agent-hide>
              <FixLink href={p.path} label={`All results for ${routeFor(p.path)!.title}`}>
                All results
              </FixLink>
            </span>
          }
        >
          <PairTable
            key="Test"
            items={KEY_ROWS[p.path].map((id): Item => {
              const at = placeOf(id)!;
              const href = `${p.path}/${at.section.id}`;
              // A feature's row names it; any other row's table names what it compares.
              return at.table.kind === 'feature'
                ? { table: at.table, row: at.row, head: <A href={href}>{at.row.label}</A>, sub: at.table.label }
                : { table: at.table, row: at.row, head: <A href={href}>{at.table.label}</A>, sub: at.row.label };
            })}
            scale="row"
            defects={RESULTS.defects}
          />
        </DocSection>
      )}
    </For>

    <DocSection id="defects" title="Defects">
      <Defects />
    </DocSection>
  </>
);

export default Overview;
