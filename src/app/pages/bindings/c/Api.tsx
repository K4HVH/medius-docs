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
          The whole <code>medius_*</code> surface from <A href="/bindings/c"><code>medius.h</code></A>, grouped. The semantics
          live in the <A href="/library">Rust library</A> (the{' '}
          <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer">medius crate</a>)
          and the <A href="/native">Native API</A>. Structs, enums, and constants are on{' '}
          <A href="/bindings/c/types">Types &amp; errors</A>; streams on{' '}
          <A href="/bindings/c/streams">Streams</A>.
        </p>
        <p>
          Most calls are <A href="/native/injection#fire-and-forget">fire-and-forget</A>: they
          return once the <A href="/native/frame">frame</A> is queued, without waiting on the box.
          The queries, plus <code>open</code> / <code>find</code>, block for the{' '}
          <A href="/native/hardware">box</A>'s <A href="/native/commands/requests">reply</A>.
        </p>
        <p>
          Every fallible call returns a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A>{' '}
          (<code>MEDIUS_STATUS_OK</code> is 0) and writes its result through an out-param;{' '}
          <A href="/bindings/c/api#module"><code>medius_last_error_message()</code></A> gives the last failure's text on the calling thread.
        </p>
        <div class="api-response-label">CALLING CONVENTION</div>
        <pre><code class="language-c">{`MediusDevice *dev = NULL;
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
            <code>MediusInputStream</code>, <code>MediusTimeline</code>, <code>MediusLogStream</code>,{' '}
            <code>MediusMockBox</code>) are yours to free, each with its own <code>*_free</code>.
          </p>
          <p>
            Events and log lines are fixed-size structs with nothing to free per event; see{' '}
            <A href="/bindings/c/usage#lifecycle">Lifecycle</A>.
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
              <tr><td><code>medius_find_ports(MediusPortInfo *out, uintptr_t cap, uintptr_t *out_total)</code></td><td>List present ports into <code>out</code> (up to <code>cap</code>); writes total to <code>*out_total</code>, returns the number written. See <A href="/bindings/c/types#portinfo"><code>MediusPortInfo</code></A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="discovery" data-search-target>
        <Card>
          <CardHeader title="Discovery" subtitle="Enumerate boxes and open one by identity" />
          <p>See <A href="/library/discovery">Discovery</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_list(MediusBoxInfo *out, uintptr_t cap, uintptr_t *out_total)</code></td><td>Enumerate every connected box into <code>out</code> (up to <code>cap</code>): opens, handshakes, and reads each one's version + cloned-device info. Writes the total to <code>*out_total</code>, returns the number written. See <A href="/bindings/c/types#box-info"><code>MediusBoxInfo</code></A>.</td></tr>
              <tr><td><code>medius_device_open_by_id(const char *id, MediusDevice **out)</code></td><td>Open the box whose identity matches <code>id</code> (device MAC hex or CH343 serial) and handshake.</td></tr>
              <tr><td><code>medius_device_find_mouse_box(MediusDevice **out)</code></td><td>Open the first box whose clone is a mouse.</td></tr>
              <tr><td><code>medius_device_find_keyboard_box(MediusDevice **out)</code></td><td>Open the first box whose clone is a keyboard.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="move" data-search-target>
        <Card>
          <CardHeader title="Movement" subtitle="Relative cursor and wheel" />
          <p>See <A href="/library/move">Move</A>. <code>+x</code> right, <code>+y</code> down. Build the axis struct with the <A href="/bindings/c/api#builders">motion helpers</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_move_rel(MediusDevice *dev, int16_t dx, int16_t dy)</code></td><td>Nudge the cursor by a signed 16-bit delta.</td></tr>
              <tr><td><code>medius_device_wheel(MediusDevice *dev, int16_t delta)</code></td><td>Scroll the wheel.</td></tr>
              <tr><td><code>medius_device_move_rel_now(MediusDevice *dev, int16_t dx, int16_t dy)</code></td><td>The same, bypassing <A href="/library/options#set-movement-riding">movement riding</A>.</td></tr>
              <tr><td><code>medius_device_wheel_now(MediusDevice *dev, int16_t delta)</code></td><td>Scroll, bypassing movement riding.</td></tr>
              <tr><td><code>medius_device_flush_motion(MediusDevice *dev)</code></td><td>Emit the motion riding is holding, now.</td></tr>
              <tr><td><code>medius_device_discard_motion(MediusDevice *dev)</code></td><td>Drop the motion riding is holding.</td></tr>
              <tr><td><code>medius_device_move_axis(MediusDevice *dev, MediusMotion motion, MediusMoveTiming timing, MediusPendingMotion pending)</code></td><td>Drive one axis from a <code>medius_motion_cursor(...)</code> or <code>medius_motion_wheel(...)</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="inject" data-search-target>
        <Card>
          <CardHeader title="Inject" subtitle="Drive any usage: button, key, or media" />
          <p>
            One verb set over a <A href="/bindings/c/types#input"><code>MediusUsage</code></A> (button, key,
            or media). Build it with the <A href="/bindings/c/api#builders">input helpers</A>; see{' '}
            <A href="/library/inject">Inject</A>, the <A href="/native/injection">injection model</A>, and
            the id spaces on <A href="/native/commands/usage">Usage IDs</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_inject(MediusDevice *dev, MediusUsage input, MediusAction action)</code></td><td>Apply a <A href="/bindings/c/types#action"><code>MediusAction</code></A> to a usage.</td></tr>
              <tr><td><code>medius_device_press(MediusDevice *dev, MediusUsage input)</code></td><td>Sends <code>MEDIUS_ACTION_PRESS</code>.</td></tr>
              <tr><td><code>medius_device_soft_release(MediusDevice *dev, MediusUsage input)</code></td><td>Sends <code>MEDIUS_ACTION_SOFT_RELEASE</code>.</td></tr>
              <tr><td><code>medius_device_force_release(MediusDevice *dev, MediusUsage input)</code></td><td>Sends <code>MEDIUS_ACTION_FORCE_RELEASE</code>.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              A <A href="/bindings/c/types#key"><code>MediusKey</code></A>{' '}
              or <A href="/bindings/c/types#media-key"><code>MediusMediaKey</code></A> is a raw HID usage.
            </p>
          </div>
        </Card>
      </div>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="Locks" subtitle="Weigh the user's own input" />
          <p>See <A href="/library/lock">Lock</A>. A <A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A> picks an axis or usage, <code>dir</code> takes a <A href="/bindings/c/types#direction"><code>MediusDirection</code></A> constant and <code>what</code> a <A href="/bindings/c/types#blanket"><code>MediusBlanket</code></A> one; anything else is <code>MEDIUS_STATUS_ERR_INVALID_ARG</code> and no frame goes out. Read the entries back with <A href="/bindings/c/api#inspectors"><code>medius_locks_scale_of</code></A> and <code>medius_locks_is_locked</code>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_scale(MediusDevice *dev, MediusLockTarget target, uint8_t dir, uint8_t scale)</code></td><td>Keep <code>scale</code> percent of an axis or usage on one direction: <code>MEDIUS_LOCK_SCALE_BLOCK</code> (0), <code>_PASS</code> (100), up to <code>_MAX</code> (255).</td></tr>
              <tr><td><code>medius_device_scale_all(MediusDevice *dev, uint8_t what, uint8_t dir, uint8_t scale)</code></td><td>The same over a whole class (aim, wheel, buttons, keys, or media).</td></tr>
              <tr><td><code>medius_device_lock(MediusDevice *dev, MediusLockTarget target, uint8_t dir)</code></td><td>Block an axis or usage on a direction: scale 0.</td></tr>
              <tr><td><code>medius_device_unlock(MediusDevice *dev, MediusLockTarget target, uint8_t dir)</code></td><td>Back to passing untouched: scale 100.</td></tr>
              <tr><td><code>medius_device_lock_all(MediusDevice *dev, uint8_t what, uint8_t dir)</code></td><td>Blanket block a whole class.</td></tr>
              <tr><td><code>medius_device_unlock_all(MediusDevice *dev, uint8_t what, uint8_t dir)</code></td><td>Release a blanket block.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>A scale auto-clears; it isn't permanent. The <A href="/library/guides/connection#keepalive">keepalive</A> holds it for you. <code>MEDIUS_DIRECTION_WITH</code> and <code>_AGAINST</code> need a live bearing, set with <code>medius_device_set_bearing</code>; the refusal rules for them are on <A href="/bindings/c/types#direction"><code>MediusDirection</code></A>.</p>
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
              <tr><td><code>medius_device_set_emit_pace(MediusDevice *dev, uint8_t mode, uint16_t hz, uint16_t force_hz)</code></td><td>Pick the pace (<code>hz</code> is the target for <code>FIXED</code>) and the advertised rate (<code>force_hz</code>, 0 = the device's own). Both ride one frame. See <A href="/library/options">Options</A>.</td></tr>
              <tr><td><code>medius_device_set_render(MediusDevice *dev, uint8_t mode, bool full)</code></td><td>Pick the texture (<A href="/bindings/c/types#render-mode"><code>MediusRenderMode</code></A>) and whether the device's own motion is rendered by the model rather than relayed. Both ride one frame. See <A href="/library/options">Options</A>.</td></tr>
              <tr><td><code>medius_device_set_name(MediusDevice *dev, const char *name)</code></td><td>Set the box's human-readable name (1 to 32 printable ASCII). See <A href="/library/options#set-name">Name</A>.</td></tr>
              <tr><td><code>medius_device_set_bearing(MediusDevice *dev, uint16_t window_ms, uint8_t mode)</code></td><td>Set what <code>MEDIUS_DIRECTION_WITH</code> / <code>_AGAINST</code> are measured against; <code>window_ms == 0</code> turns it off.</td></tr>
              <tr><td><code>medius_device_clear_name(MediusDevice *dev)</code></td><td>Clear the name, back to the synthesised default. Read it back on <A href="/bindings/c/types#version"><code>MediusVersion.name</code></A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="queries" data-search-target>
        <Card>
          <CardHeader title="Queries" subtitle="Read box state; each blocks for one reply" />
          <p>
            See <A href="/library/requests">Requests</A>. Each blocks for the box's reply, writes a
            struct documented on <A href="/bindings/c/types">Types &amp; errors</A>, and returns{' '}
            <code>MEDIUS_STATUS_ERR_QUERY_TIMEOUT</code> if no reply arrives.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Writes to <code>*out</code></th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_query_version(dev, MediusVersion *out)</code></td><td><A href="/bindings/c/types#version"><code>MediusVersion</code></A>: protocol + firmware version.</td></tr>
              <tr><td><code>medius_device_query_health(dev, MediusHealth *out)</code></td><td><A href="/bindings/c/types#health"><code>MediusHealth</code></A>: link, mouse, clone, injection flags.</td></tr>
              <tr><td><code>medius_device_device_info(dev, MediusDeviceInfo *out)</code></td><td><A href="/bindings/c/types#device-info"><code>MediusDeviceInfo</code></A>: the cloned device's USB identity, kind, and product.</td></tr>
              <tr><td><code>medius_device_caps(dev, MediusCaps *out)</code></td><td><A href="/bindings/c/types#caps"><code>MediusCaps</code></A>: mouse/keyboard capabilities.</td></tr>
              <tr><td><code>medius_device_query_rate(dev, MediusRate *out)</code></td><td><A href="/bindings/c/types#rate"><code>MediusRate</code></A>: native report rate and poll period.</td></tr>
              <tr><td><code>medius_device_query_stats(dev, MediusStats *out)</code></td><td><A href="/bindings/c/types#stats"><code>MediusStats</code></A>: box-side telemetry.</td></tr>
              <tr><td><code>medius_device_query_locks(dev, MediusLocks *out)</code></td><td><A href="/bindings/c/types#locks"><code>MediusLocks</code></A>: every weighed direction (entry list).</td></tr>
              <tr><td><code>medius_device_query_catch(dev, MediusCatchState *out)</code></td><td><A href="/bindings/c/types#catch-state"><code>MediusCatchState</code></A>: the accepted subscription entries with their per-entry drops, the box-wide drop count, and the inter-chip clock estimate.</td></tr>
              <tr><td><code>medius_device_query_imperfect(dev, MediusImperfectStatus *out)</code></td><td><A href="/bindings/c/types#imperfect-status"><code>MediusImperfectStatus</code></A>: imperfect-clone state.</td></tr>
              <tr><td><code>medius_device_query_movement_riding(dev, bool *out_enabled, uint32_t *out_window_ms)</code></td><td>Whether riding is on, and the window in ms (0 when off).</td></tr>
              <tr><td><code>medius_device_query_emit_pace(dev, MediusEmitPaceStatus *out)</code></td><td><A href="/bindings/c/types#emit-pace-status"><code>MediusEmitPaceStatus</code></A>: pacing mode, rate in effect, and the rate the clone advertises.</td></tr>
              <tr><td><code>medius_device_query_render(dev, MediusRenderStatus *out)</code></td><td><A href="/bindings/c/types#render-status"><code>MediusRenderStatus</code></A>: the texture, whether the device's own motion goes through it, and whether a profile has armed.</td></tr>
              <tr><td><code>medius_device_query_bearing(dev, MediusBearing *out)</code></td><td><A href="/bindings/c/types#bearing"><code>MediusBearing</code></A>: the bearing window and geometry.</td></tr>
              <tr><td><code>medius_device_counters(dev, MediusCountersSnapshot *out)</code></td><td><A href="/bindings/c/types#counters"><code>MediusCountersSnapshot</code></A>: host-side wire counters.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="update" data-search-target>
        <Card>
          <CardHeader title="Firmware update" subtitle="Write either chip over the open connection" />
          <p>
            See <A href="/library/update">Firmware update</A>. Staging blocks for the whole transfer;
            a refusal returns <code>MEDIUS_STATUS_ERR_UPDATE</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_firmware_info(dev, MediusFirmwareInfo *out)</code></td><td>Both chips' versions, the slot each runs, and what is staged.</td></tr>
              <tr><td><code>medius_device_stage_firmware(dev, target, image, len, progress, user)</code></td><td>Write <code>len</code> bytes into <code>target</code>'s spare slot (0 = device chip, 1 = host chip). Inert until activated; <code>progress</code> may be <code>NULL</code>.</td></tr>
              <tr><td><code>medius_device_activate_firmware(dev)</code></td><td>Commit every staged image and reboot into it. Blocks while the host chip reboots and comes back.</td></tr>
              <tr><td><code>medius_device_abort_update(dev, target)</code></td><td>Throw a staged or in-flight transfer away.</td></tr>
            </tbody>
          </table>
          <pre class="api-signature">typedef void (*MediusUpdateProgress)(void *user, size_t sent, size_t total);</pre>
        </Card>
      </div>

      <div id="streams" data-search-target>
        <Card>
          <CardHeader title="Streams" subtitle="Subscribe to live input and logs" />
          <p>
            Consuming events is on <A href="/bindings/c/streams">Streams</A>, the catch feature
            on <A href="/library/catch">Catch</A>, and logs on{' '}
            <A href="/library/diagnostics">Logs &amp; counters</A>.
          </p>
          <p>
            <code>medius_device_catch_events</code> takes an array of{' '}
            <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A> entries, built
            by the <A href="/bindings/c/api#catch-filters">filter helpers</A>. The box's table holds 32;
            asking for more, or for an entry it cannot honour, fails the call.
          </p>
          <pre class="api-signature">{`MediusStatus medius_device_catch_events(MediusDevice *dev,
                                        const MediusCatchFilter *filters,
                                        uintptr_t n_filters,
                                        MediusEventStream **out);

MediusStatus medius_device_input_events(MediusDevice *dev,
                                        const MediusCatchFilter *filters,
                                        uintptr_t n_filters,
                                        MediusInputStream **out);`}</pre>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_catch_events(dev, const MediusCatchFilter *filters, uintptr_t n_filters, MediusEventStream **out)</code></td><td>Subscribe to the addressed input and traffic classes; each element becomes one table entry.</td></tr>
              <tr><td><code>medius_event_stream_clone(const MediusEventStream *stream)</code></td><td>Another handle to the same subscription. Null in &rarr; null out.</td></tr>
              <tr><td><code>medius_event_stream_free(MediusEventStream *stream)</code></td><td>Free a handle; the subscription ends with the last one.</td></tr>
              <tr><td><code>medius_event_stream_recv(stream, MediusCatchEvent *out)</code></td><td>Block for the next event; <code>MEDIUS_STATUS_ERR_DISCONNECTED</code> on close.</td></tr>
              <tr><td><code>medius_event_stream_try_recv(stream, MediusCatchEvent *out)</code></td><td>Next buffered event; returns <code>false</code> if none (never blocks).</td></tr>
              <tr><td><code>medius_event_stream_recv_timeout(stream, uint64_t timeout_ms, MediusCatchEvent *out)</code></td><td>Block up to <code>timeout_ms</code>; <code>false</code> on timeout or close.</td></tr>
              <tr><td><code>medius_event_stream_dropped(stream)</code></td><td>Events dropped because the consumer fell behind.</td></tr>
              <tr><td><code>medius_device_input_events(dev, const MediusCatchFilter *filters, uintptr_t n_filters, MediusInputStream **out)</code></td><td>Subscribe to decoded press/release edges. Every filter must name an input class and cover both edges. See <A href="/bindings/c/streams#input">Decoded input</A>.</td></tr>
              <tr><td><code>medius_input_stream_recv</code> / <code>_try_recv</code> / <code>_recv_timeout(stream, …, MediusInputEvent *out)</code></td><td>Pull the next <A href="/bindings/c/types#input-event"><code>MediusInputEvent</code></A> (block / non-block / timed).</td></tr>
              <tr><td><code>medius_input_stream_held(stream, MediusClass class_, MediusUsage *out, uintptr_t cap)</code></td><td>Write that class's held usages into <code>out</code>; returns how many there are.</td></tr>
              <tr><td><code>medius_input_stream_dropped(stream)</code> / <code>medius_input_stream_free(stream)</code></td><td>Events lost behind a slow consumer / release the handle. There is no input-stream clone.</td></tr>
              <tr><td><code>medius_timeline_new()</code> / <code>_free(t)</code></td><td>Open / release a <A href="/bindings/c/streams#timeline">timeline</A> that maps box stamps onto your own clock.</td></tr>
              <tr><td><code>medius_timeline_observe(t, const MediusCatchEvent *ev, uint64_t now_ns, MediusStamped *out)</code></td><td>Place one event on the caller's monotonic scale, unwrapped past the 32-bit rollover.</td></tr>
              <tr><td><code>medius_timeline_reset(t, MediusClockDomain domain)</code> / <code>_samples(t, domain)</code></td><td>Forget a rebooted chip's rollover count and floor / how many events that domain has fed in.</td></tr>
              <tr><td><code>medius_device_logs(MediusDevice *dev, MediusLogStream **out)</code></td><td>Open the device log-line stream.</td></tr>
              <tr><td><code>medius_log_stream_clone</code> / <code>medius_log_stream_free</code></td><td>Clone / free a log-stream handle.</td></tr>
              <tr><td><code>medius_log_stream_recv</code> / <code>try_recv</code> / <code>recv_timeout(stream, …, MediusLogLine *out)</code></td><td>Pull the next <A href="/bindings/c/types#log-line"><code>MediusLogLine</code></A> (block / non-block / timed).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="catch-filters" data-search-target>
        <Card>
          <CardHeader title="Catch filters" subtitle="Name one subscription entry, then narrow it" />
          <p>
            Pure constructors for a{' '}
            <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A>: a base names
            what to observe, a modifier returns a narrowed copy. No device, no wire traffic. See{' '}
            <A href="/library/catch">Catch</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Addresses</th></tr></thead>
            <tbody>
              <tr><td><code>medius_catch_filter_watch(MediusUsage usage)</code></td><td>One momentary usage: a button, key, or media usage. The same thing <code>medius_device_lock</code> takes.</td></tr>
              <tr><td><code>medius_catch_filter_watch_axis(MediusAxis axis)</code></td><td>One relative <A href="/bindings/c/types#axis"><code>MediusAxis</code></A>.</td></tr>
              <tr><td><code>medius_catch_filter_watch_class(MediusClass class_)</code></td><td>Every usage in one momentary class.</td></tr>
              <tr><td><code>medius_catch_filter_watch_axes()</code></td><td>Every relative axis: X, Y, and the wheel.</td></tr>
              <tr><td><code>medius_catch_filter_all_input(MediusCatchFilter *out)</code></td><td>Writes the four input-class filters to <code>out[0..4]</code>: buttons, keys, media, axes. The whole of what <code>medius_device_input_events</code> can report.</td></tr>
              <tr><td><code>medius_catch_filter_traffic(MediusCatchClass class_, uint16_t id)</code></td><td>One traffic address: an endpoint, an interface, or a control endpoint number.</td></tr>
              <tr><td><code>medius_catch_filter_traffic_class(MediusCatchClass class_)</code></td><td>Every id within one traffic class.</td></tr>
              <tr><td><code>medius_catch_filter_everything()</code></td><td>Every class, every id, both directions, whole packets. One table entry, not an expansion.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MODIFIERS</div>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns a copy of <code>f</code></th></tr></thead>
            <tbody>
              <tr><td><code>medius_catch_filter_with_direction(f, uint8_t direction)</code></td><td>Restricted to one direction, sign, or edge.</td></tr>
              <tr><td><code>medius_catch_filter_with_capture(f, uint8_t bytes)</code></td><td>Keeping only the first <code>bytes</code> of each packet; <code>0</code> keeps the whole one. Traffic classes only.</td></tr>
              <tr><td><code>medius_catch_filter_on_press(f)</code> / <code>_on_release(f)</code></td><td>Restricted to the press / release edge.</td></tr>
              <tr><td><code>medius_catch_filter_inbound(f)</code> / <code>_outbound(f)</code></td><td>Restricted to traffic from the device to the PC / from the PC to the device.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              <code>medius_catch_filter_everything</code> includes{' '}
              <code>MEDIUS_CATCH_CLASS_VENDOR_BULK</code>, which can saturate the control link on its
              own. Pair it with <code>medius_catch_filter_with_capture</code> unless you mean to trace
              bulk in full. The queue ranking is on{' '}
              <A href="/native/commands/catch#delivery">Delivery</A>.
            </p>
          </div>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-c">{`/* the wheel, scrolled up only */
MediusCatchFilter up = medius_catch_filter_with_direction(
    medius_catch_filter_watch_axis(MEDIUS_AXIS_WHEEL), MEDIUS_DIRECTION_POSITIVE);

/* EP0, first 8 bytes: the setup packet and nothing after it */
MediusCatchFilter ep0 = medius_catch_filter_with_capture(
    medius_catch_filter_traffic(MEDIUS_CATCH_CLASS_CONTROL, 0), 8);`}</code></pre>
        </Card>
      </div>

      <div id="clip" data-search-target>
        <Card>
          <CardHeader title="Buffered clip playback" subtitle="Preload a per-frame stream, box-clocked" />
          <p>
            Build an entry stream with an opaque <code>MediusClipBuilder</code>, then drive playback through
            an opaque <code>MediusClip</code> handle from <code>medius_device_clip</code>. Each owns its
            allocation: free the builder with <code>medius_clip_builder_free</code> and the handle with{' '}
            <code>medius_clip_free</code>. Concept on <A href="/library/clip">Clip</A>.
          </p>
          <div class="api-response-label">BUILDER</div>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_clip_builder_new() / _free(b) / _clear(b)</code></td><td>Allocate / free / reset a builder.</td></tr>
              <tr><td><code>medius_clip_builder_gap(b, uint16_t frames)</code></td><td>A gap run (0 = no-op).</td></tr>
              <tr><td><code>medius_clip_builder_move(b, dx, dy) / _wheel(b, dz)</code></td><td>A cursor / wheel motion frame.</td></tr>
              <tr><td><code>medius_clip_builder_press / _release / _force_release(b, usage)</code></td><td>A one-edge press / soft-release / force-release frame; <code>usage</code> is a <A href="/bindings/c/types#input"><code>MediusUsage</code></A> (button, key, or media).</td></tr>
              <tr><td><code>medius_clip_builder_edge(b, usage, action)</code></td><td>A one-edge frame for any <A href="/bindings/c/types#input"><code>MediusUsage</code></A> with an explicit <A href="/bindings/c/types#action"><code>MediusAction</code></A>.</td></tr>
              <tr><td><code>medius_clip_builder_frame(b, dx, dy, wheel, inputs, actions, n)</code></td><td>A motion delta plus up to 8 edges on one frame: parallel <A href="/bindings/c/types#input"><code>MediusUsage</code></A> / <A href="/bindings/c/types#action"><code>MediusAction</code></A> arrays. Build the inputs with <code>medius_usage_button</code>/<code>_key</code>/<code>_media</code>.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-c">{`MediusClipBuilder *b = medius_clip_builder_new();

/* move (+10, -4) AND press Left on the same frame */
MediusUsage  inputs[1]  = { medius_usage_button(MEDIUS_BUTTON_LEFT) };
MediusAction actions[1] = { MEDIUS_ACTION_PRESS };
medius_clip_builder_frame(b, 10, -4, 0, inputs, actions, 1);`}</code></pre>
          <div class="api-response-label">HANDLE</div>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_clip(dev, out) / medius_clip_free(clip)</code></td><td>Open / free a clip handle.</td></tr>
              <tr><td><code>medius_clip_append(clip, b)</code></td><td>Append the builder's entries to the ring.</td></tr>
              <tr><td><code>medius_clip_set_autolock(clip, const MediusBlanket *scope, uintptr_t scope_len)</code></td><td>The auto-lock scope: the <A href="/bindings/c/types#blanket"><code>MediusBlanket</code></A> groups <code>scope</code> points at (<code>NULL</code> / 0 = no lock). Set before the first append.</td></tr>
              <tr><td><code>medius_clip_set_loop(clip, uint8_t on) / _set_retain(clip, uint8_t on)</code></td><td>Loop at the clip end (retained only) / retain the loaded clip so it can rewind and replay (0 = streaming, the default).</td></tr>
              <tr><td><code>medius_clip_set_ride(clip, uint8_t on)</code></td><td>Run the clip's motion under <A href="/library/options#set-movement-riding">movement riding</A> (0 = the box's own clock, the default).</td></tr>
              <tr><td><code>medius_clip_finalize(clip)</code></td><td>Fix a retained clip's end so it can replay and loop.</td></tr>
              <tr><td><code>medius_clip_bind(clip, MediusClipTrigger trigger)</code></td><td>Add or overwrite a <A href="/bindings/c/types#clip-trigger"><code>MediusClipTrigger</code></A>: a <A href="/bindings/c/types#edge"><code>MediusEdge</code></A> of <code>on</code> drives a <A href="/bindings/c/types#clip-action"><code>MediusClipAction</code></A>; <code>consume</code> hides the input from the game.</td></tr>
              <tr><td><code>medius_clip_unbind(clip, MediusUsage usage, MediusEdge edge) / _clear_triggers(clip)</code></td><td>Remove the binding on that usage + edge; drop every binding.</td></tr>
              <tr><td><code>medius_clip_start(clip) / _stop(clip)</code></td><td>Rewind and play (or resume a pause) / stop, flush a streaming clip (rewind a retained one), and release held input and the auto-lock.</td></tr>
              <tr><td><code>medius_clip_pause(clip) / _resume(clip)</code></td><td>Halt mid-clip, retaining the cursor and held input / continue from the paused cursor.</td></tr>
              <tr><td><code>medius_clip_restart(clip) / _toggle(clip)</code></td><td>Force a rewind and play, even mid-playback / play if idle or paused, stop if playing.</td></tr>
              <tr><td><code>medius_clip_clear(clip)</code></td><td>Discard the loaded clip, free the ring, and clear a <code>Faulted</code> state.</td></tr>
              <tr><td><code>medius_clip_query_status(clip, out)</code></td><td>Fill a <A href="/bindings/c/types#clip-status"><code>MediusClipStatus</code></A>: ring depth, progress, and playback counters.</td></tr>
              <tr><td><code>medius_clip_query_config(clip, out)</code></td><td>Fill a <A href="/bindings/c/types#clip-settings"><code>MediusClipSettings</code></A>: auto-lock scope, loop/retain, finalized, and the trigger set.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="builders" data-search-target>
        <Card>
          <CardHeader title="Usage, motion & lock-target builders" subtitle="Make the value structs the calls take" />
          <p>Pure constructors: no device, no wire traffic. See <A href="/library/inject">Inject</A>, <A href="/library/move">Move</A>, and <A href="/library/lock">Lock</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>medius_usage_button(MediusButton button)</code></td><td><A href="/bindings/c/types#input"><code>MediusUsage</code></A> for <code>medius_device_inject</code>.</td></tr>
              <tr><td><code>medius_usage_key(MediusKey key)</code></td><td><code>MediusUsage</code> addressing a keyboard key.</td></tr>
              <tr><td><code>medius_usage_media(MediusMediaKey media)</code></td><td><code>MediusUsage</code> addressing a media key.</td></tr>
              <tr><td><code>medius_motion_cursor(int16_t dx, int16_t dy)</code></td><td><A href="/bindings/c/types#motion"><code>MediusMotion</code></A> for <code>medius_device_move_axis</code>.</td></tr>
              <tr><td><code>medius_motion_wheel(int16_t delta)</code></td><td><code>MediusMotion</code> for a wheel scroll.</td></tr>
              <tr><td><code>medius_lock_target_axis(MediusLockTargetKind kind)</code></td><td><A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A> for an axis (<code>X</code> / <code>Y</code> / <code>Wheel</code>).</td></tr>
              <tr><td><code>medius_lock_target_usage(MediusUsage usage)</code></td><td><code>MediusLockTarget</code> for a usage (button, key, or media).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="inspectors" data-search-target>
        <Card>
          <CardHeader title="Struct inspectors" subtitle="Read query / event results without the wire" />
          <p>Helpers that interpret a struct you already have. They take it by value (or pointer) and do no I/O. Each mirrors the matching method on the <A href="/library/types">Rust type</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>medius_locks_scale_of(const MediusLocks *locks, MediusLockTarget target, uint8_t dir)</code></td><td><code>uint8_t</code>: percent of the physical value kept there, 100 when nothing weighs it. See <A href="/library/lock">Lock</A>.</td></tr>
              <tr><td><code>medius_locks_is_locked(const MediusLocks *locks, MediusLockTarget target, uint8_t dir)</code></td><td><code>bool</code>: is that target/direction blocked outright (<code>Both</code> needs both fixed signs). A direction merely weighed is not locked.</td></tr>
              <tr><td><code>medius_rate_native_hz(MediusRate rate, float *out_hz)</code></td><td><code>bool</code>: writes the native rate in Hz; <code>false</code> when there is no continuous cadence.</td></tr>
              <tr><td><code>medius_usage_event_is_held(const MediusUsageEvent *event, MediusUsage usage)</code></td><td><code>bool</code>: is that usage (button, key, or media) held in the snapshot.</td></tr>
              <tr><td><code>medius_traffic_event_truncated(const MediusTrafficEvent *ev)</code></td><td><code>bool</code>: <code>ev-&gt;len &lt; ev-&gt;true_len</code>, so the box cut the packet at the matching entry's <code>capture</code>. Without the comparison a cut packet and a genuinely short one look identical. See <A href="/bindings/c/types#traffic-event"><code>MediusTrafficEvent</code></A>.</td></tr>
              <tr><td><code>medius_traffic_event_setup(const MediusTrafficEvent *ev)</code></td><td><code>const uint8_t *</code>: the 8-byte setup packet of a CONTROL event, or <code>NULL</code> for another class or a capture cut shorter than the setup stage.</td></tr>
              <tr><td><code>medius_traffic_event_data(const MediusTrafficEvent *ev, uintptr_t *out_len)</code></td><td><code>const uint8_t *</code>: the data stage of a CONTROL event, the whole packet for any other class. Both point into <code>ev</code>.</td></tr>
              <tr><td><code>medius_traffic_event_control_status(const MediusTrafficEvent *ev, MediusControlStatus *out)</code></td><td><code>bool</code>: what the real device answered; <code>false</code> for any class but CONTROL.</td></tr>
              <tr><td><code>medius_traffic_event_bus_event(const MediusTrafficEvent *ev, MediusBusEvent *out)</code></td><td><code>bool</code>: the decoded lifecycle event; <code>false</code> for any class but BUS or an unknown kind.</td></tr>
              <tr><td><code>medius_traffic_event_bulk_end_of_transfer(ev)</code> / <code>medius_traffic_event_bulk_zlp(ev)</code></td><td><code>bool</code>: end-of-transfer / zero-length packet, for a <code>VENDOR_BULK</code> event. A ZLP carries no bytes and still terminates a transfer.</td></tr>
              <tr><td><code>medius_catch_filter_same_address(MediusCatchFilter a, MediusCatchFilter b)</code></td><td><code>bool</code>: the two name the same box table entry, whatever their captures.</td></tr>
              <tr><td><code>medius_catch_class_is_input(MediusCatchClass class_)</code> / <code>_is_traffic(class_)</code></td><td><code>bool</code>: one of the four parsed-input classes, which carry no packet / one of the seven byte-oriented ones.</td></tr>
              <tr><td><code>medius_clip_status_is_held(const MediusClipStatus *status, MediusUsage usage)</code></td><td><code>bool</code>: is the clip holding that usage down.</td></tr>
              <tr><td><code>medius_caps_has_mouse(MediusCaps caps)</code></td><td><code>bool</code>: a mouse interface is bound. See <A href="/library/requests">Requests</A>.</td></tr>
              <tr><td><code>medius_caps_has_keyboard(MediusCaps caps)</code></td><td><code>bool</code>: a keyboard interface is bound.</td></tr>
              <tr><td><code>medius_caps_is_composite(MediusCaps caps)</code></td><td><code>bool</code>: the clone is multi-HID-interface.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="module" data-search-target>
        <Card>
          <CardHeader title="Library functions" subtitle="Library-level helpers and errors" />
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_last_error_message(char *buf, uintptr_t cap)</code></td><td>Copy the last error's text into <code>buf</code>; returns the full length (size a buffer and retry). See <A href="/bindings/c/types#errors">errors</A>.</td></tr>
              <tr><td><code>medius_last_error_proto_ver()</code></td><td>The proto-version byte from the last <code>MEDIUS_STATUS_ERR_BAD_PROTO_VER</code>, or 0.</td></tr>
              <tr><td><code>medius_default_query_timeout_ms()</code></td><td>The default query reply wait, in ms.</td></tr>
              <tr><td><code>medius_default_keepalive_cadence_ms()</code></td><td>The default <A href="/library/guides/connection#keepalive">keepalive</A> interval, in ms.</td></tr>
              <tr><td><code>medius_abi_version()</code></td><td>The C ABI version, bumped on any breaking header change; currently <code>6</code>. Check it at start-up when you load the library dynamically, since a mismatched header and library agree on symbol names but not on struct layout.</td></tr>
              <tr><td><code>medius_version_string()</code></td><td>The crate version as a static NUL-terminated string.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="mock" data-search-target>
        <Card>
          <CardHeader title="Mock box" subtitle="Scriptable fake for tests, feature-gated" />
          <p>
            All of these are wrapped in <code>#ifdef MEDIUS_FEATURE_MOCK</code> (the <code>mock</code>{' '}
            <a href="https://doc.rust-lang.org/cargo/reference/features.html" target="_blank" rel="noreferrer">cargo feature</a>). The concept lives on <A href="/library/features/mock">Mock</A>; turning the
            feature on is on <A href="/bindings/c/build">Build &amp; features</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_mock_new()</code></td><td>A fresh mock that records commands and auto-replies to queries.</td></tr>
              <tr><td><code>medius_mock_clone</code> / <code>medius_mock_free(MediusMockBox *mock)</code></td><td>Share (same state) / free a mock handle.</td></tr>
              <tr><td><code>medius_device_with_mock(const MediusMockBox *mock, MediusDevice **out)</code></td><td>Build a <code>MediusDevice</code> over the mock <em>without</em> a handshake.</td></tr>
              <tr><td><code>medius_device_open_mock(const MediusMockBox *mock, MediusDevice **out)</code></td><td>Build a <code>MediusDevice</code> over the mock <em>and</em> run the handshake.</td></tr>
              <tr><td><code>medius_mock_set_version / _health / _device_info / _caps / _mouse_caps / _kbd_caps / _rate / _stats / _locks / _catch_state / _imperfect_status</code></td><td>Set the value the mock returns for each query.</td></tr>
              <tr><td><code>medius_mock_set_movement_riding(mock, bool enabled, uint32_t window_ms)</code></td><td>Set the movement-riding window the mock reports.</td></tr>
              <tr><td><code>medius_mock_set_bearing(mock, uint16_t window_ms, uint8_t mode)</code></td><td>Set the bearing the mock reports. A mode no constant names is ignored, as the box ignores it.</td></tr>
              <tr><td><code>medius_mock_silent(MediusMockBox *mock)</code></td><td>Stop answering queries for timeout tests (still records).</td></tr>
              <tr><td><code>medius_mock_push_raw(mock, const uint8_t *bytes, uintptr_t len)</code></td><td>Inject raw inbound bytes, as if the box sent them.</td></tr>
              <tr><td><code>medius_mock_push_log(mock, MediusLogLevel level, const char *text)</code></td><td>Push a LOG line onto the device's log stream.</td></tr>
              <tr><td><code>medius_mock_push_motion(mock, uint8_t seq, uint32_t ts_us, MediusMotionEvent event)</code></td><td>Push a <A href="/bindings/c/types#motion-event"><code>MediusMotionEvent</code></A> as a <code>Motion</code> catch event.</td></tr>
              <tr><td><code>medius_mock_push_usages(mock, uint8_t seq, uint32_t ts_us, const MediusUsageEvent *event)</code></td><td>Push a <A href="/bindings/c/types#usage-event"><code>MediusUsageEvent</code></A> as a <code>Usages</code> catch event.</td></tr>
              <tr><td><code>medius_mock_push_traffic(mock, uint8_t seq, uint32_t ts_us, MediusClockDomain clock, const MediusTrafficEvent *event)</code></td><td>Push a <A href="/bindings/c/types#traffic-event"><code>MediusTrafficEvent</code></A> as a <code>Traffic</code> catch event. A <code>true_len</code> above <code>len</code> is how a cut capture looks.</td></tr>
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
