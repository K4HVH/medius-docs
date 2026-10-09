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
    ['/Index.html', '', '/'],
    ['/NATIVE.HTML', '', '/native'],
    ['/Native.Html/', '', '/native'],
    ['/zzz', '', null],
    ['/zzz/', '', null],
    ['/native.md', '', null],
    ['/assets/x.js', '', null],
    ['/api/stats/', '', null],
    ['/mcp/', '', null],
    ['/.well-known/mcp/server-card.json', '', null],
    ['/native//', '', null],
    // A page that moved goes to where its content is now, its anchor included.
    ['/dashboard/advanced-control', '', '/dashboard/control#advanced'],
    ['/dashboard/advanced', '?x=1', '/dashboard/update?x=1#manual'],
    ['/Dashboard/Advanced/', '', '/dashboard/update#manual'],
  ])('%s%s -> %s', (pathname, search, expected) => {
    expect(planRedirect(pathname, search, ROUTES)).toBe(expected);
  });
});
