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
    ['/guide/update', '', '/guide/help#q-update'],
    ['/guide/faq', '', '/guide/help'],
    ['/guide/troubleshooting', '', '/guide/help'],
    ['/guide/device-fixes', '', '/guide/compatibility#device-fixes'],
    ['/Dashboard/Advanced/', '', '/dashboard/update#manual'],
    // A moved page's Markdown twin follows it; the twin has no anchors.
    ['/guide/faq.md', '', '/guide/help.md'],
    ['/dashboard/advanced-control.md', '', '/dashboard/control.md'],
  ])('%s%s -> %s', (pathname, search, expected) => {
    expect(planRedirect(pathname, search, ROUTES)).toBe(expected);
  });
});
