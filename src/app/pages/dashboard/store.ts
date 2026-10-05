export interface HeldBox {
  mac: string;
  name: string;
}

export const BOX_ICONS = ['box', 'mouse', 'keyboard', 'controller', 'usb'] as const;
export type BoxIcon = (typeof BOX_ICONS)[number];

export interface BoxStore {
  selected(): string | null;
  setSelected(key: string | null): void;
  held(): HeldBox[];
  hold(mac: string, name: string): void;
  release(mac: string): void;
  // By MAC; a box with none shows the default box.
  icons(): Record<string, BoxIcon>;
  setIcon(mac: string, icon: BoxIcon): void;
}

export const STORE_KEY = 'medius.dashboard.boxes';

interface Saved {
  selected: string | null;
  held: HeldBox[];
  icons: Record<string, BoxIcon>;
}

const isHeld = (h: unknown): h is HeldBox =>
  typeof h === 'object' &&
  h !== null &&
  typeof (h as HeldBox).mac === 'string' &&
  typeof (h as HeldBox).name === 'string';

const iconsOf = (raw: unknown): Record<string, BoxIcon> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, BoxIcon> = {};
  for (const [mac, icon] of Object.entries(raw)) {
    if (icon !== 'box' && BOX_ICONS.includes(icon as BoxIcon)) out[mac] = icon as BoxIcon;
  }
  return out;
};

function read(storage: Storage | null): Saved | null {
  try {
    const text = storage?.getItem(STORE_KEY);
    if (text === undefined) return null;
    const raw: unknown = JSON.parse(text ?? 'null');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { selected: null, held: [], icons: {} };
    const r = raw as Record<string, unknown>;
    return {
      selected: typeof r.selected === 'string' ? r.selected : null,
      held: Array.isArray(r.held) && r.held.every(isHeld) ? r.held.map((h) => ({ mac: h.mac, name: h.name })) : [],
      icons: iconsOf(r.icons),
    };
  } catch {
    return null;
  }
}

// Rereads storage on every call, so tabs don't undo each other.
export function createBoxStore(storage: Storage | null): BoxStore {
  let saved: Saved = read(storage) ?? { selected: null, held: [], icons: {} };
  // Once a write fails, rereading would undo this page's own changes.
  let writable = true;
  const current = () => {
    if (writable) saved = read(storage) ?? saved;
    return saved;
  };
  const change = (fn: (s: Saved) => boolean) => {
    const s = current();
    if (!fn(s)) return;
    try {
      storage?.setItem(STORE_KEY, JSON.stringify(s));
    } catch {
      writable = false;
    }
  };
  return {
    selected: () => current().selected,
    setSelected: (key) =>
      change((s) => {
        s.selected = key;
        return true;
      }),
    held: () => current().held.map((h) => ({ ...h })),
    hold: (mac, name) =>
      change((s) => {
        const h = s.held.find((x) => x.mac === mac);
        if (h?.name === name) return false;
        if (h) h.name = name;
        else s.held.push({ mac, name });
        return true;
      }),
    release: (mac) =>
      change((s) => {
        s.held = s.held.filter((h) => h.mac !== mac);
        return true;
      }),
    icons: () => ({ ...current().icons }),
    setIcon: (mac, icon) =>
      change((s) => {
        if (icon === 'box') delete s.icons[mac];
        else s.icons[mac] = icon;
        return true;
      }),
  };
}
