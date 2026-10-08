import { For } from 'solid-js';
import { A } from '@solidjs/router';
import { LINKS } from './site';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Docs',
    links: [
      { label: 'Native API', href: '/native' },
      { label: 'Rust Library', href: '/library' },
      { label: 'Bindings', href: '/bindings' },
      { label: 'AI access', href: '/ai' },
    ],
  },
  {
    title: 'Dashboard',
    links: [
      { label: 'Set up', href: '/dashboard/setup' },
      { label: 'Update', href: '/dashboard/update' },
      { label: 'Changelog', href: '/dashboard/changelog' },
      { label: 'Stats', href: '/dashboard/stats' },
    ],
  },
  { title: 'Community', links: [{ label: 'Discord', href: LINKS.discord }] },
  {
    title: 'Code',
    links: [
      { label: 'GitHub', href: LINKS.github },
      { label: 'crates.io', href: LINKS.crates },
      { label: 'PyPI', href: LINKS.pypi },
    ],
  },
];

export const SiteFooter = () => (
  <footer class="site-footer">
    <For each={COLUMNS}>
      {(col) => (
        <div class="site-footer__column">
          <div class="site-footer__title">{col.title}</div>
          <For each={col.links}>
            {(link) =>
              link.href.startsWith('/') ? (
                <A href={link.href} end activeClass="" inactiveClass="">{link.label}</A>
              ) : (
                <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
              )
            }
          </For>
        </div>
      )}
    </For>
  </footer>
);
