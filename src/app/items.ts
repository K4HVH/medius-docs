// The address of one item on a page: a Help answer, a release or a device row. Each address opens its parent
// page at the item and has a link card naming the item. A #hash can't carry a card: it never reaches the server.
export type ItemKind = 'help' | 'release' | 'device';

export interface Item {
  kind: ItemKind;
  parent: string;
  id: string;
  // The id of the element the parent page lands on.
  target: string;
}

const PARENT: Record<ItemKind, string> = {
  help: '/guide/help',
  release: '/dashboard/changelog',
  device: '/guide/compatibility',
};

export const ITEM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function itemFor(pathname: string): Item | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  for (const kind of Object.keys(PARENT) as ItemKind[]) {
    const parent = PARENT[kind];
    if (!path.startsWith(`${parent}/`)) continue;
    const id = path.slice(parent.length + 1);
    if (!ITEM_ID.test(id)) return null;
    return { kind, parent, id, target: kind === 'device' ? `device-${id}` : id };
  }
  return null;
}

export function itemPath(kind: ItemKind, id: string): string {
  return `${PARENT[kind]}/${id}`;
}
