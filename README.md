# Medius Documentation

Documentation site for Medius: the input-passthrough firmware, its binary control protocol, and the `medius` Rust library.

Built with [SolidJS](https://solidjs.com) and MidnightUI.

## Sections

| Section | What |
|---|---|
| Native API | Binary control protocol and box behaviour: hardware, transport, frame format, injection model, every command (opcodes `0x01`-`0x1E`). |
| Rust Library | `medius` crate reference: connecting, command bindings, keepalive, reconnect, and the `async` / `mock` / `tracing` features. |
| Bindings | C ABI and Python bindings over the crate. |
| Dashboard | In-browser box dashboard: connect, device info, firmware update, recovery, device log. |
| AI Access | Per-page Markdown twins, `llms.txt`, and the MCP server. |

## Development

### Prerequisites

- [Bun](https://bun.sh)

### Setup

```bash
bun install
```

### Dev server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
bun run build
```

Output: `dist/`.

## Tech stack

| Tool | Role |
|---|---|
| [SolidJS](https://solidjs.com) | Reactive UI framework |
| [@solidjs/router](https://docs.solidjs.com/solid-router) | Client-side routing |
| [Vite](https://vitejs.dev) | Build tool |
| [Bun](https://bun.sh) | Runtime and package manager |
| MidnightUI | Component library |
| [solid-icons](https://github.com/x64Bits/solid-icons) | Icons |

## Deployment

CI builds the app and a multi-arch container on every push to `main` and publishes it to
`ghcr.io/k4hvh/medius-docs`. Run it:

```bash
docker run --rm -p 3000:3000 ghcr.io/k4hvh/medius-docs:latest
```

`docker-compose.yml` runs the same image. The container builds with Bun and serves `dist/`
on port 3000.
