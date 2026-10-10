// Dev only, behind `?searchindex` (with `?fakebox=imperfect`, so the Advanced tab's controls show): every
// page of the site rendered in turn through the app's router and read into search entries, the dashboard
// with a box connected so its panels show, and what became of each element a page marked for search. The
// site build and the dev server's search both run it in headless Chromium.

import { ROUTES, documentTitle, sectionLabel } from '../app/routes';
import { extractPage, type Fate } from '../app/search/extract';
import type { IndexEntry } from '../app/search/types';
import Prism from '../app/prism';
import { holdsLink } from '../app/shell/CopyLink';

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const until = async (what: string, ok: () => boolean, ms = 15000) => {
  const start = performance.now();
  while (!ok()) {
    if (performance.now() - start > ms) throw new Error(`search pass: ${what} after ${ms} ms`);
    await frame();
  }
};

// Until the page has stopped changing for `quiet` ms, or `most` ms have passed.
const settled = (quiet = 250, most = 6000) =>
  new Promise<void>((resolve) => {
    const done = () => {
      watch.disconnect();
      clearTimeout(still);
      clearTimeout(cap);
      resolve();
    };
    let still = setTimeout(done, quiet);
    const cap = setTimeout(done, most);
    const watch = new MutationObserver(() => {
      clearTimeout(still);
      still = setTimeout(done, quiet);
    });
    watch.observe(document.body, { childList: true, subtree: true, characterData: true });
  });

// Code the highlighter would still change: a page marked done before its code was in place, which would
// put comments and strings into the index and show readers plain code.
const unhighlighted = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>('code[class*="language-"]')].filter((c) => {
    const lang = /language-(\w+)/.exec(c.className)?.[1] ?? '';
    const grammar = Prism.languages[lang];
    if (!grammar) return false;
    const fresh = document.createElement('code');
    fresh.innerHTML = Prism.highlight(c.textContent ?? '', grammar, lang);
    return fresh.innerHTML !== c.innerHTML;
  }).length;

const button = (label: RegExp) => [...document.querySelectorAll('button')].find((b) => label.test(b.textContent?.trim() ?? ''));

const connect = async () => {
  if (button(/^Disconnect$/)) return;
  const b = button(/^Connect$/);
  if (!b) return;
  b.click();
  await until('the fake box connecting', () => !!button(/^Disconnect$/));
};

// A panel waiting on the box says so; the pass waits for every answer, up to a few seconds.
const reading = () => (document.querySelector('.docs-page')?.textContent ?? '').includes('Reading...');

export interface Pass {
  entries: IndexEntry[];
  rendered: Record<string, { id: string; fate: Fate; panel: boolean; link: boolean }[]>;
}

export async function runSearchPass(): Promise<Pass> {
  const out: IndexEntry[] = [];
  const rendered: Pass['rendered'] = {};
  for (const r of ROUTES) {
    if (r.kind === 'home' || r.section === 'notfound') continue;
    history.pushState(null, '', r.path);
    dispatchEvent(new PopStateEvent('popstate'));
    await until(`${r.path} rendering`, () => document.title === documentTitle(r) && !!document.querySelector('.docs-page .page-header h1'));
    // Code read for its names needs the highlighter's marks, to leave comments and strings out.
    await until(`${r.path} highlighting`, () => document.querySelector<HTMLElement>('main.docs-page')?.dataset.highlighted === r.path);
    if (r.kind === 'app') await connect();
    await settled();
    if (r.kind === 'app') await until(`${r.path} answering`, () => !reading(), 5000).catch(() => {});
    const root = document.querySelector('.docs-page');
    if (!root) throw new Error(`search pass: ${r.path} has no content`);
    const plain = unhighlighted(root);
    if (plain) throw new Error(`search pass: ${r.path} was marked highlighted with ${plain} code blocks left plain`);
    out.push(
      ...extractPage(root, {
        path: r.path,
        title: r.title,
        description: r.description,
        section: sectionLabel(r),
        group: r.group,
        nav: r.nav,
        app: r.kind === 'app',
      }, (id, fate, panel) => {
        (rendered[r.path] ??= []).push({ id, fate, panel, link: holdsLink(root, id) });
      }),
    );
  }
  return { entries: out, rendered };
}
