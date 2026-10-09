// Scroll reveals. Anything below the first screen eases up the first time it comes into view; anything
// already on screen when a page is armed (including a section a hash jump brought into view) is never
// hidden, and at the page bottom whatever is still waiting is shown.

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const fontsReady = (): Promise<unknown> => document.fonts?.ready ?? Promise.resolve();

export function armReveals(scope: ParentNode, selector: string): () => void {
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return () => {};
  const timers: ReturnType<typeof setTimeout>[] = [];
  const show = (el: Element, delay: number) => timers.push(setTimeout(() => el.classList.remove('pre'), delay));

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const waiting = e.target.parentElement
          ? [...e.target.parentElement.children].filter((c) => c.classList.contains('pre'))
          : [];
        show(e.target, Math.min(Math.max(0, waiting.indexOf(e.target)), 6) * 70);
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );

  scope.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (el.classList.contains('rv')) return;
    el.classList.add('rv');
    if (el.getBoundingClientRect().top >= window.innerHeight) {
      el.classList.add('pre');
      io.observe(el);
    }
  });

  const atBottom = () => {
    if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 4) return;
    [...scope.querySelectorAll<HTMLElement>('.rv.pre')]
      .filter((el) => el.getBoundingClientRect().top < window.innerHeight)
      .forEach((el, i) => {
        io.unobserve(el);
        show(el, Math.min(i, 4) * 70);
      });
  };
  window.addEventListener('scroll', atBottom, { passive: true });

  return () => {
    io.disconnect();
    window.removeEventListener('scroll', atBottom);
    timers.forEach(clearTimeout);
    scope.querySelectorAll('.rv.pre').forEach((el) => el.classList.remove('pre'));
  };
}
