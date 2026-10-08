import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';

interface Item {
  id: string;
  title: string;
}

const sections = () => [...document.querySelectorAll<HTMLElement>('.docs-page section.doc-section[id]')];

// The right rail on wide screens: the page's sections, with a marker on the one being read. The same
// section's rule lights in the article.
export function OnThisPage(props: { pathname: string }) {
  const [items, setItems] = createSignal<Item[]>([]);
  const [active, setActive] = createSignal('');
  let mark: HTMLSpanElement | undefined;
  let rail: HTMLElement | undefined;

  const place = () => {
    const a = rail?.querySelector<HTMLAnchorElement>('a.act');
    if (a && mark) {
      mark.style.top = `${a.offsetTop}px`;
      mark.style.height = `${a.offsetHeight}px`;
    }
  };

  const spy = () => {
    const list = sections();
    if (!list.length) return;
    let cur = list[0].id;
    for (const s of list) if (s.getBoundingClientRect().top < window.innerHeight * 0.4) cur = s.id;
    if (cur !== active()) setActive(cur);
    for (const s of list) s.querySelector('h2')?.classList.toggle('act', s.id === cur);
    requestAnimationFrame(place);
  };

  const scan = () => {
    setItems(
      sections().map((s) => ({
        id: s.id,
        title: (s.querySelector('h2')?.firstChild?.textContent ?? s.id).trim(),
      })),
    );
    spy();
  };

  createEffect(on(() => props.pathname, () => requestAnimationFrame(() => requestAnimationFrame(scan))));
  onMount(() => window.addEventListener('scroll', spy, { passive: true }));
  onCleanup(() => window.removeEventListener('scroll', spy));

  return (
    <Show when={items().length > 0}>
      <aside class="toc" aria-label="On this page">
        <p class="label">On this page</p>
        <nav ref={rail}>
          <span class="ind" ref={mark} aria-hidden="true" />
          <For each={items()}>
            {(it) => (
              <a href={`#${it.id}`} classList={{ act: active() === it.id }}>
                {it.title}
              </a>
            )}
          </For>
        </nav>
      </aside>
    </Show>
  );
}
