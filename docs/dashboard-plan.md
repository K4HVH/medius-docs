# Medius Dashboard: design

A browser-based tool inside the Medius site for viewing, connecting to, and flashing a
box, with no driver install. Built on WebSerial + esptool-js, native to the SolidJS app.

## Goal

Turn the docs site into a hub. From a Chromium browser a user can:

- Connect to a box and see what it is (running firmware version, link/mouse/clone/inject health).
- Flash either ESP32-S3 chip: an Update (app only) or a Full/Recovery (factory image).
- Recover a blank, stock, or bricked box (guided, with the one physical step that needs).

No CH343 driver download, no Python, no esptool install.

## Feasibility (verified, including two adversarial passes)

Driverless flashing works. The CH343 on the control port enumerates as a genuine USB
CDC-ACM device (VID 0x1A86 / PID 0x55D3, class 02/02/01), so the OS binds its built-in
driver with zero install: Windows `usbser.sys`, macOS `AppleUSBCDCACM`, Linux `cdc-acm`.
The repo's own probe logs confirm it: the box comes up as `/dev/ttyACM*` (the generic CDC
path), which only happens with the inbox driver. This is the deliberate CH343-vs-CH340
difference. WebSerial reads inbox COM ports, so Chrome/Edge drives it with nothing installed.

Hard constraints the design must respect:

- Chromium only (Chrome/Edge/Opera 89+). No Firefox, no Safari. Feature-detect and show a
  fallback.
- Secure context required (HTTPS, or localhost). The site's `serve.ts` is plain HTTP, so
  production needs TLS in front of it.
- No DTR/RTS auto-reset is wired on this board. esptool's normal "open the port and it
  resets into download mode" does nothing. Download mode is entered another way (below).
- A blank/bricked chip cannot receive the reboot command, so it needs one physical step
  (hold BOTH BOOT buttons, replug USB). The browser does the write after that.
- USB3 carries a 5V back-feed hazard. Host-chip flashing uses USB3, which must never share
  a machine with USB1. The UI hard-warns this.
- A box cannot be identified by VID/PID (the CH343 ID is generic; the clone mirrors the
  attached mouse). Identity is confirmed by the protocol handshake.

## Hardware and protocol facts the design depends on

Two ESP32-S3 chips, both flashed with the stock Espressif ROM serial protocol (so esptool-js
mirrors the existing Python tooling exactly, no custom bootloader work).

| Chip | Faces | Port | Control/flash transport |
|------|-------|------|-------------------------|
| Device | Game PC (the clone) | USB1 | CH343 CDC (1A86:55D3), and its own native USB |
| Host | Mouse | USB3 | Its own native USB ROM (303A:0009); reboot relayed via the device |

Entering download mode:

- Running firmware: send the framed `REBOOT` command (opcode `0x07`, one target byte).
  Target 0 = device chip to ROM download, target 1 = host chip to ROM download (relayed over
  the 5 Mbaud inter-chip UART), targets 2/3 = reboot to run. The chip force-boots into ROM
  via `RTC_CNTL_FORCE_DOWNLOAD_BOOT`. Then esptool writes with no-reset.
- Blank/bricked: disconnect all USB, hold BOTH BOOT buttons, replug. Both chips enumerate as
  native ESP32-S3 ROM devices (303A:0009). Then esptool writes.

Two transports the dashboard handles:

- CH343 CDC port (1A86:55D3, 4 Mbaud framed): all control, and device-chip flash after a
  software REBOOT.
- Native ESP32-S3 ROM port (303A:0009): host-chip flash, and blank-chip recovery for either
  chip after the BOOT-button step.

Flash layout (ESP32-S3, bootloader at 0x0):

- Update: app only at `0x10000`.
- Full/Recovery: the CI merged factory image at `0x0`. (Equivalent to bootloader 0x0 +
  partition-table 0x8000 + app 0x10000.)

Frame format for the control link: `[SOF 0xA5][TYPE u8][SEQ u8][LEN u16 LE][PAYLOAD][CRC16
LE]`, CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, no final XOR) over
TYPE..PAYLOAD. Version reply is `[Q_VERSION, proto_ver, major, minor, patch]`, proto_ver 1.
After a REBOOT the library waits ~2s for the ROM to settle before esptool runs.

## Architecture

A new top-level section, separate from the docs shell because it is a tool, not a page.

- Route `/dashboard` with its own `DashboardLayout` (registered in `src/app/App.tsx`).
- The Home page gets a card linking to it.
- Built only from existing MidnightUI primitives (Card, CardHeader, Button, Tabs, Pane,
  Divider, Notification, Progress, FileUpload, Combobox, Chip, Dialog). `src/components/` and
  `src/styles/global.css` stay untouched; styling goes in `src/styles/docs.css`.

Internal layout (tabs/steps within the dashboard):

1. Connect: pick the box, handshake, identify.
2. Device: read-only status panel.
3. Flash: chip selector (device/host) + mode (Update / Full-Recovery) + image source.
4. Recovery: guided blank/bricked flow with the BOOT-button step.
5. Console (stretch): decoded frame monitor.

## Modules

### 1. Protocol layer (TypeScript)

A small, dependency-free port of the wire protocol, mirroring the `medius` Rust crate so the
web view and the native library share one definition:

