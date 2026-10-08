import { For, Show, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { FAQ } from '../../data/faq';

const Faq: Component = () => (
  <>
    <PageHeader lead="Answers from the Discord server's FAQ." />
    <For each={FAQ}>
      {(f) => (
        <DocSection id={f.id} title={f.q}>
          <p>{f.a}</p>
          <Show when={f.links}>
            {(links) => (
              <ul class="see">
                <For each={links()}>
                  {(l) =>
                    l.href.startsWith('/') ? (
                      <li><A href={l.href}>{l.label}</A></li>
                    ) : (
                      <li><a href={l.href} target="_blank" rel="noreferrer">{l.label}</a></li>
                    )
                  }
                </For>
              </ul>
            )}
          </Show>
        </DocSection>
      )}
    </For>
  </>
);

export default Faq;
