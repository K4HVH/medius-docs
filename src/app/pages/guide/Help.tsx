import { createMemo, createSignal, For, Show, type Component } from 'solid-js';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { Filter, FixLink, Marked } from '../../shell/Filter';
import { HELP, HELP_ITEMS, type HelpItem } from '../../data/help';
import { LINKS } from '../../site';
import { matches } from '../../search/text';
import { CopyLink } from '../../shell/CopyLink';
import { itemPath } from '../../items';

const Help: Component = () => {
  const [query, setQuery] = createSignal('');
  // Matched as the site search matches; an answer's anchor word counts too: "bsod" finds the blue screen.
  const shows = (i: HelpItem) => matches(`${i.q} ${i.a} ${i.id.replace(/-/g, ' ')}`, query());
  const count = createMemo(() => HELP_ITEMS.filter(shows).length);

  return (
    <>
      <PageHeader />
      <Filter value={query()} onInput={setQuery} placeholder="Search help" count={count()} noun={['answer', 'answers']} />
      <For each={HELP}>
        {(g) => {
          const shown = () => g.items.filter(shows);
          return (
            <DocSection id={g.id} title={g.title} hidden={shown().length === 0}>
              <div class="qas">
                <For each={g.items}>
                  {(item) => (
                    <div class="qa" id={item.id} data-search-target hidden={!shows(item)} classList={{ first: shown()[0] === item }}>
                      <h3 aria-label={item.q}>
                        <Marked text={item.q} query={query()} />
                        <CopyLink id={item.id} label={item.q} to={itemPath('help', item.id)} />
                      </h3>
                      <div>
                        <p><Marked text={item.a} query={query()} /></p>
                        <Show when={item.links}>
                          {(links) => (
                            <div class="qlinks">
                              <For each={links()}>{(l) => <FixLink href={l.href}>{l.label}</FixLink>}</For>
                            </div>
                          )}
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </DocSection>
          );
        }}
      </For>
      <Show when={count() === 0}>
        <p class="none">
          No answers match. Ask in a support ticket on{' '}
          <a class="ln-a" href={LINKS.discord} target="_blank" rel="noreferrer">Discord</a>.
        </p>
      </Show>
    </>
  );
};

export default Help;
