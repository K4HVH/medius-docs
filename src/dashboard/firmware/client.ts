// Browser client for the server-side firmware proxy (/api/firmware/*). The token
// lives on the server, so this just calls same-origin endpoints.

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
      'Firmware fetch is not set up on this server. Upload a .bin instead.',
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
  // A mid-stream CDN drop yields a truncated image that esptool's MD5 cannot
  // catch (it hashes the truncated file), so reject a short download here.
  if (asset.size && bytes.length !== asset.size) {
    throw new Error(`Download was incomplete (${bytes.length} of ${asset.size} bytes). Try again.`);
  }
  return bytes;
}
