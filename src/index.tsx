/* @refresh reload */
import { render } from 'solid-js/web';
import 'solid-devtools';

import App from './app/App';
import { introElapsed, resumeIntro } from './app/shell/takeover';
import './styles/global.css';
import './styles/theme/index.css';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

// Prerendered SSG pages ship a static snapshot inside #root; clear it before the
// client renders a fresh tree (this is a client render(), not a hydrate()).
const elapsed = introElapsed();
if (root) root.textContent = '';

const dev = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
// `?searchindex` on the dev server: the site read into search entries, which a headless browser collects.
const pass = !!dev?.has('searchindex');
if (pass) (globalThis as { __mediusSearchPass?: boolean }).__mediusSearchPass = true;

const start = () => {
  render(() => <App />, root!);
  resumeIntro(elapsed);
  if (pass)
    void import('./dev/searchPass').then((m) => {
      (globalThis as { __searchEntries?: unknown }).__searchEntries = m.runSearchPass();
    });
};

// `?fakebox` on the dev server: Connect finds a box that answers without hardware.
if (dev?.has('fakebox')) {
  void import('./dev/fakeBox').then((m) => {
    (globalThis as { __mediusDevBox?: unknown }).__mediusDevBox = m.fakeBoxDeps();
    start();
  });
} else start();
