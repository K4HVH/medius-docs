import { For, Show, type Component } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { A } from '@solidjs/router';

export interface NavItem {
  href: string;
  label: string;
  icon?: Component;
}

// A vertical list of router links that look like MidnightUI's subtle vertical Tabs, so crawlers can
// follow the sidebar and a page opens in a new tab.
export const NavLinks = (props: {
  items: NavItem[];
  active: string;
  label?: string;
  current?: 'page' | 'true';
  disabled?: boolean;
  onNavigate?: () => void;
}) => (
  <nav aria-label={props.label}>
    <div class={`tabs tabs--subtle tabs--vertical${props.disabled ? ' tabs--disabled' : ''}`}>
      <For each={props.items}>
        {(item) => {
          const active = () => props.active === item.href;
          return (
            <A
              href={item.href}
              end
              activeClass=""
              inactiveClass=""
              class={`tabs__tab${active() ? ' tabs__tab--active' : ''}`}
              aria-current={active() ? (props.current ?? 'page') : undefined}
              aria-disabled={props.disabled ? 'true' : undefined}
              tabIndex={props.disabled ? -1 : undefined}
              on:click={(e: MouseEvent) => {
                if (props.disabled) {
                  e.preventDefault();
                  e.stopImmediatePropagation();
                  return;
                }
                props.onNavigate?.();
              }}
            >
              <Show when={item.icon}>
                <span class="tabs__tab-icon">
                  <Dynamic component={item.icon!} />
                </span>
              </Show>
              <span class="tabs__tab-label">{item.label}</span>
            </A>
          );
        }}
      </For>
    </div>
  </nav>
);