- CRC16-CCITT-FALSE.
- Frame encode/decode (`encode(type, seq, payload)`, streaming decoder for replies).
- Constants: SOF, opcodes (`QUERY` 0x05, `REBOOT` 0x07, `LOG` 0x08, etc.), `RebootTarget`,
  query selectors (VERSION, HEALTH).
- Decoders for `RESP(VERSION)` and `RESP(HEALTH)` (flags: link_up, mouse_attached,
  clone_configured, inject_active).

### 2. Serial transport (WebSerial)

- Feature-detect `navigator.serial`; gate the whole section behind it.
- `requestPort()` on a user gesture, with VID hints (0x1A86 for control, 0x303A for ROM).
- Open with DTR/RTS deasserted (avoid an unintended device-chip reset on open).
- A read pump (port.readable -> frame decoder) for the view panel and console.

### 3. Identify

- After connecting the control port, send `QUERY(VERSION)` (or catch the unsolicited boot
  hello), require proto_ver 1. Only then call it a Medius box. Reject/ warn otherwise.

### 4. View device panel (read-only, safe)

- Never enters download mode, never touches esptool. Shows running version and health.
- Polls `QUERY(HEALTH)` on a cadence; renders flags as chips.

### 5. Flash engine (esptool-js 0.6.0)

- `new Transport(port)` -> `new ESPLoader({transport, ...})`.
- Custom download-mode entry: send the `REBOOT` frame over the control port, wait ~2s, then
  `esploader.main('no_reset')` so it syncs to the already-in-ROM chip.
- `writeFlash({ fileArray: [{address, data: Uint8Array}], flashSize:'keep', compress:true,
  reportProgress, calculateMD5Hash })`. Note: 0.6.0 wants `data` as `Uint8Array` (0.5.x used
  a binary string; old snippets break).
- Device chip: REBOOT target 0 over the CH343 port, then flash on that same port.
- Host chip: REBOOT target 1 over the CH343 port (relayed), then prompt the user to select
  the host's native ROM port (303A:0009) and flash there. Two-port hand-off, explicit in UI.
- Progress -> a SolidJS signal -> a Progress bar; esptool terminal text -> a log component.

### 6. Recovery flow (blank/bricked)

- Guided: an illustrated "disconnect all USB, hold BOTH BOOT buttons, replug" step, then
  `requestPort()` on the 303A:0009 ROM device, then a Full/Recovery write at `0x0`.
- Surfaced when the handshake fails or the user picks "my box is blank/bricked".

### 7. Firmware image source

- Default: fetch the latest GitHub Release via the API, list assets
  (`medius_device.bin`, `medius_device-factory.bin`, `medius_host.bin`,
  `medius_host-factory.bin`), pick by chip + mode.
- Manual: a FileUpload for a local `.bin` (rollback, dev builds).
- Show the selected image's version and a confirm step before writing.

## Safety and UX guards

- Browser/secure-context gate with a clear "use Chrome or Edge over HTTPS" fallback.
- Hard, blocking warning before any host-chip or USB3 step: never connect USB1 and USB3 to
  the same machine. Require an explicit ack.
- Confirm dialog before every write, naming the chip, mode, image, and version.
- The view panel and flasher are separate code paths; the panel must never toggle DTR/RTS or
  enter download mode while a box is running live.
- A clear error when esptool sync fails ("device not in download mode, hold BOOT and replug").

## Dependencies and build changes

- `bun add esptool-js` (0.6.0, Apache-2.0; deps atob-lite, pako, tslib). Not esp-web-tools
  (its auto-reset + Wi-Fi assumptions do not fit, and it drags in Lit + Material).
- Production TLS: WebSerial needs a secure context. Confirm the deployment terminates HTTPS
  (localhost is exempt for dev).
- Register dashboard pages in `src/app/searchIndex.ts`.
- Vite/Bun: esptool-js is plain ESM, no special bundling expected. Verify the build.

## Open questions to validate on real hardware

These are not blockers for building, but the flows must be tested against a box:

1. Opening the CH343 port from WebSerial on Windows: confirm it does not reset the device
   chip (bring-up notes say the CH343/USB2 port does not suffer the open/close reset that the
   native OTG console does; deassert DTR/RTS to be safe).
2. After a software REBOOT(target 0), confirm the device chip's ROM accepts esptool-js over
   the same CH343 port (the Python path uses `--before no_reset` on that port).
3. Confirm which native port enumerates for the host chip and for blank recovery, and that
   esptool-js syncs to 303A:0009 cleanly.
4. Confirm the CI release asset names and that the factory image writes at `0x0`.
5. Confirm GitHub Release assets are fetchable from the browser (CORS). Fall back to a small
   proxy or manual upload if not.
6. Whether retail boxes expose the BOOT buttons without opening the case (affects the
   recovery flow wording).

## Build sequence

1. Protocol layer + tests (CRC, frame round-trip, version/health decode).
2. WebSerial transport + feature gating + Connect/Identify.
3. View device panel (read-only). Shippable on its own.
4. Flash engine: device chip Update, then Full/Recovery.
5. Host chip flash (second-port hand-off + USB3 hazard guards).
6. Recovery flow (BOOT-button guided).
7. Firmware source (release fetch + upload).
8. Console (stretch).
9. searchIndex entries, TLS confirmation, build + manual hardware validation.
