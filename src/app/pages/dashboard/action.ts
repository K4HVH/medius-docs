// Run one box command and keep whether it failed.
//
// Every card needs the same three things around a write: a busy flag, the error if it threw, and
// the follow-up read. Without it the writes were fire-and-forget `void` calls, so a command that
// never reached the box looked exactly like one that worked -- worst of all on the persistent
// options, where the value survives a reboot.

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
