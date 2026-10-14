// Each Comparison page draws every section of its categories and the diagrams it puts in them; Overview its
// key rows and every defect; Method the rig, the layers, the tests not run yet and every download.
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Router } from '@solidjs/router';
import type { Component } from 'solid-js';
import { RESULTS, categoryOf, placeOf } from '../../src/app/data/comparison';
import { COMPARISON_PAGES, KEY_ROWS, pageOfCategory } from '../../src/app/data/comparison/pages';
import { comparisonFiles } from '../../src/app/data/comparison/files';
import { addressFor, routeFor } from '../../src/app/routes';
import { holdsLink } from '../../src/app/shell/CopyLink';
import Overview from '../../src/app/pages/comparison/Overview';
import Devices from '../../src/app/pages/comparison/Devices';
import Passthrough from '../../src/app/pages/comparison/Passthrough';
import Injection from '../../src/app/pages/comparison/Injection';
import ControlLink from '../../src/app/pages/comparison/ControlLink';
import Input from '../../src/app/pages/comparison/Input';
import Recovery from '../../src/app/pages/comparison/Recovery';
import Features from '../../src/app/pages/comparison/Features';
import Software from '../../src/app/pages/comparison/Software';
import Method from '../../src/app/pages/comparison/Method';

afterEach(cleanup);

const show = (Page: Component) => render(() => <Router root={() => <Page />} />).container;

// Each page, and the sections its hand-drawn diagrams sit in: a section the data renames takes its diagram
// with it.
const TOPICS: [string, Component, string[]][] = [
  ['/comparison/devices', Devices, []],
  ['/comparison/passthrough', Passthrough, []],
  ['/comparison/injection', Injection, []],
  ['/comparison/control-link', ControlLink, []],
  ['/comparison/input', Input, []],
  ['/comparison/recovery', Recovery, []],
  ['/comparison/features', Features, []],
  ['/comparison/software', Software, []],
];
const ALL: [string, Component][] = [['/comparison', Overview], ...TOPICS.map(([p, P]): [string, Component] => [p, P]), ['/comparison/method', Method]];

describe('the topic pages', () => {
  it('cover every page with categories', () => {
    expect(TOPICS.map(([p]) => p).sort()).toEqual(COMPARISON_PAGES.filter((p) => p.categories.length).map((p) => p.path).sort());
  });

  for (const [path, Page, drawn] of TOPICS) {
    it(`${path} draws every section of its categories, in order, with a row per result`, () => {
      const page = COMPARISON_PAGES.find((p) => p.path === path)!;
      const sections = page.categories.flatMap((c) => categoryOf(c)?.sections ?? []);
      const el = show(Page);
      expect([...el.querySelectorAll('section.doc-section')].map((s) => s.id)).toEqual(sections.map((s) => s.id));
      for (const s of sections) {
        const rows = s.tables.reduce((n, t) => n + t.rows.length, 0);
        expect(el.querySelectorAll(`section#${CSS.escape(s.id)} tbody tr`).length, s.id).toBe(rows);
      }
    });

    it(`${path} puts its diagrams in ${drawn.join(', ') || 'no section'}`, () => {
      const el = show(Page);
      expect([...el.querySelectorAll('pre.diagram')].map((d) => d.closest('section')!.id)).toEqual(drawn);
    });
  }
});

describe('every Comparison page', () => {
  it('ends on its last section, with no line of sources or versions under it', () => {
    for (const [path, Page] of ALL) {
      expect(show(Page).querySelector('p.src'), path).toBeNull();
      cleanup();
    }
  });

  it('links only downloads the build writes', () => {
    const files = comparisonFiles();
    for (const [path, Page] of ALL) {
      for (const a of show(Page).querySelectorAll('a[download]')) expect(files.has(a.getAttribute('href')!), `${path} links ${a.getAttribute('href')}`).toBe(true);
      cleanup();
    }
  });
});

describe('Overview', () => {
  it("leads each area with its key rows, each naming what it compares, then its condition, linked to its section", () => {
    const el = show(Overview);
    for (const [path, ids] of Object.entries(KEY_ROWS)) {
      const sec = el.querySelector(`section#${path.slice(path.lastIndexOf('/') + 1)}-results`)!;
      const rows = [...sec.querySelectorAll('tbody tr')];
      expect(rows.length).toBe(ids.length);
      ids.forEach((id, i) => {
        const at = placeOf(id)!;
        const first = rows[i].querySelector('td')!;
        const [head, sub] = at.table.kind === 'feature' ? [at.row.label, at.table.label] : [at.table.label, at.row.label];
        expect(first.querySelector('a')!.textContent).toBe(head);
        expect(first.querySelector('a')!.getAttribute('href')).toBe(`${path}/${at.section.id}`);
        expect(first.querySelector('.sub')!.textContent).toBe(sub);
      });
      expect(sec.querySelector(`h2 a[href="${path}"]`)!.getAttribute('aria-label')).toBe(`All results for ${routeFor(path)!.title}`);
    }
  });

  it('gives every defect its own place, which the defect marks on its rows link to', () => {
    const page = show(Overview);
    for (const d of RESULTS.defects) {
      const id = `defect-${d.id}`;
      const row = page.querySelector(`section#defects tr[id="${id}"]`)!;
      expect(row.hasAttribute('data-search-target')).toBe(true);
      expect(row.getAttribute('data-search-title')).toBe(d.text);
      expect(holdsLink(page, id)).toBe(true);
      expect(addressFor(`/comparison/${id}`)).toMatchObject({ kind: 'place', parent: '/comparison', id });
    }
  });

  it('lists every defect with a link to the section of its first row, and None found for a box with none', () => {
    const rows = [...show(Overview).querySelectorAll('section#defects tbody tr')];
    for (const d of RESULTS.defects) {
      const row = rows.find((r) => r.textContent!.includes(d.text))!;
      const at = placeOf(d.rows[0])!;
      expect(row.querySelector('a')!.getAttribute('href')).toBe(`${pageOfCategory(at.category.id)!.path}/${at.section.id}`);
    }
    for (const box of ['Stock', 'Medius'])
      if (!RESULTS.defects.some((d) => d.box === box.toLowerCase())) expect(rows.some((r) => r.textContent === `${box}None found`)).toBe(true);
  });
});

describe('Method', () => {
  it('names both versions, every timing layer, every test not run yet, and a download for the whole and each page', () => {
    const el = show(Method);
    expect(el.querySelector('section#rig')!.textContent).toContain(`Stock ${RESULTS.firmware.stock}, Medius ${RESULTS.firmware.medius}`);
    for (const detail of Object.values(RESULTS.layers)) expect(el.querySelector('section#layers')!.textContent).toContain(detail);
    // Each area's tests under its name, in page order.
    const areas = COMPARISON_PAGES.map((p) => ({ title: routeFor(p.path)!.title, n: RESULTS.pending.filter((x) => p.categories.includes(x.category)).length })).filter((a) => a.n);
    expect([...el.querySelectorAll('section#pending .api-response-label')].map((l) => l.textContent)).toEqual(areas.map((a) => a.title));
    expect([...el.querySelectorAll('section#pending ul')].map((u) => u.children.length)).toEqual(areas.map((a) => a.n));
    const files = [...el.querySelectorAll('section#data a[download]')].map((a) => a.getAttribute('href'));
    expect(files).toEqual(['/comparison.json', ...COMPARISON_PAGES.filter((p) => p.categories.length).map((p) => `${p.path}.json`)]);
  });
});
