import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { PageHeader } from '../../src/app/shell/PageHeader';
import { DocSection } from '../../src/app/shell/DocSection';
import { OnThisPage } from '../../src/app/shell/OnThisPage';
import { IndexRow } from '../../src/app/shell/IndexRow';

const mount = (at: string, view: () => JSX.Element) => {
  const history = createMemoryHistory();
  history.set({ value: at });
  return render(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={view} />
    </MemoryRouter>
  ));
};

const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 0))));

afterEach(cleanup);

describe('PageHeader', () => {
  it('gives the page one h1, its registry title, under crumbs to the parent', () => {
    const r = mount('/native/commands/inject', () => <PageHeader lead="Press and release any input." />);
    const h1s = r.container.querySelectorAll('h1');
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toBe('Inject');
    expect(r.container.querySelector('.crumbs')!.textContent).toBe('Medius / Native API');
    expect(r.container.querySelector('.lead')!.textContent).toBe('Press and release any input.');
  });

  it('keeps the intro body under the heading', () => {
    const r = mount('/library/inject', () => (
      <PageHeader>
        <p id="body">intro</p>
      </PageHeader>
    ));
    expect(r.container.querySelector('header.page-header #body')).not.toBeNull();
    expect(r.container.querySelector('.lead')).toBeNull();
  });
});

describe('DocSection', () => {
  it('keeps the id and search target, with an h2 and its caption', () => {
    const r = mount('/native/commands/inject', () => (
      <DocSection id="payload" title="Payload" caption="4 bytes">
        <p>body</p>
      </DocSection>
    ));
    const s = r.container.querySelector('section.doc-section')!;
    expect(s.id).toBe('payload');
    expect(s.hasAttribute('data-search-target')).toBe(true);
    expect(s.querySelector('h2.doc-h2')!.firstChild!.textContent).toBe('Payload');
    expect(s.querySelector('.doc-caption')!.textContent).toBe('4 bytes');
  });

  it('is not a search target without an id', () => {
    const r = mount('/native', () => <DocSection title="Notes">x</DocSection>);
    expect(r.container.querySelector('section')!.hasAttribute('data-search-target')).toBe(false);
  });
});

describe('OnThisPage', () => {
  it('lists the sections of the page and lights the first', async () => {
    const r = mount('/native/commands/inject', () => (
      <>
        <main class="docs-page">
          <DocSection id="payload" title="Payload" caption="4 bytes">x</DocSection>
          <DocSection id="classes" title="Classes">y</DocSection>
        </main>
        <OnThisPage pathname="/native/commands/inject" />
      </>
    ));
    const at = (id: string, top: number) => {
      r.container.querySelector<HTMLElement>(`#${id}`)!.getBoundingClientRect = () => ({ top } as DOMRect);
    };
    at('payload', 120);
    at('classes', window.innerHeight + 200);
    await frames();
    const links = [...r.container.querySelectorAll('.toc a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Payload', '#payload'],
      ['Classes', '#classes'],
    ]);
    expect(links[0].classList.contains('act')).toBe(true);
    expect(r.container.querySelector('#payload h2')!.classList.contains('act')).toBe(true);
  });

  it('glides to a section from the rail and puts its hash in the address', async () => {
    const r = mount('/native/commands/inject', () => (
      <>
        <main class="docs-page">
          <DocSection id="payload" title="Payload">x</DocSection>
          <DocSection id="classes" title="Classes">y</DocSection>
        </main>
        <OnThisPage pathname="/native/commands/inject" />
      </>
    ));
    await frames();
    const target = r.container.querySelector<HTMLElement>('#classes')!;
    const glide = vi.fn();
    target.scrollIntoView = glide;
    const click = fireEvent.click([...r.container.querySelectorAll('.toc a')][1]);
    expect(click).toBe(false);
    expect(glide).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(window.location.hash).toBe('#classes');
  });
});

describe('IndexRow', () => {
  it('links inside the site, and outside in a new tab', () => {
    const r = mount('/', () => (
      <>
        <IndexRow href="/guide" title="Install" tag="Flash a box from the browser" />
        <IndexRow href="https://discord.gg/ArRqcA84pB" title="Discord" tag="590 members" external />
      </>
    ));
    const [inside, outside] = [...r.container.querySelectorAll('a.go')];
    expect(inside.getAttribute('href')).toBe('/guide');
    expect(inside.getAttribute('target')).toBeNull();
    expect(inside.querySelector('h3')!.textContent).toBe('Install');
    expect(outside.getAttribute('target')).toBe('_blank');
    expect(outside.querySelector('.arr.ne')).not.toBeNull();
  });
});
