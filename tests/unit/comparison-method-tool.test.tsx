// The Method page's comparison tool sections: the script's download, its requirements and steps, and its tests, each
// linked to the results sections it compares with.
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Router } from '@solidjs/router';
import Method from '../../src/app/pages/comparison/Method';
import { RESULTS } from '../../src/app/data/comparison';

afterEach(cleanup);

const show = () => render(() => <Router root={() => <Method />} />).container;

// The tests medius-compare.py runs, in its order (ALL_TESTS).
const TOOL_TESTS = ['query', 'move-latency', 'move-spread', 'release', 'move-accept', 'malformed', 'ep0'];

describe('the Method page comparison tool', () => {
  it('has its three sections', () => {
    const el = show();
    for (const id of ['tool', 'tool-run', 'tool-tests']) expect(el.querySelector(`section#${id}`), id).not.toBeNull();
  });

  it('offers the script as a download', () => {
    const a = show().querySelector('section#tool a[href="/comparison/medius-compare.py"]');
    expect(a).not.toBeNull();
    expect(a!.hasAttribute('download')).toBe(true);
  });

  it('gives its commands as shell code', () => {
    const blocks = [...show().querySelectorAll('section#tool-run pre code.language-bash')].map((c) => c.textContent);
    expect(blocks.some((b) => b!.includes('medius-compare.py run --box stock'))).toBe(true);
    expect(blocks.some((b) => b!.includes('medius-compare.py report stock.json medius.json'))).toBe(true);
  });

  it('lists every test in the order the tool runs them', () => {
    const ids = [...show().querySelectorAll('section#tool-tests tbody tr')].map((r) => r.querySelector('td code')!.textContent);
    expect(ids).toEqual(TOOL_TESTS);
  });

  it('links each test to a results section that exists, by its title', () => {
    const sections = new Map(RESULTS.categories.flatMap((c) => c.sections.map((s) => [`/comparison/${c.id}/${s.id}`, s.title])));
    const links = [...show().querySelectorAll('section#tool-tests tbody a')];
    expect(links.length).toBeGreaterThanOrEqual(TOOL_TESTS.length);
    for (const a of links) {
      const href = a.getAttribute('href')!;
      expect(sections.has(href), href).toBe(true);
      expect(a.textContent).toBe(sections.get(href));
    }
  });
});
