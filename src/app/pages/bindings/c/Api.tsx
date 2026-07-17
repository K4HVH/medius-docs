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
          Most calls are <A href="/native/injection#fire-and-forget">fire-and-forget</A>. They
          return as soon as the <A href="/native/frame">frame</A> is queued and never wait on the box.
          The queries, plus <code>open</code> / <code>find</code>, block for the{' '}
          <A href="/native/hardware">box</A>'s <A href="/native/commands/requests">reply</A>. Every
          fallible call returns a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A>{' '}
          (<code>MEDIUS_STATUS_OK</code> is 0) and writes its result through an out-param;{' '}
          <A href="#module"><code>medius_last_error_message()</code></A> gives the last failure's text on the calling thread.
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
              <tr><td><code>medius_find_ports(MediusPortInfo *out, uintptr_t cap, uintptr_t *out_total)</code></td><td>List present ports into <code>out</code> (up to <code>cap</code>); writes total to <code>*out_total</code>, returns the number written. See <A href="/bindings/c/types#portinfo"><code>MediusPortInfo</code></A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="discovery" data-search-target>
        <Card>
          <CardHeader title="Discovery" subtitle="Enumerate boxes and open one by identity" />
          <p>
            Pick a box out of several by a stable identity (device MAC or CH343 serial), or by the kind
            of device it clones. See <A href="/library/discovery">Discovery</A>.
          </p>
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
          <CardHeader title="Inject" subtitle="Drive any usage: button, key, or media" />
          <p>
            One verb set over a <A href="/bindings/c/types#input"><code>MediusUsage</code></A> (button, key,
            or media). Build it with the <A href="#builders">input helpers</A>; see{' '}
            <A href="/library/inject">Inject</A>, the <A href="/native/injection">injection model</A>, and
            the id spaces on <A href="/native/commands/usage">Usage IDs</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_inject(MediusDevice *dev, MediusUsage input, MediusAction action)</code></td><td>Apply a <A href="/bindings/c/types#action"><code>MediusAction</code></A> to a usage.</td></tr>
              <tr><td><code>medius_device_press(MediusDevice *dev, MediusUsage input)</code></td><td>Hold the usage down (<code>MEDIUS_ACTION_PRESS</code>).</td></tr>
              <tr><td><code>medius_device_soft_release(MediusDevice *dev, MediusUsage input)</code></td><td>Release, unless the user is physically holding it.</td></tr>
              <tr><td><code>medius_device_force_release(MediusDevice *dev, MediusUsage input)</code></td><td>Release even against a physical hold.</td></tr>
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
          <CardHeader title="Locks" subtitle="Block the user's own input" />
          <p>See <A href="/library/lock">Lock</A>. A <A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A> picks an axis or usage (button, key, or media) and a <A href="/bindings/c/types#lock-direction"><code>MediusLockDirection</code></A> picks an edge. Read the returned entries with <A href="#inspectors"><code>medius_locks_is_locked</code></A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_lock(MediusDevice *dev, MediusLockTarget target, MediusLockDirection dir)</code></td><td>Lock an axis or usage on an edge.</td></tr>
              <tr><td><code>medius_device_unlock(MediusDevice *dev, MediusLockTarget target, MediusLockDirection dir)</code></td><td>Release a lock.</td></tr>
              <tr><td><code>medius_device_lock_all(MediusDevice *dev, MediusBlanket what, MediusLockDirection dir)</code></td><td>Blanket lock a whole class (aim, wheel, buttons, keys, or media).</td></tr>
              <tr><td><code>medius_device_unlock_all(MediusDevice *dev, MediusBlanket what, MediusLockDirection dir)</code></td><td>Release a blanket lock.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>A lock auto-clears; it isn't permanent. The <A href="/library/guides/connection#keepalive">keepalive</A> holds it for you (see <A href="/library/lock">Lock</A>).</p>
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
              <tr><td><code>medius_device_set_emit_pace(MediusDevice *dev, MediusEmitMode mode, uint16_t hz)</code></td><td>Pick what paces injected motion; <code>hz</code> is the target rate for <code>FIXED</code>. See <A href="/library/options">Options</A>.</td></tr>
              <tr><td><code>medius_device_set_name(MediusDevice *dev, const char *name)</code></td><td>Set the box's human-readable name (1 to 32 printable ASCII). See <A href="/library/options#set-name">Name</A>.</td></tr>
              <tr><td><code>medius_device_clear_name(MediusDevice *dev)</code></td><td>Clear the name, back to the synthesized default. Read it back on <A href="/bindings/c/types#version"><code>MediusVersion.name</code></A>.</td></tr>
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
              <tr><td><code>medius_device_query_locks(dev, MediusLocks *out)</code></td><td><A href="/bindings/c/types#locks"><code>MediusLocks</code></A>: the active locks (entry list).</td></tr>
              <tr><td><code>medius_device_query_catch(dev, MediusCatchState *out)</code></td><td><A href="/bindings/c/types#catch-state"><code>MediusCatchState</code></A>: subscription mask + dropped count.</td></tr>
              <tr><td><code>medius_device_query_imperfect(dev, MediusImperfectStatus *out)</code></td><td><A href="/bindings/c/types#imperfect-status"><code>MediusImperfectStatus</code></A>: imperfect-clone state.</td></tr>
              <tr><td><code>medius_device_query_movement_riding(dev, bool *out_enabled, uint32_t *out_window_ms)</code></td><td>Whether riding is on, and the window in ms (0 when off).</td></tr>
              <tr><td><code>medius_device_query_emit_pace(dev, MediusEmitPaceStatus *out)</code></td><td><A href="/bindings/c/types#emit-pace-status"><code>MediusEmitPaceStatus</code></A>: pacing mode + rate in effect.</td></tr>
              <tr><td><code>medius_device_counters(dev, MediusCountersSnapshot *out)</code></td><td><A href="/bindings/c/types#counters"><code>MediusCountersSnapshot</code></A>: host-side wire counters.</td></tr>
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
          <div class="api-response-label">HANDLE &mdash; CONFIG</div>
          <p>Set these before the first <code>medius_clip_append</code>. See <A href="/library/clip">Clip</A>.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_clip(dev, out) / medius_clip_free(clip)</code></td><td>Open / free a clip handle.</td></tr>
              <tr><td><code>medius_clip_append(clip, b)</code></td><td>Append the builder's entries to the ring.</td></tr>
              <tr><td><code>medius_clip_set_autolock(clip, const MediusBlanket *scope, uintptr_t scope_len)</code></td><td>The auto-lock scope: the <A href="/bindings/c/types#blanket"><code>MediusBlanket</code></A> groups <code>scope</code> points at (<code>NULL</code> / 0 = no lock).</td></tr>
              <tr><td><code>medius_clip_set_loop(clip, uint8_t on) / _set_retain(clip, uint8_t on)</code></td><td>Loop at the clip end (retained only) / retain the loaded clip so it can rewind and replay (0 = streaming, the default).</td></tr>
              <tr><td><code>medius_clip_finalize(clip)</code></td><td>Fix a retained clip's end so it can replay and loop.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">HANDLE &mdash; TRIGGERS</div>
          <p>A managed set of up to <code>MEDIUS_CLIP_TRIG_MAX</code> bindings, keyed by usage + edge.</p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td><code>medius_clip_bind(clip, MediusClipTrigger trigger)</code></td><td>Add or overwrite a <A href="/bindings/c/types#clip-trigger"><code>MediusClipTrigger</code></A>: a <A href="/bindings/c/types#edge"><code>MediusEdge</code></A> of <code>on</code> drives a <A href="/bindings/c/types#clip-action"><code>MediusClipAction</code></A>; <code>consume</code> hides the input from the game.</td></tr>
              <tr><td><code>medius_clip_unbind(clip, MediusUsage usage, MediusEdge edge)</code></td><td>Remove the binding on that usage + edge.</td></tr>
              <tr><td><code>medius_clip_clear_triggers(clip)</code></td><td>Remove every trigger binding.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">HANDLE &mdash; TRANSPORT &amp; QUERY</div>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Effect</th></tr></thead>
            <tbody>
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
              <tr><td><code>medius_locks_is_locked(const MediusLocks *locks, MediusLockTarget target, MediusLockDirection dir)</code></td><td><code>bool</code>: is that target/edge locked (<code>Both</code> needs both edges). See <A href="/library/lock">Lock</A>.</td></tr>
              <tr><td><code>medius_rate_native_hz(MediusRate rate, float *out_hz)</code></td><td><code>bool</code>: writes the native rate in Hz; <code>false</code> when there is no continuous cadence.</td></tr>
              <tr><td><code>medius_usage_event_is_held(const MediusUsageEvent *event, MediusUsage usage)</code></td><td><code>bool</code>: is that usage (button, key, or media) held in the snapshot.</td></tr>
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
          <CardHeader title="Mock box" subtitle="Scriptable fake for tests, feature-gated" />
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
              <tr><td><code>medius_mock_set_version / _health / _device_info / _caps / _mouse_caps / _kbd_caps / _rate / _stats / _locks / _catch_state / _imperfect_status</code></td><td>Set the value the mock answers to each query.</td></tr>
              <tr><td><code>medius_mock_set_movement_riding(mock, bool enabled, uint32_t window_ms)</code></td><td>Set the movement-riding window the mock reports.</td></tr>
              <tr><td><code>medius_mock_silent(MediusMockBox *mock)</code></td><td>Stop answering queries for timeout tests (still records).</td></tr>
              <tr><td><code>medius_mock_push_raw(mock, const uint8_t *bytes, uintptr_t len)</code></td><td>Inject raw inbound bytes, as if the box sent them.</td></tr>
              <tr><td><code>medius_mock_push_log(mock, MediusLogLevel level, const char *text)</code></td><td>Push a LOG line onto the device's log stream.</td></tr>
              <tr><td><code>medius_mock_push_motion(mock, uint8_t seq, MediusMotionEvent event)</code></td><td>Push a <A href="/bindings/c/types#motion-event"><code>MediusMotionEvent</code></A> as a <code>Motion</code> catch event.</td></tr>
              <tr><td><code>medius_mock_push_usages(mock, uint8_t seq, const MediusUsageEvent *event)</code></td><td>Push a <A href="/bindings/c/types#usage-event"><code>MediusUsageEvent</code></A> as a <code>Usages</code> catch event.</td></tr>
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
