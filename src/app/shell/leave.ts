import { type Accessor, createEffect, on } from 'solid-js';
import { useBeforeLeave, useLocation } from '@solidjs/router';
import { prefersReducedMotion } from './motion';

const FADE_MS = 120;

// A link to another page fades the page out first; the new page then arrives. The last link clicked
// during the fade is the one taken. Back and forward go at once (the router could only hold them by
// rewinding history and replaying it), as does a redirect, and a flash in progress blocks navigation
// elsewhere, so it is left alone here. The held navigation goes on through the other listeners, so a
// flash that began during the fade still holds the reader on the page.
export function useLeaveFade(blocked: Accessor<boolean>): void {
  const location = useLocation();
  const root = document.documentElement;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let passing = false;

  const settle = () => {
    clearTimeout(pending);
    pending = undefined;
  };

  useBeforeLeave((e) => {
    if (passing) {
      passing = false;
      return;
    }
    settle();
    const fades =
      typeof e.to === 'string' &&
      !e.options?.replace &&
      !blocked() &&
      !prefersReducedMotion() &&
      new URL(e.to, window.location.href).pathname !== location.pathname;
    if (!fades) {
      root.classList.remove('leaving');
      return;
    }
    e.preventDefault();
    root.classList.add('leaving');
    pending = setTimeout(() => {
      pending = undefined;
      passing = true;
      e.retry();
      passing = false;
    }, FADE_MS);
    clearTimeout(fallback);
    fallback = setTimeout(() => root.classList.remove('leaving'), FADE_MS * 5);
  });

  createEffect(on(() => location.pathname, () => root.classList.remove('leaving'), { defer: true }));
}
