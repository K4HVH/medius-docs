import { For, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { FixLink } from '../../shell/Filter';
import { routeFor } from '../../routes';
import { RESULTS, categoryOf, rowOf } from '../../data/comparison';
import { COMPARISON_PAGES, KEY_ROWS } from '../../data/comparison/pages';
import type { Box, Defect } from '../../data/comparison/types';
import { BOX, ResultRows, SourceLine } from './parts';

// An area's section here: its page's last word and -results, so the section's address differs from the page's.
const sectionOf = (path: string) => `${path.slice(path.lastIndexOf('/') + 1)}-results`;
const pageOf = (category: string) => COMPARISON_PAGES.find((p) => p.categories.includes(category))!;
const groupTitle = (category: string, group: string) => categoryOf(category)?.groups.find((g) => g.id === group)?.title ?? group;

const Defects = () => {
  const rows = () =>
    (['stock', 'medius'] as Box[]).flatMap((box): { box: Box; text: string; at: Defect | null }[] => {
      const mine = RESULTS.defects.filter((d) => d.box === box);
      return mine.length ? mine.map((d) => ({ box, text: d.text, at: d })) : [{ box, text: 'None found', at: null }];
    });
  return (
    <div class="table-scroll">
      <table class="api-params names fixed vs-defects">
        <colgroup>
          <col class="b" />
          <col />
          <col class="w" />
        </colgroup>
        <thead>
          <tr><th>Box</th><th>Defect</th><th>Section</th></tr>
        </thead>
        <tbody>
          <For each={rows()}>
            {(r) => (
              <tr id={r.at ? `defect-${r.at.id}` : undefined}>
                <td>{BOX[r.box]}</td>
                <td>{r.text}</td>
                <td>
                  {r.at && <A href={`${pageOf(r.at.category).path}/${r.at.group}`}>{groupTitle(r.at.category, r.at.group)}</A>}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};

const Overview: Component = () => (
  <>
    <PageHeader>
      <p>
        MAKCU's stock firmware and Medius, each on a MAKCU box fed by an identical emulated device and measured the same way.
        Below are the results each area leads with; its page has the rest.
      </p>
    </PageHeader>

    <For each={COMPARISON_PAGES.filter((p) => KEY_ROWS[p.path])}>
      {(p) => (
        <DocSection
          id={sectionOf(p.path)}
          title={routeFor(p.path)!.title}
          aside={
            <span class="cross" data-search-skip data-agent-hide>
              <FixLink href={p.path}>All results</FixLink>
            </span>
          }
        >
          <ResultRows rows={KEY_ROWS[p.path].map((id) => rowOf(id)!.row)} defects={RESULTS.defects} />
        </DocSection>
      )}
    </For>

    <DocSection id="defects" title="Defects">
      <p>Serious flaws only, each beside the result that shows it.</p>
      <Defects />
    </DocSection>

    <SourceLine path="/comparison" />
  </>
);

export default Overview;
