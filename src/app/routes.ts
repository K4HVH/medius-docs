import { ITEM_ID, type Item, itemFor } from './items';
import { MOVED } from './site';
import { lostPath } from './served';

// Every page's metadata, in sidebar order. Plain data, so the prerender and server can load it too.

export type Section = 'home' | 'guide' | 'native' | 'library' | 'bindings' | 'dashboard' | 'comparison' | 'ai' | 'notfound';
export type Lang = 'c' | 'python';
export type Kind = 'home' | 'article' | 'app';

export interface RouteInfo {
  path: string;
  section: Section;
  lang?: Lang;
  group?: string;
  nav: string;
  title: string;
  fullTitle?: string;
  description: string;
  kind: Kind;
  index: boolean;
}

export const SECTION_LABEL: Record<Section, string> = {
  home: 'Medius',
  guide: 'Guide',
  native: 'Native API',
  library: 'Rust Library',
  bindings: 'Bindings',
  dashboard: 'Dashboard',
  comparison: 'Comparison',
  ai: 'AI access',
  notfound: 'Medius',
};

export const SECTION_ROOT: Partial<Record<Section, string>> = {
  guide: '/guide',
  native: '/native',
  library: '/library',
  bindings: '/bindings',
  dashboard: '/dashboard',
  comparison: '/comparison',
  ai: '/ai',
};

export const LANG_LABEL: Record<Lang, string> = { c: 'C / C++', python: 'Python' };
export const LANG_ROOT: Record<Lang, string> = { c: '/bindings/c', python: '/bindings/python' };

type Entry = Omit<RouteInfo, 'kind' | 'index'> & { kind?: Kind; index?: boolean };

const guide = (path: string, nav: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'guide', group: 'Guide', nav, title, description, fullTitle });
const native = (path: string, group: string, nav: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'native', group, nav, title, description, fullTitle });
const library = (path: string, group: string, nav: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'library', group, nav, title, description, fullTitle });
const binding = (lang: Lang, sub: string, group: string, nav: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path: LANG_ROOT[lang] + sub, section: 'bindings', lang, group, nav, title, description, fullTitle });
const dashboard = (path: string, nav: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'dashboard', group: 'Dashboard', nav, title, description, fullTitle, kind: 'app' });
const comparison = (path: string, nav: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'comparison', group: 'Comparison', nav, title, description, fullTitle });

