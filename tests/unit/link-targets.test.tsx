import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { DocSection } from '../../src/app/shell/DocSection';
import { Panel } from '../../src/app/shell/Panel';
import { Anchor } from '../../src/app/shell/Anchor';
import { extractPage } from '../../src/app/search/extract';
import { htmlToMarkdown } from '../../scripts/lib/htmlToMarkdown';

afterEach(cleanup);

const icon = (root: ParentNode, id: string) => root.querySelector<HTMLButtonElement>(`button.cl[data-for="${id}"]`);

const PAGE = { path: '/native/commands/lock', title: 'LOCK', description: 'Locks.', section: 'Native API', group: 'Commands', nav: 'LOCK', app: false };

describe('the places a link can name', () => {
  it('gives a docs section its icon after the title, before the caption', () => {
    const r = render(() => (
      <DocSection id="frames" title="Frames" caption="What a frame holds">
        <p>Body.</p>
      </DocSection>
    ));
    const h2 = r.container.querySelector('h2')!;
    const b = icon(h2, 'frames')!;
    expect(b.getAttribute('aria-label')).toBe('Copy link to Frames');
    expect(b.parentElement!.matches('.doc-t')).toBe(true);
    expect(b.parentElement!.nextElementSibling?.classList.contains('doc-caption')).toBe(true);
  });

  it('gives a section with no id none', () => {
    const r = render(() => <DocSection title="Loose">x</DocSection>);
    expect(r.container.querySelector('button.cl')).toBeNull();
  });

  it("gives a panel its icon after its title, and a panel shown in one state of the box none", () => {
    const r = render(() => (
      <>
        <Panel id="cursor" title="Cursor">
          x
        </Panel>
        <Panel id="events" title="Events" transient>
          y
        </Panel>
      </>
    ));
    expect(icon(r.container.querySelector('#cursor h2')!, 'cursor')).not.toBeNull();
    expect(r.container.querySelector('#events button.cl')).toBeNull();
  });

  it('draws a marked block: its id, its label and the icon after the label', () => {
    const r = render(() => (
      <Anchor id="scale" label="SCALE">
        <p>Body.</p>
      </Anchor>
    ));
    const block = r.container.querySelector('#scale')!;
    expect(block.hasAttribute('data-search-target')).toBe(true);
    const label = block.querySelector('.api-response-label')!;
    expect(label.textContent).toBe('SCALE');
    expect(icon(label, 'scale')).not.toBeNull();
    expect(block.querySelector('p')!.textContent).toBe('Body.');
  });

  it('keeps each heading named by its title, not by its icon', () => {
    const r = render(() => (
      <>
        <DocSection id="frames" title="Frames" caption="What a frame holds">x</DocSection>
        <Panel id="cursor" title="Cursor">y</Panel>
      </>
    ));
    expect(r.container.querySelector('#frames h2')!.getAttribute('aria-label')).toBe('Frames');
    expect(r.container.querySelector('#cursor h2')!.getAttribute('aria-label')).toBe('Cursor');
  });

  it('leaves search titles as they were', () => {
    const r = render(() => (
      <div class="docs-page">
        <DocSection id="frames" title="Frames" caption="What a frame holds">
          <p>Body.</p>
          <Anchor id="scale" label="SCALE">
            <p>Scale text.</p>
          </Anchor>
        </DocSection>
        <Panel id="cursor" title="Cursor">
          <p>Moves.</p>
        </Panel>
      </div>
    ));
    const entries = extractPage(r.container.querySelector('.docs-page')!, PAGE);
    const by = (id: string) => entries.find((e) => e.path === `${PAGE.path}#${id}`)!;
    expect(by('frames')).toMatchObject({ title: 'Frames', caption: 'What a frame holds' });
    expect(by('scale').title).toBe('SCALE');
    expect(by('cursor').title).toBe('Cursor');
  });

  it('leaves the Markdown twin as it was', () => {
    const r = render(() => (
      <DocSection id="inject" title="INJECT" caption="Momentary-usage override">
        <p>Body.</p>
      </DocSection>
    ));
    expect(htmlToMarkdown(r.container.innerHTML)).toBe('## INJECT\n\n_Momentary-usage override_\n\nBody.');
  });
});
