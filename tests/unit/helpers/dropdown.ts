// A dropdown (shell Select) found as a screen reader names it, by its field's label: opened, read, picked from.
import { fireEvent, within } from '@solidjs/testing-library';

const button = (root: ParentNode, label: string): HTMLButtonElement => {
  const named = within(root as HTMLElement)
    .queryAllByRole('button', { name: (n) => n === label || n.startsWith(`${label} `) })
    .filter((b) => b.classList.contains('dd-b'));
  if (named.length !== 1) throw new Error(`${named.length} dropdowns labelled ${label}`);
  return named[0] as HTMLButtonElement;
};

// Opens the dropdown, if it isn't, and returns its options; it stays open.
export const open = (root: ParentNode, label: string): HTMLButtonElement[] => {
  const b = button(root, label);
  if (b.getAttribute('aria-expanded') !== 'true') fireEvent.click(b);
  return [...b.closest('.dd')!.querySelectorAll<HTMLButtonElement>('[role="option"]')];
};

// Opens the dropdown and clicks the option whose text is `option`.
export const choose = (root: ParentNode, label: string, option: string) => {
  const o = open(root, label).find((x) => x.textContent?.trim() === option);
  if (!o) throw new Error(`no option ${option} in ${label}`);
  fireEvent.click(o);
};

// The options' texts; a dropdown found closed is closed again.
export const optionsOf = (root: ParentNode, label: string): string[] => {
  const was = button(root, label).getAttribute('aria-expanded') === 'true';
  const texts = open(root, label).map((o) => o.textContent!.trim());
  if (!was) fireEvent.click(button(root, label));
  return texts;
};

// What the dropdown shows.
export const shownIn = (root: ParentNode, label: string): string =>
  button(root, label).querySelector('[data-search-skip]')!.textContent!.trim();
