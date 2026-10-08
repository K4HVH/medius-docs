import { createEffect, on, onCleanup } from 'solid-js';

const holders = new Set<string>();

// The page under an open phone panel stays still. Each panel holds its own key, so closing one never
// unlocks the page under the other.
export function lockPage(key: string, locked: boolean): void {
  if (locked) holders.add(key);
  else holders.delete(key);
  document.documentElement.classList.toggle('locked', holders.size > 0);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// While a phone panel is open, focus starts on its first control, Tab cycles through its toggle and its
// controls, and Escape closes it and puts focus back on the toggle.
export function panelKeys(o: {
  open: () => boolean;
  panel: () => HTMLElement | undefined;
  toggle: () => HTMLElement | undefined;
  close: () => void;
}): void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      o.close();
      o.toggle()?.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [o.toggle(), ...(o.panel()?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
      (el): el is HTMLElement => !!el,
    );
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i < 0 || i === items.length - 1 ? 0 : i + 1;
    e.preventDefault();
    items[next].focus();
  };
  createEffect(
    on(o.open, (open) => {
      if (!open) return;
      document.addEventListener('keydown', onKey);
      queueMicrotask(() => o.panel()?.querySelector<HTMLElement>(FOCUSABLE)?.focus());
      onCleanup(() => document.removeEventListener('keydown', onKey));
    }),
  );
}
