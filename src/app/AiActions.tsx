import { createSignal, Show } from 'solid-js';
import { useLocation } from '@solidjs/router';

const SITE = 'https://medius.k4tech.net';

// Per-page "use this with an AI" row: copy/view the Markdown twin, or open the
// page in ChatGPT/Claude. Shown only on documentation routes (the ones with a
// prerendered .md twin), never on the dashboard. Marked data-agent-hide so it is
// stripped from the extracted Markdown.
export default function AiActions() {
  const location = useLocation();
  const isDoc = () => /^\/(native|library|bindings)(\/|$)/.test(location.pathname);
  const mdPath = () => location.pathname.replace(/\/+$/, '') + '.md';
  const mdUrl = () => SITE + mdPath();
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const copyMarkdown = async (e: Event) => {
    e.preventDefault();
    try {
      const res = await fetch(mdPath());
      if (!res.ok) return;
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard or fetch unavailable */
    }
  };

  const prompt = () =>
    `Read the Medius documentation page at ${mdUrl()} and help me use it. ` +
    `The full docs index is at ${SITE}/llms.txt and there is an MCP server at ${SITE}/mcp.`;

  return (
    <Show when={isDoc()}>
      <div class="ai-actions" data-agent-hide>
        <span class="ai-actions__label">For AI</span>
        <button type="button" class="ai-actions__item" onClick={copyMarkdown}>
          {copied() ? 'Copied' : 'Copy as Markdown'}
        </button>
        <a class="ai-actions__item" href={mdPath()} target="_blank" rel="noreferrer">
          View as Markdown
        </a>
        <a
          class="ai-actions__item"
          href={`https://chatgpt.com/?q=${encodeURIComponent(prompt())}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in ChatGPT
        </a>
        <a
          class="ai-actions__item"
          href={`https://claude.ai/new?q=${encodeURIComponent(prompt())}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in Claude
        </a>
      </div>
    </Show>
  );
}
