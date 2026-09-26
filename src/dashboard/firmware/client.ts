// Client for the server's firmware proxy (/api/firmware/*), which holds the token.

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

export async function downloadAsset(asset: FirmwareAsset): Promise<Uint8Array> {
  const res = await fetch(`/api/firmware/asset/${asset.id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Download failed (${res.status}).`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  // esptool's MD5 hashes a truncated file too, so a short download is rejected here.
  if (asset.size && bytes.length !== asset.size) {
    throw new Error(`Incomplete download (${bytes.length} of ${asset.size} bytes). Try again.`);
  }
  return bytes;
}
