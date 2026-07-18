/* @refresh reload */
import { render } from 'solid-js/web';
import 'solid-devtools';

import App from './app/App';
import './styles/global.css';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

// Prerendered SSG pages ship a static snapshot inside #root; clear it before the
// client renders a fresh tree (this is a client render(), not a hydrate()).
if (root) root.textContent = '';

render(() => <App />, root!);
