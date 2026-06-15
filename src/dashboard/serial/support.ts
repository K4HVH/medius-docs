// Web Serial availability checks. The API exists only in Chromium-based browsers
// (Chrome/Edge/Opera 89+) and only in a secure context (HTTPS or localhost).

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function isSecureContextOk(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}
