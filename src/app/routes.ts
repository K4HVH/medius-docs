// Every page's metadata, in sidebar order. Plain data, so the prerender and server can load it too.

export type Section = 'home' | 'guide' | 'native' | 'library' | 'bindings' | 'dashboard' | 'ai' | 'notfound';
export type Lang = 'c' | 'python';
export type Kind = 'home' | 'article' | 'app';

export interface RouteInfo {
  path: string;
  section: Section;
  lang?: Lang;
  group?: string;
  nav: string;
  icon: string;
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
  ai: 'AI access',
  notfound: 'Medius',
};

export const SECTION_ROOT: Partial<Record<Section, string>> = {
  guide: '/guide',
  native: '/native',
  library: '/library',
  bindings: '/bindings',
  dashboard: '/dashboard',
  ai: '/ai',
};

export const LANG_LABEL: Record<Lang, string> = { c: 'C / C++', python: 'Python' };
export const LANG_ROOT: Record<Lang, string> = { c: '/bindings/c', python: '/bindings/python' };

type Entry = Omit<RouteInfo, 'kind' | 'index'> & { kind?: Kind; index?: boolean };

const guide = (path: string, nav: string, icon: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'guide', group: 'Guide', nav, icon, title, description, fullTitle });
const native = (path: string, group: string, nav: string, icon: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'native', group, nav, icon, title, description, fullTitle });
const library = (path: string, group: string, nav: string, icon: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'library', group, nav, icon, title, description, fullTitle });
const binding = (lang: Lang, sub: string, group: string, nav: string, icon: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path: LANG_ROOT[lang] + sub, section: 'bindings', lang, group, nav, icon, title, description, fullTitle });
const dashboard = (path: string, nav: string, icon: string, title: string, description: string, fullTitle?: string): Entry =>
  ({ path, section: 'dashboard', group: 'Dashboard', nav, icon, title, description, fullTitle, kind: 'app' });

