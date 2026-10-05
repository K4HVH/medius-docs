// What the dashboard reports and what the stats page reads. The dashboard takes only the types, with
// `import type`, since the server is not part of its bundle.

export const OSES = ['windows', 'macos', 'linux', 'chromeos', 'android', 'other'] as const;
export const BROWSERS = ['chrome', 'edge', 'opera', 'brave', 'chromium'] as const;
export const PAGES = ['setup', 'update', 'advanced'] as const;
export const ROUTES = ['usb2', 'rom'] as const;
export const CHIPS = ['device', 'host', 'both'] as const;
export const SOURCES = ['release', 'file'] as const;
export const KINDS = ['app', 'factory'] as const;
// verified, reverted, sent and failed are runs over USB2; written is ROM download.
export const RESULTS = ['verified', 'reverted', 'sent', 'failed', 'written'] as const;

export type Os = (typeof OSES)[number];
export type Browser = (typeof BROWSERS)[number];
export type FlashPage = (typeof PAGES)[number];
export type FlashRoute = (typeof ROUTES)[number];
export type FlashChips = (typeof CHIPS)[number];
export type FlashSource = (typeof SOURCES)[number];
export type ImageKind = (typeof KINDS)[number];
export type FlashResult = (typeof RESULTS)[number];

// MACs are 12 lowercase hex digits; versions are "major.minor.patch".
export interface BoxEvent {
  type: 'box';
  mac: string;
  fw: string;
  hostFw: string | null;
  proto: number;
  os: Os;
  browser: Browser;
}

// kind: 0 unknown, 1 keyboard, 2 mouse, as DEVICE_INFO reports it.
export interface DeviceEvent {
  type: 'device';
  mac: string;
  vid: number;
  pid: number;
  kind: number;
  product: string | null;
}

export interface ChipVersions {
  device: string | null;
  host: string | null;
}

export interface FlashEvent {
  type: 'flash';
  mac: string | null;
  page: FlashPage;
  route: FlashRoute;
  chips: FlashChips;
  source: FlashSource;
  kind: ImageKind | null;
  to: ChipVersions;
  from: ChipVersions;
  result: FlashResult;
  ms: number;
}

export type StatsEvent = BoxEvent | DeviceEvent | FlashEvent;

export interface Count {
  key: string;
  n: number;
}

export interface WeekFlashes {
  week: string;
  verified: number;
  reverted: number;
  sent: number;
  failed: number;
  written: number;
}

export interface TopDevice {
  vid: number;
  pid: number;
  kind: number;
  product: string | null;
  boxes: number;
}

export interface KindCount {
  kind: number;
  devices: number;
  boxes: number;
}

// Days are YYYY-MM-DD in UTC; weeks are named by their Monday. Series are filled, oldest first.
export interface StatsSummary {
  boxes: {
    total: number;
    active7: number;
    active30: number;
    newPerWeek: Count[];
    activePerDay: Count[];
  };
  firmware: {
    versions: Count[];
  };
  devices: {
    unique: number;
    byKind: KindCount[];
    top: TopDevice[];
  };
  flashes: {
    total: number;
    succeeded: number;
    byResult: Count[];
    byRoute: Count[];
    byChips: Count[];
    bySource: Count[];
    byVersion: Count[];
    perWeek: WeekFlashes[];
  };
  countries: Count[];
  os: Count[];
  browsers: Count[];
}