const ENTRIES: Entry[] = [
  {
    path: '/', section: 'home', nav: 'Home', title: 'Medius', kind: 'home',
    fullTitle: 'Medius: replacement firmware for the MAKCU box',
    description: 'Medius is replacement firmware for the MAKCU box: it clones your mouse or keyboard to the PC and injects input sent over an open protocol.',
  },

  guide('/guide', 'Start here', 'Start here',
    'Start with Medius on a MAKCU box: which port goes where, what you need to install it from Chrome or Edge, then install, update, devices and help.',
    'Install Medius on a MAKCU box: start here'),
  guide('/guide/compatibility', 'Devices', 'Devices',
    'Owners\' reports of mice and keyboards through a MAKCU box on Medius: the release each was reported on, the box\'s limits, and the fixes some need.',
    'MAKCU compatibility: mice and keyboards · Medius'),
  guide('/guide/options', 'Options', 'Options',
    'Every option on the Medius dashboard for a MAKCU box: what each value does, the default, when to change it, and what it costs in delay or faithfulness.',
    'Medius options explained: imperfect clone, wire rate, render and more'),
  guide('/guide/help', 'Help', 'Help',
    'Troubleshooting and FAQ for MAKCU owners on Medius: install and connection messages, mice and keyboards, updates and rollback, software and Windows.',
    'Medius help: MAKCU troubleshooting and FAQ'),
  guide('/guide/privacy', 'Privacy', 'Privacy',
    'What the Medius site, the dashboard and the Discord bot keep, for how long, and how to have it deleted.',
    'Medius privacy: the site, usage stats and the Discord bot'),

  native('/native', 'Overview', 'Introduction', 'Native API',
    'The Medius control protocol for the MAKCU box: the frames and commands a program sends over the USB-serial port to inject input.',
    'Native API: the MAKCU box control protocol · Medius'),
  native('/native/quickstart', 'Overview', 'Quickstart', 'Quickstart',
    'Wire a MAKCU box running Medius, open the 6 Mbaud serial port, send a first MOVE frame, then check the path with HEALTH.'),
  native('/native/architecture', 'Overview', 'Architecture', 'Architecture',
    'How a Medius box presents a clone of the real mouse or keyboard to the game PC, relays its native reports, and adds injected input.'),
  native('/native/hardware', 'Overview', 'Hardware', 'Hardware',
    "The MAKCU box's three USB ports, which cable goes where, the USB1 and USB3 power hazard, and unplugging safely."),
  native('/native/transport', 'Protocol', 'Transport', 'Transport',
    'The control link: a CH343 USB-serial port at a fixed 6 Mbaud carrying binary frames only, and the USB ID that identifies the box.'),
  native('/native/connection', 'Protocol', 'Connection', 'Connection',
    'Open the serial port, find the Medius box, and confirm its protocol version with one QUERY(VERSION) round trip or the boot hello.'),
  native('/native/frame', 'Protocol', 'Frame format', 'Frame format',
    'The one packet shape every Medius message uses: sync byte, TYPE, SEQ, length, payload and CRC16, plus the full opcode list.'),
  native('/native/injection', 'Protocol', 'Injection model', 'Injection model',
    'How injected input adds to native input: axes and usages, MOVE and INJECT, reports at the native report rate, and the safety rules.'),
  native('/native/commands/inject', 'Commands', 'Inject', 'Inject',
    'INJECT (0x03): press or release a mouse button, keyboard key or media key on top of native input, named by class and usage id.'),
  native('/native/commands/move', 'Commands', 'Move', 'Move',
    "MOVE (0x01): inject relative cursor motion, wheel scroll or horizontal pan, summed with native motion in one report."),
  native('/native/commands/lock', 'Commands', 'Lock', 'Lock',
    'LOCK (0x0A): set how much of one native input reaches the game PC, from blocked to amplified, per class, axis or bearing.'),
  native('/native/commands/catch', 'Commands', 'Catch', 'Catch',
    'CATCH (0x0B): subscribe to traffic through the box, from native input events to vendor endpoints, control transfers and bus events.'),
  native('/native/commands/transform', 'Commands', 'Transform', 'Transform',
    'TRANSFORM (0x1E): swap or remap one declared field of the cloned device into another, such as a mouse button onto a key.'),
  native('/native/commands/option', 'Commands', 'Option', 'Option',
    'OPTION (0x11): set a persistent box option by id: imperfect cloning, movement riding, emit pace, box name, bearing and more.'),
  native('/native/commands/clip', 'Commands', 'Clip', 'Clip',
    "CLIP_APPEND, CLIP_CTRL, CLIP_SET and CLIP_TRIGGER: preload input frame by frame and play it back on the box's clock."),
  native('/native/commands/requests', 'Commands', 'Requests', 'Requests',
    'QUERY (0x05) and RESP (0x06): read the box version, health, cloned device, capabilities, report rate, stats and stored tables.'),
  native('/native/commands/led', 'Commands', 'LED', 'LED',
    "LED (0x09): override either chip's green status LED, or return it to showing the box status."),
  native('/native/commands/admin', 'Commands', 'Admin', 'Admin',
    'RESET (0x04), REBOOT (0x07) and LOG (0x08): return the box to passthrough, restart a chip, and read device log lines.'),
  native('/native/commands/update', 'Commands', 'Update', 'Update',
    'UPDATE (0x17): write new firmware to either chip of a running Medius box over the control port, in chunks, then activate it.'),
  native('/native/commands/usage', 'Commands', 'Usage IDs', 'Usage IDs',
    'The ids INJECT and LOCK take: mouse button ids, HID keyboard usages for keys and modifiers, and Consumer usages for media keys.'),
  native('/native/commands/raw', 'Advanced control', 'Raw', 'Raw',
    'RAW (0x19): put one packet or bulk transfer, byte for byte, on a cloned endpoint, toward the game PC or the real device.'),
  native('/native/commands/transfer', 'Advanced control', 'Transfer', 'Transfer',
    'TRANSFER (0x1A): run one USB control request on the real device from the control PC and read the reply in TRANSFER_RESP.'),
  native('/native/commands/rewrite', 'Advanced control', 'Rewrite', 'Rewrite',
    'REWRITE (0x1C): up to 32 rules that match packets in flight and pass, drop, patch, replace, answer or refuse them.'),
  native('/native/commands/patch', 'Advanced control', 'Patch', 'Patch',
    'PATCH (0x1D): store byte overwrites for the descriptors the clone presents, kept per device VID:PID across reboots.'),
  native('/native/flashing', 'Reference', 'Flashing', 'Flashing',
    "Install Medius on a MAKCU box chip by chip, or recover a chip whose firmware won't boot, when an update over the control port can't."),
  native('/native/troubleshooting', 'Reference', 'Troubleshooting', 'Troubleshooting',
    'Fixes for common Medius problems: no reply to QUERY(VERSION), injection that does nothing, buttons that release, a PC that shuts off.'),

  {
    path: '/ai', section: 'ai', group: 'AI access', nav: 'AI & LLMs', title: 'AI and LLM access',
    fullTitle: 'Medius docs for AI agents and LLMs',
    description: 'Read the Medius docs from an AI agent: a Markdown twin of every page, llms.txt and llms-full.txt, and a read-only MCP server.',
  },

  library('/library', 'Getting started', 'Introduction', 'Rust Library',
    'The medius Rust crate: open a MAKCU box running Medius, inject mouse, keyboard and media input, and read what the box reports.',
    'Rust library for MAKCU boxes · Medius'),
  library('/library/connection', 'Getting started', 'Connection', 'Connection',
    'Open a Device in Rust: auto-detect the box or name its port, run the handshake in the same call, and release it by dropping the handle.'),
  library('/library/discovery', 'Getting started', 'Discovery', 'Discovery',
    'List every connected Medius box from Rust, open one by its stable identity, or open the first box cloning a mouse or a keyboard.'),
  library('/library/inject', 'API', 'Inject', 'Inject',
    'inject, press, release and force_release: drive a mouse button, keyboard key or media key from Rust, one INJECT frame each.'),
  library('/library/move', 'API', 'Move', 'Move',
    'move_axis, move_rel, wheel and pan: inject cursor motion and scrolling from Rust, plus _now variants that skip movement riding.'),
  library('/library/lock', 'API', 'Lock', 'Lock',
    'scale, lock, unlock and their axis and class variants: set how much native input reaches the game PC, from Rust.'),
  library('/library/catch', 'API', 'Catch', 'Catch',
    'input_events and catch_events: subscribe from Rust to decoded press and release edges or to the raw traffic stream through the box.'),
  library('/library/transform', 'API', 'Transform', 'Transform',
    'transform, transform_swap, transform_remap and untransform: swap or remap fields of the cloned device from Rust.'),
  library('/library/options', 'API', 'Options', 'Options',
    'The seven persistent box settings from Rust, each set and read separately: imperfect cloning, movement riding, emit pace, name and more.'),
  library('/library/clip', 'API', 'Clip', 'Clip',
    'ClipBuilder and ClipHandle: build per-frame input in Rust, load it onto the box, and drive its playback and triggers.'),
  library('/library/requests', 'API', 'Requests', 'Requests',
    'Blocking queries from Rust: query_version, query_health, device_info, caps, query_rate, query_stats, query_locks and query_catch.'),
  library('/library/led', 'API', 'LED', 'LED',
    "led: override one of the box's two green status LEDs from Rust, or set LedMode::Auto to return it to the status display."),
  library('/library/admin', 'API', 'Admin', 'Admin',
    'reset, factory_reset and reboot: return the box to passthrough, erase what it stores, or restart either chip, from Rust.'),
  library('/library/update', 'API', 'Update', 'Update',
    'stage_firmware, activate_firmware and update_firmware: update either chip of a Medius box from Rust over the open connection.'),
  library('/library/lifecycle', 'API', 'Lifecycle', 'Lifecycle',
    'reapply and reconnect: keep held overrides past the silence timeout and restore them after a dropped link, from Rust.'),
  library('/library/diagnostics', 'API', 'Logs & counters', 'Logs & counters',
    "logs and counters: read the box's log stream and the link's frame statistics from Rust without blocking."),
  library('/library/advanced/raw', 'Advanced control', 'Raw injection', 'Raw injection',
    'raw: put a report on a cloned endpoint byte for byte from Rust, bypassing the semantic model, behind the imperfect-clone opt-in.'),
  library('/library/advanced/transfer', 'Advanced control', 'Control transfers', 'Control transfers',
    'transfer: run one USB control request on the real device behind the box from Rust and read the reply as a TransferOutcome.'),
  library('/library/advanced/rewrite', 'Advanced control', 'Rewrite rules', 'Rewrite rules',
    'set_rewrite, remove_rewrite, clear_rewrite and the queries: rewrite, answer, refuse or drop matched packets from Rust.'),
  library('/library/advanced/patch', 'Advanced control', 'Descriptor patches', 'Descriptor patches',
    'set_patch, apply_patch, clear_patch and query_patches: overwrite the descriptor bytes the clone presents, per device, from Rust.'),
  library('/library/features/async', 'Features', 'Async', 'Async',
    'AsyncDevice: the same Medius connection with every query as a future, on any executor, behind the async cargo feature.'),
  library('/library/features/mock', 'Features', 'Mock', 'Mock',
    'MockBox: an in-process fake Medius box for testing Rust code without hardware, with scripted replies and recorded frames.'),
  library('/library/features/tracing', 'Features', 'Tracing', 'Tracing',
    'The tracing cargo feature: spans and events for the link, frames, device logs and reconnects, read by any tracing subscriber.'),
  library('/library/guides/calls', 'Guides', 'Calls & input', 'Calls and input',
    'The three kinds of medius call (fire-and-forget, blocking query, no round-trip), query timeouts, and smooth motion in Rust.'),
  library('/library/guides/connection', 'Guides', 'Connection', 'Connection guide',
    'Choosing a port when several boxes are plugged in, sharing one connection across threads, keepalive and holds, and releasing it.'),
  library('/library/guides/testing', 'Guides', 'Testing', 'Testing guide',
    'Test Rust code that drives a Medius box without hardware: assert the frames sent, push log lines, and run a MockBox under async.'),
  library('/library/types', 'Reference', 'Types overview', 'Types & errors',
    'Every public type of the medius crate, re-exported at the crate root: enums, structs, frame types and the Error enum.'),
  library('/library/types/enums', 'Reference', 'Enums', 'Enums',
    "The medius crate's enums, each tied to a wire byte: DeviceKind, Action, Class, CatchClass, TrafficClass, Capture and more."),
  library('/library/types/structs', 'Reference', 'Structs', 'Structs',
    'The values a Medius box reports back to Rust: Version, Health, DeviceInfo, Caps, MouseCaps, Rate, Stats and more.'),
  library('/library/types/frames', 'Reference', 'Frames', 'Frames',
    'FrameType and DecodedFrame: low-level Rust types for inspecting the raw frame traffic between a program and the box.'),
  library('/library/types/errors', 'Reference', 'Errors', 'Errors',
    'The medius Error enum and the Result alias every fallible call returns, with what each variant means.'),

  {
    path: '/bindings', section: 'bindings', group: 'Bindings', nav: 'Overview', title: 'Bindings',
    fullTitle: 'C, C++ and Python libraries for MAKCU boxes · Medius',
    description: 'Drive a MAKCU box running Medius from C, C++ or Python: which binding to pick, and what each one covers.',
  },
  binding('c', '', 'Getting started', 'Install', 'Install',
    'Install the Medius C and C++ library: download the release archive for your platform, then build against medius.h and link.'),
  binding('c', '/quickstart', 'Getting started', 'First program', 'First program',
    'A first C program for a Medius box: connect, read the firmware version, move, click, wait for one input event, and free.'),
  binding('c', '/usage', 'Usage', 'Calls & errors', 'Calls & errors',
    'How the C binding behaves: fire-and-forget and blocking calls, MediusStatus codes and the last error, handle lifetime, builders.'),
  binding('c', '/streams', 'Usage', 'Streams', 'Streams',
    'Live streams in C: subscribe to raw catch events, decoded input edges or device logs, and read fixed-size events off the handle.'),
  binding('c', '/api', 'Reference', 'API index', 'API index',
    'Every medius_* function in medius.h, grouped by task and linked to what it does on the box.'),
  binding('c', '/types', 'Reference', 'Types & errors', 'Types & errors',
    'Every C struct, enum, status code and sizing constant in medius.h, linked to what each value means.'),
  binding('c', '/build', 'Build', 'Build & features', 'Build & features',
    'Linking the Medius C library: compiler and linker flags, the off-by-default mock feature, and the prebuilt release archives.'),
  binding('python', '', 'Getting started', 'Install', 'Install',
    'pip install medius: the Python library for MAKCU boxes running Medius, with its requirements, a version check and a first connection.',
    'Python library for MAKCU boxes: install · Medius'),
  binding('python', '/quickstart', 'Getting started', 'First program', 'First program',
    'A first Python program for a Medius box: find the box, move the cursor, click, and read one native input event.'),
  binding('python', '/usage', 'Usage', 'Calls & errors', 'Calls & errors',
    'How the Python binding behaves: blocking and fire-and-forget calls, MediusError and its subclasses, handle lifetime, builders.'),
  binding('python', '/streams', 'Usage', 'Streams', 'Streams',
    'Live streams in Python: subscribe to input events or device logs, and read them blocking, polled, with a timeout, or iterated.'),
  binding('python', '/api', 'Reference', 'API index', 'API index',
    'Every Device call in the medius Python package, grouped by task and linked to what it does on the box.'),
  binding('python', '/types', 'Reference', 'Types & errors', 'Types & errors',
    'Every enum, dataclass and exception in the medius Python package, linked to what each value means.'),
  binding('python', '/build', 'Build', 'Build & features', 'Build & features',
    'Building the medius Python package from source, enabling its mock feature, and how it finds the native library.'),

  dashboard('/dashboard/setup', 'Set up', 'Set up',
    'The Medius installer: flash each chip of a MAKCU box over USB from Chrome or Edge, one step at a time, then wire the box.'),
  dashboard('/dashboard', 'Device', 'Device',
    'Connect a MAKCU box running Medius from Chrome or Edge, no driver needed, and see its firmware, health, cloned device and log.',
    'MAKCU box dashboard in the browser · Medius'),
  dashboard('/dashboard/control', 'Control', 'Control',
    'Test a connected Medius box from the browser: inject input, lock and transform input, catch events, play clips, drive the LED, and more.'),
  dashboard('/dashboard/update', 'Update', 'Update',
    'The Medius updater: both chips of a MAKCU box to the latest firmware in one click from Chrome or Edge.'),
  dashboard('/dashboard/flash', 'Flash', 'Flash',
    "Flash a MAKCU box by hand from Chrome or Edge: any Medius release from v3.2.0 on, a .bin file, or MAKCU's stock firmware."),
  dashboard('/dashboard/changelog', 'Changelog', 'Changelog',
    'Every Medius firmware release for the MAKCU box: what changed for users, with the full commit list under each one.',
    'Medius firmware changelog'),
  dashboard('/dashboard/stats', 'Stats', 'Usage stats',
    'Public usage counts for Medius: boxes, cloned devices, firmware versions, flashes, countries and the systems the dashboard runs on.'),

  comparison('/comparison', 'Overview', 'Stock vs Medius',
    'MAKCU stock firmware against Medius, measured the same way: devices, passthrough, injected motion, control link, buttons, recovery, features, software.',
    'MAKCU stock firmware vs Medius'),
  comparison('/comparison/devices', 'Devices', 'Devices',
    'Which USB devices MAKCU stock firmware and Medius clone, how faithful each clone is, endpoint 0 replies and clone time.'),
  comparison('/comparison/passthrough', 'Passthrough', 'Passthrough',
    'A device relayed through MAKCU stock firmware and Medius: reports kept in order, relay timing, reads while injecting, and traffic with the real device.'),
  comparison('/comparison/injection', 'Injected motion', 'Injected motion',
    'Injected moves on MAKCU stock firmware and Medius: latency, reports per move, reports the box adds, totals, and a freshly cloned device.'),
  comparison('/comparison/control-link', 'Control link', 'Control link',
    'Query round trips on MAKCU stock firmware and Medius, and what malformed input on the control port does.'),
  comparison('/comparison/input', 'Buttons and keys', 'Buttons, keys and locks',
    'Buttons, keys and locks on MAKCU stock firmware and Medius: native and injected presses held together, and native input through a lock.'),
  comparison('/comparison/recovery', 'Recovery', 'Recovery',
    'What MAKCU stock firmware and Medius do when a program stops sending, the real device is replugged, or the PC restarts or sleeps.'),
  comparison('/comparison/features', 'Features', 'Features',
    'What the commands of MAKCU stock firmware and Medius can do: motion, buttons, keys, locks, game pads, USB traffic and the box itself.'),
  comparison('/comparison/software', 'Software', 'Software',
    'The software around MAKCU stock firmware and Medius: owner tools, programs for other boxes, libraries, updates, data sent, docs, adoption and community.'),
  comparison('/comparison/method', 'Method', 'Method',
    'How MAKCU stock firmware and Medius were measured: the rig, the rules every result follows, timing layers, and the data.'),
];

