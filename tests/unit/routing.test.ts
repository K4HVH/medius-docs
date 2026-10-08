import { describe, it, expect } from 'vitest';
import { planRedirect } from '../../server/routing';

const ROUTES = new Set(['/', '/native', '/native/commands/inject', '/dashboard', '/dashboard/setup']);

describe('planRedirect', () => {
  it.each([
    ['/native', '', null],
    ['/native/', '', '/native'],
    ['/native/', '?a=1', '/native?a=1'],
    ['/native.html', '', '/native'],
    ['/native.html', '?x=1', '/native?x=1'],
    ['/Native', '', '/native'],
    ['/NATIVE/', '', '/native'],
    ['/dashboard/Setup.html', '', '/dashboard/setup'],
    ['/Native/Commands/Inject/', '', '/native/commands/inject'],
    ['/', '', null],
    ['/index.html', '', '/'],
    ['/zzz', '', null],
    ['/zzz/', '', null],
    ['/native.md', '', null],
    ['/assets/x.js', '', null],
    ['/api/stats/', '', null],
    ['/mcp/', '', null],
    ['/.well-known/mcp/server-card.json', '', null],
    ['/native//', '', null],
  ])('%s%s -> %s', (pathname, search, expected) => {
    expect(planRedirect(pathname, search, ROUTES)).toBe(expected);
  });
});
