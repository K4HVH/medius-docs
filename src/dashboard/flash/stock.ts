// MAKCU's stock firmware, as this site's server relays it from MAKCU's signed catalog (server/stock.ts).

export interface StockFileInfo {
  name: string;
  size: number;
}

export interface StockCatalog {
  id: string;
  files: { package: StockFileInfo; usb1: StockFileInfo; usb3: StockFileInfo };
}

const reason = async (res: Response, fallback: string) => {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
};

export async function fetchStockCatalog(): Promise<StockCatalog> {
  const res = await fetch('/api/stock/catalog');
  if (!res.ok) throw new Error(await reason(res, "MAKCU's catalog couldn't be read."));
  return (await res.json()) as StockCatalog;
}

export async function fetchStockFile(name: string): Promise<Uint8Array> {
  const res = await fetch(`/api/stock/file/${name}`);
  if (!res.ok) throw new Error(await reason(res, `${name} couldn't be read from MAKCU.`));
  return new Uint8Array(await res.arrayBuffer());
}
