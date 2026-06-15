import type { Component } from 'solid-js';
import type { CommandPaletteItem } from '../components/navigation/CommandPalette';
import {
  BsInfoCircle, BsLightning, BsStack, BsCpu, BsPlug, BsLink45deg, BsFileCode,
  BsBroadcast, BsArrowsMove, BsCursor, BsArrowLeftRight, BsGear, BsBoxArrowInDown,
  BsExclamationTriangle, BsArrowRepeat, BsStars, BsWrench, BsJournalText, BsActivity,
} from 'solid-icons/bs';

interface SearchEntry {
  label: string;
  description?: string;
  path: string;
  group: string;
  icon?: Component;
  tags?: string[];
  keywords?: string[];
}

const entries: SearchEntry[] = [
  // ── Native API ──────────────────────────────────────────────────────────
  { label: 'Introduction', description: 'What Medius is and how to read the native docs', path: '/native', group: 'Native API', icon: BsInfoCircle, keywords: ['native', 'overview', 'start', 'protocol', 'medius'] },
  { label: 'Quickstart', description: 'Wire it up and send your first command', path: '/native/quickstart', group: 'Native API', icon: BsLightning, keywords: ['getting started', 'first command', 'example'] },
  { label: 'Wiring', description: 'The safe three-port layout', path: '/native/quickstart#wiring', group: 'Native API', icon: BsLightning, keywords: ['usb1', 'usb2', 'usb3', 'wiring', 'ports'] },
  { label: 'Open the link', description: 'Open the port at 4 Mbaud and speak binary', path: '/native/quickstart#open', group: 'Native API', icon: BsLightning, keywords: ['baud', 'open', 'serial', 'hello', '8N1'] },
  { label: 'Send a MOVE', description: 'Build and send a MOVE frame in Python', path: '/native/quickstart#first-move', group: 'Native API', icon: BsLightning, keywords: ['move', 'frame', 'crc', 'python', 'example'] },
  { label: 'Architecture', description: 'The mouse, box, and PC data path', path: '/native/architecture', group: 'Native API', icon: BsStack, keywords: ['clone', 'transparency', 'data flow', 'two chip'] },
  { label: 'Data path', description: 'Host chip clones, device chip presents, control PC injects', path: '/native/architecture#data-flow', group: 'Native API', icon: BsStack, keywords: ['host chip', 'device chip', 'clone', 'inject'] },
  { label: 'Transparency', description: 'Byte-identical clone, additive injection, native-equivalent idle', path: '/native/architecture#transparency', group: 'Native API', icon: BsStack, keywords: ['transparency', 'byte-identical', 'additive', 'guarantee'] },
  { label: 'Hardware', description: 'Three USB ports and the USB3 power hazard', path: '/native/hardware', group: 'Native API', icon: BsCpu, keywords: ['ports', 'esp32', 'ch343', 'wiring'] },
  { label: 'Ports', description: 'USB1 clone, USB2 control, USB3 mouse', path: '/native/hardware#ports', group: 'Native API', icon: BsCpu, keywords: ['usb1', 'usb2', 'usb3', 'port map'] },
  { label: 'USB3 power hazard', description: 'Never connect USB1 and USB3 to the same machine', path: '/native/hardware#hazard', group: 'Native API', icon: BsExclamationTriangle, keywords: ['hazard', 'back-feed', '5v', 'shutdown', 'battery'] },
  { label: 'Transport', description: '4 Mbaud framed serial, CH343, USB identity', path: '/native/transport', group: 'Native API', icon: BsPlug, keywords: ['baud', 'ch343', 'vid', 'pid', 'ttyACM'] },
  { label: 'Serial link', description: 'Fixed 4 Mbaud, framed-only, no baud dance', path: '/native/transport#serial', group: 'Native API', icon: BsPlug, keywords: ['4000000', 'framed', 'baud trap'] },
  { label: 'USB identity', description: 'CH343, VID 0x1A86 / PID 0x55D3', path: '/native/transport#usb-identity', group: 'Native API', icon: BsPlug, keywords: ['vid', 'pid', '0x1A86', '0x55D3', 'ttyACM', 'COM'] },
  { label: 'Connection & Handshake', description: 'Confirming a Medius box', path: '/native/connection', group: 'Native API', icon: BsLink45deg, keywords: ['handshake', 'hello', 'connect'] },
  { label: 'Handshake', description: 'Open, QUERY(VERSION), check proto_ver', path: '/native/connection#handshake', group: 'Native API', icon: BsLink45deg, keywords: ['handshake', 'proto_ver', 'version'] },
  { label: 'The ready hello', description: 'Unsolicited RESP(VERSION) with SEQ=0', path: '/native/connection#hello', group: 'Native API', icon: BsLink45deg, keywords: ['hello', 'ready', 'seq', 'boot', 'first contact'] },
  { label: 'Frame Format', description: 'The wire packet: SOF, opcode, length, payload, CRC', path: '/native/frame', group: 'Native API', icon: BsFileCode, keywords: ['frame', 'sof', '0xA5', 'packet', 'little-endian'] },
  { label: 'Frame layout', description: 'SOF, TYPE, SEQ, LEN, PAYLOAD, CRC16', path: '/native/frame#layout', group: 'Native API', icon: BsFileCode, keywords: ['layout', 'byte', 'fields', 'len'] },
  { label: 'Checksum (CRC16-CCITT)', description: 'Poly 0x1021, init 0xFFFF, resync, unknown opcode ignored', path: '/native/frame#crc', group: 'Native API', icon: BsFileCode, keywords: ['crc', 'crc16', 'ccitt', '0x1021', 'checksum', 'resync', 'forward compatible'] },
  { label: 'Sequence numbers', description: 'SEQ correlates a QUERY with its RESP', path: '/native/frame#seq', group: 'Native API', icon: BsFileCode, keywords: ['seq', 'sequence', 'correlate'] },
  { label: 'Opcodes', description: 'The full opcode table 0x01–0x08', path: '/native/frame#opcodes', group: 'Native API', icon: BsFileCode, keywords: ['opcode', 'type', 'table', '0x01', '0x08'] },
  { label: 'Example frame', description: 'An annotated MOVE frame', path: '/native/frame#example', group: 'Native API', icon: BsFileCode, keywords: ['example', 'hex', 'move'] },
  { label: 'Injection Model', description: 'How injection merges with the real mouse', path: '/native/injection', group: 'Native API', icon: BsBroadcast, keywords: ['injection', 'additive', 'merge', 'no-halving'] },
  { label: 'Fire-and-forget', description: 'No per-command ack; QUERY is the only round-trip', path: '/native/injection#fire-and-forget', group: 'Native API', icon: BsBroadcast, keywords: ['fire and forget', 'ack', '1 kHz', 'reconcile'] },
  { label: 'State & carry', description: 'Accumulators, overrides, carry-remainder', path: '/native/injection#state', group: 'Native API', icon: BsBroadcast, keywords: ['accumulator', 'carry', 'override', 'state'] },
  { label: 'Emission', description: 'One report per frame, physical plus accumulator, frame clock', path: '/native/injection#emission', group: 'Native API', icon: BsBroadcast, keywords: ['emission', 'frame clock', 'no coalescing', 'edge'] },
  { label: 'Safety & auto-clear', description: 'Silence timeout, force-release authority, no stuck input', path: '/native/injection#safety', group: 'Native API', icon: BsBroadcast, keywords: ['safety', 'silence', 'auto-clear', 'force-release', 'no-stuck', 'keepalive', '1000 ms'] },

  // ── Native Commands ─────────────────────────────────────────────────────
  { label: 'Movement', description: 'MOVE and WHEEL — relative pointer input', path: '/native/commands/movement', group: 'Native Commands', icon: BsArrowsMove, keywords: ['move', 'wheel', 'scroll', '0x01', '0x02'] },
  { label: 'MOVE', description: 'Relative cursor movement, opcode 0x01', path: '/native/commands/movement#move', group: 'Native Commands', icon: BsArrowsMove, keywords: ['move', '0x01', 'dx', 'dy', 'cursor'] },
  { label: 'WHEEL', description: 'Vertical scroll, opcode 0x02', path: '/native/commands/movement#wheel', group: 'Native Commands', icon: BsArrowsMove, keywords: ['wheel', 'scroll', '0x02', 'delta'] },
  { label: 'Buttons', description: 'Button overrides, opcode 0x03', path: '/native/commands/buttons', group: 'Native Commands', icon: BsCursor, keywords: ['button', 'press', 'release', '0x03'] },
  { label: 'BUTTON', description: 'id and action bytes, opcode 0x03', path: '/native/commands/buttons#button', group: 'Native Commands', icon: BsCursor, keywords: ['button', 'id', 'action', 'left', 'right', 'middle', 'side1', 'side2'] },
  { label: 'Button actions', description: 'press, soft-release, force-release', path: '/native/commands/buttons#button', group: 'Native Commands', icon: BsCursor, keywords: ['press', 'soft-release', 'force-release', 'authority'] },
  { label: 'Requests', description: 'QUERY and its RESP reply, opcodes 0x05 / 0x06', path: '/native/commands/requests', group: 'Native Commands', icon: BsArrowLeftRight, keywords: ['query', 'resp', 'request', '0x05', '0x06'] },
  { label: 'QUERY', description: 'Request a state snapshot, opcode 0x05', path: '/native/commands/requests#requests', group: 'Native Commands', icon: BsArrowLeftRight, keywords: ['query', 'what', '0x05'] },
  { label: 'VERSION', description: 'Firmware identity, what=0', path: '/native/commands/requests#version', group: 'Native Commands', icon: BsArrowLeftRight, keywords: ['version', 'proto_ver', 'firmware', 'hello'] },
  { label: 'HEALTH', description: 'Chain status flags, what=1', path: '/native/commands/requests#health', group: 'Native Commands', icon: BsArrowLeftRight, keywords: ['health', 'flags', 'link_up', 'mouse_attached', 'clone_configured', 'injection_active'] },
  { label: 'RESP', description: 'The reply, opcode 0x06', path: '/native/commands/requests#resp', group: 'Native Commands', icon: BsArrowLeftRight, keywords: ['resp', 'reply', '0x06', 'seq'] },
  { label: 'Admin', description: 'RESET, REBOOT, and LOG', path: '/native/commands/admin', group: 'Native Commands', icon: BsGear, keywords: ['admin', 'reset', 'reboot', 'log'] },
  { label: 'RESET', description: 'Back to pure passthrough, opcode 0x04', path: '/native/commands/admin#reset', group: 'Native Commands', icon: BsGear, keywords: ['reset', '0x04', 'clear', 'passthrough'] },
  { label: 'REBOOT', description: 'Reboot a chip for flashing or restart, opcode 0x07', path: '/native/commands/admin#reboot', group: 'Native Commands', icon: BsGear, keywords: ['reboot', 'download', 'flash', '0x07', 'target', 'esptool'] },
  { label: 'LOG', description: 'Device diagnostics, opcode 0x08', path: '/native/commands/admin#log', group: 'Native Commands', icon: BsGear, keywords: ['log', 'diagnostics', '0x08', 'level', 'console'] },

  // ── Reference ───────────────────────────────────────────────────────────
  { label: 'Flashing & Updates', description: 'Updating firmware on the two chips', path: '/native/flashing', group: 'Reference', icon: BsBoxArrowInDown, keywords: ['flash', 'esptool', 'update', 'version', 'download'] },
  { label: 'Two chips', description: 'Device over CH343, host over its own USB', path: '/native/flashing#two-chips', group: 'Reference', icon: BsBoxArrowInDown, keywords: ['device chip', 'host chip', 'download', 'esptool'] },
  { label: 'Version scheme', description: 'major.minor.patch, reported in RESP(VERSION)', path: '/native/flashing#version', group: 'Reference', icon: BsBoxArrowInDown, keywords: ['version', '0.1.0', 'single source'] },
  { label: 'Troubleshooting', description: 'Common problems and fixes', path: '/native/troubleshooting', group: 'Reference', icon: BsExclamationTriangle, keywords: ['troubleshoot', 'faq'] },
  { label: 'No reply to QUERY(VERSION)', description: 'Wrong baud, port held, or not a Medius box', path: '/native/troubleshooting#no-reply', group: 'Reference', icon: BsExclamationTriangle, keywords: ['no reply', 'baud', 'port held', 'handshake'] },
  { label: 'Injection does nothing', description: 'Check HEALTH: mouse attached, clone configured', path: '/native/troubleshooting#no-injection', group: 'Reference', icon: BsExclamationTriangle, keywords: ['no injection', 'health', 'clone', 'mouse'] },
  { label: 'A held button releases on its own', description: 'Silence auto-clear; send a keepalive', path: '/native/troubleshooting#button-stuck-release', group: 'Reference', icon: BsExclamationTriangle, keywords: ['stuck', 'release', 'silence', 'keepalive'] },
  { label: 'A machine shuts off or drains battery', description: 'USB1 and USB3 on the same machine', path: '/native/troubleshooting#shutdown', group: 'Reference', icon: BsExclamationTriangle, keywords: ['shutdown', 'battery', 'back-feed', 'hazard'] },
  { label: 'Serial port disappeared after REBOOT', description: 'The chip is in the ROM bootloader', path: '/native/troubleshooting#port-gone', group: 'Reference', icon: BsExclamationTriangle, keywords: ['port gone', 'bootloader', 'download', 'reboot'] },
  { label: 'No LOG frames', description: 'Only emitted while a control PC is attached', path: '/native/troubleshooting#no-logs', group: 'Reference', icon: BsExclamationTriangle, keywords: ['no logs', 'log', 'attached'] },
  { label: 'Types & Errors', description: 'Every public type and the Error enum', path: '/library/types', group: 'Reference', icon: BsFileCode, keywords: ['types', 'error', 'result', 'enum', 'struct'] },
  { label: 'Enums', description: 'Button, ButtonAction, RebootTarget, LogLevel', path: '/library/types#enums', group: 'Reference', icon: BsFileCode, keywords: ['enum', 'button', 'buttonaction', 'reboottarget', 'loglevel'] },
  { label: 'Structs', description: 'Version, Health, LogLine, PortInfo, CountersSnapshot', path: '/library/types#structs', group: 'Reference', icon: BsFileCode, keywords: ['struct', 'version', 'health', 'portinfo', 'counters'] },
  { label: 'Errors', description: 'Error variants and the Result alias', path: '/library/types#errors', group: 'Reference', icon: BsFileCode, keywords: ['error', 'result', 'notfound', 'querytimeout', 'badprotover', 'disconnected'] },

  // ── Rust Library ────────────────────────────────────────────────────────
  { label: 'Introduction', description: 'The official medius client', path: '/library', group: 'Rust Library', icon: BsInfoCircle, keywords: ['crate', 'medius', 'cargo add', 'features', 'install'] },
  { label: 'Installation', description: 'cargo add medius and the feature flags', path: '/library#installation', group: 'Rust Library', icon: BsInfoCircle, keywords: ['cargo add', 'features', 'async', 'mock', 'flash', 'tracing'] },
  { label: 'Quick start', description: 'Connect and send a few commands', path: '/library#quick-start', group: 'Rust Library', icon: BsInfoCircle, keywords: ['quick start', 'example', 'find'] },
  { label: 'Connecting', description: 'Open, find, handshake, threading', path: '/library/connection', group: 'Rust Library', icon: BsLink45deg, keywords: ['open', 'find', 'handshake', 'threading'] },
  { label: 'Open a device', description: 'Device::open, Device::find, find_medius', path: '/library/connection#open', group: 'Rust Library', icon: BsLink45deg, keywords: ['open', 'find', 'find_medius', 'vid', 'pid', 'notfound'] },
  { label: 'Handshake (library)', description: 'QUERY(VERSION), proto_ver check, error mapping', path: '/library/connection#handshake', group: 'Rust Library', icon: BsLink45deg, keywords: ['handshake', 'proto_ver', 'noreply', 'badprotover'] },
  { label: 'Zero config', description: 'No settings struct; the default constants', path: '/library/connection#zero-config', group: 'Rust Library', icon: BsLink45deg, keywords: ['zero config', 'default_query_timeout', 'default_keepalive_cadence'] },
  { label: 'Threading model', description: '&self, Send + Sync, reader and keepalive threads', path: '/library/connection#threading', group: 'Rust Library', icon: BsLink45deg, keywords: ['threading', 'send sync', 'arc', 'reader', 'drop'] },
  { label: 'Movement (library)', description: 'move_rel and wheel', path: '/library/movement', group: 'Rust Library', icon: BsArrowsMove, keywords: ['move_rel', 'wheel'] },
  { label: 'move_rel', description: 'Relative cursor movement', path: '/library/movement#move-rel', group: 'Rust Library', icon: BsArrowsMove, keywords: ['move_rel', 'dx', 'dy'] },
  { label: 'wheel', description: 'Scroll input', path: '/library/movement#wheel', group: 'Rust Library', icon: BsArrowsMove, keywords: ['wheel', 'delta', 'scroll'] },
  { label: 'Buttons (library)', description: 'press, soft_release, force_release, button', path: '/library/buttons', group: 'Rust Library', icon: BsCursor, keywords: ['press', 'soft_release', 'force_release', 'button', 'buttonaction'] },
  { label: 'Requests (library)', description: 'query_version and query_health', path: '/library/requests', group: 'Rust Library', icon: BsArrowLeftRight, keywords: ['query_version', 'query_health'] },
  { label: 'query_version', description: 'Firmware identity', path: '/library/requests#version', group: 'Rust Library', icon: BsArrowLeftRight, keywords: ['query_version', 'version'] },
  { label: 'query_health', description: 'Chain status', path: '/library/requests#health', group: 'Rust Library', icon: BsArrowLeftRight, keywords: ['query_health', 'health', 'ready'] },
  { label: 'Admin (library)', description: 'reset and reboot', path: '/library/admin', group: 'Rust Library', icon: BsGear, keywords: ['reset', 'reboot'] },
  { label: 'reset', description: 'Clear all injection', path: '/library/admin#reset', group: 'Rust Library', icon: BsGear, keywords: ['reset', 'clear', 'passthrough'] },
  { label: 'reboot', description: 'Restart or flash-mode a chip', path: '/library/admin#reboot', group: 'Rust Library', icon: BsGear, keywords: ['reboot', 'reboottarget', 'download', 'run'] },
  { label: 'Keepalive & Reconnect', description: 'Holding state and recovering the link', path: '/library/lifecycle', group: 'Rust Library', icon: BsArrowRepeat, keywords: ['keepalive', 'reconnect', 'reapply'] },
  { label: 'Keepalive', description: 'QUERY(HEALTH) holds a pressed button alive', path: '/library/lifecycle#keepalive', group: 'Rust Library', icon: BsArrowRepeat, keywords: ['keepalive', 'silence', 'hold'] },
  { label: 'Reapply', description: 'Re-send held overrides', path: '/library/lifecycle#reapply', group: 'Rust Library', icon: BsArrowRepeat, keywords: ['reapply'] },
  { label: 'Reconnect', description: 'Rescan, reopen, re-apply held state', path: '/library/lifecycle#reconnect', group: 'Rust Library', icon: BsArrowRepeat, keywords: ['reconnect', 'rescan', 'back-off'] },
  { label: 'Logs & Counters', description: 'logs() and counters()', path: '/library/diagnostics', group: 'Rust Library', icon: BsJournalText, keywords: ['logs', 'counters', 'logstream'] },
  { label: 'Logs', description: 'LogStream of device LOG frames', path: '/library/diagnostics#logs', group: 'Rust Library', icon: BsJournalText, keywords: ['logs', 'logstream', 'logline'] },
  { label: 'Counters', description: 'frames_tx, frames_rx, crc_drops, reconnects', path: '/library/diagnostics#counters', group: 'Rust Library', icon: BsJournalText, keywords: ['counters', 'frames_tx', 'crc_drops', 'reconnects'] },

  // ── Library Features ────────────────────────────────────────────────────
  { label: 'Async', description: 'AsyncDevice with any runtime', path: '/library/features/async', group: 'Library Features', icon: BsStars, keywords: ['async', 'asyncdevice', 'await', 'flume', 'runtime'] },
  { label: 'AsyncDevice', description: 'into_async, async queries', path: '/library/features/async#asyncdevice', group: 'Library Features', icon: BsStars, keywords: ['asyncdevice', 'into_async', 'await'] },
  { label: 'Mock', description: 'Test without hardware', path: '/library/features/mock', group: 'Library Features', icon: BsWrench, keywords: ['mock', 'mockbox', 'test', 'with_mock', 'open_mock'] },
  { label: 'Flash', description: 'Firmware flashing from Rust', path: '/library/features/flash', group: 'Library Features', icon: BsBoxArrowInDown, keywords: ['flash', 'esptool', 'firmware', 'download'] },
  { label: 'Tracing', description: 'Structured diagnostics over the link', path: '/library/features/tracing', group: 'Library Features', icon: BsActivity, keywords: ['tracing', 'instrumentation', 'spans', 'subscriber', 'logging', 'diagnostics'] },
  { label: 'What tracing instruments', description: 'Connect, keepalive, reconnect', path: '/library/features/tracing#coverage', group: 'Library Features', icon: BsActivity, keywords: ['tracing', 'coverage', 'lifecycle', 'spans', 'events'] },
];

export function buildSearchItems(navigate: (path: string) => void): CommandPaletteItem[] {
  return entries.map((entry, i) => ({
    id: `search-${i}`,
    label: entry.label,
    description: entry.description,
    icon: entry.icon,
    group: entry.group,
    tags: entry.tags,
    keywords: entry.keywords,
    onSelect: () => navigate(entry.path),
  }));
}
