// Names for the momentary usages the box addresses: mouse buttons, HID Keyboard/Keypad keycodes,
// and Consumer (media) usages. One vocabulary for every surface that names an input, so the lock
// picker, the injection picker, the clip trigger picker, and the catch log all read the same.
//
// The keyboard table is the whole Keyboard/Keypad page rather than a shortlist: the box will inject
// any usage, so a picker that only offers a handful is the client inventing a limit the firmware
// does not have.

import { INJ_BTN, INJ_KEY, INJ_MEDIA } from './opcode';

export interface NamedUsage {
  id: number;
  name: string;
  // Groups the pickers sort and section by. Not on the wire.
  group: string;
}

export const BUTTONS: NamedUsage[] = [
  { id: 0, name: 'Left', group: 'Mouse' },
  { id: 1, name: 'Right', group: 'Mouse' },
  { id: 2, name: 'Middle', group: 'Mouse' },
  { id: 3, name: 'Side 1', group: 'Mouse' },
  { id: 4, name: 'Side 2', group: 'Mouse' },
];

const letters = (): NamedUsage[] =>
  Array.from({ length: 26 }, (_, i) => ({
    id: 0x04 + i,
    name: String.fromCharCode(65 + i),
    group: 'Letters',
  }));

const digits = (): NamedUsage[] =>
  Array.from({ length: 10 }, (_, i) => ({
    id: 0x1e + i,
    name: String(((i + 1) % 10)),
    group: 'Digits',
  }));

const fnKeys = (): NamedUsage[] => [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: 0x3a + i,
    name: `F${i + 1}`,
    group: 'Function',
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: 0x68 + i,
    name: `F${i + 13}`,
    group: 'Function',
  })),
];

const keypad = (): NamedUsage[] => [
  { id: 0x53, name: 'Num Lock', group: 'Keypad' },
  { id: 0x54, name: 'Keypad /', group: 'Keypad' },
  { id: 0x55, name: 'Keypad *', group: 'Keypad' },
  { id: 0x56, name: 'Keypad -', group: 'Keypad' },
  { id: 0x57, name: 'Keypad +', group: 'Keypad' },
  { id: 0x58, name: 'Keypad Enter', group: 'Keypad' },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: 0x59 + i,
    name: `Keypad ${i + 1}`,
    group: 'Keypad',
  })),
  { id: 0x62, name: 'Keypad 0', group: 'Keypad' },
  { id: 0x63, name: 'Keypad .', group: 'Keypad' },
  { id: 0x67, name: 'Keypad =', group: 'Keypad' },
  { id: 0x85, name: 'Keypad ,', group: 'Keypad' },
];

export const KEYS: NamedUsage[] = [
  ...letters(),
  ...digits(),
  { id: 0x28, name: 'Enter', group: 'Control' },
  { id: 0x29, name: 'Escape', group: 'Control' },
  { id: 0x2a, name: 'Backspace', group: 'Control' },
  { id: 0x2b, name: 'Tab', group: 'Control' },
  { id: 0x2c, name: 'Space', group: 'Control' },
  { id: 0x2d, name: '- _', group: 'Punctuation' },
  { id: 0x2e, name: '= +', group: 'Punctuation' },
  { id: 0x2f, name: '[ {', group: 'Punctuation' },
  { id: 0x30, name: '] }', group: 'Punctuation' },
  { id: 0x31, name: '\\ |', group: 'Punctuation' },
  { id: 0x32, name: 'Non-US #', group: 'Punctuation' },
  { id: 0x33, name: '; :', group: 'Punctuation' },
  { id: 0x34, name: "' \"", group: 'Punctuation' },
  { id: 0x35, name: '` ~', group: 'Punctuation' },
  { id: 0x36, name: ', <', group: 'Punctuation' },
  { id: 0x37, name: '. >', group: 'Punctuation' },
  { id: 0x38, name: '/ ?', group: 'Punctuation' },
  { id: 0x39, name: 'Caps Lock', group: 'Control' },
  ...fnKeys(),
  { id: 0x46, name: 'Print Screen', group: 'Navigation' },
  { id: 0x47, name: 'Scroll Lock', group: 'Navigation' },
  { id: 0x48, name: 'Pause', group: 'Navigation' },
  { id: 0x49, name: 'Insert', group: 'Navigation' },
  { id: 0x4a, name: 'Home', group: 'Navigation' },
  { id: 0x4b, name: 'Page Up', group: 'Navigation' },
  { id: 0x4c, name: 'Delete', group: 'Navigation' },
  { id: 0x4d, name: 'End', group: 'Navigation' },
  { id: 0x4e, name: 'Page Down', group: 'Navigation' },
  { id: 0x4f, name: 'Right Arrow', group: 'Navigation' },
  { id: 0x50, name: 'Left Arrow', group: 'Navigation' },
  { id: 0x51, name: 'Down Arrow', group: 'Navigation' },
  { id: 0x52, name: 'Up Arrow', group: 'Navigation' },
  ...keypad(),
  { id: 0x64, name: 'Non-US \\', group: 'Punctuation' },
  { id: 0x65, name: 'Application', group: 'Control' },
  { id: 0x66, name: 'Power', group: 'Control' },
  { id: 0x74, name: 'Execute', group: 'Editing' },
  { id: 0x75, name: 'Help', group: 'Editing' },
  { id: 0x76, name: 'Menu', group: 'Editing' },
  { id: 0x77, name: 'Select', group: 'Editing' },
  { id: 0x78, name: 'Stop', group: 'Editing' },
  { id: 0x79, name: 'Again', group: 'Editing' },
  { id: 0x7a, name: 'Undo', group: 'Editing' },
  { id: 0x7b, name: 'Cut', group: 'Editing' },
  { id: 0x7c, name: 'Copy', group: 'Editing' },
  { id: 0x7d, name: 'Paste', group: 'Editing' },
  { id: 0x7e, name: 'Find', group: 'Editing' },
  { id: 0x7f, name: 'Mute', group: 'Control' },
  { id: 0x80, name: 'Volume Up', group: 'Control' },
  { id: 0x81, name: 'Volume Down', group: 'Control' },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: 0x87 + i,
    name: `International ${i + 1}`,
    group: 'International',
  })),
  ...Array.from({ length: 9 }, (_, i) => ({
    id: 0x90 + i,
    name: `Language ${i + 1}`,
    group: 'International',
  })),
  { id: 0xe0, name: 'Left Ctrl', group: 'Modifiers' },
  { id: 0xe1, name: 'Left Shift', group: 'Modifiers' },
  { id: 0xe2, name: 'Left Alt', group: 'Modifiers' },
  { id: 0xe3, name: 'Left GUI', group: 'Modifiers' },
  { id: 0xe4, name: 'Right Ctrl', group: 'Modifiers' },
  { id: 0xe5, name: 'Right Shift', group: 'Modifiers' },
  { id: 0xe6, name: 'Right Alt', group: 'Modifiers' },
  { id: 0xe7, name: 'Right GUI', group: 'Modifiers' },
];

