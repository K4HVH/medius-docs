import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Usage: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Calls & errors" subtitle="The Python patterns: blocking, exceptions, lifecycle, builders" />
        <p>
          What every <code>Device</code> call looks like in{' '}
          <a href="https://www.python.org" target="_blank" rel="noreferrer">Python</a>: when it blocks, how a failure
          surfaces, when the handle is freed, and how the generic targets are built. The full call
          list is on <A href="/bindings/python/api">API index</A>; the value types on{' '}
          <A href="/bindings/python/types">Types &amp; errors</A>. What each command <em>does</em>{' '}
          lives in the <A href="/library">Rust Library</A> and <A href="/native">Native API</A>{' '}
          sections.
        </p>
      </Card>

      <div id="calls" data-search-target>
        <Card>
          <CardHeader title="Fire-and-forget vs blocking" subtitle="What the two badges mean" />
          <p>
            Every <code>Device</code> call carries one of two badges, by whether it waits for{' '}
            <A href="/native/hardware">the box</A> to answer or{' '}
            <A href="/native/injection#fire-and-forget">fires and forgets</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Badge</th><th>Means</th><th>Which calls</th></tr></thead>
            <tbody>
              <tr>
                <td><span class="api-badge api-badge--executed">Fire-and-forget</span></td>
                <td>Queues a <A href="/native/frame">frame</A> and returns at once. No reply is read.</td>
                <td><A href="/library/move"><code>move_rel</code></A>, <A href="/library/move"><code>wheel</code></A>, <A href="/library/inject"><code>inject</code></A>, <A href="/library/inject"><code>press</code></A>, <A href="/library/inject"><code>soft_release</code></A>, <A href="/library/lock"><code>lock</code></A>/<A href="/library/lock"><code>unlock</code></A>, <A href="/library/led"><code>led</code></A>, <A href="/library/admin"><code>reset</code></A>, <A href="/library/admin"><code>reapply</code></A>, <A href="/library/options"><code>set_movement_riding</code></A>, <A href="/library/options"><code>set_emit_pace</code></A> …</td>
              </tr>
              <tr>
                <td><span class="api-badge api-badge--responded">Blocks</span></td>
                <td>Sends, then waits for the box's reply (or times out).</td>
                <td><A href="/bindings/python/api#connect"><code>Device.open</code></A> / <A href="/bindings/python/api#connect"><code>find</code></A> (the <A href="/native/connection#handshake">handshake</A>), every <A href="/native/commands/requests"><code>query_*</code></A> / <A href="/native/commands/requests"><code>caps</code></A> / <A href="/library/diagnostics"><code>counters</code></A>, and a stream <A href="/bindings/python/streams"><code>recv()</code></A></td>
              </tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              A <span class="api-badge api-badge--executed">Fire-and-forget</span> call returning
              without raising means the frame was <em>queued</em>, not that the box acted on it.
              Confirm with a <span class="api-badge api-badge--responded">Blocks</span> query like{' '}
              <A href="/bindings/python/api#queries"><code>dev.query_health()</code></A>. Blocking calls use the default reply wait,{' '}
              <A href="/bindings/python/api#module"><code>medius.default_query_timeout_ms()</code></A> (1000 ms).
            </p>
          </div>
        </Card>
      </div>

      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="A failed call raises MediusError" />
          <p>
            There is no status return in Python: a failed call <strong>raises</strong>. The base type
            is <A href="/bindings/python/types#mediuserror"><code>MediusError</code></A> (an{' '}
            <a href="https://docs.python.org/3/library/exceptions.html#Exception" target="_blank" rel="noreferrer"><code>Exception</code></a>{' '}
            subclass); each{' '}
            <A href="/library/types/errors">status code</A> (a <A href="/bindings/python/types#status"><code>Status</code></A>{' '}
            <a href="https://docs.python.org/3/library/enum.html" target="_blank" rel="noreferrer">IntEnum</a>)
            maps to its own <A href="/bindings/python/types#subclasses">subclass</A>, so you can catch the case you care about. Catch{' '}
            <code>MediusError</code> for all of them.
          </p>
          <pre class="api-signature">{`class MediusError(Exception):
    status:    Status   # the failure code (a Status IntEnum)
    message:   str      # the box's last error text, may be ""
    proto_ver: int      # offending byte for BadProtoVerError, else 0

str(err)   # "ERR_NOT_FOUND: no medius port found"  (or only the name)`}</pre>
          <div class="api-response-label">STATUS &rarr; EXCEPTION</div>
          <table class="api-params">
            <thead><tr><th><code>Status</code></th><th>Subclass raised</th><th>Typically means</th></tr></thead>
            <tbody>
              <tr><td><code>ERR_IO</code></td><td><code>IoError</code></td><td>serial read/write failed</td></tr>
              <tr><td><code>ERR_NOT_FOUND</code></td><td><code>NotFoundError</code></td><td>no box at that path / none present</td></tr>
              <tr><td><code>ERR_NO_REPLY</code></td><td><code>NoReplyError</code></td><td>box never answered</td></tr>
              <tr><td><code>ERR_BAD_PROTO_VER</code></td><td><code>BadProtoVerError</code></td><td>firmware protocol mismatch (see <code>.proto_ver</code>)</td></tr>
              <tr><td><code>ERR_QUERY_TIMEOUT</code></td><td><code>QueryTimeoutError</code></td><td>a <code>query_*</code> outran its wait</td></tr>
              <tr><td><code>ERR_DISCONNECTED</code></td><td><code>DisconnectedError</code></td><td>the link dropped (see below)</td></tr>
              <tr><td><code>ERR_FRAME_TOO_LONG</code></td><td><code>FrameTooLongError</code></td><td>payload over the frame limit</td></tr>
              <tr><td><code>ERR_FLASH_TOOL</code></td><td><code>FlashToolError</code></td><td><a href="https://github.com/espressif/esptool" target="_blank" rel="noreferrer">esptool</a> flash failed</td></tr>
              <tr><td><code>ERR_INVALID_ARG</code></td><td><code>InvalidArgError</code></td><td>a bad argument value</td></tr>
              <tr><td><code>ERR_PANIC</code></td><td><code>PanicError</code></td><td>the native core panicked</td></tr>
              <tr><td><code>ERR_UNKNOWN</code></td><td><code>MediusError</code></td><td>anything unmapped</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-python">{`from medius import Device, MediusError, DisconnectedError

