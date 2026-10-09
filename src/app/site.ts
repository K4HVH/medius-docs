export const SITE = 'https://medius.k4tech.net';

export const LINKS = {
  discord: 'https://discord.gg/ArRqcA84pB',
  github: 'https://github.com/K4HVH/medius',
  crates: 'https://crates.io/crates/medius',
  pypi: 'https://pypi.org/project/medius/',
} as const;

// Pages the server fills in per request; their prerendered snapshot holds no release or figure.
export const LIVE_PATHS: ReadonlySet<string> = new Set(['/dashboard/changelog', '/dashboard/stats']);

// Pages the server fills in per request where it can, and serves as prerendered when it can't.
export const SOFT_FILL_PATHS: ReadonlySet<string> = new Set(['/', '/guide/compatibility']);

// Pages that moved, each to where its content lives now: the server answers the old path with a 301
// there, and the app follows a stale link the same way.
export const MOVED: Readonly<Record<string, string>> = {
  '/dashboard/advanced-control': '/dashboard/control#advanced',
  '/dashboard/advanced': '/dashboard/update#manual',
  // An anchor on the old page carries over where the new one keeps it (the FAQ's answers).
  '/guide/update': '/guide/help#q-update',
  '/guide/faq': '/guide/help',
  '/guide/troubleshooting': '/guide/help',
  '/guide/device-fixes': '/guide/compatibility#device-fixes',
};