// Consumer page usages a keyboard's media collection actually reports. 16-bit, so this is a subset
// by nature; the pickers accept a raw value alongside the table.
export const MEDIA: NamedUsage[] = [
  { id: 0xb0, name: 'Play', group: 'Transport' },
  { id: 0xb1, name: 'Pause', group: 'Transport' },
  { id: 0xb5, name: 'Next Track', group: 'Transport' },
  { id: 0xb6, name: 'Previous Track', group: 'Transport' },
  { id: 0xb7, name: 'Stop', group: 'Transport' },
  { id: 0xcd, name: 'Play / Pause', group: 'Transport' },
  { id: 0xe2, name: 'Mute', group: 'Volume' },
  { id: 0xe9, name: 'Volume Up', group: 'Volume' },
  { id: 0xea, name: 'Volume Down', group: 'Volume' },
  { id: 0x183, name: 'Media Player', group: 'Launch' },
  { id: 0x18a, name: 'Mail', group: 'Launch' },
  { id: 0x192, name: 'Calculator', group: 'Launch' },
  { id: 0x194, name: 'File Browser', group: 'Launch' },
  { id: 0x221, name: 'Search', group: 'Browser' },
  { id: 0x223, name: 'Home', group: 'Browser' },
  { id: 0x224, name: 'Back', group: 'Browser' },
  { id: 0x225, name: 'Forward', group: 'Browser' },
  { id: 0x226, name: 'Stop Browsing', group: 'Browser' },
  { id: 0x227, name: 'Refresh', group: 'Browser' },
  { id: 0x22a, name: 'Bookmarks', group: 'Browser' },
];

// The table for one INJECT class. Unknown class yields an empty table rather than throwing, so a
// caller rendering a class byte off the wire cannot crash the page on a value it did not expect.
export function usageTable(cls: number): NamedUsage[] {
  if (cls === INJ_BTN) return BUTTONS;
  if (cls === INJ_KEY) return KEYS;
  if (cls === INJ_MEDIA) return MEDIA;
  return [];
}

const index = new Map<string, string>();
for (const cls of [INJ_BTN, INJ_KEY, INJ_MEDIA]) {
  for (const u of usageTable(cls)) index.set(`${cls}:${u.id}`, u.name);
}

// A usage's display name, falling back to the hex id. Every id is addressable whether or not the
// table names it, so the fallback is the normal case for an unnamed Consumer usage, not an error.
export function usageName(cls: number, id: number): string {
  return index.get(`${cls}:${id}`) ?? `0x${id.toString(16)}`;
}

export const CLASS_LABELS: Record<number, string> = {
  [INJ_BTN]: 'Button',
  [INJ_KEY]: 'Key',
  [INJ_MEDIA]: 'Media',
};
