import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { arrive, inOrder } from './motion';

interface Item {
  id: string;
  title: string;
}

const sections = () => [...document.querySelectorAll<HTMLElement>('.docs-page section.doc-section[id]:not([hidden])')];

// The right rail on wide screens: the page's sections, with a marker on the one being read. The same
// section's rule lights in the article.
export function OnThisPage(props: { pathname: string }) {
  const [items, setItems] = createSignal<Item[]>([]);
  const [active, setActive] = createSignal('');
  let mark: HTMLSpanElement | undefined;
  let rail: HTMLElement | undefined;
  const [box, setBox] = createSignal<HTMLElement>();

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
    // At the page's end the last section on screen is the one being read, though its top never reaches the line.
    const h = document.documentElement.scrollHeight;
    const end = h > window.innerHeight + 2 && window.scrollY >= h - window.innerHeight - 2;
    const line = end ? window.innerHeight : window.innerHeight * 0.4;
    for (const s of list) if (s.getBoundingClientRect().top < line) cur = s.id;
    if (cur !== active()) setActive(cur);
    for (const s of list) s.querySelector('h2')?.classList.toggle('act', s.id === cur);
    requestAnimationFrame(place);
  };

  // The list changes only when the sections do, so a rescan never redraws the same links.
  const scan = () => {
    const next = sections().map((s) => ({
      id: s.id,
      title: (s.querySelector('h2')?.firstChild?.textContent ?? s.id).trim(),
    }));
    const cur = items();
    if (next.length !== cur.length || next.some((n, i) => n.id !== cur[i].id || n.title !== cur[i].title)) setItems(next);
    spy();
  };

  // Read with the page, so the list arrives with it; read again once its layout has settled.
  createEffect(
    on(
      () => props.pathname,
      () => {
        scan();
        requestAnimationFrame(() => requestAnimationFrame(scan));
      },
    ),
  );
  // A page's list cascades in with the page; a filter changing it later does not.
  let arrivedFor = '';
  createEffect(
    on([items, box], ([list, el]) => {
      if (!el || !list.length || arrivedFor === props.pathname) return;
      arrivedFor = props.pathname;
      arrive(el, inOrder(el.querySelectorAll<HTMLElement>('.label, nav > a'), 120, 30, 16));
    }),
  );
  onMount(() => window.addEventListener('scroll', spy, { passive: true }));
  onCleanup(() => window.removeEventListener('scroll', spy));
  // A section a filter hides leaves the list, and comes back with it.
  onMount(() => {
    const page = document.querySelector('.docs-page');
    if (!page || typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver((records) => {
      if (records.some((r) => (r.target as Element).matches?.('section.doc-section'))) scan();
    });
    mo.observe(page, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    onCleanup(() => mo.disconnect());
  });

  return (
    <Show when={items().length > 0}>
      <aside ref={setBox} class="toc" aria-label="On this page">
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