try:
    with Device.find() as dev:
        dev.move_rel(10, 0)
        print(dev.query_health())
except DisconnectedError:
    print("the link dropped mid-session")
except MediusError as e:
    print(e.status, "-", e.message)   # e.g. Status.ERR_NOT_FOUND - no medius port found`}</code></pre>
          <div class="callout callout--warning">
            <p>
              A dropped link raises <code>DisconnectedError</code> from a normal call, but a{' '}
              <A href="/bindings/python/streams">stream</A> iterator
              (<code>for ev in dev.catch_events():</code>) stops cleanly
              instead: it returns when the link drops rather than raising. Calling <code>recv()</code>{' '}
              directly still raises. Box-side telemetry behind these errors is on{' '}
              <A href="/library/diagnostics">Diagnostics</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="lifecycle" data-search-target>
        <Card>
          <CardHeader title="Lifecycle" subtitle="Open, clone, and release the handle" />
          <p>
            A <code>Device</code> owns a native handle. Open one, optionally <A href="/bindings/python/api#connect"><code>clone()</code></A> it,
            and release it three ways. Connection sharing is on{' '}
            <A href="/library/connection">Connection</A> and <A href="/library/lifecycle">Lifecycle</A>.
          </p>
          <table class="api-params">
            <thead><tr><th>Open with</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>Device.find()</code></td><td>First box found + handshake. <span class="api-badge api-badge--responded">Blocks</span></td></tr>
              <tr><td><code>Device.open(path)</code></td><td>One serial path + handshake. <span class="api-badge api-badge--responded">Blocks</span></td></tr>
              <tr><td><code>dev.clone()</code></td><td>Another handle to the <em>same</em> link; the connection is shared.</td></tr>
              <tr><td><code>MockBox().open()</code></td><td>Open over an in-process <A href="/library/features/mock">mock box</A> (needs the mock feature).</td></tr>
            </tbody>
          </table>
          <pre class="diagram">{`Device.find() ──┐
                ├──▶  one USB-serial link  (stays up while ANY handle is open)
dev.clone() ────┘

  each handle is freed on its own; the link closes with the last one`}</pre>
          <div class="api-response-label">THREE WAYS TO RELEASE</div>
          <table class="api-params">
            <thead><tr><th>Route</th><th>When the handle frees</th></tr></thead>
            <tbody>
              <tr><td><code>with Device.find() as dev:</code></td><td>When the <a href="https://docs.python.org/3/reference/datamodel.html#context-managers" target="_blank" rel="noreferrer">context manager</a> block exits (<code>__exit__</code>). Preferred.</td></tr>
              <tr><td><code>dev.close()</code></td><td>Immediately. Idempotent, so it's safe to call twice.</td></tr>
              <tr><td><a href="https://docs.python.org/3/glossary.html#term-garbage-collection" target="_blank" rel="noreferrer">garbage collection</a></td><td>Best-effort via <code>__del__</code>. Don't rely on timing.</td></tr>
            </tbody>
          </table>
          <pre><code class="language-python">{`# preferred: the context manager closes on exit
with Device.find() as dev:
    dev.move_rel(5, 5)

# or hand a clone to a worker thread and close each when done
dev = Device.find()
worker = dev.clone()
worker.close()
dev.close()`}</code></pre>
          <div class="callout callout--info">
            <p>
              <code>EventStream</code>, <code>LogStream</code>, and <code>MockBox</code> follow the
              same pattern: a <code>with</code> block, <code>.close()</code>, or GC. Streams hold
              the device alive while open; see <A href="/bindings/python/streams">Streams</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="builders" data-search-target>
        <Card>
          <CardHeader title="Building targets" subtitle="Input · Motion · LockTarget" />
          <p>
            The <A href="/library/inject"><code>inject</code></A> / <A href="/library/inject"><code>press</code></A> / <A href="/library/move"><code>move_axis</code></A> / <A href="/library/lock"><code>lock</code></A> calls take a{' '}
            <em>target object</em>, not a bare value. Build it with a classmethod, then pass it in. One
            <A href="/bindings/python/types#input"><code>Input</code></A> (button, key, or media) feeds every inject verb.
          </p>
          <table class="api-params">
            <thead><tr><th>Builder</th><th>Feeds</th><th>What it makes</th></tr></thead>
            <tbody>
              <tr><td><A href="/bindings/python/types#input"><code>Input.button(button)</code></A></td><td rowspan="3"><code>dev.inject(input, action)</code>, <code>dev.press(input)</code><br />see <A href="/library/inject">Inject</A></td><td>a mouse-button usage</td></tr>
              <tr><td><code>Input.key(key)</code></td><td>a keyboard-key usage (<A href="/native/commands/usage#keycodes">keycodes</A>)</td></tr>
              <tr><td><code>Input.media(media)</code></td><td>a consumer/media usage (<A href="/native/commands/usage#consumer">usages</A>)</td></tr>
              <tr><td><A href="/bindings/python/types#motion"><code>Motion.cursor(dx, dy)</code></A></td><td rowspan="2"><code>dev.move_axis(motion)</code><br />see <A href="/library/move">Move</A></td><td>a relative cursor nudge</td></tr>
              <tr><td><code>Motion.wheel(delta)</code></td><td>a wheel turn</td></tr>
              <tr><td><A href="/bindings/python/types#locktarget"><code>LockTarget.x()</code></A> / <code>y()</code> / <code>wheel()</code></td><td rowspan="2"><code>dev.lock(target, dir)</code> / <code>unlock</code><br />see <A href="/library/lock">Lock</A></td><td>an axis lock target</td></tr>
              <tr><td><code>LockTarget.usage(input)</code> (or <code>button</code>/<code>key</code>/<code>media</code>)</td><td>a usage lock target</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-python">{`from medius import Device, Input, Motion, LockTarget, Button, Action, LockDirection

with Device.find() as dev:
    dev.inject(Input.button(Button.LEFT), Action.PRESS)        # generic inject
    dev.move_axis(Motion.cursor(10, -4))                       # generic move
    dev.lock(LockTarget.button(Button.LEFT), LockDirection.BOTH)`}</code></pre>
          <div class="callout callout--info">
            <p>
              <code>action</code> is an <A href="/bindings/python/types#action"><code>Action</code></A> (<code>PRESS</code> /{' '}
              <code>SOFT_RELEASE</code> / <code>FORCE_RELEASE</code>); the{' '}
              <A href="/native/injection">injection model</A> defines what each does.{' '}
              <code>Input.button</code> takes a{' '}
              <A href="/bindings/python/types#button"><code>Button</code></A>;{' '}
              <code>Input.key</code>/<code>media</code> accept a <A href="/bindings/python/types#key"><code>Key</code></A>/<A href="/bindings/python/types#mediakey"><code>MediaKey</code></A> or a
              raw <code>int</code>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Usage;
