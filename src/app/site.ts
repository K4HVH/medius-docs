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