const ENTRIES: Entry[] = [
  {
    path: '/', section: 'home', nav: 'Home', icon: 'BsHouseDoor', title: 'Medius', kind: 'home',
    fullTitle: 'Medius: replacement firmware for the MAKCU box',
    description: 'Medius is replacement firmware for the MAKCU box: it clones your mouse or keyboard to the PC and adds input sent over an open protocol.',
  },

  guide('/guide', 'Install', 'BsBoxArrowInDown', 'Install Medius on a MAKCU box',
    'Install Medius on a MAKCU box from Chrome or Edge in five steps: what you need, which port goes where, and what happens if a flash fails.',
    'Install Medius on a MAKCU box'),
  guide('/guide/update', 'Update', 'BsArrowRepeat', 'Update Medius on a MAKCU box',
    'Update a MAKCU box already running Medius in one click, when to use Set up instead, and how a failed update rolls itself back.',
    'Update Medius on a MAKCU box'),
  guide('/guide/compatibility', 'Compatibility', 'BsCpu', 'MAKCU compatibility: mice and keyboards',
    'Which mice and keyboards work through a MAKCU box running Medius, which need a setting changed, and how many boxes run each one.',
    'MAKCU compatibility: mice and keyboards · Medius'),
  guide('/guide/faq', 'FAQ', 'BsInfoCircle', 'Medius FAQ',
    'Answers for MAKCU owners about Medius: software support, price, controllers, browsers, drivers, and reporting a device that does not work.',
    'Medius FAQ'),
  guide('/guide/troubleshooting', 'Troubleshooting', 'BsExclamationTriangle', 'Troubleshooting a MAKCU box',
    'Fixes for common MAKCU box problems with Medius: the box is not found, a blue screen, a device that will not clone, an update that reverted.',
    'Troubleshooting a MAKCU box · Medius'),
  guide('/guide/device-fixes', 'Device fixes', 'BsWrench', 'Device fixes',
    'Settings that make specific mice and keyboards work through a MAKCU box running Medius, such as imperfect cloning and a forced report rate.',
    'Device fixes for the MAKCU box · Medius'),

  native('/native', 'Overview', 'Introduction', 'BsInfoCircle', 'Native API',
    'The Medius control protocol for the MAKCU box: the frames and commands a program sends over the USB-serial port to inject input.',
    'Native API: the MAKCU box control protocol · Medius'),
  native('/native/quickstart', 'Overview', 'Quickstart', 'BsLightning', 'Quickstart',
    'Wire a MAKCU box running Medius, open the 6 Mbaud serial port, send a first MOVE frame, then check the path with HEALTH.'),
  native('/native/architecture', 'Overview', 'Architecture', 'BsStack', 'Architecture',
    'How a Medius box presents a clone of the real mouse or keyboard to the game PC, passes its input through, and adds injected input.'),
  native('/native/hardware', 'Overview', 'Hardware', 'BsCpu', 'Hardware',
    "The MAKCU box's three USB ports, which cable goes where, the USB1 and USB3 power hazard, and unplugging safely."),
  native('/native/transport', 'Protocol', 'Transport', 'BsPlug', 'Transport',
    'The control link: a CH343 USB-serial port at a fixed 6 Mbaud carrying binary frames only, and the USB ID that identifies the box.'),
  native('/native/connection', 'Protocol', 'Connection', 'BsLink45deg', 'Connection',
    'Open the serial port, find the Medius box, and confirm its protocol version with one QUERY(VERSION) round trip or the boot hello.'),
  native('/native/frame', 'Protocol', 'Frame Format', 'BsFileCode', 'Frame format',
    'The one packet shape every Medius message uses: sync byte, TYPE, SEQ, length, payload and CRC16, plus the full opcode list.'),
  native('/native/injection', 'Protocol', 'Injection Model', 'BsBroadcast', 'Injection model',
    "How injected input adds to the real device's: axes and usages, MOVE and INJECT, reports at the native rate, and the safety clear."),
  native('/native/commands/inject', 'Commands', 'Inject', 'BsCursor', 'Inject',
    'INJECT (0x03): press or release a mouse button, keyboard key or media key on top of physical input, named by class and usage id.'),
  native('/native/commands/move', 'Commands', 'Move', 'BsArrowsMove', 'Move',
    "MOVE (0x01): inject relative cursor motion, wheel scroll or horizontal pan, summed with the real mouse's motion in one report."),
  native('/native/commands/lock', 'Commands', 'Lock', 'BsLock', 'Lock',
    'LOCK (0x0A): set how much of one physical input reaches the game PC, from blocked to amplified, per class, axis or bearing.'),
  native('/native/commands/catch', 'Commands', 'Catch', 'BsActivity', 'Catch',
    'CATCH (0x0B): subscribe to traffic through the box, from physical input events to vendor endpoints, control transfers and bus events.'),
  native('/native/commands/transform', 'Commands', 'Transform', 'BsSliders', 'Transform',
    'TRANSFORM (0x1E): swap or remap one declared field of the cloned device into another, such as a mouse button onto a key.'),
  native('/native/commands/option', 'Commands', 'Option', 'BsPuzzle', 'Option',
    'OPTION (0x11): set a persistent box option by id: imperfect cloning, movement riding, emit pace, box name, bearing and more.'),
  native('/native/commands/clip', 'Commands', 'Clip', 'BsStack', 'Clip',
    "CLIP_APPEND, CLIP_CTRL, CLIP_SET and CLIP_TRIGGER: preload input frame by frame and play it back on the box's clock."),
  native('/native/commands/requests', 'Commands', 'Requests', 'BsArrowLeftRight', 'Requests',
    'QUERY (0x05) and RESP (0x06): read the box version, health, cloned device, capabilities, report rate, stats and stored tables.'),
  native('/native/commands/led', 'Commands', 'LED', 'BsLightbulb', 'LED',
    "LED (0x09): override either chip's green status LED, or return it to showing the box status."),
  native('/native/commands/admin', 'Commands', 'Admin', 'BsGear', 'Admin',
    'RESET (0x04), REBOOT (0x07) and LOG (0x08): return the box to passthrough, restart a chip, and read device log lines.'),
  native('/native/commands/update', 'Commands', 'Update', 'BsDownload', 'Update',
    'UPDATE (0x17): write new firmware to either chip of a running Medius box over the control port, in chunks, then activate it.'),
  native('/native/commands/usage', 'Commands', 'Usage IDs', 'BsHash', 'Usage IDs',
    'The ids INJECT and LOCK take: mouse button ids, HID keyboard usages for keys and modifiers, and Consumer usages for media keys.'),
  native('/native/commands/raw', 'Advanced control', 'Raw', 'BsBroadcast', 'Raw',
    'RAW (0x19): put one packet or bulk transfer, byte for byte, on a cloned endpoint, toward the game PC or the real device.'),
  native('/native/commands/transfer', 'Advanced control', 'Transfer', 'BsArrowLeftRight', 'Transfer',
    'TRANSFER (0x1A): run one USB control request on the real device from the control PC and read the reply in TRANSFER_RESP.'),
  native('/native/commands/rewrite', 'Advanced control', 'Rewrite', 'BsCodeSlash', 'Rewrite',
    'REWRITE (0x1C): up to 32 rules that match packets in flight and pass, drop, patch, replace, answer or refuse them.'),
  native('/native/commands/patch', 'Advanced control', 'Patch', 'BsFileCode', 'Patch',
    'PATCH (0x1D): store byte overwrites for the descriptors the clone presents, kept per device VID:PID across reboots.'),
  native('/native/flashing', 'Reference', 'Flashing', 'BsBoxArrowInDown', 'Flashing',
    "Install Medius on a MAKCU box chip by chip, or recover a chip whose firmware won't boot, when an update over the control port can't."),
  native('/native/troubleshooting', 'Reference', 'Troubleshooting', 'BsExclamationTriangle', 'Troubleshooting',
    'Fixes for common Medius problems: no reply to QUERY(VERSION), injection that does nothing, buttons that release, a PC that shuts off.'),

  {
    path: '/ai', section: 'ai', group: 'AI Access', nav: 'AI & LLMs', icon: 'BsStars', title: 'AI and LLM access',
    fullTitle: 'Medius docs for AI agents and LLMs',
    description: 'Read the Medius docs from an AI agent: a Markdown twin of every page, llms.txt and llms-full.txt, and a read-only MCP server.',
  },

  library('/library', 'Getting Started', 'Introduction', 'BsInfoCircle', 'Rust Library',
    'The medius Rust crate: open a MAKCU box running Medius, inject mouse, keyboard and media input, and read what the box reports.',
    'Rust library for MAKCU boxes · Medius'),
  library('/library/connection', 'Getting Started', 'Connection', 'BsLink45deg', 'Connection',
    'Open a Device in Rust: auto-detect the box or name its port, run the handshake in the same call, and release it by dropping the handle.'),
  library('/library/discovery', 'Getting Started', 'Discovery', 'BsBoxes', 'Discovery',
    'List every connected Medius box from Rust, open one by its stable identity, or open the first box cloning a mouse or a keyboard.'),
  library('/library/inject', 'API', 'Inject', 'BsCursor', 'Inject',
    'inject, press, release and force_release: drive a mouse button, keyboard key or media key from Rust, one INJECT frame each.'),
  library('/library/move', 'API', 'Move', 'BsArrowsMove', 'Move',
    'move_axis, move_rel, wheel and pan: inject cursor motion and scrolling from Rust, plus _now variants that skip movement riding.'),
  library('/library/lock', 'API', 'Lock', 'BsLock', 'Lock',
    'scale, lock, unlock and their axis and class variants: set how much physical input reaches the game PC, from Rust.'),
  library('/library/catch', 'API', 'Catch', 'BsActivity', 'Catch',
    'input_events and catch_events: subscribe from Rust to decoded press and release edges or to the raw traffic stream through the box.'),
  library('/library/transform', 'API', 'Transform', 'BsSliders', 'Transform',
    'transform, transform_swap, transform_remap and untransform: swap or remap fields of the cloned device from Rust.'),
  library('/library/options', 'API', 'Options', 'BsPuzzle', 'Options',
    'The seven persistent box settings from Rust, each set and read separately: imperfect cloning, movement riding, emit pace, name and more.'),
  library('/library/clip', 'API', 'Clip', 'BsStack', 'Clip',
    'ClipBuilder and ClipHandle: build per-frame input in Rust, load it onto the box, and drive its playback and triggers.'),
  library('/library/requests', 'API', 'Requests', 'BsArrowLeftRight', 'Requests',
    'Blocking queries from Rust: query_version, query_health, device_info, caps, query_rate, query_stats, query_locks and query_catch.'),
  library('/library/led', 'API', 'LED', 'BsLightbulb', 'LED',
    "led: override one of the box's two green status LEDs from Rust, or set LedMode::Auto to return it to the status display."),
  library('/library/admin', 'API', 'Admin', 'BsGear', 'Admin',
    'reset, factory_reset and reboot: return the box to passthrough, erase what it stores, or restart either chip, from Rust.'),
  library('/library/update', 'API', 'Update', 'BsDownload', 'Update',
    'stage_firmware, activate_firmware and update_firmware: update either chip of a Medius box from Rust over the open connection.'),
  library('/library/lifecycle', 'API', 'Lifecycle', 'BsArrowRepeat', 'Lifecycle',
    'reapply and reconnect: keep held overrides past the silence timeout and restore them after a dropped link, from Rust.'),
  library('/library/diagnostics', 'API', 'Logs & Counters', 'BsJournalText', 'Logs & counters',
    "logs and counters: read the box's log stream and the link's frame statistics from Rust without blocking."),
  library('/library/advanced/raw', 'Advanced control', 'Raw injection', 'BsBroadcast', 'Raw injection',
    'raw: put a report on a cloned endpoint byte for byte from Rust, bypassing the semantic model, behind the imperfect-clone opt-in.'),
  library('/library/advanced/transfer', 'Advanced control', 'Control transfers', 'BsArrowLeftRight', 'Control transfers',
    'transfer: run one USB control request on the real device behind the box from Rust and read the reply as a TransferOutcome.'),
  library('/library/advanced/rewrite', 'Advanced control', 'Rewrite rules', 'BsCodeSlash', 'Rewrite rules',
    'set_rewrite, remove_rewrite, clear_rewrite and the queries: rewrite, answer, refuse or drop matched packets from Rust.'),
  library('/library/advanced/patch', 'Advanced control', 'Descriptor patches', 'BsFileCode', 'Descriptor patches',
    'set_patch, apply_patch, clear_patch and query_patches: overwrite the descriptor bytes the clone presents, per device, from Rust.'),
  library('/library/features/async', 'Features', 'Async', 'BsStars', 'Async',
    'AsyncDevice: the same Medius connection with every query as a future, on any executor, behind the async cargo feature.'),
  library('/library/features/mock', 'Features', 'Mock', 'BsWrench', 'Mock',
    'MockBox: an in-process fake Medius box for testing Rust code without hardware, with scripted replies and recorded frames.'),
  library('/library/features/tracing', 'Features', 'Tracing', 'BsActivity', 'Tracing',
    'The tracing cargo feature: spans and events for the link, frames, device logs and reconnects, read by any tracing subscriber.'),
  library('/library/guides/calls', 'Guides', 'Calls & input', 'BsLightning', 'Calls and input',
    'The three kinds of medius call (fire-and-forget, blocking query, no round-trip), query timeouts, and smooth motion in Rust.'),
  library('/library/guides/connection', 'Guides', 'Connection', 'BsArrowRepeat', 'Connection guide',
    'Choosing a port when several boxes are plugged in, sharing one connection across threads, keepalive and holds, and releasing it.'),
  library('/library/guides/testing', 'Guides', 'Testing', 'BsWrench', 'Testing guide',
    'Test Rust code that drives a Medius box without hardware: assert the frames sent, push log lines, and run a MockBox under async.'),
  library('/library/types', 'Reference', 'Types overview', 'BsFileCode', 'Types & errors',
    'Every public type of the medius crate, re-exported at the crate root: enums, structs, frame types and the Error enum.'),
  library('/library/types/enums', 'Reference', 'Enums', 'BsFileCode', 'Enums',
    "The medius crate's enums, each tied to a wire byte: DeviceKind, Action, Class, CatchClass, TrafficClass, Capture and more."),
  library('/library/types/structs', 'Reference', 'Structs', 'BsFileCode', 'Structs',
    'The values a Medius box reports back to Rust: Version, Health, DeviceInfo, Caps, MouseCaps, Rate, Stats and more.'),
  library('/library/types/frames', 'Reference', 'Frames', 'BsFileCode', 'Frames',
    'FrameType and DecodedFrame: low-level Rust types for inspecting the raw frame traffic between a program and the box.'),
  library('/library/types/errors', 'Reference', 'Errors', 'BsExclamationTriangle', 'Errors',
    'The medius Error enum and the Result alias every fallible call returns, with what each variant means.'),

  {
    path: '/bindings', section: 'bindings', group: 'Bindings', nav: 'Overview', icon: 'BsBoxes', title: 'Bindings',
    fullTitle: 'C, C++ and Python libraries for MAKCU boxes · Medius',
    description: 'Drive a MAKCU box running Medius from C, C++ or Python: which binding to pick, and what each one covers.',
  },
  binding('c', '', 'Getting Started', 'Install', 'BsBoxArrowInDown', 'Install',
    'Install the Medius C and C++ library: download the release archive for your platform, then build against medius.h and link.'),
  binding('c', '/quickstart', 'Getting Started', 'First program', 'BsLightning', 'First program',
    'A first C program for a Medius box: connect, read the firmware version, move, click, wait for one input event, and free.'),
  binding('c', '/usage', 'Usage', 'Calls & errors', 'BsTerminal', 'Calls & errors',
    'How the C binding behaves: fire-and-forget and blocking calls, MediusStatus codes and the last error, handle lifetime, builders.'),
  binding('c', '/streams', 'Usage', 'Streams', 'BsActivity', 'Streams',
    'Live streams in C: subscribe to raw catch events, decoded input edges or device logs, and read fixed-size events off the handle.'),
  binding('c', '/api', 'Reference', 'API index', 'BsList', 'API index',
    'Every medius_* function in medius.h, grouped by task and linked to what it does on the box.'),
  binding('c', '/types', 'Reference', 'Types & errors', 'BsFileCode', 'Types & errors',
    'Every C struct, enum, status code and sizing constant in medius.h, linked to what each value means.'),
  binding('c', '/build', 'Build', 'Build & features', 'BsWrench', 'Build & features',
    'Linking the Medius C library: compiler and linker flags, the off-by-default mock feature, and the prebuilt release archives.'),
  binding('python', '', 'Getting Started', 'Install', 'BsBoxArrowInDown', 'Install',
    'pip install medius: the Python library for MAKCU boxes running Medius, with its requirements, a version check and a first connection.',
    'Python library for MAKCU boxes: install · Medius'),
  binding('python', '/quickstart', 'Getting Started', 'First program', 'BsLightning', 'First program',
    'A first Python program for a Medius box: find the box, move the cursor, click, and read one physical input event.'),
  binding('python', '/usage', 'Usage', 'Calls & errors', 'BsTerminal', 'Calls & errors',
    'How the Python binding behaves: blocking and fire-and-forget calls, MediusError and its subclasses, handle lifetime, builders.'),
  binding('python', '/streams', 'Usage', 'Streams', 'BsActivity', 'Streams',
    'Live streams in Python: subscribe to input events or device logs, and read them blocking, polled, with a timeout, or iterated.'),
  binding('python', '/api', 'Reference', 'API index', 'BsList', 'API index',
    'Every Device call in the medius Python package, grouped by task and linked to what it does on the box.'),
  binding('python', '/types', 'Reference', 'Types & errors', 'BsFileCode', 'Types & errors',
    'Every enum, dataclass and exception in the medius Python package, linked to what each value means.'),
  binding('python', '/build', 'Build', 'Build & features', 'BsWrench', 'Build & features',
    'Building the medius Python package from source, enabling its mock feature, and how it finds the native library.'),

  dashboard('/dashboard/setup', 'Set up', 'BsUsbPlug', 'Set up',
    'The Medius installer: flash each chip of a MAKCU box over USB from Chrome or Edge, then wire the box. The Install guide explains each step.'),
  dashboard('/dashboard', 'Device', 'BsCpu', 'Device',
    'Connect a MAKCU box running Medius from Chrome or Edge, no driver needed, and see its firmware, health, cloned device and log.',
    'MAKCU box dashboard in the browser · Medius'),
  dashboard('/dashboard/control', 'Control', 'BsSliders', 'Control',
    'Test a connected Medius box from the browser: inject input, lock physical input, catch events, play clips, drive the LED.'),
  dashboard('/dashboard/advanced-control', 'Advanced control', 'BsCodeSlash', 'Advanced control',
    'Rewrite rules, descriptor patches, raw reports and control transfers for a connected Medius box, from the browser.'),
  dashboard('/dashboard/update', 'Update', 'BsArrowRepeat', 'Update',
    'The Medius updater: update both chips of a MAKCU box to the latest firmware in one click over the control port, from Chrome or Edge.'),
  dashboard('/dashboard/advanced', 'Advanced', 'BsBoxArrowInDown', 'Advanced',
    'Flash any firmware image onto either chip of a MAKCU box from the browser, from a release or a file of your own.',
    'Flash any firmware onto a MAKCU box · Medius'),
  dashboard('/dashboard/changelog', 'Changelog', 'BsJournalText', 'Changelog',
    'Every Medius firmware release for the MAKCU box: what changed for users, with the full commit list under each one.',
    'Medius firmware changelog'),
  dashboard('/dashboard/stats', 'Stats', 'BsBarChart', 'Usage stats',
    'Public usage counts for Medius: boxes, cloned devices, firmware versions, flashes, countries and the systems the dashboard runs on.'),
];

export const ROUTES: readonly RouteInfo[] = ENTRIES.map((e) => ({ ...e, kind: e.kind ?? 'article', index: e.index ?? true }));

export const NOT_FOUND: RouteInfo = {
  path: '/404',
  section: 'notfound',
  nav: 'Not found',
  icon: 'BsExclamationTriangle',
  title: 'Page not found',
  fullTitle: 'Page not found · Medius',
  description: 'There is no Medius page at this address. The Native API, the Rust library and the dashboard are linked below.',
  kind: 'article',
  index: false,
};

const BY_PATH = new Map(ROUTES.map((r) => [r.path, r]));

export function routeFor(path: string): RouteInfo | undefined {
  return BY_PATH.get(path);
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

export function sidebarGroups(section: Section, lang?: Lang): SidebarGroup[] {
  const groups: SidebarGroup[] = [];
  for (const r of ROUTES) {
    if (r.section !== section || r.lang !== lang || !r.group) continue;
    const last = groups[groups.length - 1];
    if (last && last.label === r.group) last.routes.push(r);
    else groups.push({ label: r.group, routes: [r] });
  }
  return groups;
}
