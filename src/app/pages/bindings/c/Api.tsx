import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Api: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="API index" subtitle="Every C function, linked to what it does" />
        <p>
          The whole <code>medius_*</code> surface from <A href="/bindings/c"><code>medius.h</code></A>, grouped. Each row is the
          C signature and a one-line summary; follow the link for what the call does. The semantics
          live in the <A href="/library">Rust library</A> (the{' '}
          <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer">medius crate</a>)
          and the <A href="/native">Native API</A>, not here. Structs, enums, and constants are on{' '}
          <A href="/bindings/c/types">Types &amp; errors</A>; streams on{' '}
          <A href="/bindings/c/streams">Streams</A>.
        </p>
        <p>
          Most calls are <A href="/native/injection#fire-and-forget">fire-and-forget</A> — they
          return as soon as the <A href="/native/frame">frame</A> is queued and never wait on the box.
          The query reads and <code>open</code> / <code>find</code> block for the{' '}
          <A href="/native/hardware">box</A>'s <A href="/native/commands/requests">reply</A>. Every
          fallible call returns a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A>{' '}
          (<code>MEDIUS_STATUS_OK</code> is 0) and writes its result through an out-param;{' '}
          <A href="#module"><code>medius_last_error_message()</code></A> gives the last failure's text on the calling thread.
        </p>
        <div class="api-response-label">CALLING CONVENTION</div>
        <pre><code>{`MediusDevice *dev = NULL;
if (medius_device_find(&dev) != MEDIUS_STATUS_OK) {
    char buf[256];
    medius_last_error_message(buf, sizeof buf);   /* why it failed */
    return 1;
}
MediusVersion v;
medius_device_query_version(dev, &v);             /* result written to &v */
medius_device_free(dev);`}</code></pre>
        <div class="callout callout--info">
          <p>
            Opaque handles (<code>MediusDevice</code>, <code>MediusEventStream</code>,{' '}
            <code>MediusLogStream</code>, <code>MediusMockBox</code>) each have a <code>*_free</code>;
            you own them. Catch events and log lines are fixed-size structs, so there is nothing to
            free per event.
          </p>
        </div>
      </Card>

      <div id="connect" data-search-target>
        <Card>
          <CardHeader title="Connecting & lifecycle" subtitle="Open, share, and release the link" />
          <p>See <A href="/library/connection">Connection</A> and <A href="/library/lifecycle">Lifecycle</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_open(const char *path, MediusDevice **out)</code></td><td>Open a serial path and <A href="/native/connection#handshake">handshake</A>.</td></tr>
              <tr><td><code>medius_device_find(MediusDevice **out)</code></td><td>Open the first box found by USB id.</td></tr>
              <tr><td><code>medius_device_clone(const MediusDevice *dev)</code></td><td>Another handle to the same link (ref-counted); returns <code>MediusDevice *</code>. Null in &rarr; null out.</td></tr>
              <tr><td><code>medius_device_free(MediusDevice *dev)</code></td><td>Free a handle; joins the reader/<A href="/library/guides/connection#keepalive">keepalive</A> threads when the last clone drops. Null is a no-op.</td></tr>
              <tr><td><code>medius_find_ports(MediusPortInfo *out, uintptr_t cap, uintptr_t *out_total)</code></td><td>List present boxes into <code>out</code> (up to <code>cap</code>); writes total to <code>*out_total</code>, returns the number written. See <A href="/bindings/c/types#portinfo"><code>MediusPortInfo</code></A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="move" data-search-target>
        <Card>
          <CardHeader title="Movement" subtitle="Relative cursor and wheel" />
          <p>See <A href="/library/move">Move</A>. <code>+x</code> right, <code>+y</code> down. Build the axis struct with the <A href="#builders">motion helpers</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_move_rel(MediusDevice *dev, int16_t dx, int16_t dy)</code></td><td>Nudge the cursor by a signed 16-bit delta.</td></tr>
              <tr><td><code>medius_device_wheel(MediusDevice *dev, int16_t delta)</code></td><td>Scroll the wheel.</td></tr>
              <tr><td><code>medius_device_move_axis(MediusDevice *dev, MediusMotion motion)</code></td><td>Drive one axis from a <code>medius_motion_cursor(...)</code> or <code>medius_motion_wheel(...)</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="inject" data-search-target>
        <Card>
          <CardHeader title="Inject — buttons" subtitle="Press and release mouse buttons" />
          <p>
            See <A href="/library/inject">Inject</A> and the{' '}
            <A href="/native/injection">injection model</A> (press / soft-release / force-release).
            Button ids are on <A href="/native/commands/usage#buttons">Usage IDs</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_inject(MediusDevice *dev, MediusInput input, MediusAction action)</code></td><td>Apply an action to a built <A href="/bindings/c/types#input"><code>MediusInput</code></A> (button, key, or media).</td></tr>
              <tr><td><code>medius_device_button(MediusDevice *dev, MediusButton button, MediusAction action)</code></td><td>Apply an action to a button directly.</td></tr>
              <tr><td><code>medius_device_press(MediusDevice *dev, MediusButton button)</code></td><td>Hold a button down (<code>MEDIUS_ACTION_PRESS</code>).</td></tr>
              <tr><td><code>medius_device_soft_release(MediusDevice *dev, MediusButton button)</code></td><td>Release, unless the user is physically holding it.</td></tr>
              <tr><td><code>medius_device_force_release(MediusDevice *dev, MediusButton button)</code></td><td>Release even against a physical hold.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              <code>medius_device_inject</code> takes a value you build with{' '}
              <code>medius_input_button</code>, <code>medius_input_key</code>, or{' '}
              <code>medius_input_media</code> (see <A href="#builders">Input builders</A>). The direct
              verbs (<code>medius_device_press</code>, <A href="#keys"><code>medius_device_key_down</code></A>,{' '}
              <A href="#media"><code>medius_device_media_down</code></A>) take the target on their own.
            </p>
          </div>
        </Card>
      </div>

      <div id="keys" data-search-target>
        <Card>
          <CardHeader title="Inject — keyboard" subtitle="Press and release keys" />
          <p>See <A href="/library/inject">Inject</A>; HID keycodes (the <code>MEDIUS_KEY_*</code> constants) on <A href="/native/commands/usage#keycodes">Usage IDs</A>. A <A href="/bindings/c/types#key"><code>MediusKey</code></A> is a <code>uint8_t</code> usage.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_key(MediusDevice *dev, MediusKey key, MediusAction action)</code></td><td>Apply an action to a key.</td></tr>
              <tr><td><code>medius_device_key_down(MediusDevice *dev, MediusKey key)</code></td><td>Hold a key down.</td></tr>
              <tr><td><code>medius_device_key_up(MediusDevice *dev, MediusKey key)</code></td><td>Soft-release a key.</td></tr>
              <tr><td><code>medius_device_key_force_release(MediusDevice *dev, MediusKey key)</code></td><td>Force-release a key.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="media" data-search-target>
        <Card>
          <CardHeader title="Inject — media" subtitle="Consumer-control keys" />
          <p>See <A href="/library/inject">Inject</A>; Consumer usages (the <code>MEDIUS_MEDIA_*</code> constants) on <A href="/native/commands/usage#consumer">Usage IDs</A>. A <A href="/bindings/c/types#media-key"><code>MediusMediaKey</code></A> is a <code>uint16_t</code> usage.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_media(MediusDevice *dev, MediusMediaKey media, MediusAction action)</code></td><td>Apply an action to a media key.</td></tr>
              <tr><td><code>medius_device_media_down(MediusDevice *dev, MediusMediaKey media)</code></td><td>Hold a media key down.</td></tr>
              <tr><td><code>medius_device_media_up(MediusDevice *dev, MediusMediaKey media)</code></td><td>Soft-release a media key.</td></tr>
              <tr><td><code>medius_device_media_force_release(MediusDevice *dev, MediusMediaKey media)</code></td><td>Force-release a media key.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="Locks" subtitle="Block the user's own input" />
          <p>See <A href="/library/lock">Lock</A>. A <A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A> picks an axis or button and a <A href="/bindings/c/types#lock-direction"><code>MediusLockDirection</code></A> picks an edge. Read a returned mask with <A href="#inspectors"><code>medius_locks_is_locked</code></A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_lock(MediusDevice *dev, MediusLockTarget target, MediusLockDirection dir)</code></td><td>Lock an axis or button.</td></tr>
              <tr><td><code>medius_device_unlock(MediusDevice *dev, MediusLockTarget target, MediusLockDirection dir)</code></td><td>Unlock an axis or button.</td></tr>
              <tr><td><code>medius_device_lock_key(...)</code> / <code>medius_device_unlock_key(MediusDevice *dev, MediusKey key, MediusLockDirection dir)</code></td><td>Lock / unlock one keyboard key.</td></tr>
              <tr><td><code>medius_device_lock_media(...)</code> / <code>medius_device_unlock_media(MediusDevice *dev, MediusMediaKey media)</code></td><td>Lock / unlock one media key.</td></tr>
              <tr><td><code>medius_device_lock_all(...)</code> / <code>medius_device_unlock_all(MediusDevice *dev, MediusBlanket what)</code></td><td>Blanket lock / unlock a class (keys, media, buttons).</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>A lock auto-clears; it isn't permanent. The <A href="/library/guides/connection#keepalive">keepalive</A> holds it for you — see <A href="/library/lock">Lock</A>.</p>
          </div>
        </Card>
      </div>

      <div id="led-admin-options" data-search-target>
        <Card>
          <CardHeader title="LED, admin & options" subtitle="Status light, resets, persistent settings" />
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_led(MediusDevice *dev, MediusLedTarget target, MediusLedMode mode, uint8_t level)</code></td><td>Drive the status LED. See <A href="/library/led">LED</A>.</td></tr>
              <tr><td><code>medius_device_reset(MediusDevice *dev)</code></td><td>Clear all overrides. See <A href="/library/admin">Admin</A>.</td></tr>
              <tr><td><code>medius_device_reapply(MediusDevice *dev)</code></td><td>Re-send the active settings.</td></tr>
              <tr><td><code>medius_device_reconnect(MediusDevice *dev)</code></td><td>Force a <A href="/library/lifecycle">reconnect</A> to the mouse.</td></tr>
              <tr><td><code>medius_device_reboot(MediusDevice *dev, MediusRebootTarget target)</code></td><td>Reboot a chip to run or download mode.</td></tr>
              <tr><td><code>medius_device_allow_imperfect_clones(MediusDevice *dev, bool allow)</code></td><td>Opt in to cloning over-capacity devices. See <A href="/library/options">Options</A>.</td></tr>
              <tr><td><code>medius_device_set_movement_riding(MediusDevice *dev, bool enabled, uint32_t window_ms)</code></td><td>Set movement riding; <code>enabled == false</code> clears the window (rounded to whole ms).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="queries" data-search-target>
        <Card>
          <CardHeader title="Queries" subtitle="Read box state — each blocks for one reply" />
          <p>
            See <A href="/library/requests">Requests</A>. Each blocks for the box's reply, writes a
            struct documented on <A href="/bindings/c/types">Types &amp; errors</A>, and returns{' '}
            <code>MEDIUS_STATUS_ERR_QUERY_TIMEOUT</code> if no reply arrives.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Writes to <code>*out</code></th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_query_version(dev, MediusVersion *out)</code></td><td><A href="/bindings/c/types#version"><code>MediusVersion</code></A> — protocol + firmware version.</td></tr>
              <tr><td><code>medius_device_query_health(dev, MediusHealth *out)</code></td><td><code>MediusHealth</code> — link, mouse, clone, injection flags.</td></tr>
              <tr><td><code>medius_device_query_mouse_info(dev, MediusMouseInfo *out)</code></td><td><A href="/bindings/c/types#mouse-info"><code>MediusMouseInfo</code></A> — the cloned mouse's USB identity.</td></tr>
              <tr><td><code>medius_device_caps(dev, MediusCaps *out)</code></td><td><A href="/bindings/c/types#caps"><code>MediusCaps</code></A> — mouse/keyboard capabilities.</td></tr>
              <tr><td><code>medius_device_query_rate(dev, MediusRate *out)</code></td><td><A href="/bindings/c/types#rate"><code>MediusRate</code></A> — native report rate and poll period.</td></tr>
              <tr><td><code>medius_device_query_stats(dev, MediusStats *out)</code></td><td><A href="/bindings/c/types#stats"><code>MediusStats</code></A> — box-side telemetry.</td></tr>
              <tr><td><code>medius_device_query_locks(dev, MediusLocks *out)</code></td><td><A href="/bindings/c/types#locks"><code>MediusLocks</code></A> — active lock mask.</td></tr>
              <tr><td><code>medius_device_query_catch(dev, MediusCatchState *out)</code></td><td><A href="/bindings/c/types#catch-state"><code>MediusCatchState</code></A> — subscription mask + dropped count.</td></tr>
              <tr><td><code>medius_device_query_imperfect(dev, MediusImperfectStatus *out)</code></td><td><A href="/bindings/c/types#imperfect-status"><code>MediusImperfectStatus</code></A> — imperfect-clone state.</td></tr>
              <tr><td><code>medius_device_query_movement_riding(dev, bool *out_enabled, uint32_t *out_window_ms)</code></td><td>Whether riding is on, and the window in ms (0 when off).</td></tr>
              <tr><td><code>medius_device_counters(dev, MediusCountersSnapshot *out)</code></td><td><A href="/bindings/c/types#counters"><code>MediusCountersSnapshot</code></A> — host-side wire counters.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="streams" data-search-target>
        <Card>
          <CardHeader title="Streams" subtitle="Subscribe to live input and logs" />
          <p>Consuming events is covered on <A href="/bindings/c/streams">Streams</A>; the catch feature itself on <A href="/library/catch">Catch</A> and logs on <A href="/library/diagnostics">Logs &amp; counters</A>. <code>medius_device_catch_events</code> takes an OR of the <code>MEDIUS_CATCH_MASK_*</code> bits as its subscription.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_catch_events(MediusDevice *dev, MediusCatchMask mask, MediusEventStream **out)</code></td><td>Subscribe to physical mouse/key/media events.</td></tr>
              <tr><td><code>medius_event_stream_clone(const MediusEventStream *stream)</code></td><td>Another handle to the same subscription. Null in &rarr; null out.</td></tr>
              <tr><td><code>medius_event_stream_free(MediusEventStream *stream)</code></td><td>Free a handle; the subscription ends with the last one.</td></tr>
              <tr><td><code>medius_event_stream_recv(stream, MediusCatchEvent *out)</code></td><td>Block for the next event; <code>MEDIUS_STATUS_ERR_DISCONNECTED</code> on close.</td></tr>
              <tr><td><code>medius_event_stream_try_recv(stream, MediusCatchEvent *out)</code></td><td>Next buffered event; returns <code>false</code> if none (never blocks).</td></tr>
              <tr><td><code>medius_event_stream_recv_timeout(stream, uint64_t timeout_ms, MediusCatchEvent *out)</code></td><td>Block up to <code>timeout_ms</code>; <code>false</code> on timeout or close.</td></tr>
              <tr><td><code>medius_event_stream_dropped(stream)</code></td><td>Events dropped because the consumer fell behind.</td></tr>
              <tr><td><code>medius_device_logs(MediusDevice *dev, MediusLogStream **out)</code></td><td>Open the device log-line stream.</td></tr>
              <tr><td><code>medius_log_stream_clone</code> / <code>medius_log_stream_free</code></td><td>Clone / free a log-stream handle.</td></tr>
              <tr><td><code>medius_log_stream_recv</code> / <code>try_recv</code> / <code>recv_timeout(stream, …, MediusLogLine *out)</code></td><td>Pull the next <A href="/bindings/c/types#log-line"><code>MediusLogLine</code></A> (block / non-block / timed).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="builders" data-search-target>
        <Card>
          <CardHeader title="Input & motion builders" subtitle="Make the value structs the calls take" />
          <p>Pure constructors — no device, no wire traffic. See <A href="/library/inject">Inject</A> and <A href="/library/move">Move</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>medius_input_button(MediusButton button)</code></td><td><code>MediusInput</code> for <code>medius_device_inject</code>.</td></tr>
              <tr><td><code>medius_input_key(MediusKey key)</code></td><td><code>MediusInput</code> addressing a keyboard key.</td></tr>
              <tr><td><code>medius_input_media(MediusMediaKey media)</code></td><td><code>MediusInput</code> addressing a media key.</td></tr>
              <tr><td><code>medius_motion_cursor(int16_t dx, int16_t dy)</code></td><td><A href="/bindings/c/types#motion"><code>MediusMotion</code></A> for <code>medius_device_move_axis</code>.</td></tr>
              <tr><td><code>medius_motion_wheel(int16_t delta)</code></td><td><code>MediusMotion</code> for a wheel scroll.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="inspectors" data-search-target>
        <Card>
          <CardHeader title="Struct inspectors" subtitle="Read query / event results without the wire" />
          <p>Helpers that interpret a struct you already have — they take it by value (or pointer) and do no I/O. Each mirrors the matching method on the <A href="/library/types">Rust type</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>medius_locks_is_locked(MediusLocks locks, MediusLockTarget target, MediusLockDirection dir)</code></td><td><code>bool</code> — is that target/edge locked (<code>Both</code> needs both edges). See <A href="/library/lock">Lock</A>.</td></tr>
              <tr><td><code>medius_rate_native_hz(MediusRate rate, float *out_hz)</code></td><td><code>bool</code> — writes the native rate in Hz; <code>false</code> when there is no continuous cadence.</td></tr>
              <tr><td><code>medius_mouse_event_is_pressed(const MediusMouseEvent *event, MediusButton button)</code></td><td><code>bool</code> — is that button held in the snapshot.</td></tr>
              <tr><td><code>medius_keyboard_event_is_pressed(const MediusKeyboardEvent *event, MediusKey key)</code></td><td><code>bool</code> — is that key held (modifier bitmap or keycode list).</td></tr>
              <tr><td><code>medius_media_event_is_pressed(const MediusMediaEvent *event, MediusMediaKey media)</code></td><td><code>bool</code> — is that media usage active.</td></tr>
              <tr><td><code>medius_caps_has_mouse(MediusCaps caps)</code></td><td><code>bool</code> — a mouse interface is bound. See <A href="/library/requests">Requests</A>.</td></tr>
              <tr><td><code>medius_caps_has_keyboard(MediusCaps caps)</code></td><td><code>bool</code> — a keyboard interface is bound.</td></tr>
              <tr><td><code>medius_caps_is_composite(MediusCaps caps)</code></td><td><code>bool</code> — the clone is multi-HID-interface.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="module" data-search-target>
        <Card>
          <CardHeader title="Global functions" subtitle="Library-level helpers and errors" />
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_last_error_message(char *buf, uintptr_t cap)</code></td><td>Copy the last error's text into <code>buf</code>; returns the full length (size a buffer and retry). See <A href="/bindings/c/types#errors">errors</A>.</td></tr>
              <tr><td><code>medius_last_error_proto_ver()</code></td><td>The proto-version byte from the last <code>MEDIUS_STATUS_ERR_BAD_PROTO_VER</code>, or 0.</td></tr>
              <tr><td><code>medius_default_query_timeout_ms()</code></td><td>The default query reply wait, in ms.</td></tr>
              <tr><td><code>medius_default_keepalive_cadence_ms()</code></td><td>The default <A href="/library/guides/connection#keepalive">keepalive</A> interval, in ms.</td></tr>
              <tr><td><code>medius_abi_version()</code></td><td>The C ABI version (bumped on any breaking header change).</td></tr>
              <tr><td><code>medius_version_string()</code></td><td>The crate version as a static NUL-terminated string.</td></tr>
              <tr><td><code>medius_flash(const char *port, const char *bin_path, bool host)</code></td><td>Flash firmware via <a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer">esptool</a>. <code>MEDIUS_FEATURE_FLASH</code> only; see <A href="/library/features/flash">Flash</A> and <A href="/bindings/c/build">Build &amp; features</A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="mock" data-search-target>
        <Card>
          <CardHeader title="Mock box" subtitle="Scriptable fake for tests — feature-gated" />
          <p>
            All of these are wrapped in <code>#ifdef MEDIUS_FEATURE_MOCK</code> (the <code>mock</code>{' '}
            <a href="https://doc.rust-lang.org/cargo/reference/features.html" target="_blank" rel="noreferrer">cargo feature</a>). The concept lives on <A href="/library/features/mock">Mock</A>; turning the
            feature on is on <A href="/bindings/c/build">Build &amp; features</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_mock_new()</code></td><td>A fresh mock that records commands and auto-answers queries.</td></tr>
              <tr><td><code>medius_mock_clone</code> / <code>medius_mock_free(MediusMockBox *mock)</code></td><td>Share (same state) / free a mock handle.</td></tr>
              <tr><td><code>medius_device_with_mock(const MediusMockBox *mock, MediusDevice **out)</code></td><td>Build a <code>MediusDevice</code> over the mock <em>without</em> a handshake.</td></tr>
              <tr><td><code>medius_device_open_mock(const MediusMockBox *mock, MediusDevice **out)</code></td><td>Build a <code>MediusDevice</code> over the mock <em>and</em> run the handshake.</td></tr>
              <tr><td><code>medius_mock_set_version / _health / _mouse_info / _caps / _mouse_caps / _kbd_caps / _rate / _stats / _locks / _catch_state / _imperfect_status</code></td><td>Set the value the mock answers to each query.</td></tr>
              <tr><td><code>medius_mock_set_movement_riding(mock, bool enabled, uint32_t window_ms)</code></td><td>Set the movement-riding window the mock reports.</td></tr>
              <tr><td><code>medius_mock_silent(MediusMockBox *mock)</code></td><td>Stop answering queries (still records) — for timeout tests.</td></tr>
              <tr><td><code>medius_mock_push_raw(mock, const uint8_t *bytes, uintptr_t len)</code></td><td>Inject raw inbound bytes, as if the box sent them.</td></tr>
              <tr><td><code>medius_mock_push_log(mock, MediusLogLevel level, const char *text)</code></td><td>Push a LOG line onto the device's log stream.</td></tr>
              <tr><td><code>medius_mock_push_event / _push_kb_event / _push_cons_event(mock, uint8_t seq, …)</code></td><td>Push a mouse / keyboard / media report as a catch event.</td></tr>
              <tr><td><code>medius_mock_recorded(MediusMockBox *mock)</code></td><td>How many commands the host has sent.</td></tr>
              <tr><td><code>medius_mock_saw(mock, MediusFrameType ty)</code></td><td>Whether at least one frame of that type was sent.</td></tr>
              <tr><td><code>medius_mock_clear_recorded(MediusMockBox *mock)</code></td><td>Clear the recorded-command log.</td></tr>
              <tr><td><code>medius_mock_recorded_frame(mock, uintptr_t idx, MediusFrameType *out_ty, uint8_t *out_seq, uint8_t *payload_buf, uintptr_t cap)</code></td><td>Read recorded frame <code>idx</code>: type, SEQ, and payload bytes.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default Api;
