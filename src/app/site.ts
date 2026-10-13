export const SITE = 'https://medius.k4tech.net';

// The landing's claim, a line each; the home page's link card sets it the same way.
export const CLAIM = ['Replacement firmware', 'for the MAKCU box.'] as const;

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
  // A place is named by its hash, which a browser keeps over the old address's (a Location with none takes the
  // old one); the page writes the place's address once it lands.
  '/dashboard/advanced-control': '/dashboard/control#advanced',
  '/dashboard/advanced': '/dashboard/flash',
  // An anchor on the old page carries over where the new one keeps it (the FAQ's answers).
  '/guide/update': '/guide/help#q-update',
  '/guide/faq': '/guide/help',
  '/guide/troubleshooting': '/guide/help',
  '/guide/device-fixes': '/guide/compatibility#fixes',
  // The address a privacy policy is looked for at, and the one the Discord bot's listing names.
  '/privacy': '/guide/privacy',
};