export const ROUTES: readonly RouteInfo[] = ENTRIES.map((e) => ({ ...e, kind: e.kind ?? 'article', index: e.index ?? true }));

export const NOT_FOUND: RouteInfo = {
  path: '/404',
  section: 'notfound',
  nav: 'Not found',
 
  title: 'Page not found',
  fullTitle: 'Page not found · Medius',
  description: 'There is no Medius page at this address. Set up, the dashboard and the developer docs are linked below.',
  kind: 'article',
  index: false,
};

const BY_PATH = new Map(ROUTES.map((r) => [r.path, r]));

export function routeFor(path: string): RouteInfo | undefined {
  return BY_PATH.get(path);
}

// An address inside a page: an item (items.ts), or a place on the page, `/page/id`. Home has no places.
// `alt`: on Devices, a section's id. Where the page has that section, the address lands on it before a
// device row of that name.
export interface Address extends Omit<Item, 'kind'> {
  kind: Item['kind'] | 'place';
  alt?: string;
}

// A place's id: lowercase letters, digits and hyphens, as the server's redirects spell an address. No dot,
// so a Markdown twin (/guide/compatibility.md) is never read as a place on the page above it.
export const PLACE_ID = /^[a-z0-9][a-z0-9-]*$/;
// A page that moved is served its redirect, never as a place on the page above it.
const MOVED_FROM = new Set(Object.keys(MOVED));

