// Which boxes this browser holds, and which one is selected, across reloads.

export interface HeldBox {
  mac: string;
  name: string;
}

export interface BoxStore {
  selected(): string | null;
  setSelected(key: string | null): void;
  held(): HeldBox[];
  hold(mac: string, name: string): void;
  release(mac: string): void;
}

export const STORE_KEY = 'medius.dashboard.boxes';

interface Saved {
  selected: string | null;
  held: HeldBox[];
}

const isHeld = (h: unknown): h is HeldBox =>
  typeof h === 'object' &&
  h !== null &&
  typeof (h as HeldBox).mac === 'string' &&
  typeof (h as HeldBox).name === 'string';

function read(storage: Storage | null): Saved {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(STORE_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { selected: null, held: [] };
    const r = raw as Record<string, unknown>;
    return {
      selected: typeof r.selected === 'string' ? r.selected : null,
      held: Array.isArray(r.held) && r.held.every(isHeld) ? r.held.map((h) => ({ mac: h.mac, name: h.name })) : [],
    };
  } catch {
    return { selected: null, held: [] };
  }
}

// Storage can be missing or throw (private windows, blocked site data); this page's copy still works.
export function createBoxStore(storage: Storage | null): BoxStore {
  const saved = read(storage);
  const write = () => {
    try {
      storage?.setItem(STORE_KEY, JSON.stringify(saved));
    } catch {
      /* this page's copy stands */
    }
  };
  return {
    selected: () => saved.selected,
    setSelected: (key) => {
      saved.selected = key;
      write();
    },
    held: () => saved.held.map((h) => ({ ...h })),
    hold: (mac, name) => {
      const h = saved.held.find((x) => x.mac === mac);
      if (h) {
        if (h.name === name) return;
        h.name = name;
      } else saved.held.push({ mac, name });
      write();
    },
    release: (mac) => {
      saved.held = saved.held.filter((h) => h.mac !== mac);
      write();
    },
  };
}
