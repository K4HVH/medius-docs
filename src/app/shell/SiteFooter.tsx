import { For } from 'solid-js';
import { A } from '@solidjs/router';
import { LINKS } from '../site';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Guide',
    links: [
      { label: 'Start here', href: '/guide' },
      { label: 'Devices', href: '/guide/compatibility' },
      { label: 'Help', href: '/guide/help' },
      { label: 'Changelog', href: '/dashboard/changelog' },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Native API', href: '/native' },
      { label: 'Rust', href: '/library' },
      { label: 'C and C++', href: '/bindings/c' },
      { label: 'Python', href: '/bindings/python' },
      { label: 'AI and LLMs', href: '/ai' },
    ],
  },
  {
    title: 'Dashboard',
    links: [
      { label: 'Set up', href: '/dashboard/setup' },
      { label: 'Device', href: '/dashboard' },
      { label: 'Update', href: '/dashboard/update' },
      { label: 'Changelog', href: '/dashboard/changelog' },
      { label: 'Usage stats', href: '/dashboard/stats' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Discord', href: LINKS.discord },
      { label: 'GitHub', href: LINKS.github },
      { label: 'crates.io', href: LINKS.crates },
      { label: 'PyPI', href: LINKS.pypi },
    ],
  },
];

export const SiteFooter = () => (
  <footer class="site-footer">
    <div>
      <A class="brand" href="/" end activeClass="" inactiveClass="">Medius</A>
      <p>Firmware for the MAKCU box.</p>
    </div>
    <For each={COLUMNS}>
      {(col) => (
        <div>
          <h4 class="label">{col.title}</h4>
          <ul>
            <For each={col.links}>
              {(link) => (
                <li>
                  {link.href.startsWith('/') ? (
                    <A href={link.href} end activeClass="" inactiveClass="">{link.label}</A>
                  ) : (
                    <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
                  )}
                </li>
              )}
            </For>
          </ul>
        </div>
      )}
    </For>
    <div class="legal caps">
      <span>© 2026 K4TECH</span>
      <span class="nc">medius.k4tech.net</span>
    </div>
  </footer>
);