export function addressFor(pathname: string): Address | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (BY_PATH.has(path) || MOVED_FROM.has(path.toLowerCase())) return null;
  const item = itemFor(path);
  if (item) return item.kind === 'device' ? { ...item, alt: item.id } : item;
  const cut = path.lastIndexOf('/');
  const parent = path.slice(0, cut);
  const id = path.slice(cut + 1);
  if (cut <= 0 || !BY_PATH.has(parent) || !PLACE_ID.test(id)) return null;
  return { kind: 'place', parent, id, target: id };
}

// The id an address lands on: its hash (a link on the page), else the place or item its path names.
// `has`: whether the page holds an id, so a Devices section lands on its id before a device row's.
export function landingId(pathname: string, hash: string, has: (id: string) => boolean = () => false): string {
  if (hash.length > 1) {
    try {
      return decodeURIComponent(hash.slice(1));
    } catch {
      return '';
    }
  }
  const at = addressFor(pathname);
  if (!at) return '';
  return at.alt && has(at.alt) ? at.alt : at.target;
}

// A place's address, as copy link and the address bar write it. A device row or release gets its item's
// address (items.ts). Null on Home (no places), where a page is at that address or moved from it, and for
// an id no address can spell.
export function placeAddress(page: string, id: string): string | null {
  if (page === '/' || !BY_PATH.has(page)) return null;
  const device = page === '/guide/compatibility' && id.startsWith('device-');
  // A release's tag carries dots (v3.4.4).
  if (!(device || page === '/dashboard/changelog' ? ITEM_ID : PLACE_ID).test(id)) return null;
  const at = `${page}/${device ? id.slice('device-'.length) : id}`;
  return BY_PATH.has(at) || MOVED_FROM.has(at) ? null : at;
}

