import { describe, it, expect, afterEach } from 'vitest';
import { shareAddress } from '../../src/app/shell/share';

const page = (html: string) => {
  document.body.innerHTML = `<main class="docs-page">${html}</main>`;
};
const el = (id: string) => document.getElementById(id);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('shareAddress', () => {
  it("gives a place search lists its address, and the page's for the section that opens the page", () => {
    page(
      '<header class="page-header" id="top" data-search-target><h1>Lock</h1></header>' +
        '<section id="lock" data-search-target><h2>LOCK</h2></section>' +
        '<section id="scale" data-search-target><h2>Scale</h2></section>',
    );
    expect(shareAddress(el('scale'), 'scale', '/native/commands/lock')).toBe('/native/commands/lock/scale');
    expect(shareAddress(el('scale'), 'scale', '/native/commands/lock/direction')).toBe('/native/commands/lock/scale');
    expect(shareAddress(el('lock'), 'lock', '/native/commands/lock')).toBe('/native/commands/lock');
    expect(shareAddress(el('top'), 'top', '/native/commands/lock')).toBe('/native/commands/lock');
  });

  it('keeps the hash on a marked element with no title, and on one search does not mark', () => {
    page('<section id="box" data-search-target><p>Values</p></section><div id="plain"><h2>Plain</h2></div>');
    expect(shareAddress(el('box'), 'box', '/native/transport')).toBe('/native/transport#box');
    expect(shareAddress(el('plain'), 'plain', '/native/transport')).toBe('/native/transport#plain');
    expect(shareAddress(null, 'gone', '/native/transport')).toBe('/native/transport#gone');
  });

  it("gives a device row and a release their item's address", () => {
    page('<table><tr id="device-zowie-ec2"><td>Zowie</td></tr></table><section id="v3.4.4" class="rel"><h2>v3.4.4</h2></section>');
    expect(shareAddress(el('device-zowie-ec2'), 'device-zowie-ec2', '/guide/compatibility')).toBe('/guide/compatibility/zowie-ec2');
    expect(shareAddress(el('v3.4.4'), 'v3.4.4', '/dashboard/changelog')).toBe('/dashboard/changelog/v3.4.4');
  });

  it("keeps the hash where a page holds the place's address", () => {
    page('<section id="build" data-search-target><h2>Build &amp; run</h2></section>');
    expect(shareAddress(el('build'), 'build', '/bindings/c')).toBe('/bindings/c#build');
  });
});
