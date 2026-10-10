import { createSignal, onCleanup, onMount } from 'solid-js';
import { pagePath } from '../routes';
import { SITE } from '../site';

// Copies are announced from one live region outside every heading: one inside would join its text. It is
// in the page before the first copy, and each message lands a moment after it is cleared, so a screen
// reader hears every one.
let said: HTMLElement | undefined;
function liveRegion(): HTMLElement {
  if (!said || !said.isConnected) said = document.querySelector<HTMLElement>('.cl-said') ?? undefined;
  if (!said) {
    said = document.createElement('div');
    said.className = 'cl-said';
    said.setAttribute('role', 'status');
    said.setAttribute('aria-live', 'polite');
    document.body.appendChild(said);
  }
  return said;
}
function say(text: string): void {
  const region = liveRegion();
  region.textContent = '';
  setTimeout(() => (region.textContent = text), 50);
}

// Whether a marked place holds its link icon (the build's search pass asks of every place).
export function holdsLink(root: ParentNode, id: string): boolean {
  const v = id.replace(/["\\]/g, '\\$&');
  return !!root.querySelector(`[id="${v}"] .cl[data-for="${v}"]`);
}

// The browser's copy command, for a page the Clipboard API refuses (an insecure origin, a denied
// permission).
function copyCommand(text: string): boolean {
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    back?.focus({ preventScroll: true });
  }
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyCommand(text);
  }
}

// The link icon beside a place the site links to. It copies the full address: `to`, or the page (the
// parent, on an item's address) and the place's id. Copied or Not copied shows for 1.5 s (data-state),
// drawn by the CSS from data-said, which stays while the word fades out: the button holds no text for
// search, the rail or a Markdown twin to read. Near the right edge of the screen the word opens to the
// icon's left (data-side), so it never widens the page.
export function CopyLink(props: { id: string; label: string; to?: string }) {
  const [state, setState] = createSignal<'copied' | 'failed' | null>(null);
  const [said, setSaid] = createSignal('');
  const [side, setSide] = createSignal<'left' | undefined>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fade: ReturnType<typeof setTimeout> | undefined;
  onMount(liveRegion);
  onCleanup(() => {
    clearTimeout(timer);
    clearTimeout(fade);
  });
  const click = async (e: MouseEvent) => {
    const at = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const path = props.to ?? `${pagePath(window.location.pathname)}#${props.id}`;
    const ok = await copy(SITE + path);
    clearTimeout(timer);
    clearTimeout(fade);
    setSide(document.documentElement.clientWidth - at.right < 110 ? 'left' : undefined);
    setState(ok ? 'copied' : 'failed');
    setSaid(ok ? 'Copied' : 'Not copied');
    say(ok ? 'Link copied' : 'Link not copied');
    timer = setTimeout(() => {
      setState(null);
      fade = setTimeout(() => setSaid(''), 400);
    }, 1500);
  };
  return (
    <button
      type="button"
      class="cl"
      aria-label={`Copy link to ${props.label}`}
      data-for={props.id}
      data-state={state() ?? undefined}
      data-said={said() || undefined}
      data-side={side()}
      data-search-skip
      data-agent-hide
      onClick={click}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" />
        <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z" />
      </svg>
    </button>
  );
}
