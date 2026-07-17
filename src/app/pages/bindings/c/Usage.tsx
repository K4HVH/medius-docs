import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Usage: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Calls & errors" subtitle="The C-specific shapes: status codes, handle lifecycle, builders" />
        <p>
          This page covers what's specific to C: how a failed call surfaces, who frees a handle, and
          how you build the generic <A href="/library/inject"><code>inject</code></A> /{' '}
          <A href="/library/move"><code>move</code></A> / <A href="/library/lock"><code>lock</code></A>{' '}
          targets. What each call <em>does</em> lives in the <A href="/library">Rust Library</A> and{' '}
          <A href="/native">Native API</A> sections. The full call list is on the{' '}
          <A href="/bindings/c/api">API index</A>; structs and enums are on{' '}
          <A href="/bindings/c/types">Types &amp; errors</A>.
        </p>
        <p>
          <span class="api-badge api-badge--executed">Fire-and-forget</span> calls return as soon as the{' '}
          <A href="/native/frame">frame</A> is queued;{' '}
          <span class="api-badge api-badge--responded">Blocks</span> calls wait for the{' '}
          <A href="/native/hardware">box</A>'s reply. Both return a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A>.
        </p>
      </Card>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="MediusStatus + a thread-local last error" />
          <p>
            Every fallible call returns a <code>MediusStatus</code> and writes its real result through
            an out-param. <code>MEDIUS_STATUS_OK</code> is <code>0</code>; anything else is a failure
            and the out-param is untouched. Fetch the human-readable detail separately. What each code
            means lives on <A href="/library/types/errors">Errors</A>.
          </p>
          <pre class="diagram">{`  call ──▶ MediusStatus
             │
             ├─ == OK ──▶ the out-param is valid, carry on
             └─ != OK ──▶ medius_last_error_message(buf, cap)   text (this thread)
                          medius_last_error_proto_ver()         byte (BadProtoVer only)`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>MediusStatus</th><th>Value</th><th>Means</th></tr>
            </thead>
            <tbody>
              <tr><td><code>MEDIUS_STATUS_OK</code></td><td>0</td><td>Success; the out-param is written.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_IO</code></td><td>1</td><td>Serial I/O failed on the link.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_NOT_FOUND</code></td><td>2</td><td>No box found (<A href="/bindings/c/api#connect"><code>open</code></A> / <A href="/bindings/c/api#connect"><code>find</code></A>).</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_NO_REPLY</code></td><td>3</td><td>A query got no <A href="/native/commands/requests#resp">RESP</A> frame.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_BAD_PROTO_VER</code></td><td>4</td><td>Protocol mismatch at the <A href="/native/connection#handshake">handshake</A>; read <code>medius_last_error_proto_ver()</code>.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_QUERY_TIMEOUT</code></td><td>5</td><td>The RESP wait elapsed.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_DISCONNECTED</code></td><td>6</td><td>Link dropped or a stream closed (see below).</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_FRAME_TOO_LONG</code></td><td>7</td><td>Payload exceeded the wire limit.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_FLASH_TOOL</code></td><td>8</td><td><a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer">esptool</a> failed (<A href="/library/features/flash">flash</A> feature).</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_INVALID_ARG</code></td><td>9</td><td>A bad argument (e.g. a null handle).</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_PANIC</code></td><td>10</td><td>An internal panic was caught at the boundary.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_UNKNOWN</code></td><td>11</td><td>Unspecified, or a platform-gated call on an unsupported OS.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">READING THE DETAIL</div>
          <pre class="api-signature">uintptr_t medius_last_error_message(char *buf, uintptr_t cap);
uint8_t   medius_last_error_proto_ver(void);</pre>
          <pre><code class="language-c">{`MediusDevice *dev = NULL;
if (medius_device_find(&dev) != MEDIUS_STATUS_OK) {
    char buf[256];
    medius_last_error_message(buf, sizeof buf);   /* NUL-terminated, truncated to cap */
    fprintf(stderr, "open failed: %s\\n", buf);
    return 1;
}`}</code></pre>
          <p>
            <A href="/bindings/c/api#module"><code>medius_last_error_message</code></A> returns the full message length in bytes (excluding
            the NUL), so a caller can size a buffer and retry on truncation.{' '}
            <A href="/bindings/c/api#module"><code>medius_last_error_proto_ver</code></A> returns the offending version byte after a{' '}
            <code>BadProtoVer</code>, else <code>0</code>.
          </p>
          <div class="callout callout--warning">
            <p>
              The last error is <strong>thread-local and overwritten by the next <code>medius_*</code>{' '}
              call on that thread</strong>. Read it right after the call that failed, before doing
              anything else on the same thread.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              A device call returns{' '}
              <code>MEDIUS_STATUS_ERR_DISCONNECTED</code> once the link drops, and a stream's blocking{' '}
              <code>recv</code> returns it when the stream closes (after a reset or link loss). Recover
              with <A href="/bindings/c/api#led-admin-options"><code>medius_device_reconnect</code></A> or by re-opening (see{' '}
              <A href="/library/lifecycle">Lifecycle</A>).
            </p>
          </div>
        </Card>
      </div>

      <div id="lifecycle" data-search-target>
        <Card>
          <CardHeader title="Lifecycle" subtitle="Opaque pointers, manual free, no RAII or GC" />
          <p>
            Handles are opaque pointers you own. There's no destructor or{' '}
            <a href="https://en.cppreference.com/w/cpp/language/raii" target="_blank" rel="noreferrer">RAII</a>:
            a constructor hands you a pointer, <code>medius_*_clone</code> makes another owner of the{' '}
            <em>same</em> underlying object (reference-counted, like <code>Device::clone</code> in Rust),
            and you must call the matching <code>medius_*_free</code> on every handle you hold. See{' '}
            <A href="/library/connection">Connection</A> and <A href="/library/lifecycle">Lifecycle</A>{' '}
            for what the link does between open and free.
          </p>
          <pre class="diagram">{`  medius_device_open / _find  ──▶  MediusDevice *    (you own it)
                                        │  medius_device_clone
                                        ▼
                                   MediusDevice *    (2nd owner, same link)

  medius_device_free(handle)  ──▶  drop one owner    (NULL = no-op)
  free the last owner         ──▶  joins the reader + keepalive threads`}</pre>
          <table class="api-params">
            <thead>
              <tr><th>Handle</th><th>Create</th><th>Clone</th><th>Free</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/connection"><code>MediusDevice</code></A></td>
                <td><code>medius_device_open</code> · <code>_find</code> · <code>_with_mock</code></td>
                <td><code>medius_device_clone</code></td>
                <td><code>medius_device_free</code></td>
              </tr>
              <tr>
                <td><A href="/library/catch"><code>MediusEventStream</code></A></td>
                <td><code>medius_device_catch_events</code></td>
                <td><code>medius_event_stream_clone</code></td>
                <td><code>medius_event_stream_free</code></td>
              </tr>
              <tr>
                <td><A href="/library/diagnostics"><code>MediusLogStream</code></A></td>
                <td><code>medius_device_logs</code></td>
                <td><code>medius_log_stream_clone</code></td>
                <td><code>medius_log_stream_free</code></td>
              </tr>
              <tr>
                <td><A href="/library/features/mock"><code>MediusMockBox</code></A></td>
                <td><code>medius_mock_new</code></td>
                <td><code>medius_mock_clone</code></td>
                <td><code>medius_mock_free</code></td>
              </tr>
              <tr>
                <td><A href="/library/clip#builder"><code>MediusClipBuilder</code></A></td>
                <td><code>medius_clip_builder_new</code></td>
                <td>-</td>
                <td><code>medius_clip_builder_free</code></td>
              </tr>
              <tr>
                <td><A href="/library/clip#handle"><code>MediusClip</code></A></td>
                <td><code>medius_device_clip</code></td>
                <td>-</td>
                <td><code>medius_clip_free</code></td>
              </tr>
            </tbody>
          </table>
          <pre><code class="language-c">{`MediusDevice *dev = NULL;
if (medius_device_find(&dev) != MEDIUS_STATUS_OK) { return 1; }

MediusDevice *worker = medius_device_clone(dev);  /* same link, ref-counted */
/* ... use either handle from either thread ... */

medius_device_free(worker);   /* drop one owner */
medius_device_free(dev);      /* last owner -> joins the background threads */`}</code></pre>
          <div class="callout callout--info">
            <p>
              <code>clone(NULL)</code> returns <code>NULL</code> and every <code>*_free(NULL)</code> is
              a no-op, so cleanup paths don't need null checks. Freeing a stream unsubscribes when its
              last handle drops; catch events and log lines are fixed-size structs written into your
              buffer, so there's nothing to free per event.
            </p>
          </div>
        </Card>
      </div>

      <div id="builders" data-search-target>
        <Card>
          <CardHeader title="Building targets" subtitle="Usage, Motion, LockTarget for the generic verbs" />
          <p>
            Rust's generic <A href="/library/inject"><code>inject</code></A> /{' '}
            <A href="/library/move"><code>move_axis</code></A> / <A href="/library/lock"><code>lock</code></A>{' '}
            targets are built structs in C: <A href="/bindings/c/types#input"><code>MediusUsage</code></A>,{' '}
            <A href="/bindings/c/types#motion"><code>MediusMotion</code></A>, and{' '}
            <A href="/bindings/c/types#lock-target"><code>MediusLockTarget</code></A>, each with a helper
            constructor. A <code>MediusUsage</code> holds a{' '}
            <A href="/native/commands/usage#buttons">button id</A>,{' '}
            <A href="/native/commands/usage#keycodes">keycode</A>, or{' '}
            <A href="/native/commands/usage#consumer">Consumer usage</A>, and the same value drives an
            inject, a lock, or a catch test.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Builder</th><th>Returns</th><th>For</th></tr>
            </thead>
            <tbody>
              <tr><td><code>medius_usage_button(MediusButton)</code></td><td><code>MediusUsage</code></td><td rowspan="3"><A href="/library/inject">inject</A> / <A href="/native/injection">injection model</A></td></tr>
              <tr><td><code>medius_usage_key(MediusKey)</code></td><td><code>MediusUsage</code></td></tr>
              <tr><td><code>medius_usage_media(MediusMediaKey)</code></td><td><code>MediusUsage</code></td></tr>
              <tr><td><code>medius_motion_cursor(dx, dy)</code></td><td><code>MediusMotion</code></td><td rowspan="2"><A href="/library/move">move</A> / <A href="/native/commands/move#move">MOVE</A></td></tr>
              <tr><td><code>medius_motion_wheel(delta)</code></td><td><code>MediusMotion</code></td></tr>
              <tr><td><code>medius_lock_target_axis(MediusLockTargetKind)</code></td><td><code>MediusLockTarget</code></td><td rowspan="2"><A href="/library/lock">lock</A> / <A href="/native/commands/lock">LOCK</A></td></tr>
              <tr><td><code>medius_lock_target_usage(MediusUsage)</code></td><td><code>MediusLockTarget</code></td></tr>
            </tbody>
          </table>
          <pre><code class="language-c">{`/* inject: build a usage, then apply an Action */
MediusUsage lmb = medius_usage_button(MEDIUS_BUTTON_LEFT);
medius_device_inject(dev, lmb, MEDIUS_ACTION_PRESS);
medius_device_press(dev, medius_usage_key(MEDIUS_KEY_W));   /* keys and media inject the same way */

/* move: build a motion arm */
MediusMotion m = medius_motion_cursor(100, -50);
medius_device_move_axis(dev, m);

/* lock: an axis, or any usage */
MediusLockTarget x = medius_lock_target_axis(MEDIUS_LOCK_TARGET_KIND_X);
medius_device_lock(dev, x, MEDIUS_LOCK_DIRECTION_BOTH);

MediusLockTarget side = medius_lock_target_usage(medius_usage_button(MEDIUS_BUTTON_SIDE1));
medius_device_lock(dev, side, MEDIUS_LOCK_DIRECTION_BOTH);`}</code></pre>
          <div class="callout callout--info">
            <p>
              A button, key, and media usage all lock the same way:{' '}
              <code>medius_lock_target_usage(medius_usage_key(...))</code> locks a key,{' '}
              <code>medius_lock_target_axis(...)</code> an axis or the wheel. The struct fields are on{' '}
              <A href="/bindings/c/types#lock-target">Types &amp; errors</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="calls" data-search-target>
        <Card>
          <CardHeader title="Fire-and-forget vs blocking" subtitle="The two call-kind badges" />
          <p>
            Two return shapes, both yielding a <code>MediusStatus</code>. The badge on each row of the{' '}
            <A href="/bindings/c/api">API index</A> says which is which.
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Badge</th><th>Behaviour</th><th>Fails with</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="api-badge api-badge--executed">Fire-and-forget</span></td>
                <td>Returns once the frame is queued for the wire; no reply is awaited. Move, inject, lock, <A href="/library/led">LED</A>, <A href="/library/options">options</A>, <A href="/library/clip">clip playback</A>. See <A href="/native/injection#fire-and-forget">fire-and-forget</A>.</td>
                <td><code>MEDIUS_STATUS_ERR_IO</code> / <code>MEDIUS_STATUS_ERR_DISCONNECTED</code> if the link is down.</td>
              </tr>
              <tr>
                <td><span class="api-badge api-badge--responded">Blocks</span></td>
                <td>Sends a QUERY and waits for the box's RESP, up to the query timeout. The <A href="/bindings/c/api#queries"><code>medius_device_query_*</code></A> reads and the open/handshake calls. See <A href="/native/commands/requests#requests">Requests</A>.</td>
                <td><code>MEDIUS_STATUS_ERR_NO_REPLY</code> / <code>MEDIUS_STATUS_ERR_QUERY_TIMEOUT</code>.</td>
              </tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              A <span class="api-badge api-badge--executed">Fire-and-forget</span> call returning{' '}
              <code>MEDIUS_STATUS_OK</code> means the frame was handed to the writer, not that the box
              acted on it; there's no acknowledgement. The default reply wait is{' '}
              <A href="/bindings/c/api#module"><code>medius_default_query_timeout_ms()</code></A>; the held-override keepalive cadence is{' '}
              <A href="/bindings/c/api#module"><code>medius_default_keepalive_cadence_ms()</code></A> (see{' '}
              <A href="/library/guides/connection#keepalive">keepalive</A>).
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Usage;
