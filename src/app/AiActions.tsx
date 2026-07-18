import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useLocation } from '@solidjs/router';
import { BsStars } from 'solid-icons/bs';
import { Button } from '../components/inputs/Button';

const SITE = 'https://medius.k4tech.net';

// Titlebar "use this page with an AI" menu: copy/view the Markdown twin, or open
// the page in ChatGPT/Claude. Shown only on documentation routes (the ones with
// a prerendered .md twin). The menu is portaled to <body> so the titlebar's
// overflow:hidden cannot clip it.
export default function AiActions() {
  const location = useLocation();
  const isDoc = () => /^\/(native|library|bindings)(\/|$)/.test(location.pathname);
  const mdPath = () => location.pathname.replace(/\/+$/, '') + '.md';
  const mdUrl = () => SITE + mdPath();

  const [open, setOpen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [pos, setPos] = createSignal({ top: 0, right: 0 });
  let triggerRef: HTMLSpanElement | undefined;
  let menuRef: HTMLDivElement | undefined;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  const place = () => {
    if (!triggerRef) return;
    const r = triggerRef.getBoundingClientRect();
    setPos({ top: Math.round(r.bottom + 6), right: Math.round(Math.max(8, window.innerWidth - r.right)) });
  };
  const toggle = () => {
    if (!open()) place();
    setOpen(!open());
  };
  const close = () => setOpen(false);

  const onDocPointer = (e: PointerEvent) => {
    if (!open()) return;
    const t = e.target as Node;
    if (triggerRef?.contains(t) || menuRef?.contains(t)) return;
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('pointerdown', onDocPointer);
  document.addEventListener('keydown', onKey);
  onCleanup(() => {
    document.removeEventListener('pointerdown', onDocPointer);
    document.removeEventListener('keydown', onKey);
    clearTimeout(copyTimer);
  });

  // Close the menu when the route changes.
  createEffect(() => {
    location.pathname;
    close();
  });

  const copyMarkdown = async () => {
    try {
      const res = await fetch(mdPath());
      if (!res.ok) return;
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard or fetch unavailable */
    }
  };

  const prompt = () =>
    `Read the Medius documentation page at ${mdUrl()} and help me use it. ` +
    `The full docs index is at ${SITE}/llms.txt and there is an MCP server at ${SITE}/mcp.`;

  return (
    <Show when={isDoc()}>
      <span class="ai-actions" ref={triggerRef}>
        <Button
          variant="subtle"
          size="compact"
          icon={BsStars}
          onClick={toggle}
          aria-label="Use this page with an AI assistant"
        />
        <Show when={open()}>
          <Portal>
            <div
              class="ai-actions__menu"
              role="menu"
              ref={menuRef}
              style={{ top: `${pos().top}px`, right: `${pos().right}px` }}
            >
              <button type="button" class="ai-actions__item" onClick={copyMarkdown}>
                {copied() ? 'Copied' : 'Copy as Markdown'}
              </button>
              <a class="ai-actions__item" href={mdPath()} target="_blank" rel="noreferrer" onClick={close}>
                View as Markdown
              </a>
              <a
                class="ai-actions__item"
                href={`https://chatgpt.com/?q=${encodeURIComponent(prompt())}`}
                target="_blank"
                rel="noreferrer"
                onClick={close}
              >
                Open in ChatGPT
              </a>
              <a
                class="ai-actions__item"
                href={`https://claude.ai/new?q=${encodeURIComponent(prompt())}`}
                target="_blank"
                rel="noreferrer"
                onClick={close}
              >
                Open in Claude
              </a>
            </div>
          </Portal>
        </Show>
      </span>
    </Show>
  );
}
