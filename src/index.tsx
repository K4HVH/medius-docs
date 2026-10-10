/* @refresh reload */
import { render } from 'solid-js/web';
import 'solid-devtools';

import App from './app/App';
import { pageLoaded, preloadPage } from './app/lazyPages';
import { holdHistory } from './app/shell/leave';
import { keepPlaces, openingAt } from './app/shell/scrollPlace';
import { retime } from './app/shell/motion';
import { introElapsed, resumeIntro } from './app/shell/takeover';
import './styles/global.css';
import './styles/theme/index.css';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

const dev = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
// `?searchindex` on the dev server: the site read into search entries, which a headless browser collects.
const pass = !!dev?.has('searchindex');
if (pass) (globalThis as { __mediusSearchPass?: boolean }).__mediusSearchPass = true;

// A reload or a return to this tab puts the snapshot where the reader left it, before the app takes over.
keepPlaces();
const place = openingAt();
if (place) window.scrollTo({ top: place, left: 0, behavior: 'instant' });
// The snapshot's arrival, stamped from the top as it was prerendered, then starts at what is in view.
const shown = root?.querySelector<HTMLElement>('main.docs-page');
if (shown && (place || location.hash)) retime(shown);

let up = false;
holdHistory({ loaded: pageLoaded, load: preloadPage, reload: () => window.location.reload(), live: () => up });

// Prerendered pages ship a static snapshot inside #root. The app replaces it once the page's code is in,
// so it does so in one step (a client render, not a hydrate), and picks the snapshot's intro up where it
// is then. Without the page's code (offline), the snapshot stays: it reads, and its links load pages. Back
// or forward while the code comes changes the page asked for, whose code is then fetched in turn.
const start = async () => {
  while (!pageLoaded(location.pathname)) if (!(await preloadPage(location.pathname).then(() => true, () => false))) return;
  const elapsed = introElapsed();
  if (root) root.textContent = '';
  render(() => <App />, root!);
  up = true;
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
    void start();
  });
} else void start();
