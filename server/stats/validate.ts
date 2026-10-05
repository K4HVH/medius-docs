// One posted event, checked field by field. Fields not listed here are dropped.

import {
  BROWSERS,
  CHIPS,
  type ChipVersions,
  KINDS,
  OSES,
  PAGES,
  RESULTS,
  ROUTES,
  SOURCES,
  type StatsEvent,
} from './types';

const MAC = /^[0-9a-f]{12}$/;
const VERSION = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const PRODUCT_MAX = 126;
const MS_MAX = 3_600_000;

class Refused extends Error {}

const refuse = (why: string): never => {
  throw new Refused(why);
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const mac = (v: unknown, field = 'mac'): string => {
  const m = typeof v === 'string' ? v.toLowerCase() : '';
  if (!MAC.test(m) || m === '000000000000') refuse(`${field}: not a MAC`);
  return m;
};

const version = (v: unknown, field: string): string => {
  const m = typeof v === 'string' ? VERSION.exec(v) : null;
  if (!m || m.slice(1).some((n) => +n > 255)) refuse(`${field}: not a version`);
  return v as string;
};

const maybeVersion = (v: unknown, field: string): string | null => (v === null ? null : version(v, field));

const int = (v: unknown, field: string, min: number, max: number): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) refuse(`${field}: out of range`);
  return v as number;
};

const oneOf = <T extends string>(list: readonly T[], v: unknown, field: string): T => {
  if (!list.includes(v as T)) refuse(`${field}: not one of ${list.join(', ')}`);
  return v as T;
};

const product = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return refuse('product: not a string');
  // Control and format characters (bidi overrides, zero-width marks) are dropped; the cut is by
  // characters, so it never splits one.
  const s = Array.from(v.replace(/[\p{Cc}\p{Cf}]/gu, '').trim()).slice(0, PRODUCT_MAX).join('').trim();
  return s === '' ? null : s;
};

const versions = (v: unknown, field: string): ChipVersions => {
  if (!isObject(v)) return refuse(`${field}: not an object`);
  return { device: maybeVersion(v.device, `${field}.device`), host: maybeVersion(v.host, `${field}.host`) };
};

function parse(e: Record<string, unknown>): StatsEvent {
  switch (e.type) {
    case 'box':
      return {
        type: 'box',
        mac: mac(e.mac),
        fw: version(e.fw, 'fw'),
        hostFw: maybeVersion(e.hostFw, 'hostFw'),
        proto: int(e.proto, 'proto', 0, 255),
        os: oneOf(OSES, e.os, 'os'),
        browser: oneOf(BROWSERS, e.browser, 'browser'),
      };
    case 'device': {
      const vid = int(e.vid, 'vid', 0, 0xffff);
      const pid = int(e.pid, 'pid', 0, 0xffff);
      if (vid === 0 && pid === 0) refuse('vid, pid: nothing cloned');
      return { type: 'device', mac: mac(e.mac), vid, pid, kind: int(e.kind, 'kind', 0, 2), product: product(e.product) };
    }
    case 'flash':
      return {
        type: 'flash',
        mac: e.mac === null ? null : mac(e.mac),
        page: oneOf(PAGES, e.page, 'page'),
        route: oneOf(ROUTES, e.route, 'route'),
        chips: oneOf(CHIPS, e.chips, 'chips'),
        source: oneOf(SOURCES, e.source, 'source'),
        kind: e.kind === null ? null : oneOf(KINDS, e.kind, 'kind'),
        to: versions(e.to, 'to'),
        from: versions(e.from, 'from'),
        result: oneOf(RESULTS, e.result, 'result'),
        ms: int(e.ms, 'ms', 0, MS_MAX),
      };
    default:
      return refuse('type: not an event');
  }
}

// The event, or why it was refused.
export function parseEvent(input: unknown): StatsEvent | string {
  if (!isObject(input)) return 'not an event';
  try {
    return parse(input);
  } catch (e) {
    if (e instanceof Refused) return e.message;
    throw e;
  }
}
