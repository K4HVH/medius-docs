# Medius Documentation

Documentation site for Medius: the mouse-passthrough firmware, its binary control protocol, and the `medius` Rust library.

Built with [SolidJS](https://solidjs.com) and [MidnightUI](https://github.com/user/midnightui).

## Sections

- **Native API** -- The binary control protocol and how the box behaves. Covers the hardware, transport, frame format, injection model, and every command (opcodes `0x01`-`0x08`).
- **Rust Library** -- API reference for the `medius` crate: connecting, the command bindings, keepalive and reconnect, and the `async` / `mock` / `flash` features.

## Development

### Prerequisites

- [Bun](https://bun.sh)

### Setup

```bash
bun install
```

### Dev Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
bun run build
```

Output goes to `dist/`.

## Tech Stack

- [SolidJS](https://solidjs.com) -- Reactive UI framework
- [@solidjs/router](https://docs.solidjs.com/solid-router) -- Client-side routing
- [Vite](https://vitejs.dev) -- Build tool
- [Bun](https://bun.sh) -- Runtime and package manager
- [MidnightUI](https://github.com/user/midnightui) -- Component library
- [solid-icons](https://github.com/x64Bits/solid-icons) -- Icons
