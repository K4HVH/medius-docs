import { describe, it, expect } from 'vitest';
import { HELP, HELP_ITEMS } from '../../src/app/data/help';
import { routeFor } from '../../src/app/routes';

describe('Help', () => {
  it('gives every group and every answer its own id', () => {
    const ids = [...HELP.map((g) => g.id), ...HELP_ITEMS.map((f) => f.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('keeps the old FAQ ids, so its links land on the same answers', () => {
    const ids = HELP_ITEMS.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['software', 'why', 'controller', 'free', 'report', 'bsod', 'browsers', 'drivers', 'systems']));
  });

  it('links only to pages that exist or to other sites', () => {
    for (const f of HELP_ITEMS)
      for (const l of f.links ?? []) {
        if (/^https:\/\//.test(l.href)) continue;
        expect(routeFor(l.href.split('#')[0]), `${f.id}: ${l.href}`).toBeDefined();
      }
  });

  it('answers in plain sentences, so the structured data can carry them as they are', () => {
    for (const f of HELP_ITEMS) {
      expect(f.q, f.id).not.toMatch(/[<>`*_.]$/);
      // File names keep their underscores; markup has no place here.
      expect(f.a, f.id).not.toMatch(/[<>`]|\*\*|\b_\w+_\b/);
      expect(f.a, f.id).toMatch(/\.$/);
    }
  });

  it('names Update\'s Manual tab, never the Advanced page that became it', () => {
    for (const f of HELP_ITEMS) expect(f.a, f.id).not.toMatch(/\bAdvanced\b/);
  });
});
