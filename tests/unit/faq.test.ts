import { describe, it, expect } from 'vitest';
import { FAQ } from '../../src/app/data/faq';
import { routeFor } from '../../src/app/routes';

describe('FAQ', () => {
  it('gives every entry its own id', () => {
    const ids = FAQ.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('links only to pages that exist or to other sites', () => {
    for (const f of FAQ)
      for (const l of f.links ?? []) {
        if (/^https:\/\//.test(l.href)) continue;
        expect(routeFor(l.href.split('#')[0]), `${f.id}: ${l.href}`).toBeDefined();
      }
  });

  it('answers in plain sentences, so the structured data can carry them as they are', () => {
    for (const f of FAQ) {
      expect(f.q, f.id).toMatch(/\?$/);
      expect(f.a, f.id).not.toMatch(/[<>`*_]/);
      expect(f.a, f.id).toMatch(/\.$/);
    }
  });
});
