import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../../shell/PageHeader';
import { DocSection } from '../../../shell/DocSection';

const Api: Component = () => {
  return (
    <>
      <PageHeader>
        <p>
          Every <code>medius_*</code> call in <A href="/bindings/c"><code>medius.h</code></A>, grouped.
          Semantics are in the <A href="/library">Rust library</A> (the{' '}
          <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer">medius crate</a>)
          and <A href="/native">Native API</A>; structs, enums and constants on{' '}
          <A href="/bindings/c/types">Types &amp; errors</A>; streams on{' '}
          <A href="/bindings/c/streams">Streams</A>.
        </p>
        <p>
          Most calls are <A href="/native/injection#fire-and-forget">fire-and-forget</A>: they
          return once the <A href="/native/frame">frame</A> is queued. Queries,{' '}
          <code>open</code> and <code>find</code> block for the{' '}
          <A href="/native/hardware">box</A>'s <A href="/native/commands/requests">reply</A>.
        </p>
        <p>
          Every fallible call returns a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A>{' '}
          (<code>MEDIUS_STATUS_OK</code> is 0) and writes its result through an out-param.{' '}
          <A href="/bindings/c/api#module"><code>medius_last_error_message()</code></A> gives the calling thread's last failure text.
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
            <code>MediusMockBox</code>) are yours to free, each with a matching <code>*_free</code>.
          </p>
          <p>
            Events and log lines are fixed-size structs with nothing to free per event; see{' '}
            <A href="/bindings/c/usage#lifecycle">Lifecycle</A>.
          </p>
        </div>
      </PageHeader>

      <DocSection id="connect" title="Connecting & lifecycle" caption="Open, share, and release the link">
        <p>See <A href="/library/connection">Connection</A> and <A href="/library/lifecycle">Lifecycle</A>.</p>
        <div class="table-scroll">
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
        </div>
      </DocSection>

      <DocSection id="discovery" title="Discovery" caption="Enumerate boxes and open one by identity">
        <p>See <A href="/library/discovery">Discovery</A>.</p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_list(MediusBoxInfo *out, uintptr_t cap, uintptr_t *out_total)</code></td><td>Enumerate every connected box into <code>out</code> (up to <code>cap</code>). Reads each box's version, and its cloned-device info if it speaks this protocol (a box on another protocol has <code>has_device</code> 0). Writes the total to <code>*out_total</code> and returns the number written. See <A href="/bindings/c/types#box-info"><code>MediusBoxInfo</code></A>.</td></tr>
              <tr><td><code>medius_device_open_by_id(const char *id, MediusDevice **out)</code></td><td>Open the box whose identity matches <code>id</code> (device MAC hex or CH343 serial) and handshake. <code>MEDIUS_STATUS_ERR_BAD_PROTO_VER</code> when that box speaks another protocol, <code>MEDIUS_STATUS_ERR_NOT_FOUND</code> when no box matches.</td></tr>
              <tr><td><code>medius_device_find_mouse_box(MediusDevice **out)</code></td><td>Open the first box whose clone is a mouse. If none is found and a connected box is on another protocol, returns <code>MEDIUS_STATUS_ERR_BAD_PROTO_VER</code> (that box's clone can't be read).</td></tr>
              <tr><td><code>medius_device_find_keyboard_box(MediusDevice **out)</code></td><td>Open the first box whose clone is a keyboard, with the same errors.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="move" title="Movement" caption="Relative cursor and wheel">
        <p>See <A href="/library/move">Move</A>. <code>+x</code> right, <code>+y</code> down. Build the axis struct with the <A href="/bindings/c/api#builders">motion helpers</A>.</p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_move_rel(MediusDevice *dev, int16_t dx, int16_t dy)</code></td><td>Move the cursor by a signed 16-bit delta.</td></tr>
              <tr><td><code>medius_device_wheel(MediusDevice *dev, int16_t delta)</code></td><td>Scroll the wheel.</td></tr>
              <tr><td><code>medius_device_move_rel_now(MediusDevice *dev, int16_t dx, int16_t dy)</code></td><td>The same, bypassing <A href="/library/options#set-movement-riding">movement riding</A>.</td></tr>
              <tr><td><code>medius_device_wheel_now(MediusDevice *dev, int16_t delta)</code></td><td>Scroll, bypassing movement riding.</td></tr>
              <tr><td><code>medius_device_pan(MediusDevice *dev, int16_t delta)</code></td><td>AC Pan (horizontal scroll), a full peer of the wheel.</td></tr>
              <tr><td><code>medius_device_pan_now(MediusDevice *dev, int16_t delta)</code></td><td>Pan, bypassing movement riding.</td></tr>
              <tr><td><code>medius_device_flush_motion(MediusDevice *dev)</code></td><td>Emit the motion held by movement riding, now.</td></tr>
              <tr><td><code>medius_device_discard_motion(MediusDevice *dev)</code></td><td>Drop the motion held by movement riding.</td></tr>
              <tr><td><code>medius_device_move_axis(MediusDevice *dev, MediusMotion motion, MediusMoveTiming timing, MediusPendingMotion pending)</code></td><td>Drive one axis from a <code>medius_motion_cursor(...)</code>, <code>medius_motion_wheel(...)</code>, or <code>medius_motion_pan(...)</code>.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="inject" title="Inject" caption="Drive any usage: button, key, or media">
        <p>
          One verb set over a <A href="/bindings/c/types#input"><code>MediusUsage</code></A> (button, key,
          or media). Build it with the <A href="/bindings/c/api#builders">input helpers</A>; see{' '}
          <A href="/library/inject">Inject</A>, the <A href="/native/injection">injection model</A>, and
          the id spaces on <A href="/native/commands/usage">Usage IDs</A>.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_inject(MediusDevice *dev, MediusUsage input, MediusAction action)</code></td><td>Apply a <A href="/bindings/c/types#action"><code>MediusAction</code></A> to a usage.</td></tr>
              <tr><td><code>medius_device_press(MediusDevice *dev, MediusUsage input)</code></td><td>Sends <code>MEDIUS_ACTION_PRESS</code>.</td></tr>
              <tr><td><code>medius_device_soft_release(MediusDevice *dev, MediusUsage input)</code></td><td>Sends <code>MEDIUS_ACTION_SOFT_RELEASE</code>.</td></tr>
              <tr><td><code>medius_device_force_release(MediusDevice *dev, MediusUsage input)</code></td><td>Sends <code>MEDIUS_ACTION_FORCE_RELEASE</code>.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--info">
          <p>
            A <A href="/bindings/c/types#key"><code>MediusKey</code></A>{' '}
            or <A href="/bindings/c/types#media-key"><code>MediusMediaKey</code></A> is a raw HID usage.
          </p>
        </div>
      </DocSection>

      <DocSection id="lock" title="Locks" caption="Weigh native input">
        <p>See <A href="/library/lock">Lock</A>. A <A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A> picks an axis or usage. <code>dir</code> takes a <A href="/bindings/c/types#direction"><code>MediusDirection</code></A> constant and <code>what</code> a <A href="/bindings/c/types#blanket"><code>MediusBlanket</code></A> constant; any other value is <code>MEDIUS_STATUS_ERR_INVALID_ARG</code> and sends no frame. Read the entries back with <A href="/bindings/c/api#inspectors"><code>medius_locks_scale_of</code></A> and <code>medius_locks_is_locked</code>.</p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_scale(MediusDevice *dev, MediusLockTarget target, uint8_t dir, int16_t scale)</code></td><td>Keep <code>scale</code> percent of an axis or usage in one direction, from <code>_MIN</code> (-255) to <code>_MAX</code> (255): <code>MEDIUS_LOCK_SCALE_BLOCK</code> (0) blocks, <code>_PASS</code> (100) passes untouched, and a negative reverses what it keeps (axes only).</td></tr>
              <tr><td><code>medius_device_scale_all(MediusDevice *dev, uint8_t what, uint8_t dir, int16_t scale)</code></td><td>The same over a whole class (aim, wheel, buttons, keys, or media).</td></tr>
              <tr><td><code>medius_device_lock(MediusDevice *dev, MediusLockTarget target, uint8_t dir)</code></td><td>Block an axis or usage on a direction: scale 0.</td></tr>
              <tr><td><code>medius_device_unlock(MediusDevice *dev, MediusLockTarget target, uint8_t dir)</code></td><td>Back to passing untouched: scale 100.</td></tr>
              <tr><td><code>medius_device_lock_all(MediusDevice *dev, uint8_t what, uint8_t dir)</code></td><td>Blanket block a whole class.</td></tr>
              <tr><td><code>medius_device_unlock_all(MediusDevice *dev, uint8_t what, uint8_t dir)</code></td><td>Release a blanket block.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--warning">
          <p>A negative percent inverts: <code>-100</code> on an axis flips it exactly. The delta's sign before weighing picks the direction, so a negative on one direction leaves the other alone. A negative on a button, key or media usage is <code>MEDIUS_STATUS_ERR_LOCK_SCALE_USAGE</code> (one bit has nothing to reverse). A magnitude outside the range is <code>..._ERR_LOCK_SCALE_RANGE</code>.</p>
          <p>A scale auto-clears unless the <A href="/library/guides/connection#keepalive">keepalive</A> holds it. <code>MEDIUS_DIRECTION_WITH</code> and <code>_AGAINST</code> need a live bearing (<code>medius_device_set_bearing</code>); their refusal rules are on <A href="/bindings/c/types#direction"><code>MediusDirection</code></A>.</p>
        </div>
      </DocSection>

      <DocSection id="led-admin-options" title="LED, admin & options" caption="Status light, resets, persistent settings">
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_led(MediusDevice *dev, MediusLedTarget target, MediusLedMode mode, uint8_t level)</code></td><td>Drive the status LED. See <A href="/library/led">LED</A>.</td></tr>
              <tr><td><code>medius_device_reset(MediusDevice *dev)</code></td><td>Clear all overrides. See <A href="/library/admin">Admin</A>.</td></tr>
              <tr><td><code>medius_device_factory_reset(MediusDevice *dev)</code></td><td>Clear all overrides, then the box erases its stored name, options and learned devices and reboots. See <A href="/library/admin#factory-reset">factory_reset</A>.</td></tr>
              <tr><td><code>medius_device_reapply(MediusDevice *dev)</code></td><td>Re-send the active settings.</td></tr>
              <tr><td><code>medius_device_reconnect(MediusDevice *dev)</code></td><td>Rescan, reopen this box, and re-apply held state (<A href="/library/lifecycle#reconnect">reconnect</A>). <code>MEDIUS_STATUS_ERR_BAD_PROTO_VER</code> if the box replies on another protocol, and the handle stays disconnected.</td></tr>
              <tr><td><code>medius_device_reboot(MediusDevice *dev, MediusRebootTarget target)</code></td><td>Reboot a chip to run or download mode.</td></tr>
              <tr><td><code>medius_device_allow_imperfect_clones(MediusDevice *dev, bool allow)</code></td><td>Opt in to cloning a device the box can't clone faithfully; this also opens the advanced control layer. If the toggle re-presents the clone, the session is released, and the library re-sends what it holds once the new clone is up. See <A href="/library/options">Options</A>.</td></tr>
              <tr><td><code>medius_device_set_movement_riding(MediusDevice *dev, bool enabled, uint32_t window_ms)</code></td><td>Set movement riding (the window is rounded to whole ms); <code>enabled == false</code> clears the window.</td></tr>
              <tr><td><code>medius_device_set_emit_pace(MediusDevice *dev, uint8_t mode, uint16_t hz, uint16_t force_hz)</code></td><td>Pick the pace (<code>hz</code> is the target for <code>FIXED</code>) and the advertised rate (<code>force_hz</code>, 0 = the native interval). Both go in one frame. A <code>mode</code> no constant names is <code>MEDIUS_STATUS_ERR_INVALID_ARG</code> and sends nothing. See <A href="/library/options">Options</A>.</td></tr>
              <tr><td><code>medius_device_set_name(MediusDevice *dev, const char *name)</code></td><td>Set the box's human-readable name (1-32 printable ASCII characters). See <A href="/library/options#set-name">Name</A>.</td></tr>
              <tr><td><code>medius_device_clear_name(MediusDevice *dev)</code></td><td>Clear the name, back to the synthesised default. Read it back on <A href="/bindings/c/types#version"><code>MediusVersion.name</code></A>.</td></tr>
              <tr><td><code>medius_device_set_bearing(MediusDevice *dev, uint16_t window_ms, uint8_t mode)</code></td><td>Set what <code>MEDIUS_DIRECTION_WITH</code> / <code>_AGAINST</code> are measured against; <code>window_ms == 0</code> turns the bearing off.</td></tr>
              <tr><td><code>medius_device_set_spread(MediusDevice *dev, uint16_t percent)</code></td><td>Spread each injected delta over <code>percent</code> of the command interval: 0 puts the whole delta on the next report, 100 spreads it over one interval, &gt;100 overlaps. See <A href="/library/options">Options</A>.</td></tr>
              <tr><td><code>medius_device_set_render(MediusDevice *dev, uint8_t mode, bool full)</code></td><td>Pick the texture (<A href="/bindings/c/types#render-mode"><code>MediusRenderMode</code></A>) and whether native motion is rendered by the model rather than relayed. Both share one frame. <code>full</code> is off on a box that has not been set. See <A href="/library/options">Options</A>.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="queries" title="Queries" caption="Read box state; each blocks for one reply">
        <p>
          See <A href="/library/requests">Requests</A>. Each writes a struct from{' '}
          <A href="/bindings/c/types">Types &amp; errors</A>, or returns{' '}
          <code>MEDIUS_STATUS_ERR_QUERY_TIMEOUT</code> when no reply arrives.
        </p>
        <div class="table-scroll">
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
              <tr><td><code>medius_device_query_bearing(dev, MediusBearing *out)</code></td><td><A href="/bindings/c/types#bearing"><code>MediusBearing</code></A>: the bearing window and geometry.</td></tr>
              <tr><td><code>medius_device_query_render(dev, MediusRenderStatus *out)</code></td><td><A href="/bindings/c/types#render-status"><code>MediusRenderStatus</code></A>: the texture, whether native motion goes through it, and whether a profile has armed.</td></tr>
              <tr><td><code>medius_device_query_spread(dev, MediusSpreadStatus *out)</code></td><td><A href="/bindings/c/types#spread-status"><code>MediusSpreadStatus</code></A>: how far an injected delta is spread, and the interval in effect.</td></tr>
              <tr><td><code>medius_device_counters(dev, MediusCountersSnapshot *out)</code></td><td><A href="/bindings/c/types#counters"><code>MediusCountersSnapshot</code></A>: host-side wire counters.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="update" title="Firmware update" caption="Write either chip over the open connection">
        <p>
          See <A href="/library/update">Firmware update</A>. Staging blocks for the whole transfer;
          a refusal returns <code>MEDIUS_STATUS_ERR_UPDATE</code>.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_firmware_info(dev, MediusFirmwareInfo *out)</code></td><td>Both chips' versions, the slot each runs, and what is staged.</td></tr>
              <tr><td><code>medius_device_stage_firmware(dev, target, image, len, progress, user)</code></td><td>Write <code>len</code> bytes into <code>target</code>'s spare slot (0 = device chip, 1 = host chip). Inert until activated; <code>progress</code> may be <code>NULL</code>.</td></tr>
              <tr><td><code>medius_device_activate_firmware(dev)</code></td><td>Commit every staged image and reboot into it. Blocks while the host chip reboots and comes back.</td></tr>
              <tr><td><code>medius_device_abort_update(dev, target)</code></td><td>Throw a staged or in-flight transfer away.</td></tr>
              <tr><td><code>medius_device_update_firmware(dev, target, image, len, progress, user)</code></td><td>Stage one image and activate it. A refused activate aborts the staged image before the error returns.</td></tr>
              <tr><td><code>medius_device_wait_firmware_confirmed(dev, MediusFirmwareInfo *out)</code></td><td>Block until neither chip is on <A href="/native/commands/update#rollback">probation</A>, polling the box through the reboot after an activate. After 55&nbsp;s: <code>MEDIUS_STATUS_ERR_UPDATE</code> if a chip is still on probation, <code>MEDIUS_STATUS_ERR_QUERY_TIMEOUT</code> if the box has not replied.</td></tr>
              <tr><td><code>medius_last_error_update(MediusUpdateError *out)</code></td><td>After <code>MEDIUS_STATUS_ERR_UPDATE</code>, write the refused op and its status to <code>out</code> (<A href="/bindings/c/types#update-error"><code>MediusUpdateError</code></A>); <code>false</code> if the thread's last error was not an update error.</td></tr>
            </tbody>
          </table>
        </div>
        <pre class="api-signature">void (*progress)(void *user, uintptr_t sent, uintptr_t total)</pre>
      </DocSection>

      <DocSection id="streams" title="Streams" caption="Subscribe to live input and logs">
        <p>
          Consuming events is on <A href="/bindings/c/streams">Streams</A>, the catch feature
          on <A href="/library/catch">Catch</A>, and logs on{' '}
          <A href="/library/diagnostics">Logs &amp; counters</A>.
        </p>
        <p>
          <code>medius_device_catch_events</code> takes an array of{' '}
          <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A> entries from
          the <A href="/bindings/c/api#catch-filters">filter helpers</A>. The box's table holds 32
          entries. More entries, or one the box cannot honour, fail the call.
        </p>
        <pre class="api-signature">{`MediusStatus medius_device_catch_events(MediusDevice *dev,
                                        const MediusCatchFilter *filters,
                                        uintptr_t n_filters,
                                        MediusEventStream **out);

MediusStatus medius_device_input_events(MediusDevice *dev,
                                        const MediusCatchFilter *filters,
                                        uintptr_t n_filters,
                                        MediusInputStream **out);`}</pre>
        <div class="table-scroll">
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
              <tr><td><code>medius_event_stream_is_connected(stream)</code></td><td>Whether the box still delivers. A <code>false</code> from <code>_try_recv</code> or <code>_recv_timeout</code> can't tell a closed stream from an empty one.</td></tr>
              <tr><td><code>medius_event_stream_close(stream)</code></td><td>End the subscription for every clone. A receive blocked on it in another thread returns at once. Free the handle once no thread uses it.</td></tr>
              <tr><td><code>medius_device_input_events(dev, const MediusCatchFilter *filters, uintptr_t n_filters, MediusInputStream **out)</code></td><td>Subscribe to decoded press/release edges. Every filter must name an input class and cover both edges. See <A href="/bindings/c/streams#input">Decoded input</A>.</td></tr>
              <tr><td><code>medius_input_stream_recv</code> / <code>_try_recv</code> / <code>_recv_timeout(stream, …, MediusInputEvent *out)</code></td><td>Pull the next <A href="/bindings/c/types#input-event"><code>MediusInputEvent</code></A> (block / non-block / timed).</td></tr>
              <tr><td><code>medius_input_stream_held(stream, MediusClass class_, MediusUsage *out, uintptr_t cap)</code></td><td>Write that class's held usages into <code>out</code>; returns how many there are.</td></tr>
              <tr><td><code>medius_input_stream_dropped(stream)</code> / <code>medius_input_stream_free(stream)</code></td><td>Events lost behind a slow consumer / release the handle. There is no input-stream clone.</td></tr>
              <tr><td><code>medius_input_stream_is_connected(stream)</code> / <code>_close(stream)</code></td><td>As for an event stream.</td></tr>
              <tr><td><code>medius_timeline_new()</code> / <code>_free(t)</code></td><td>Open / release a <A href="/bindings/c/streams#timeline">timeline</A> that maps box stamps onto the caller's clock.</td></tr>
              <tr><td><code>medius_timeline_observe(t, const MediusCatchEvent *ev, uint64_t now_ns, MediusStamped *out)</code></td><td>Place one event on the caller's monotonic scale, unwrapped past the 32-bit rollover.</td></tr>
              <tr><td><code>medius_timeline_observe_input(t, const MediusInputEvent *ev, uint64_t now_ns, MediusStamped *out)</code></td><td>The same for an input-stream event. One timeline orders events from both streams.</td></tr>
              <tr><td><code>medius_timeline_reset(t, MediusClockDomain domain)</code> / <code>_samples(t, domain)</code></td><td>Forget a rebooted chip's rollover count and floor / how many events that domain has fed in.</td></tr>
              <tr><td><code>medius_device_logs(MediusDevice *dev, MediusLogStream **out)</code></td><td>Open the device log-line stream.</td></tr>
              <tr><td><code>medius_log_stream_clone</code> / <code>medius_log_stream_free</code></td><td>Clone / free a log-stream handle.</td></tr>
              <tr><td><code>medius_log_stream_recv</code> / <code>try_recv</code> / <code>recv_timeout(stream, …, MediusLogLine *out)</code></td><td>Pull the next <A href="/bindings/c/types#log-line"><code>MediusLogLine</code></A> (block / non-block / timed).</td></tr>
              <tr><td><code>medius_log_stream_is_connected(stream)</code> / <code>_close(stream)</code></td><td>As for an event stream. Closing one log stream leaves the others reading.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="catch-filters" title="Catch filters" caption="Name one subscription entry, then narrow it">
        <p>
          Pure constructors for a{' '}
          <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A>: a base names
          what to observe, a modifier returns a narrowed copy. No device, no wire traffic. See{' '}
          <A href="/library/catch">Catch</A>.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Addresses</th></tr></thead>
            <tbody>
              <tr><td><code>medius_catch_filter_watch(MediusUsage usage)</code></td><td>One momentary usage (button, key, or media), as <code>medius_device_lock</code> takes it.</td></tr>
              <tr><td><code>medius_catch_filter_watch_axis(MediusAxis axis)</code></td><td>One relative <A href="/bindings/c/types#axis"><code>MediusAxis</code></A>.</td></tr>
              <tr><td><code>medius_catch_filter_watch_class(MediusClass class_)</code></td><td>Every usage in one momentary class.</td></tr>
              <tr><td><code>medius_catch_filter_watch_axes()</code></td><td>Every relative axis: X, Y, the wheel, and AC Pan.</td></tr>
              <tr><td><code>medius_catch_filter_all_input(MediusCatchFilter *out)</code></td><td>Writes the four input-class filters to <code>out[0..4]</code>: buttons, keys, media and axes (everything <code>medius_device_input_events</code> can report).</td></tr>
              <tr><td><code>medius_catch_filter_traffic(MediusCatchClass class_, uint16_t id)</code></td><td>One traffic address: an endpoint, an interface, or a control endpoint number.</td></tr>
              <tr><td><code>medius_catch_filter_traffic_class(MediusCatchClass class_)</code></td><td>Every id within one traffic class.</td></tr>
              <tr><td><code>medius_catch_filter_everything()</code></td><td>Every class, every id, both directions, whole packets. One table entry, not an expansion.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">MODIFIERS</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns a copy of <code>f</code></th></tr></thead>
            <tbody>
              <tr><td><code>medius_catch_filter_with_direction(f, uint8_t direction)</code></td><td>Restricted to one direction, sign, or edge.</td></tr>
              <tr><td><code>medius_catch_filter_with_capture(f, uint8_t bytes)</code></td><td>Keeping only the first <code>bytes</code> of each packet; <code>0</code> keeps the whole one. Traffic classes only.</td></tr>
              <tr><td><code>medius_catch_filter_on_press(f)</code> / <code>_on_release(f)</code></td><td>Restricted to the press / release edge.</td></tr>
              <tr><td><code>medius_catch_filter_inbound(f)</code> / <code>_outbound(f)</code></td><td>Restricted to traffic from the real device to the PC / from the PC to the real device.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="callout callout--info">
          <p>
            <code>medius_catch_filter_everything</code> includes{' '}
            <code>MEDIUS_CATCH_CLASS_VENDOR_BULK</code>, which can saturate the control link on its
            own. Pair it with <code>medius_catch_filter_with_capture</code> unless tracing bulk in
            full. Queue ranking: <A href="/native/commands/catch#delivery">Delivery</A>.
          </p>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-c">{`/* the wheel, scrolled up only */
MediusCatchFilter up = medius_catch_filter_with_direction(
    medius_catch_filter_watch_axis(MEDIUS_AXIS_WHEEL), MEDIUS_DIRECTION_POSITIVE);

/* EP0, first 8 bytes: the setup packet and nothing after it */
MediusCatchFilter ep0 = medius_catch_filter_with_capture(
    medius_catch_filter_traffic(MEDIUS_CATCH_CLASS_CONTROL, 0), 8);`}</code></pre>
      </DocSection>

      <DocSection id="clip" title="Buffered clip playback" caption="Preload a per-frame stream, box-clocked">
        <p>
          Build an entry stream with a <code>MediusClipBuilder</code>, fill a multi-field frame
          with a <code>MediusClipFrame</code>, then drive playback through the{' '}
          <code>MediusClip</code> from <code>medius_device_clip</code>. All three are opaque, each
          with a matching <code>*_free</code>. See <A href="/library/clip">Clip</A>.
        </p>
        <div class="api-response-label">BUILDER</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_clip_builder_new() / _free(b) / _clear(b)</code></td><td>Allocate / free / reset a builder.</td></tr>
              <tr><td><code>medius_clip_builder_byte_len(b)</code></td><td><code>uintptr_t</code>: ring bytes the entries take; compare with <A href="/bindings/c/types#clip-status"><code>MediusClipStatus.free</code></A> before an append.</td></tr>
              <tr><td><code>medius_clip_builder_gap(b, uint16_t frames)</code></td><td>A gap run (0 = no-op).</td></tr>
              <tr><td><code>medius_clip_builder_move(b, dx, dy) / _wheel(b, dz) / _pan(b, dpan)</code></td><td>A cursor / wheel / pan (horizontal scroll) motion frame.</td></tr>
              <tr><td><code>medius_clip_builder_press / _release / _force_release(b, usage)</code></td><td>A one-edge press / soft-release / force-release frame; <code>usage</code> is a <A href="/bindings/c/types#input"><code>MediusUsage</code></A> (button, key, or media).</td></tr>
              <tr><td><code>medius_clip_builder_edge(b, usage, action)</code></td><td>A one-edge frame for any <A href="/bindings/c/types#input"><code>MediusUsage</code></A> with an explicit <A href="/bindings/c/types#action"><code>MediusAction</code></A>.</td></tr>
              <tr><td><code>medius_clip_builder_raw(b, uint8_t ep_num, uint8_t dir, const uint8_t *bytes, uintptr_t len)</code></td><td>A frame carrying one raw report (see <code>medius_clip_frame_raw</code>).</td></tr>
              <tr><td><code>medius_clip_builder_transfer(b, uint8_t ep, MediusSetup setup,</code> <code>const uint8_t *out_data, uintptr_t out_len)</code></td><td>A frame carrying one control transfer (see <code>medius_clip_frame_transfer</code>).</td></tr>
              <tr><td><code>medius_clip_builder_frame(b, const MediusClipFrame *frame)</code></td><td>One frame carrying whatever <code>frame</code> holds. The builder takes a copy, so <code>frame</code> stays usable.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">FRAME</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_clip_frame_new() / _free(f) / _clear(f)</code></td><td>Allocate / free / reset a frame.</td></tr>
              <tr><td><code>medius_clip_frame_byte_len(f)</code></td><td><code>uintptr_t</code>: the ring bytes the frame takes. An append accepts a frame of up to <code>MEDIUS_CLIP_ENTRY_MAX</code> (512).</td></tr>
              <tr><td><code>medius_clip_frame_move(f, dx, dy) / _wheel(f, dz) / _pan(f, dpan)</code></td><td>Set the frame's cursor / wheel / pan (horizontal scroll) motion.</td></tr>
              <tr><td><code>medius_clip_frame_press / _release / _force_release(f, usage)</code></td><td>Add a press / soft-release / force-release edge of a <A href="/bindings/c/types#input"><code>MediusUsage</code></A>.</td></tr>
              <tr><td><code>medius_clip_frame_edge(f, usage, action)</code></td><td>Add an edge with an explicit <A href="/bindings/c/types#action"><code>MediusAction</code></A>, up to <A href="/bindings/c/types#capacities"><code>MEDIUS_CLIP_EDGES_MAX</code></A> (8) a frame.</td></tr>
              <tr><td><code>medius_clip_frame_raw(f, uint8_t ep_num, uint8_t dir, const uint8_t *bytes, uintptr_t len)</code></td><td>Add a raw report, as <A href="/bindings/c/api#advanced"><code>medius_device_raw</code></A> sends one; up to <code>MEDIUS_CLIP_RAW_MAX</code> (8) a frame. Played only with the imperfect-clone opt-in on.</td></tr>
              <tr><td><code>medius_clip_frame_transfer(f, uint8_t ep, MediusSetup setup,</code> <code>const uint8_t *out_data, uintptr_t out_len)</code></td><td>Add a control transfer, as <code>medius_device_transfer</code> runs one: <code>out_data</code> is <code>setup.length</code> bytes for an OUT request, none for an IN one. The reply arrives as a <A href="/bindings/c/types#catch-class"><code>MEDIUS_CATCH_CLASS_CLIP_TRANSFER</code></A> event. The box runs it only while the opt-in is on.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-c">{`MediusClipBuilder *b = medius_clip_builder_new();
MediusClipFrame   *f = medius_clip_frame_new();

/* move (+10, -4) and press Left on the same frame */
medius_clip_frame_move(f, 10, -4);
medius_clip_frame_press(f, medius_usage_button(MEDIUS_BUTTON_LEFT));
medius_clip_builder_frame(b, f);              /* the builder copies it */

/* reuse the frame: the next tick queues a SET_REPORT to the real device */
MediusSetup   setup  = { .request_type = 0x21, .request = 0x09,
                         .value = 0x0300, .index = 0, .length = 2 };
const uint8_t out[2] = { 0x04, 0x01 };
medius_clip_frame_clear(f);
medius_clip_frame_transfer(f, 0, setup, out, sizeof out);
medius_clip_builder_frame(b, f);

medius_clip_frame_free(f);`}</code></pre>
        <div class="api-response-label">HANDLE</div>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_clip(dev, out) / medius_clip_free(clip)</code></td><td>Open / free a clip handle.</td></tr>
              <tr><td><code>medius_clip_append(clip, b)</code></td><td>Append the builder's entries to the ring. Every entry is checked first, so a refusal sends nothing: <A href="/bindings/c/types#errors"><code>MEDIUS_STATUS_ERR_CLIP_FRAME_COUNT</code></A>, <code>_CLIP_FRAME_TOO_LONG</code>, <code>_CLIP_TRANSFER_DATA</code>, <code>_RAW_DIRECTION</code>, or <code>_RELATIVE_DIRECTION</code>.</td></tr>
              <tr><td><code>medius_clip_set_autolock(clip, const MediusBlanket *scope, uintptr_t scope_len)</code></td><td>Set the auto-lock scope to the <A href="/bindings/c/types#blanket"><code>MediusBlanket</code></A> groups in <code>scope</code> (<code>NULL</code> / 0 = no lock). Set it before the first append.</td></tr>
              <tr><td><code>medius_clip_set_loop(clip, uint8_t on) / _set_retain(clip, uint8_t on)</code></td><td>Loop at the clip end (retained only) / retain the loaded clip so it can rewind and replay (0 = streaming, the default).</td></tr>
              <tr><td><code>medius_clip_set_ride(clip, uint8_t on)</code></td><td>Run the clip's motion under <A href="/library/options#set-movement-riding">movement riding</A> (0 = the box's clock, the default). While rendering is on with a profile armed, only the clip's wheel and pan ride.</td></tr>
              <tr><td><code>medius_clip_finalize(clip)</code></td><td>Fix a retained clip's end so it can replay and loop.</td></tr>
              <tr><td><code>medius_clip_bind(clip, MediusClipTrigger trigger)</code></td><td>Add or overwrite a <A href="/bindings/c/types#clip-trigger"><code>MediusClipTrigger</code></A>: a <A href="/bindings/c/types#edge"><code>MediusEdge</code></A> of <code>on</code> drives a <A href="/bindings/c/types#clip-action"><code>MediusClipAction</code></A>; <code>consume</code> hides the input from the game.</td></tr>
              <tr><td><code>medius_clip_unbind(clip, MediusUsage usage, MediusEdge edge)</code></td><td>Remove the input trigger on that usage + edge.</td></tr>
              <tr><td><code>medius_clip_bind_packet(clip, const MediusClipPacketTrigger *trigger)</code></td><td>Add or overwrite a <A href="/bindings/c/types#clip-packet-trigger"><code>MediusClipPacketTrigger</code></A>. A matched packet drives its <A href="/bindings/c/types#clip-action"><code>MediusClipAction</code></A> on the frame clock's next tick; only the <A href="/library/clip#packet-triggers">most specific</A> matching trigger acts. A trigger the box would refuse is <A href="/bindings/c/types#errors"><code>MEDIUS_STATUS_ERR_CLIP_PACKET_TRIGGER</code></A> before anything is sent: the <A href="/library/clip#packet-triggers">crate's refusals</A>, or a <code>selector_len</code> without <code>once_per_run</code>. A bind the box itself refuses leaves the set unchanged: compare <code>medius_clip_query_config</code>'s readback with what was bound.</td></tr>
              <tr><td><code>medius_clip_unbind_packet(clip, const MediusClipPacketTrigger *trigger)</code></td><td>Remove the packet trigger keyed by <code>trigger</code>'s class, id, direction, match and mask. Its other fields are ignored. A key the box cannot hold is refused, as by <code>medius_clip_bind_packet</code>.</td></tr>
              <tr><td><code>medius_clip_clear_triggers(clip)</code></td><td>Remove every trigger of both kinds.</td></tr>
              <tr><td><code>medius_clip_start(clip) / _stop(clip)</code></td><td>Rewind and play (or resume a pause) / stop, flush a streaming clip (rewind a retained one), and release held input and the auto-lock.</td></tr>
              <tr><td><code>medius_clip_pause(clip) / _resume(clip)</code></td><td>Halt mid-clip, retaining the cursor and held input / continue from the paused cursor.</td></tr>
              <tr><td><code>medius_clip_restart(clip) / _toggle(clip)</code></td><td>Force a rewind and play, even mid-playback / play if idle or paused, stop if playing.</td></tr>
              <tr><td><code>medius_clip_clear(clip)</code></td><td>Discard the loaded clip, free the ring, and clear a <code>Faulted</code> state.</td></tr>
              <tr><td><code>medius_clip_lost(const MediusClip *clip)</code></td><td><code>bool</code>: the box dropped the clip appended since the last <code>medius_clip_clear</code> (its device chip restarted, the box <A href="/library/lifecycle#restart">released the session</A>, or a reconnect found the ring empty). Set once the box can take a reload; reset by the next append or clear. No wire traffic. See <A href="/library/clip#lost">lost</A>.</td></tr>
              <tr><td><code>medius_clip_query_status(clip, out)</code></td><td>Fill a <A href="/bindings/c/types#clip-status"><code>MediusClipStatus</code></A>: ring depth, progress, and playback counters.</td></tr>
              <tr><td><code>medius_clip_query_config(clip, out)</code></td><td>Fill a <A href="/bindings/c/types#clip-settings"><code>MediusClipSettings</code></A>: auto-lock scope, loop/retain, finalized, and both kinds of trigger, each packet trigger with its <code>hits</code>.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="advanced" title="Advanced control layer" caption="Raw injection, control transfers, rewrite rules, descriptor patches">
        <p>Gated on the imperfect-clone opt-in, <code>medius_device_allow_imperfect_clones(dev, true)</code>. See <A href="/library/advanced/raw">Raw injection</A>, <A href="/library/advanced/transfer">Control transfers</A>, <A href="/library/advanced/rewrite">Rewrite rules</A>, and <A href="/library/advanced/patch">Descriptor patches</A>. With it off: <code>set_rewrite</code> and <code>apply_patch</code> return <code>MEDIUS_STATUS_ERR_IMPERFECT_REQUIRED</code>; the box drops <code>medius_device_raw</code> (the library sends it unchecked); a transfer returns OK with <code>MEDIUS_TRANSFER_STATUS_REFUSED</code>. Queries, removes, clears and <code>set_patch</code> need no opt-in.</p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_raw(MediusDevice *dev, uint8_t ep_num, uint8_t dir, const uint8_t *bytes, size_t len)</code></td><td>Write <code>bytes</code> verbatim on cloned endpoint <code>ep_num</code>. <code>dir</code> is a <code>MEDIUS_DIRECTION_*</code> value: <code>POSITIVE</code> (IN) toward the game PC, <code>NEGATIVE</code> (OUT) to the real device.</td></tr>
              <tr><td><code>medius_device_transfer(MediusDevice *dev, uint8_t ep, MediusSetup setup,</code> <code>const uint8_t *out_data, size_t out_len, MediusTransferOutcome *out)</code></td><td>Run one control transfer against the real device; fill <code>out</code> with its <A href="/bindings/c/types#transfer-outcome"><code>status</code> and IN data</A>.</td></tr>
              <tr><td><code>medius_device_transfer_timeout(MediusDevice *dev, uint8_t ep, MediusSetup setup,</code> <code>const uint8_t *out_data, size_t out_len, uint32_t timeout_ms, MediusTransferOutcome *out)</code></td><td>The same transfer, waiting <code>timeout_ms</code> for the reply.</td></tr>
              <tr><td><code>medius_device_set_rewrite(MediusDevice *dev, const MediusRewriteRule *rule)</code></td><td>Install or overwrite one <A href="/bindings/c/types#rewrite-rule"><code>rewrite rule</code></A>. A payload larger than the room the held rules leave in <A href="/bindings/c/types#capacities"><code>MEDIUS_REWRITE_PAYLOAD_POOL</code></A> is <code>MEDIUS_STATUS_ERR_REWRITE_POOL_FULL</code>. A new rule past <code>MEDIUS_MAX_REWRITE_ENTRIES</code> is <code>MEDIUS_STATUS_ERR_REWRITE_TABLE_FULL</code>.</td></tr>
              <tr><td><code>medius_device_remove_rewrite(MediusDevice *dev, const MediusRewriteRule *rule)</code></td><td>Drop the rule with this rule's key.</td></tr>
              <tr><td><code>medius_device_clear_rewrite(MediusDevice *dev)</code></td><td>Drop the whole rewrite table.</td></tr>
              <tr><td><code>medius_device_query_rewrite(MediusDevice *dev, MediusRewriteTable *out)</code></td><td>Read the table summary.</td></tr>
              <tr><td><code>medius_device_query_rewrite_entry(MediusDevice *dev, uint8_t index, MediusRewriteRule *out)</code></td><td>Read one rule in full, in the shape <code>set_rewrite</code> takes.</td></tr>
              <tr><td><code>medius_device_set_patch(MediusDevice *dev, const MediusPatch *patch)</code></td><td>Store one <A href="/bindings/c/types#patch"><code>descriptor patch</code></A> (empty bytes removes it).</td></tr>
              <tr><td><code>medius_device_apply_patch(MediusDevice *dev)</code></td><td>If the stored patch set differs from the one the clone serves, re-present the clone with it (one replug). The re-clone releases the session, and the library re-sends what it holds once the new clone is up (<A href="/library/lifecycle#restart">session recovery</A>). See <A href="/library/advanced/patch#apply-patch">apply_patch</A>.</td></tr>
              <tr><td><code>medius_device_clear_patch(MediusDevice *dev)</code></td><td>Erase the real device's stored set. A clone serving patches re-presents unpatched (one replug), releasing the session as <code>medius_device_apply_patch</code> does.</td></tr>
              <tr><td><code>medius_device_query_patches(MediusDevice *dev, MediusPatchSet *out)</code></td><td>Read the stored set and its apply state.</td></tr>
              <tr><td><code>medius_device_query_patch_entry(MediusDevice *dev, uint8_t index, MediusPatch *out)</code></td><td>Read one patch in full.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="transforms" title="Transforms" caption="Swap or remap a field on the wire">
        <p>Faithful field transforms, no opt-in. See <A href="/library/transform">Transform</A>. An axis argument is a <A href="/bindings/c/types#axis"><code>MediusAxis</code></A> value (0 X, 1 Y, 2 wheel, 3 pan). <code>remap</code> takes two <A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A>s, so it can move a button onto a key or media usage. To weigh or reverse a field, use <code>medius_device_scale</code> (signed percent).</p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_transform(MediusDevice *dev, const MediusTransform *transform)</code></td><td>Install or overwrite one <A href="/bindings/c/types#transform"><code>transform</code></A>.</td></tr>
              <tr><td><code>medius_device_untransform(MediusDevice *dev, const MediusTransform *transform)</code></td><td>Drop the transform with the same (source, dest) key.</td></tr>
              <tr><td><code>medius_device_clear_transforms(MediusDevice *dev)</code></td><td>Drop the whole transform table.</td></tr>
              <tr><td><code>medius_device_transform_swap(MediusDevice *dev, uint8_t a, uint8_t b)</code></td><td>Exchange two axes.</td></tr>
              <tr><td><code>medius_device_transform_remap(MediusDevice *dev, MediusLockTarget source, MediusLockTarget dest)</code></td><td>Move a source field into a destination.</td></tr>
              <tr><td><code>medius_device_query_transforms(MediusDevice *dev, MediusTransforms *out)</code></td><td>Read the active table, in the order the box applies it.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="builders" title="Builders" caption="Make the value structs the calls take">
        <p>Pure constructors: no device, no wire traffic. See <A href="/library/inject">Inject</A>, <A href="/library/move">Move</A>, and <A href="/library/lock">Lock</A>.</p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>medius_usage_button(MediusButton button)</code></td><td><A href="/bindings/c/types#input"><code>MediusUsage</code></A> for <code>medius_device_inject</code>.</td></tr>
              <tr><td><code>medius_usage_key(MediusKey key)</code></td><td><code>MediusUsage</code> addressing a keyboard key.</td></tr>
              <tr><td><code>medius_usage_media(MediusMediaKey media)</code></td><td><code>MediusUsage</code> addressing a media key.</td></tr>
              <tr><td><code>medius_motion_cursor(int16_t dx, int16_t dy)</code></td><td><A href="/bindings/c/types#motion"><code>MediusMotion</code></A> for <code>medius_device_move_axis</code>.</td></tr>
              <tr><td><code>medius_motion_wheel(int16_t delta)</code></td><td><code>MediusMotion</code> for a wheel scroll.</td></tr>
              <tr><td><code>medius_motion_pan(int16_t delta)</code></td><td><code>MediusMotion</code> for AC Pan (horizontal scroll).</td></tr>
              <tr><td><code>medius_lock_target_axis(MediusLockTargetKind kind)</code></td><td><A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A> for an axis (<code>X</code> / <code>Y</code> / <code>Wheel</code> / <code>Pan</code>).</td></tr>
              <tr><td><code>medius_lock_target_usage(MediusUsage usage)</code></td><td><code>MediusLockTarget</code> for a usage (button, key, or media).</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="inspectors" title="Struct inspectors" caption="Read query / event results without the wire">
        <p>Interpret a struct you already hold, by value or pointer, with no I/O. Each mirrors the matching method on the <A href="/library/types">Rust type</A>.</p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>medius_locks_scale_of(const MediusLocks *locks, MediusLockTarget target, uint8_t dir)</code></td><td><code>int16_t</code>: percent of the native value kept on that target and direction. 100 when nothing weighs it; negative when a scale reverses it. See <A href="/library/lock">Lock</A>.</td></tr>
              <tr><td><code>medius_locks_is_locked(const MediusLocks *locks, MediusLockTarget target, uint8_t dir)</code></td><td><code>bool</code>: is that target/direction blocked outright (<code>Both</code> needs both fixed signs). A direction merely weighed is not locked.</td></tr>
              <tr><td><code>medius_rate_native_hz(MediusRate rate, float *out_hz)</code></td><td><code>bool</code>: writes the native report rate in Hz; <code>false</code> when there is no continuous cadence.</td></tr>
              <tr><td><code>medius_usage_event_is_held(const MediusUsageEvent *event, MediusUsage usage)</code></td><td><code>bool</code>: is that usage (button, key, or media) held in the snapshot.</td></tr>
              <tr><td><code>medius_traffic_event_truncated(const MediusTrafficEvent *ev)</code></td><td><code>bool</code>: <code>ev-&gt;len &lt; ev-&gt;true_len</code>, meaning the matching entry's <code>capture</code> cut the packet. See <A href="/bindings/c/types#traffic-event"><code>MediusTrafficEvent</code></A>.</td></tr>
              <tr><td><code>medius_traffic_event_setup(const MediusTrafficEvent *ev)</code></td><td><code>const uint8_t *</code>: the 8-byte setup packet of a CONTROL or CLIP_TRANSFER event, or <code>NULL</code> for another class or a capture cut shorter than the setup stage.</td></tr>
              <tr><td><code>medius_traffic_event_data(const MediusTrafficEvent *ev, uintptr_t *out_len)</code></td><td><code>const uint8_t *</code>: the data stage of a CONTROL or CLIP_TRANSFER event, the whole packet for any other class. Points into <code>ev</code>, as <code>medius_traffic_event_setup</code> does.</td></tr>
              <tr><td><code>medius_traffic_event_control_status(const MediusTrafficEvent *ev, MediusControlStatus *out)</code></td><td><code>bool</code>: the handshake the game PC received, <code>flags</code> bits 0-1; <code>false</code> for any class but CONTROL.</td></tr>
              <tr><td><code>medius_traffic_event_rule_acted(const MediusTrafficEvent *ev)</code></td><td><code>bool</code>: a rewrite rule changed, dropped, answered or refused the packet (<code>flags</code> bit 7, on HID_IN, HID_OUT, the vendor classes, CONTROL and EMIT). <code>false</code> for any other class.</td></tr>
              <tr><td><code>medius_traffic_event_transfer_status(const MediusTrafficEvent *ev, uint8_t *out)</code></td><td><code>bool</code>: how the transfer ended, as a <A href="/bindings/c/types#transfer-outcome"><code>MEDIUS_TRANSFER_STATUS_*</code></A> value (<code>_NAK</code> when no reply came); <code>false</code> for any class but CLIP_TRANSFER.</td></tr>
              <tr><td><code>medius_traffic_event_bus_event(const MediusTrafficEvent *ev, MediusBusEvent *out)</code></td><td><code>bool</code>: the decoded lifecycle event; <code>false</code> for a class other than BUS, or an unknown kind.</td></tr>
              <tr><td><code>medius_traffic_event_bulk_end_of_transfer(ev)</code></td><td><code>bool</code>: the last of its transfer, for a <code>VENDOR_BULK</code> event.</td></tr>
              <tr><td><code>medius_traffic_event_zlp(ev)</code></td><td><code>bool</code>: a zero-length packet (<code>flags</code> bit 1, on HID_IN, HID_OUT, the vendor classes and EMIT). A HID_IN or EMIT event on a HID endpoint carries a whole report of ≤64 bytes, so there the bit can also mean a ZLP ended the report after the event's bytes. Every other event is one packet.</td></tr>
              <tr><td><code>medius_catch_filter_same_address(MediusCatchFilter a, MediusCatchFilter b)</code></td><td><code>bool</code>: the two name the same box table entry, whatever their captures.</td></tr>
              <tr><td><code>medius_catch_class_is_input(MediusCatchClass class_)</code> / <code>_is_traffic(class_)</code></td><td><code>bool</code>: one of the four parsed-input classes, which carry no packet / one of the eight byte-oriented ones.</td></tr>
              <tr><td><code>medius_clip_status_is_held(const MediusClipStatus *status, MediusUsage usage)</code></td><td><code>bool</code>: is the clip holding that usage down.</td></tr>
              <tr><td><code>medius_caps_has_mouse(MediusCaps caps)</code></td><td><code>bool</code>: a mouse interface is bound. See <A href="/library/requests">Requests</A>.</td></tr>
              <tr><td><code>medius_caps_has_keyboard(MediusCaps caps)</code></td><td><code>bool</code>: a keyboard interface is bound.</td></tr>
              <tr><td><code>medius_caps_is_composite(MediusCaps caps)</code></td><td><code>bool</code>: the clone has more than one HID interface.</td></tr>
              <tr><td><code>medius_device_info_is_cloned(MediusDeviceInfo info)</code></td><td><code>bool</code>: a device is cloned, including one with no HID interface (<code>n_hid</code> 0).</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="module" title="Library functions" caption="Library-level helpers and errors">
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_last_error_message(char *buf, uintptr_t cap)</code></td><td>Copy the last error's text into <code>buf</code>; returns the full length (size a buffer and retry). See <A href="/bindings/c/types#errors">errors</A>.</td></tr>
              <tr><td><code>medius_last_error_proto_ver()</code></td><td>The proto-version byte from the last <code>MEDIUS_STATUS_ERR_BAD_PROTO_VER</code>, or 0.</td></tr>
              <tr><td><code>medius_default_query_timeout_ms()</code></td><td>The default query reply wait, in ms.</td></tr>
              <tr><td><code>medius_default_transfer_timeout_ms()</code></td><td>The default control-transfer reply wait, in ms.</td></tr>
              <tr><td><code>medius_default_keepalive_cadence_ms()</code></td><td>The default <A href="/library/guides/connection#keepalive">keepalive</A> interval, in ms.</td></tr>
              <tr><td><code>medius_abi_version()</code></td><td>The C ABI version of the loaded library (currently <code>10</code>), bumped on any breaking header change. Compare it with the header's <code>MEDIUS_ABI_VERSION</code> once at <A href="/bindings/c#verify">start-up</A>. On a mismatch the struct layouts differ: call nothing else, and rebuild against the header shipped with that library.</td></tr>
              <tr><td><code>medius_version_string()</code></td><td>The crate version as a static NUL-terminated string.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection id="mock" title="Mock box" caption="Scriptable fake for tests, feature-gated">
        <p>
          All behind <code>#ifdef MEDIUS_FEATURE_MOCK</code> (the <code>mock</code>{' '}
          <a href="https://doc.rust-lang.org/cargo/reference/features.html" target="_blank" rel="noreferrer">cargo feature</a>). Concept: <A href="/library/features/mock">Mock</A>; enabling it:{' '}
          <A href="/bindings/c/build">Build &amp; features</A>.
        </p>
        <div class="table-scroll">
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_mock_new()</code></td><td>A fresh mock that records commands and auto-replies to queries.</td></tr>
              <tr><td><code>medius_mock_clone</code> / <code>medius_mock_free(MediusMockBox *mock)</code></td><td>Share (same state) / free a mock handle.</td></tr>
              <tr><td><code>medius_device_with_mock(const MediusMockBox *mock, MediusDevice **out)</code></td><td>Build a <code>MediusDevice</code> over the mock <em>without</em> a handshake.</td></tr>
              <tr><td><code>medius_device_open_mock(const MediusMockBox *mock, MediusDevice **out)</code></td><td>Build a <code>MediusDevice</code> over the mock <em>and</em> run the handshake.</td></tr>
              <tr><td><code>medius_mock_set_version / _health / _device_info / _caps / _mouse_caps /</code> <code>_kbd_caps / _rate / _stats / _locks / _catch_state / _imperfect_status</code></td><td>Set the value the mock returns for each query.</td></tr>
              <tr><td><code>medius_mock_set_movement_riding(mock, bool enabled, uint32_t window_ms)</code></td><td>Set the movement-riding window the mock reports.</td></tr>
              <tr><td><code>medius_mock_set_bearing(mock, uint16_t window_ms, uint8_t mode)</code></td><td>Set the bearing the mock reports. A mode no constant names is ignored, as the box ignores it.</td></tr>
              <tr><td><code>medius_mock_set_render(mock, uint8_t mode, bool full, bool ready)</code></td><td>Set the texture the mock reports, whether native motion goes through it, and whether a profile has armed. A mode no constant names leaves the texture alone.</td></tr>
              <tr><td><code>medius_mock_set_spread_learned(mock, uint32_t period_us)</code></td><td>Set the command period the mock has learned, in microseconds. At 0 (a real box's starting state) the mock reports no interval at any percent.</td></tr>
              <tr><td><code>medius_mock_set_clip_status(mock, MediusClipStatus value) /</code> <code>_set_clip_settings(mock, MediusClipSettings value)</code></td><td>Set the mock's replies to the two clip queries. The settings' <code>packet_triggers</code> bind in order, as <code>medius_clip_bind_packet</code> binds them, under the opt-in state that <code>medius_mock_set_imperfect_status</code> scripted. Script that first: with the opt-in off, consuming triggers are dropped. The config reply is these settings plus the triggers bound on the mock. <code>set_retain</code>, <code>finalize</code>, input binds and playback are recorded as frames and leave the reply as scripted. <A href="/library/features/mock#clip-packet">What the mock holds</A>.</td></tr>
              <tr><td><code>medius_mock_clip_packet(mock, uint8_t class_, uint16_t id, uint8_t direction,</code> <code>const uint8_t *head, uintptr_t head_len, uint8_t *out_action, bool *out_consumed)</code></td><td><code>bool</code>: run one packet through the mock's packet triggers, as the box does. The most specific matching trigger counts the packet in its <code>hits</code>. True when that trigger runs its action on this packet (written to <code>*out_action</code>). False when no trigger matches, or when the trigger is <code>once_per_run</code> and the packet continues a run. <code>*out_consumed</code> is whether the trigger consumes the packet. A null out-pointer is skipped.</td></tr>
              <tr><td><code>medius_mock_restart(MediusMockBox *mock)</code></td><td>Simulate a device-chip restart: the mock drops its session state, keeps what it stores, and sends its hello now and again on the next frame it receives. See <A href="/library/features/mock#restart">restart</A>.</td></tr>
              <tr><td><code>medius_mock_link_lost(MediusMockBox *mock)</code></td><td>Simulate the inter-chip link dropping and coming back. The mock releases the session a host set (counted in <A href="/bindings/c/types#stats"><code>MediusStats.session</code></A>); the clone stays up.</td></tr>
              <tr><td><code>medius_mock_detach(MediusMockBox *mock, bool back_within_grace)</code></td><td>Simulate the real device detaching: the mock releases the session. With <code>back_within_grace</code> the real device re-attaches inside the 250 ms grace and the clone stays up; without, the clone is down until <code>medius_mock_attach</code>.</td></tr>
              <tr><td><code>medius_mock_attach(MediusMockBox *mock)</code></td><td>Simulate the real device attaching: a clone that was up is cloned again, which releases the session. See <A href="/library/features/mock#restart">restart and release</A>.</td></tr>
              <tr><td><code>medius_mock_silent(MediusMockBox *mock)</code></td><td>Stop replying to queries, for timeout tests (still records).</td></tr>
              <tr><td><code>medius_mock_set_emit_pace(mock, uint8_t mode, uint16_t hz, uint16_t force_hz)</code></td><td>Set the pacing the mock reports; <code>hz</code> matters only for <code>MEDIUS_EMIT_MODE_FIXED</code>, <code>force_hz</code> 0 is unforced.</td></tr>
              <tr><td><code>medius_mock_set_advertised_hz(mock, uint16_t hz)</code></td><td>Set the rate the mock's clone advertises unforced; 0 is no clone.</td></tr>
              <tr><td><code>medius_mock_set_transfer_reply(mock, uint8_t status, const uint8_t *data, uintptr_t len)</code></td><td>Set the reply to a <code>TRANSFER</code> while the opt-in is on; with it off the mock refuses. A status other than OK carries no data.</td></tr>
              <tr><td><code>medius_mock_refuse_next_activate(mock, uint8_t status)</code></td><td>Refuse the next <code>ACTIVATE</code> with <code>status</code>, keeping what is staged.</td></tr>
              <tr><td><code>medius_mock_reboot_after_activate(mock, uint32_t unanswered, uint32_t pending)</code></td><td>After each accepted activate, leave <code>unanswered</code> firmware queries with no reply, then report the device chip on probation for the next <code>pending</code> queries.</td></tr>
              <tr><td><code>medius_mock_push_raw(mock, const uint8_t *bytes, uintptr_t len)</code></td><td>Inject raw inbound bytes, as if the box sent them.</td></tr>
              <tr><td><code>medius_mock_push_log(mock, MediusLogLevel level, const char *text)</code></td><td>Push a LOG line onto the log stream.</td></tr>
              <tr><td><code>medius_mock_push_motion(mock, uint8_t seq, uint32_t ts_us, MediusMotionEvent event)</code></td><td>Push a <A href="/bindings/c/types#motion-event"><code>MediusMotionEvent</code></A> as a <code>Motion</code> catch event.</td></tr>
              <tr><td><code>medius_mock_push_usages(mock, uint8_t seq, uint32_t ts_us, const MediusUsageEvent *event)</code></td><td>Push a <A href="/bindings/c/types#usage-event"><code>MediusUsageEvent</code></A> as a <code>Usages</code> catch event.</td></tr>
              <tr><td><code>medius_mock_push_traffic(mock, uint8_t seq, uint32_t ts_us,</code> <code>MediusClockDomain clock, const MediusTrafficEvent *event)</code></td><td>Push a <A href="/bindings/c/types#traffic-event"><code>MediusTrafficEvent</code></A> as a <code>Traffic</code> catch event. A <code>true_len</code> above <code>len</code> marks a cut capture.</td></tr>
              <tr><td><code>medius_mock_recorded(MediusMockBox *mock)</code></td><td>How many commands the host has sent.</td></tr>
              <tr><td><code>medius_mock_saw(mock, MediusFrameType ty)</code></td><td>Whether at least one frame of that type was sent.</td></tr>
              <tr><td><code>medius_mock_clear_recorded(MediusMockBox *mock)</code></td><td>Clear the recorded-command log.</td></tr>
              <tr><td><code>medius_mock_recorded_frame(mock, uintptr_t idx, MediusFrameType *out_ty,</code> <code>uint8_t *out_seq, uint8_t *payload_buf, uintptr_t cap)</code></td><td>Read recorded frame <code>idx</code>: type, SEQ, and payload bytes.</td></tr>
            </tbody>
          </table>
        </div>
      </DocSection>
    </>
  );
};

export default Api;
