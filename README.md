# Medius Documentation

Documentation site for Medius: the input-passthrough firmware, its binary control protocol, and the `medius` Rust library.

Built with [SolidJS](https://solidjs.com) and MidnightUI.

## Sections

- **Native API** -- The binary control protocol and how the box behaves. Covers the hardware, transport, frame format, injection model, and every command (opcodes `0x01`-`0x15`).
- **Rust Library** -- API reference for the `medius` crate: connecting, the command bindings, keepalive and reconnect, and the `async` / `mock` / `flash` / `tracing` features.
- **Bindings** -- The C ABI and Python bindings over the same crate.
- **Dashboard** -- The in-browser box dashboard: connect, view device info, update firmware, recover, and a console.
- **AI Access** -- Using the docs with an AI assistant: per-page Markdown twins, `llms.txt`, and the MCP server.

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
- MidnightUI -- Component library
- [solid-icons](https://github.com/x64Bits/solid-icons) -- Icons

## Deployment

CI builds the app and a multi-arch container on every push to `main` and publishes it to
`ghcr.io/k4hvh/medius-docs`. Run it with Docker:

```bash
docker run --rm -p 3000:3000 ghcr.io/k4hvh/medius-docs:latest
```

`docker-compose.yml` runs the same image. The container builds with Bun and serves `dist/`
on port 3000.
