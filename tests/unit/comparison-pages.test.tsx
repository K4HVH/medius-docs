// Each Comparison page draws every group of its categories, the diagrams it puts in them, and its source
// line; Overview its key rows and every defect; Method the layers, the tests not run yet and every download.
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Router } from '@solidjs/router';
import type { Component } from 'solid-js';
import { RESULTS, categoryOf, rowOf } from '../../src/app/data/comparison';
import { COMPARISON_PAGES, KEY_ROWS } from '../../src/app/data/comparison/pages';
import { comparisonFiles } from '../../src/app/data/comparison/files';
import Overview from '../../src/app/pages/comparison/Overview';
import Devices from '../../src/app/pages/comparison/Devices';
import Passthrough from '../../src/app/pages/comparison/Passthrough';
import Injection from '../../src/app/pages/comparison/Injection';
import ControlLink from '../../src/app/pages/comparison/ControlLink';
import Input from '../../src/app/pages/comparison/Input';
import Controllers from '../../src/app/pages/comparison/Controllers';
import Recovery from '../../src/app/pages/comparison/Recovery';
import Capabilities from '../../src/app/pages/comparison/Capabilities';
import Software from '../../src/app/pages/comparison/Software';
import Method from '../../src/app/pages/comparison/Method';

afterEach(cleanup);

const show = (Page: Component) => render(() => <Router root={() => <Page />} />).container;

// Each page, and the groups its hand-drawn diagrams sit in: a group the data renames takes its diagram with it.
const TOPICS: [string, Component, string[]][] = [
  ['/comparison/devices', Devices, ['shapes']],
  ['/comparison/passthrough', Passthrough, ['relay-timing']],
  ['/comparison/injection', Injection, ['move-latency']],
  ['/comparison/control-link', ControlLink, ['malformed-input']],
  ['/comparison/input', Input, []],
  ['/comparison/controllers', Controllers, []],
  ['/comparison/recovery', Recovery, ['program-exit']],
  ['/comparison/capabilities', Capabilities, []],
  ['/comparison/software', Software, []],
];

describe('the topic pages', () => {
  it('cover every page with categories', () => {
    expect(TOPICS.map(([p]) => p).sort()).toEqual(COMPARISON_PAGES.filter((p) => p.categories.length).map((p) => p.path).sort());
  });

  for (const [path, Page, drawn] of TOPICS) {
    it(`${path} draws every group of its categories, in order, with a row per result`, () => {
      const page = COMPARISON_PAGES.find((p) => p.path === path)!;
      const groups = page.categories.flatMap((c) => categoryOf(c)!.groups);
      const el = show(Page);
      expect([...el.querySelectorAll('section.doc-section')].map((s) => s.id)).toEqual(groups.map((g) => g.id));
      for (const g of groups) expect(el.querySelectorAll(`section#${CSS.escape(g.id)} tbody tr`).length, g.id).toBe(g.rows.length);
    });

    it(`${path} puts its diagrams in ${drawn.join(', ') || 'no group'}`, () => {
      const el = show(Page);
      expect([...el.querySelectorAll('pre.diagram')].map((d) => d.closest('section')!.id)).toEqual(drawn);
    });

    it(`${path} links its data and the Method page`, () => {
      const src = show(Page).querySelector('p.src')!;
      expect(src.querySelector('a[download]')!.getAttribute('href')).toBe(`${path}.json`);
      expect(src.querySelector('a[href="/comparison/method"]')).toBeTruthy();
      expect(src.textContent).toContain(RESULTS.firmware.stock);
      expect(src.textContent).toContain(RESULTS.firmware.medius);
    });
  }
});

describe('Overview', () => {
  it("leads each area with its key rows, linked to the area's page", () => {
    const el = show(Overview);
    for (const [path, ids] of Object.entries(KEY_ROWS)) {
      const sec = el.querySelector(`section#${path.slice(path.lastIndexOf('/') + 1)}-results`)!;
      const label = (td: Element) => {
        const c = td.cloneNode(true) as Element;
        c.querySelectorAll('.sub').forEach((s) => s.remove());
        return c.textContent;
      };
      expect([...sec.querySelectorAll('tbody tr td:first-child')].map(label)).toEqual(ids.map((id) => rowOf(id)!.row.test));
      expect(sec.querySelector(`h2 a[href="${path}"]`)).toBeTruthy();
    }
  });

  it('lists every defect with a link to the group that shows it, and None found for a box with none', () => {
    const el = show(Overview);
    const rows = [...el.querySelectorAll('section#defects tbody tr')];
    for (const d of RESULTS.defects) {
      const row = rows.find((r) => r.textContent!.includes(d.text))!;
      expect(row.id).toBe(`defect-${d.id}`);
      const page = COMPARISON_PAGES.find((p) => p.categories.includes(d.category))!;
      expect(row.querySelector('a')!.getAttribute('href')).toBe(`${page.path}/${d.group}`);
    }
    for (const box of ['stock', 'medius'] as const)
      if (!RESULTS.defects.some((d) => d.box === box))
        expect(rows.some((r) => r.textContent!.includes('None found') && r.textContent!.toLowerCase().includes(box))).toBe(true);
  });
});

describe('every Comparison page', () => {
  it('links only downloads the build writes', () => {
    const files = comparisonFiles();
    for (const [path, Page] of [['/comparison', Overview], ...TOPICS.map(([p, P]) => [p, P]), ['/comparison/method', Method]] as [string, Component][]) {
      const links = [...show(Page).querySelectorAll('a[download]')].map((a) => a.getAttribute('href')!);
      for (const href of links) expect(files.has(href), `${path} links ${href}`).toBe(true);
      cleanup();
    }
  });
});

describe('Method', () => {
  it('lists every timing layer, every test not run yet, and a download for the whole and for each page', () => {
    const el = show(Method);
    for (const layer of Object.keys(RESULTS.layers)) expect(el.querySelector('section#layers')!.textContent).toContain(layer);
    expect(el.querySelectorAll('section#pending tbody tr').length).toBe(RESULTS.pending.length);
    const files = [...el.querySelectorAll('section#data a[download]')].map((a) => a.getAttribute('href'));
    expect(files).toEqual(['/comparison.json', ...COMPARISON_PAGES.filter((p) => p.categories.length).map((p) => `${p.path}.json`)]);
  });
});