// The page a path shows: an address inside a page shows that page, unless the server served the
// 404 page for it.
export function pagePath(pathname: string): string {
  return pathname === lostPath ? pathname : (addressFor(pathname)?.parent ?? pathname);
}

export function sectionLabel(r: RouteInfo): string {
  return r.lang ? `${LANG_LABEL[r.lang]} bindings` : SECTION_LABEL[r.section];
}

export function documentTitle(r: RouteInfo): string {
  return r.fullTitle ?? `${r.title} · ${sectionLabel(r)} · Medius`;
}

export interface Crumb {
  label: string;
  href: string;
}

export function breadcrumbTrail(r: RouteInfo): Crumb[] {
  if (r.section === 'home') return [];
  const trail: Crumb[] = [{ label: 'Medius', href: '/' }];
  const root = SECTION_ROOT[r.section];
  if (root) trail.push({ label: r.section === 'ai' ? r.nav : SECTION_LABEL[r.section], href: root });
  if (r.lang) trail.push({ label: LANG_LABEL[r.lang], href: LANG_ROOT[r.lang] });
  const last = trail[trail.length - 1];
  if (r.path !== last.href && r.path !== NOT_FOUND.path) trail.push({ label: r.nav, href: r.path });
  return trail;
}

export interface SidebarGroup {
  label: string;
  routes: RouteInfo[];
}

// One list per section and language, built once and kept. The sidebar draws its links once, so a page
// change only moves the current page's mark, and the link the reader pressed keeps its focus.
const kept = new Map<string, SidebarGroup[]>();
export function sidebarGroups(section: Section, lang?: Lang): SidebarGroup[] {
  const key = `${section}:${lang ?? ''}`;
  const known = kept.get(key);
  if (known) return known;
  const groups: SidebarGroup[] = [];
  kept.set(key, groups);
  for (const r of ROUTES) {
    if (r.section !== section || r.lang !== lang || !r.group) continue;
    const last = groups[groups.length - 1];
    if (last && last.label === r.group) last.routes.push(r);
    else groups.push({ label: r.group, routes: [r] });
  }
  return groups;
}
