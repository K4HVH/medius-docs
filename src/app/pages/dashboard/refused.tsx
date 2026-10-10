import { type Accessor, Show, createEffect, createSignal, untrack } from 'solid-js';

// For a tab whose panels share one command: a refused command shows in the panel last acted in, beside
// the button that sent it, and in `home` when it came from no panel the tab names (a refusal a later
// read reports, a click from assistive technology with no pointer before it). Put `actedIn` on a
// wrapper's pointer, key and click events, and a `Refused` in each panel of `panels`. The panel is taken
// when the refusal arrives, so a later click elsewhere leaves the message where it was.
export function createRefused(panels: readonly string[], home: string) {
  const [at, setAt] = createSignal('');
  const [shown, setShown] = createSignal<{ panel: string; msg: string } | null>(null);
  const actedIn = (e: Event) => setAt((e.target as Element | null)?.closest('.pn')?.id ?? '');
  const report = (e: unknown) => {
    const p = untrack(at);
    setShown({ panel: panels.includes(p) ? p : home, msg: e instanceof Error ? e.message : String(e) });
  };
  const clear = () => setShown(null);
  // For a command whose error is a signal of its own: clears with it, and places each refusal anew.
  const follow = (error: Accessor<string | null>) =>
    createEffect(() => {
      const msg = error();
      if (msg) report(msg);
      else clear();
    });
  const Refused = (props: { panel: string }) => (
    <Show when={shown()?.panel === props.panel && shown()?.msg}>
      {(msg) => (
        <div class="callout callout--danger" role="alert">
          {msg()}
        </div>
      )}
    </Show>
  );
  return { actedIn, report, clear, follow, Refused };
}
