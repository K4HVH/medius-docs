// The system the dashboard runs on, reduced to the few names the stats page counts. Web Serial is
// Chromium-only, so every browser here is one of its builds.

import type { Browser, Os } from '../../../server/stats/types';

interface UaData {
  platform?: string;
  brands?: { brand: string }[];
}

const PLATFORMS: [RegExp, Os][] = [
  [/^windows$/i, 'windows'],
  [/^macos$/i, 'macos'],
  [/^chrome ?os$/i, 'chromeos'],
  [/^android$/i, 'android'],
  [/^linux$/i, 'linux'],
];

// Android and ChromeOS user agents say Linux too, so they come first.
const UA_OS: [RegExp, Os][] = [
  [/Windows/, 'windows'],
  [/Macintosh|Mac OS X/, 'macos'],
  [/CrOS/, 'chromeos'],
  [/Android/, 'android'],
  [/Linux/, 'linux'],
];

const BRANDS: [string, Browser][] = [
  ['Microsoft Edge', 'edge'],
  ['Opera', 'opera'],
  ['Brave', 'brave'],
  ['Google Chrome', 'chrome'],
];

const UA_BROWSER: [RegExp, Browser][] = [
  [/Edg\//, 'edge'],
  [/OPR\//, 'opera'],
];

export function readEnv(nav: Navigator | undefined = globalThis.navigator): { os: Os; browser: Browser } {
  const ua = nav?.userAgent ?? '';
  const data = (nav as { userAgentData?: UaData } | undefined)?.userAgentData;
  const os =
    PLATFORMS.find(([re]) => re.test(data?.platform ?? ''))?.[1] ??
    UA_OS.find(([re]) => re.test(ua))?.[1] ??
    'other';
  const brands = data?.brands?.map((b) => b.brand) ?? [];
  // Brave leaves its brand out of some builds, but always defines navigator.brave.
  const browser =
    BRANDS.find(([b]) => brands.includes(b))?.[1] ??
    ((nav as { brave?: unknown } | undefined)?.brave ? 'brave' : undefined) ??
    UA_BROWSER.find(([re]) => re.test(ua))?.[1] ??
    'chromium';
  return { os, browser };
}
