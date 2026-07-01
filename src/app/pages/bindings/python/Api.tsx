import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Api: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="API index" subtitle="Every Python call, linked to what it does" />
        <p>
          The full <code>Device</code> surface, grouped. Each row gives the Python signature and a
          one-line summary; the semantics live in the <A href="/library">Rust Library</A> and{' '}
          <A href="/native">Native API</A>, so follow the link for what a call does. Types
          and enums are on <A href="/bindings/python/types">Types &amp; errors</A>; streams on{' '}
          <A href="/bindings/python/streams">Streams</A>.
        </p>
        <p>
          Most calls are <A href="/native/injection#fire-and-forget">fire-and-forget</A>. They
          return once the frame is queued. The query reads and <code>Device.open</code> /{' '}
          <code>find</code> block for the <A href="/native/hardware">box</A>'s reply. Any call raises
          a <A href="/bindings/python/types#errors"><code>MediusError</code></A> on failure.
        </p>
      </Card>

      <div id="connect" data-search-target>
        <Card>
          <CardHeader title="Connecting & lifecycle" subtitle="Open, share, and release the link" />
          <p>See <A href="/library/connection">Connection</A> and <A href="/library/lifecycle">Lifecycle</A>.</p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>Device.open(path)</code></td><td>Open a serial path and <A href="/native/connection#handshake">handshake</A>.</td></tr>
              <tr><td><code>Device.find()</code></td><td>Open the first box found, or raise <A href="/bindings/python/types#subclasses"><code>NotFoundError</code></A>.</td></tr>
              <tr><td><code>dev.clone()</code></td><td>Another handle to the same link; the connection is shared.</td></tr>
              <tr><td><code>dev.close()</code></td><td>Free the handle. Called automatically by a <a href="https://docs.python.org/3/reference/datamodel.html#context-managers" target="_blank" rel="noreferrer"><code>with</code></a> block and on GC.</td></tr>
              <tr><td><code>with Device.find() as dev:</code></td><td>Context manager that closes the link on block exit.</td></tr>
              <tr><td><code>medius.find_ports(cap=16)</code></td><td>List present ports as <A href="/bindings/python/types#portinfo"><code>PortInfo</code></A> without opening one.</td></tr>
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
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius.list_boxes()</code></td><td>Enumerate every connected box as a <A href="/bindings/python/types#boxinfo"><code>BoxInfo</code></A> (opens, handshakes, and reads each one's version + device info).</td></tr>
              <tr><td><code>Device.open_by_id(id)</code></td><td>Open the box whose identity matches <code>id</code> (device MAC hex or CH343 serial) and handshake.</td></tr>
              <tr><td><code>Device.find_mouse_box()</code></td><td>Open the first box whose clone is a mouse.</td></tr>
              <tr><td><code>Device.find_keyboard_box()</code></td><td>Open the first box whose clone is a keyboard.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="move" data-search-target>
        <Card>
          <CardHeader title="Movement" subtitle="Relative cursor and wheel" />
          <p>See <A href="/library/move">Move</A>. <code>+x</code> right, <code>+y</code> down.</p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>dev.move_rel(dx, dy)</code></td><td>Nudge the cursor by a signed 16-bit delta.</td></tr>
              <tr><td><code>dev.wheel(delta)</code></td><td>Scroll the wheel.</td></tr>
              <tr><td><code>dev.move_axis(motion)</code></td><td>Drive one axis from a <A href="/bindings/python/types#motion"><code>Motion.cursor(dx, dy)</code></A> or <code>Motion.wheel(delta)</code>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="inject" data-search-target>
        <Card>
          <CardHeader title="Inject: buttons" subtitle="Press and release mouse buttons" />
          <p>
            See <A href="/library/inject">Inject</A> and the{' '}
            <A href="/native/injection">injection model</A> (press / soft-release / force-release).
            Button ids are on <A href="/native/commands/usage#buttons">Usage IDs</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>dev.inject(input, action)</code></td><td>Apply an <A href="/bindings/python/types#action"><code>Action</code></A> to a built <A href="/bindings/python/types#input"><code>Input</code></A> (button, key, or media).</td></tr>
              <tr><td><code>dev.button(button, action)</code></td><td>Apply an <code>Action</code> to a <A href="/bindings/python/types#button"><code>Button</code></A> directly.</td></tr>
              <tr><td><code>dev.press(button)</code></td><td>Hold a button down (<code>Action.PRESS</code>).</td></tr>
              <tr><td><code>dev.soft_release(button)</code></td><td>Release, unless the user is physically holding it.</td></tr>
              <tr><td><code>dev.force_release(button)</code></td><td>Release even against a physical hold.</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              The generic <code>inject()</code> takes a built target, not a generic argument. Build it
              with <code>Input.button</code>/<code>key</code>/<code>media</code>, as in{' '}
              <code>dev.inject(Input.button(Button.LEFT), Action.PRESS)</code>. The direct verbs
              (<code>press</code>, <code>key_down</code>, <code>media_down</code>) take the target
              directly, so <code>Input</code> is only needed on the generic path.
            </p>
          </div>
        </Card>
      </div>

      <div id="keys" data-search-target>
        <Card>
          <CardHeader title="Inject: keyboard" subtitle="Press and release keys" />
          <p>See <A href="/library/inject">Inject</A>; HID keycodes on <A href="/native/commands/usage#keycodes">Usage IDs</A>. Pass a <A href="/bindings/python/types#key"><code>Key</code></A> or a raw keycode <code>int</code>.</p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>dev.key(key, action)</code></td><td>Apply an <A href="/bindings/python/types#action"><code>Action</code></A> to a key.</td></tr>
              <tr><td><code>dev.key_down(key)</code></td><td>Hold a key down.</td></tr>
              <tr><td><code>dev.key_up(key)</code></td><td>Soft-release a key.</td></tr>
              <tr><td><code>dev.key_force_release(key)</code></td><td>Force-release a key.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="media" data-search-target>
        <Card>
          <CardHeader title="Inject: media" subtitle="Consumer-control keys" />
          <p>See <A href="/library/inject">Inject</A>; Consumer usages on <A href="/native/commands/usage#consumer">Usage IDs</A>. Pass a <A href="/bindings/python/types#mediakey"><code>MediaKey</code></A> or a raw 16-bit usage <code>int</code>.</p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>dev.media(media, action)</code></td><td>Apply an <A href="/bindings/python/types#action"><code>Action</code></A> to a media key.</td></tr>
              <tr><td><code>dev.media_down(media)</code></td><td>Hold a media key down.</td></tr>
              <tr><td><code>dev.media_up(media)</code></td><td>Soft-release a media key.</td></tr>
              <tr><td><code>dev.media_force_release(media)</code></td><td>Force-release a media key.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="lock" data-search-target>
        <Card>
          <CardHeader title="Locks" subtitle="Block the user's own input" />
          <p>See <A href="/library/lock">Lock</A>. Build axis/button targets with <A href="/bindings/python/types#locktarget"><code>LockTarget.x/y/wheel/button</code></A>; a <A href="/bindings/python/types#lockdirection"><code>LockDirection</code></A> picks an edge.</p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>dev.lock(target, direction)</code></td><td>Lock an axis or button (e.g. <code>LockTarget.button(Button.LEFT)</code>).</td></tr>
              <tr><td><code>dev.unlock(target, direction)</code></td><td>Unlock an axis or button.</td></tr>
              <tr><td><code>dev.lock_key(key, direction)</code> / <code>unlock_key</code></td><td>Lock / unlock one keyboard key.</td></tr>
              <tr><td><code>dev.lock_media(media)</code> / <code>unlock_media</code></td><td>Lock / unlock one media key.</td></tr>
              <tr><td><code>dev.lock_all(what)</code> / <code>unlock_all</code></td><td>Blanket lock / unlock a <A href="/bindings/python/types#blanket"><code>Blanket</code></A> class (keys, media, buttons).</td></tr>
            </tbody>
          </table>
          <div class="callout callout--warning">
            <p>A lock auto-clears; it isn't permanent. The <A href="/library/guides/connection#keepalive">keepalive</A> holds it for you. See <A href="/library/lock">Lock</A>.</p>
          </div>
        </Card>
      </div>

      <div id="led-admin-options" data-search-target>
        <Card>
          <CardHeader title="LED, admin & options" subtitle="Status light, resets, persistent settings" />
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>dev.led(target, mode, level)</code></td><td>Drive the status LED. See <A href="/library/led">LED</A>.</td></tr>
              <tr><td><code>dev.reset()</code></td><td>Clear all overrides. See <A href="/library/admin">Admin</A>.</td></tr>
              <tr><td><code>dev.reapply()</code></td><td>Re-send the active settings.</td></tr>
              <tr><td><code>dev.reconnect()</code></td><td>Force a reconnect to the mouse.</td></tr>
              <tr><td><code>dev.reboot(target)</code></td><td>Reboot a chip to run or download mode.</td></tr>
              <tr><td><code>dev.allow_imperfect_clones(allow)</code></td><td>Opt in to cloning over-capacity devices. See <A href="/library/options">Options</A>.</td></tr>
              <tr><td><code>dev.set_movement_riding(window_ms)</code></td><td>Set the riding window in ms, or <code>None</code> to turn it off.</td></tr>
              <tr><td><code>dev.set_emit_pace(pace)</code></td><td>Pick what paces injected motion: <code>EmitPace.learned()</code> / <code>.interval()</code> / <code>.fixed(hz)</code>. See <A href="/library/options">Options</A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="queries" data-search-target>
        <Card>
          <CardHeader title="Queries" subtitle="Read box state, each blocks for one reply" />
          <p>
            See <A href="/library/requests">Requests</A>. Each blocks for the box's reply and returns
            a <a href="https://docs.python.org/3/library/dataclasses.html" target="_blank" rel="noreferrer">dataclass</a>{' '}
            documented on <A href="/bindings/python/types">Types &amp; errors</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>dev.query_version()</code></td><td><A href="/bindings/python/types#version"><code>Version</code></A>: protocol + firmware version.</td></tr>
              <tr><td><code>dev.query_health()</code></td><td><A href="/bindings/python/types#health"><code>Health</code></A>: link, mouse, clone, injection flags.</td></tr>
              <tr><td><code>dev.device_info()</code></td><td><A href="/bindings/python/types#deviceinfo"><code>DeviceInfo</code></A>: the cloned device's USB identity, kind, and product.</td></tr>
              <tr><td><code>dev.caps()</code></td><td><A href="/bindings/python/types#caps"><code>Caps</code></A>: mouse/keyboard capabilities.</td></tr>
              <tr><td><code>dev.query_rate()</code></td><td><A href="/bindings/python/types#rate"><code>Rate</code></A>: native report rate and poll period.</td></tr>
              <tr><td><code>dev.query_stats()</code></td><td><A href="/bindings/python/types#stats"><code>Stats</code></A>: box-side telemetry.</td></tr>
              <tr><td><code>dev.query_locks()</code></td><td><A href="/bindings/python/types#locks"><code>Locks</code></A>: active lock mask (<code>.is_locked(...)</code>).</td></tr>
              <tr><td><code>dev.query_catch()</code></td><td><A href="/bindings/python/types#catchstate"><code>CatchState</code></A>: subscription mask + dropped count.</td></tr>
              <tr><td><code>dev.query_imperfect()</code></td><td><A href="/bindings/python/types#imperfectstatus"><code>ImperfectStatus</code></A>: imperfect-clone state.</td></tr>
              <tr><td><code>dev.query_movement_riding()</code></td><td><code>int</code> ms, or <code>None</code> when off.</td></tr>
              <tr><td><code>dev.query_emit_pace()</code></td><td><A href="/bindings/python/types#emitpacestatus"><code>EmitPaceStatus</code></A>: pacing mode + rate in effect.</td></tr>
              <tr><td><code>dev.counters()</code></td><td><A href="/bindings/python/types#counters"><code>Counters</code></A>: <A href="/library/diagnostics">host-side wire counters</A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="streams" data-search-target>
        <Card>
          <CardHeader title="Streams" subtitle="Subscribe to live input and logs" />
          <p>Consuming events is covered on <A href="/bindings/python/streams">Streams</A>; the catch feature itself on <A href="/library/catch">Catch</A> and <A href="/library/diagnostics">Logs &amp; counters</A>.</p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>dev.catch_events(mask=CatchMask.ALL)</code></td><td><code>EventStream</code> of physical mouse/key/media events.</td></tr>
              <tr><td><code>dev.logs()</code></td><td><code>LogStream</code> of device log lines.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="module" data-search-target>
        <Card>
          <CardHeader title="Module functions" subtitle="Top-level helpers on medius" />
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius.find_ports(cap=16)</code></td><td>List present medius ports as <A href="/bindings/python/types#portinfo"><code>PortInfo</code></A> (now including the CH343 serial).</td></tr>
              <tr><td><code>medius.list_boxes()</code></td><td>Enumerate every connected box as a <A href="/bindings/python/types#boxinfo"><code>BoxInfo</code></A>. See <A href="/bindings/python/api#discovery">Discovery</A>.</td></tr>
              <tr><td><code>medius.default_query_timeout_ms()</code></td><td>The default query reply wait (1000 ms).</td></tr>
              <tr><td><code>medius.default_keepalive_cadence_ms()</code></td><td>The default keepalive interval (500 ms).</td></tr>
              <tr><td><code>medius.abi_version()</code></td><td>The <A href="/bindings/c">C ABI</A> version the library exposes.</td></tr>
              <tr><td><code>medius.version_string()</code></td><td>The library version string.</td></tr>
              <tr><td><code>medius.flash(port, bin_path, host=False)</code></td><td>Flash firmware via <a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer">esptool</a>. Needs the <A href="/bindings/python/build#features">flash feature</A>.</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

export default Api;
