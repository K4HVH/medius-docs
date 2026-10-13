// Client for the server's firmware proxy (/api/firmware/*), which holds the token.

import { type Semver, parseVersion } from '../flash/image';

export interface FirmwareAsset {
  id: number;
  name: string;
  size: number;
}

export interface FirmwareRelease {
  tag: string;
  name: string;
  publishedAt: string;
  prerelease: boolean;
  notes: string;
  assets: FirmwareAsset[];
}

// The oldest release offered to flash by hand: v3.2.0 brought updates over USB2 and protocol 5, the oldest
// this page connects to (MIN_PROTO_VER). A box on anything older couldn't come back from here.
const OLDEST_OFFERED: Semver = { major: 3, minor: 2, patch: 0 };
// v3.3.1 needed PSRAM to start, which some boxes lack; flashed with the button held it leaves nothing to fall back to.
const WITHDRAWN = new Set(['v3.3.1']);
const compare = (a: Semver, b: Semver) => a.major - b.major || a.minor - b.minor || a.patch - b.patch;

// The releases before the latest that can be flashed by hand, newest first as the list comes.
export function olderReleases(list: FirmwareRelease[] | undefined): FirmwareRelease[] {
  return (list ?? []).slice(1).filter((r) => {
    const v = parseVersion(r.tag);
    return !r.prerelease && !WITHDRAWN.has(r.tag) && !!v && compare(v, OLDEST_OFFERED) >= 0;
  });
}

export class FirmwareUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirmwareUnavailableError';
  }
}

export async function fetchReleases(): Promise<FirmwareRelease[]> {
  const res = await fetch('/api/firmware/releases');
  if (res.status === 503) {
    throw new FirmwareUnavailableError(
      "Firmware fetch isn't set up on this server. Upload a .bin.",
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Could not list firmware (${res.status}).`);
  }
  const data = (await res.json()) as { releases: FirmwareRelease[] };
  return data.releases;
}

// The release list for the pages that show it, one fetch kept a minute: the changelog arriving by a link
// finds it fetched beside its code, and the page's fetch gets the same list.
let kept: { at: number; list: Promise<FirmwareRelease[]> } | null = null;
let inHand: FirmwareRelease[] | undefined;
export function latestReleases(): Promise<FirmwareRelease[]> {
  if (!kept || Date.now() - kept.at > 60_000) {
    const list = fetchReleases().then(
      (l) => (inHand = l),
      (e: unknown) => {
        kept = null;
        throw e;
      },
    );
    kept = { at: Date.now(), list };
  }
  return kept.list;
}
export const releasesInHand = (): FirmwareRelease[] | undefined => inHand;

export async function downloadAsset(asset: FirmwareAsset): Promise<Uint8Array> {
  const res = await fetch(`/api/firmware/asset/${asset.id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Download failed (${res.status}).`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  // A flash's MD5 check is of the file as downloaded, which a short download passes, so the size is checked here.
  if (asset.size && bytes.length !== asset.size) {
    throw new Error(`Incomplete download (${bytes.length} of ${asset.size} bytes). Try again.`);
  }
  return bytes;
}
