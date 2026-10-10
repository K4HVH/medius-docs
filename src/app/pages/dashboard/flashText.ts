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
