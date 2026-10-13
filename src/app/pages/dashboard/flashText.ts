import type { FlashPhase, FlashProgress } from '../../../dashboard/flash';

const WAIT: Partial<Record<FlashPhase, string>> = {
  rebooting: 'Rebooting',
  connecting: 'Connecting',
  erasing: 'Erasing',
  restarting: 'Restarting',
  verifying: 'Verifying',
};

// A flash's figure: the count of a phase that has one, 100 once done, else none.
export function flashPercent(p: FlashProgress | null | undefined): number | undefined {
  if ((p?.phase === 'writing' || p?.phase === 'erasing') && p.total) return Math.round(((p.written ?? 0) / p.total) * 100);
  return p?.phase === 'done' ? 100 : undefined;
}

// What shows in place of the figure while a phase counts nothing: its name over a running segment.
export function flashWait(p: FlashProgress | null | undefined): string | null {
  return flashPercent(p) === undefined ? (WAIT[p?.phase ?? 'connecting'] ?? 'Connecting') : null;
}

// Flash and update failures only: a failed CONNECT is a verdict, not a string.
export function flashErrorText(e: unknown): string {
  // A DOMException isn't an Error everywhere, so Web Serial's wording is matched on the message.
  const message = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (/device has been lost/i.test(message)) return 'The box went away partway through.';
  // Web Serial's wording says nothing about what to do. Matched exactly: the box's BUSY says "already
  // open" too, about an update session.
  if (/port is already open/i.test(message)) {
    return 'That port is still held by an earlier session. Reload the page, or replug the control cable.';
  }
  if (e instanceof Error) {
    if (/[Ff]ailed to open|Access denied|NetworkError/.test(e.message)) {
      return 'Could not open that port. Close anything else using it, then replug the control cable.';
    }
    return e.message;
  }
  return String(e);
}
