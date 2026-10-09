import { LINKS } from '../site';

export interface HelpLink {
  label: string;
  href: string;
}

export interface HelpItem {
  id: string;
  q: string;
  a: string;
  links?: HelpLink[];
}

export interface HelpGroup {
  id: string;
  title: string;
  items: HelpItem[];
}

const SET_UP = { label: 'Set up', href: '/dashboard/setup' };
const OPTIONS = { label: 'Options', href: '/dashboard#imperfect-clone' };
const MANUAL = { label: 'Manual flash', href: '/dashboard/update#manual' };
const DISCORD = { label: 'Discord', href: LINKS.discord };

// The Help page: the dashboard's messages, the Discord server's FAQ and the device fixes, by topic. The
// answers stay plain text: the page's structured data carries them as written. Ids kept from the FAQ
// page (software, why, controller, free, report, bsod, browsers, drivers, systems) keep its old links
// landing.
export const HELP: readonly HelpGroup[] = [
  {
    id: 'q-install',
    title: 'Install',
    items: [
      {
        id: 'nothing-to-install',
        q: 'Nothing to install to',
        a: 'Unplug every cable. Hold the button next to USB1 (USB3 for the mouse-side chip) while you plug that port into this computer, then press Install.',
        links: [SET_UP],
      },
      {
        id: 'flash-stopped',
        q: 'A flash stopped partway',
        a: "Each chip's download mode is in ROM, so a flash that stops partway never locks the chip out. Hold the button again, plug the port back in and press Install.",
      },
      {
        id: 'which-computer',
        q: 'Which computer do I install from?',
        a: 'Any computer with Chrome or Edge. Install the main chip over USB1, unplug it, then the mouse-side chip over USB3.',
      },
      {
        id: 'browsers',
        q: "This browser can't talk to your box",
        a: 'Open the page in Chrome or Edge on a computer. The dashboard reaches the box through Web Serial.',
      },
      {
        id: 'insecure',
        q: "This page isn't secure",
        a: 'Open the dashboard from https://medius.k4tech.net/dashboard.',
      },
    ],
  },
  {
    id: 'q-connection',
    title: 'Connection',
    items: [
      {
        id: 'not-found',
        q: "This computer can't see your box",
        a: 'Plug USB2 into this computer. A box never set up needs the installer first.',
        links: [SET_UP],
      },
      { id: 'not-answering', q: "The box isn't answering", a: 'Check USB1 is plugged in too.' },
      { id: 'one-more-click', q: 'The browser needs one more click before it asks', a: 'Press Try again.' },
      { id: 'in-use', q: 'Another tab or program has this box open', a: 'Close it. One program at a time holds the box.' },
      { id: 'unreadable', q: "This computer can't read from the box", a: 'Unplug USB2 and plug it back in.' },
    ],
  },
  {
    id: 'q-input',
    title: 'Mouse and keyboard',
    items: [
      {
        id: 'mouse-still',
        q: "My mouse doesn't move",
        a: 'If Options shows Device over box capacity, or high speed, press Allow imperfect.',
        links: [OPTIONS],
      },
      {
        id: 'report',
        q: "A device doesn't clone, or misbehaves",
        a: 'Check Devices for a setting it needs. If none helps, send its USB Device Tree Viewer text in a support ticket on Discord.',
        links: [
          { label: 'Device fixes', href: '/guide/compatibility#device-fixes' },
          { label: 'Reporting a device', href: '/guide/compatibility#reporting' },
        ],
      },
      {
        id: 'logitech',
        q: 'My Logitech mouse feels delayed, or runs at 125 Hz',
        a: 'Press Allow imperfect, then set Wire rate to Forced, enter 1000 Hz and press Apply. The box restarts to apply a wire rate, so the option reads off for up to 10 seconds.',
        links: [{ label: 'Options', href: '/dashboard#wire-rate' }],
      },
      {
        id: 'no-options',
        q: 'My box has no Options',
        a: 'Options needs v3.4.2 or later, so update the box. On an older box, logitech_fix.bat (Windows) or logitech_fix.sh (Linux) from Discord #tools turns on imperfect clone, forces the wire rate to 1000 Hz and paces injection at a fixed 1000 Hz.',
        links: [{ label: 'Update', href: '/dashboard/update' }],
      },
      {
        id: 'razer-8k',
        q: 'My Razer 8K mouse runs at 125 Hz',
        a: 'Plug it into the PC directly, set it to 8000 Hz in Razer Synapse, then plug it back into the box. Through the box it runs at 1000 Hz.',
      },
      {
        id: 'mouse-and-keyboard',
        q: 'Can one box take a mouse and a keyboard?',
        a: 'Only through one receiver that carries both.',
      },
    ],
  },
  {
    id: 'q-software',
    title: 'Software',
    items: [
      {
        id: 'software',
        q: "Why doesn't my software work with Medius?",
        a: "The control protocol differs from the stock MAKCU firmware's, so software written for the stock firmware needs Medius support from its developer. Libraries for Rust, Python, C and C++ are in the docs, and the AI access page serves the docs to coding agents.",
        links: [
          { label: 'Rust library', href: '/library' },
          { label: 'Bindings', href: '/bindings' },
          { label: 'AI access', href: '/ai' },
        ],
      },
      {
        id: 'protocol-changes',
        q: 'Does my software need updating when Medius updates?',
        a: 'Only when a release changes the protocol. The release notes say so.',
        links: [{ label: 'Changelog', href: '/dashboard/changelog' }],
      },
      { id: 'baud', q: 'Which baud rate do I set?', a: '6,000,000, fixed. The libraries set it.' },
    ],
  },
  {
    id: 'q-update',
    title: 'Update',
    items: [
      {
        id: 'too-old',
        q: 'Too old to update from here',
        a: 'One-click update needs v3.2.0 or later. Set the box up once with the installer; then it updates in one click.',
        links: [SET_UP],
      },
      {
        id: 'how-update',
        q: 'How does an update work?',
        a: "Each chip writes the new firmware beside the one it runs, then boots it. The mouse-side chip's copy goes through the main chip. A chip whose new firmware won't run boots the one it ran before.",
      },
      {
        id: 'not-on-version',
        q: 'The box came back, but not on the version sent',
        a: 'The chip kept its old firmware. Update again.',
        links: [{ label: 'Update', href: '/dashboard/update' }],
      },
      {
        id: 'newer-protocol',
        q: 'This box speaks a newer protocol',
        a: "Reload the page. Update's Manual tab can still flash it.",
        links: [MANUAL],
      },
      {
        id: 'older-version',
        q: 'How do I go back to an older version?',
        a: "Get its zip from the release's post in Discord #changelog. On Update's Manual tab, choose Upload a file and flash medius_device.bin to the main chip, then medius_host.bin to the mouse-side chip. A factory image also clears your settings.",
        links: [MANUAL],
      },
      {
        id: 'stock-firmware',
        q: 'How do I go back to the stock firmware?',
        a: "The fetch_makcu_fw script in Discord #tools downloads MAKCU's v4 firmware. Flash it on Update's Manual tab over ROM download, with Upload a file.",
        links: [MANUAL, DISCORD],
      },
    ],
  },
  {
    id: 'q-windows',
    title: 'Windows',
    items: [
      {
        id: 'bsod',
        q: 'My PC blue-screens',
        a: "The Medius library fixed it in v3.4.2, so update the software you use with the box. With older software, uninstall the WCH CH343 driver that Windows Update installs and use Windows' built-in usbser.sys driver.",
      },
    ],
  },
  {
    id: 'q-medius',
    title: 'Medius',
    items: [
      {
        id: 'why',
        q: 'Why use Medius?',
        a: 'It clones your mouse or keyboard to the PC byte for byte, keyboards and media keys included, and gives developers an open protocol with tools the stock firmware lacks, such as motion mirroring.',
        links: [{ label: 'Native API', href: '/native' }],
      },
      { id: 'free', q: 'Is Medius free?', a: 'Yes, and it stays free, updates included.' },
      { id: 'drivers', q: 'Do I need to install drivers?', a: 'No. Windows, macOS and Linux already have the serial driver the box uses.' },
      {
        id: 'systems',
        q: 'Which operating systems work?',
        a: 'The dashboard runs wherever Chrome or Edge runs on a computer. The libraries support Windows, Linux and macOS.',
      },
      { id: 'controller', q: 'Does Medius support controllers?', a: 'Not yet. Controller support is planned.' },
      { id: 'open-source', q: 'Is Medius open source?', a: "The libraries, this site and the dashboard are. The firmware isn't." },
    ],
  },
];

export const HELP_ITEMS: readonly HelpItem[] = HELP.flatMap((g) => g.items);
