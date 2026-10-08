import { LINKS } from '../site';

export interface FaqItem {
  id: string;
  q: string;
  a: string;
  links?: { label: string; href: string }[];
}

// From the Discord #faq channel. The answers stay plain text: the FAQ page's structured data carries them
// as written.
export const FAQ: readonly FaqItem[] = [
  {
    id: 'software',
    q: "Why doesn't my software work with Medius?",
    a: "Medius's control protocol is binary and differs from the stock MAKCU firmware's, so software written for stock firmware needs support added for Medius. Libraries for Rust, Python, C and C++ are in the docs, and the AI access page serves the docs to coding agents.",
    links: [
      { label: 'Rust library', href: '/library' },
      { label: 'Bindings', href: '/bindings' },
      { label: 'AI access', href: '/ai' },
    ],
  },
  {
    id: 'why',
    q: 'Why use Medius?',
    a: 'It clones your mouse or keyboard to the PC byte for byte, supports keyboards and media keys as well as mice, and gives developers an open protocol with tools stock firmware does not have, such as motion mirroring.',
    links: [{ label: 'Native API', href: '/native' }],
  },
  {
    id: 'controller',
    q: 'Does Medius support controllers?',
    a: 'Not yet. Controller support is planned.',
  },
  {
    id: 'free',
    q: 'Is Medius free?',
    a: 'Yes. Medius is free and will stay free, updates included.',
  },
  {
    id: 'report',
    q: "How do I report a device that doesn't work?",
    a: 'Connect the device to your PC directly, not through the box, open USB Device Tree Viewer, select the device, copy all the text on the right, and send it in a support ticket on the Discord server.',
    links: [
      { label: 'USB Device Tree Viewer', href: 'https://www.uwe-sieber.de/usbtreeview_e.html' },
      { label: 'Discord', href: LINKS.discord },
    ],
  },
  {
    id: 'bsod',
    q: 'My PC blue-screens while using Medius. How do I fix it?',
    a: "The crash comes from the WCH CH343 driver that Windows Update installs. Uninstall it and use Windows' built-in usbser.sys driver instead.",
  },
  {
    id: 'browsers',
    q: 'Which browsers can install and update a box?',
    a: 'Chrome or Edge on a computer. The dashboard reaches the box through Web Serial, and a browser without it shows a message to open the page in Chrome.',
    links: [{ label: 'Install', href: '/guide' }],
  },
  {
    id: 'drivers',
    q: 'Do I need to install drivers?',
    a: 'No. The dashboard runs in the browser, and Windows, macOS and Linux already have the serial driver the box uses.',
  },
  {
    id: 'systems',
    q: 'Which operating systems work?',
    a: 'The dashboard runs wherever Chrome or Edge runs on a computer. The libraries support Windows, Linux and macOS.',
  },
];
