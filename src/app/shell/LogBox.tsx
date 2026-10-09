import { createEffect, onCleanup, onMount } from 'solid-js';

// A log read from the top, the newest line last and lit as the landing feed lights its newest row;
// each new line lands with a short rise. While the log is scrolled to its end it follows new lines;
// scrolled back, it holds still, old lines leaving the top included. `added` counts every line ever
// added, so a log at its cap still knows which lines are new; it must change in the same update as
// `rows` (one signal holding both), or the log would draw a half-made change. A change to `version`
// redraws every line in place, the reader's place kept, for lines whose text changed without a line
// being added.
export function LogBox(props: {
  rows: () => string[][];
  added: () => number;
  version?: () => number;
  empty: string;
  label: string;
  cols?: string;
  full?: boolean;
  cellClass?: (cell: string, index: number) => string | undefined;
}) {
  let box: HTMLDivElement | undefined;
  let follow = true;
  let seen = 0;
  let first = true;
  let drawn = 0;

  const row = (cells: string[]) => {
    const r = document.createElement('div');
    cells.forEach((c, i) => {
      const s = document.createElement('span');
      s.textContent = c;
      const cls = props.cellClass?.(c, i);
      if (cls) s.className = cls;
      r.append(s);
    });
    return r;
  };

  onMount(() => {
    box!.addEventListener('scroll', () => {
      follow = box!.scrollHeight - box!.scrollTop - box!.clientHeight <= 24;
    }, { passive: true });
    // A log in a closed tab can't scroll; when its tab opens, a log that was following goes to its end.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (follow && box!.clientHeight) box!.scrollTop = box!.scrollHeight;
    });
    ro.observe(box!);
    onCleanup(() => ro.disconnect());
  });

  createEffect(() => {
    const rows = props.rows();
    const total = props.added();
    const version = props.version?.() ?? 0;
    const redraw = version !== drawn;
    drawn = version;
    if (!box) return;
    if (!rows.length) {
      first = false;
      box.replaceChildren();
      seen = total;
      follow = true;
      return;
    }
    const fresh = first ? 0 : Math.min(rows.length, Math.max(0, total - seen));
    first = false;
    seen = total;
    const have = box.children.length;
    if (redraw || have + fresh < rows.length) {
      // Lines already there when the log opened, or more changed than was added: drawn, not landing.
      const at = box.scrollTop;
      box.replaceChildren(...rows.map(row));
      box.lastElementChild?.classList.add('now');
      if (!follow) box.scrollTop = at;
    } else if (fresh > 0) {
      box.querySelector(':scope > .now')?.classList.remove('now');
      const added = rows.slice(-fresh).map(row);
      added.forEach((r) => r.classList.add('in'));
      added[added.length - 1].classList.add('now');
      box.append(...added);
      // Lines past the cap leave the top; scrolled back, the view stays on the same lines.
      let gone = 0;
      while (box.children.length > rows.length) {
        gone += (box.firstElementChild as HTMLElement).offsetHeight;
        box.firstElementChild!.remove();
      }
      if (!follow && gone) box.scrollTop -= gone;
    }
    if (follow) box.scrollTop = box.scrollHeight;
  });

  return (
    <div
      ref={box}
      class="lg"
      classList={{ full: props.full }}
      style={props.cols ? { '--cols': props.cols } : undefined}
      data-empty={props.empty}
      tabIndex={0}
      role="log"
      aria-label={props.label}
    />
  );
}

// What a log holds, one line a row, for Copy and Save.
export const logText = (rows: string[][]): string => rows.map((r) => r.join('  ')).join('\n');
