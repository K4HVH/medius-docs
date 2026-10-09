import { For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Arrow, ArrowOut } from './Arrow';

// A live filter over a table or a list, with the count of what it leaves. The page's Markdown twin
// carries the list, not the filter.
export function Filter(props: {
  value: string;
  onInput: (v: string) => void;
  placeholder: string;
  count: number;
  noun: [one: string, many: string];
}) {
  return (
    <div class="filter" data-agent-hide>
      <label>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <input
          type="search"
          placeholder={props.placeholder}
          aria-label={props.placeholder}
          autocomplete="off"
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
        />
      </label>
      <span class="n caps" aria-live="polite">
        <b>{props.count}</b> {props.noun[props.count === 1 ? 0 : 1]}
      </span>
    </div>
  );
}

// Text with each case-insensitive match of a filter marked.
export function Marked(props: { text: string; query: string }) {
  const parts = () => {
    const q = props.query.trim().toLowerCase();
    if (!q) return [{ text: props.text, hit: false }];
    const out: { text: string; hit: boolean }[] = [];
    const lower = props.text.toLowerCase();
    let at = 0;
    for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, i + q.length)) {
      if (i > at) out.push({ text: props.text.slice(at, i), hit: false });
      out.push({ text: props.text.slice(i, i + q.length), hit: true });
      at = i + q.length;
    }
    if (at < props.text.length) out.push({ text: props.text.slice(at), hit: false });
    return out;
  };
  return <For each={parts()}>{(p) => (p.hit ? <mark>{p.text}</mark> : p.text)}</For>;
}

// A small link to the setting or page a row or an answer points at.
export function FixLink(props: { href: string; children: string }) {
  return (
    <Show
      when={props.href.startsWith('/')}
      fallback={
        <a class="fix" href={props.href} target="_blank" rel="noreferrer">
          {props.children}
          <ArrowOut size={11} />
        </a>
      }
    >
      <A class="fix" href={props.href} end activeClass="" inactiveClass="">
        {props.children}
        <Arrow size={11} />
      </A>
    </Show>
  );
}
