import { createMemo, For, Show, type JSX } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import AiActions from '../AiActions';
import { NOT_FOUND, breadcrumbTrail, routeFor } from '../routes';

// The top of every page: crumbs to the parent, then the page's one h1 (its registry title) with the
// page's state or action at its right (`aside`).
export function PageHeader(props: { id?: string; aside?: JSX.Element; children?: JSX.Element }) {
  const location = useLocation();
  const route = createMemo(() => routeFor(location.pathname) ?? NOT_FOUND);
  const crumbs = createMemo(() => {
    const trail = breadcrumbTrail(route());
    const last = trail[trail.length - 1];
    return last && last.href === route().path && trail.length > 1 ? trail.slice(0, -1) : trail;
  });

  return (
    <header class="page-header" id={props.id} data-search-target={props.id ? '' : undefined}>
      <div class="page-header__bar">
        <nav class="crumbs caps" aria-label="Breadcrumb" data-agent-hide>
          <For each={crumbs()}>
            {(c, i) => (
              <>
                <Show when={i() > 0}>
                  <span class="crumbs__sep" aria-hidden="true">{' / '}</span>
                </Show>
                <A href={c.href} end activeClass="" inactiveClass="">{c.label}</A>
              </>
            )}
          </For>
        </nav>
        <AiActions />
      </div>
      <div class="page-header__row">
        <h1>{route().title}</h1>
        <Show when={props.aside}>
          <div class="page-header__aside">{props.aside}</div>
        </Show>
      </div>
      {props.children}
    </header>
  );
}
