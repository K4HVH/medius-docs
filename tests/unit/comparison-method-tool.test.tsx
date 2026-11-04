// The Method page's comparison tool sections: the single-file download, what it needs, the commands that run it,
// and its tests: the suite's tests a still mouse or keyboard can drive, each linked to the sections its rows feed.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Router } from '@solidjs/router';
import Method from '../../src/app/pages/comparison/Method';
import { RESULTS } from '../../src/app/data/comparison';
import { PYZ } from '../../scripts/comparison-package';

afterEach(cleanup);

const show = () => render(() => <Router root={() => <Method />} />).container;

interface Decl {
  id: string;
  jams_stock?: boolean;
  legs?: { device: string }[];
  tables?: { section: string; rows: { test?: string }[] }[];
}

const SUITE = join(import.meta.dirname, '../../comparison/suite');
const DECLS: Decl[] = readdirSync(SUITE)
  .filter((d) => existsSync(join(SUITE, d, 'test.toml')))
  .sort()
  .map((d) => parse(readFileSync(join(SUITE, d, 'test.toml'), 'utf8')) as unknown as Decl);
const STILL: Record<string, string> = { 'still-mouse': 'mouse', 'still-keyboard': 'keyboard', 'still-composite': 'mouse and keyboard in one device' };
const NO_SIM = DECLS.filter((t) => !t.legs?.length || t.legs.some((l) => l.device in STILL));
const SECTIONS = RESULTS.categories.flatMap((c) => c.sections.map((s) => ({ href: `/comparison/${c.id}/${s.id}`, id: s.id, title: s.title })));
// The sections a test's rows appear in, its own tables' and those of any other test naming it, in the results' order.
const fed = (id: string) => {
  const ids = new Set(DECLS.flatMap((d) => (d.tables ?? []).filter((t) => t.rows.some((r) => (r.test ?? d.id) === id)).map((t) => t.section)));
  return SECTIONS.filter((s) => ids.has(s.id));
};

const DEVICE = '/dev/serial/by-id/usb-1a86_USB_Single_Serial_<serial>-if00';
const COMMANDS = [
  'python3 -m venv ~/medius-compare && ~/medius-compare/bin/pip install medius pyserial',
  `sudo ~/medius-compare/bin/python medius-compare.pyz run --box stock --port ${DEVICE} --usb-port <clone's USB port>`,
  `sudo ~/medius-compare/bin/python medius-compare.pyz run --box medius --port ${DEVICE}`,
  'python3 medius-compare.pyz report <stock file> <Medius file>',
];

// Each shell block's commands, a line continued with a backslash read as one.
const commands = (el: Element, section: string) =>
  [...el.querySelectorAll(`section#${section} pre code.language-bash`)].flatMap((c) => c.textContent!.replace(/ *\\\n */g, ' ').split('\n'));

describe('the Method page comparison tool', () => {
  it('has its three sections', () => {
    const el = show();
    for (const id of ['tool', 'tool-run', 'tool-tests']) expect(el.querySelector(`section#${id}`), id).not.toBeNull();
  });

  it('offers the single-file tool as a download', () => {
    const links = [...show().querySelectorAll('section#tool a[download]')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([PYZ]);
    expect(links[0].textContent).toBe('medius-compare.pyz');
  });

  it('names what it needs, and installs the packages in a venv', () => {
    const el = show();
    const text = el.querySelector('section#tool')!.textContent!;
    for (const need of ['Linux, run as root', '3.11', 'pyserial', 'medius']) expect(text).toContain(need);
    expect(commands(el, 'tool')).toEqual(COMMANDS.slice(0, 1));
  });

  it('gives the commands that run it on each box and compare two runs', () => {
    expect(commands(show(), 'tool-run')).toEqual(COMMANDS.slice(1));
  });

  it('says the clone is kept off the desktop and handed back, and how a stock box behind is power cycled', () => {
    const text = show().querySelector('section#tool-run')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('kept off the desktop while the tool runs, so nothing injected reaches it, and handed back at exit, Ctrl-C included.');
    expect(text).toContain('a leg refuses to start if it moved');
    expect(text).toContain('unplugged for 3 s and plugged back in, and waits for Enter');
  });

  it('names the tests that can leave stock one reply behind, how often they run there, and how to leave them out', () => {
    const callout = show().querySelector('section#tool-run .callout')!;
    const ids = [...callout.querySelectorAll('code')].map((c) => c.textContent).filter((t) => !t!.startsWith('--'));
    expect(ids).toEqual(NO_SIM.filter((t) => t.jams_stock).map((t) => t.id));
    expect(ids.length).toBeGreaterThan(0);
    const text = callout.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Each runs once on stock unless --stock-jam-runs asks for more.');
    expect(text).toContain('--test');
  });

  it("lists exactly the suite's tests a still device can drive, in the order the tool runs them", () => {
    const ids = [...show().querySelectorAll('section#tool-tests tbody tr')].map((r) => r.querySelector('td code')!.textContent);
    expect(ids).toEqual(NO_SIM.map((t) => t.id));
    expect(ids.length).toBeGreaterThan(0);
  });

  it('names the device each test needs', () => {
    const rows = [...show().querySelectorAll('section#tool-tests tbody tr')];
    NO_SIM.forEach((t, i) => {
      const devices = [...new Set((t.legs ?? []).map((l) => STILL[l.device]).filter(Boolean))];
      const said = devices.join(' or ') || 'none';
      expect(rows[i].querySelectorAll('td')[1].textContent, t.id).toBe(said[0].toUpperCase() + said.slice(1));
    });
  });

  it('links each test to every section its rows appear in, by title', () => {
    const rows = [...show().querySelectorAll('section#tool-tests tbody tr')];
    NO_SIM.forEach((t, i) => {
      const links = [...rows[i].querySelectorAll('td:last-child a')].map((a) => ({ href: a.getAttribute('href'), title: a.textContent }));
      expect(links, t.id).toEqual(fed(t.id).map(({ href, title }) => ({ href, title })));
      expect(links.length, t.id).toBeGreaterThan(0);
    });
  });
});
