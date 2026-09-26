// Web Serial exists only in Chromium browsers (Chrome/Edge/Opera 89+), in a secure context
// (HTTPS or localhost).

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function isSecureContextOk(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}
