// One box write with its busy flag, its error, and the follow-up read.

import { type Accessor, createSignal } from 'solid-js';

export interface Command {
  busy: Accessor<boolean>;
  error: Accessor<string | null>;
  run: (fn: () => Promise<unknown>) => void;
  clear: () => void;
}

export function createCommand(after?: () => void): Command {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    void fn()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        setBusy(false);
        after?.();
      });
  };

  return { busy, error, run, clear: () => setError(null) };
}
