import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Quickstart: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="First program" subtitle="Find the box, send a command, read one event, free it" />
        <p>
          One file: <A href="/library/connection">connect</A>, read the firmware version, move the
          cursor, click the left button, wait for one physical input, then free it. C has no{' '}
          <a href="https://en.cppreference.com/w/cpp/language/exceptions" target="_blank" rel="noreferrer">exceptions</a>,
          so every fallible call returns a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A> you
          check, and the detail comes from{' '}
          <A href="/bindings/c/api#module"><code>medius_last_error_message</code></A>. What the commands{' '}
          <em>mean</em> lives in the{' '}
          <A href="/library">Library</A> and <A href="/native">Native</A> sections; this page is only
          the C mechanics.
        </p>
        <div class="callout callout--info">
          <p>
            Get <A href="/bindings/c"><code>medius.h</code></A> and the library from{' '}
            <A href="/bindings/c/build">Build &amp; features</A>. New to the{' '}
            <A href="/native/hardware">box</A> itself, read the{' '}
            <A href="/native/quickstart">Native quickstart</A> first.
          </p>
        </div>
        <pre class="diagram">{`  find()            ──▶  open + handshake      blocks
  query_version()   ──▶  read the version      blocks
  move() / press()  ──▶  inject input          fire-and-forget
  catch_events()    ──▶  subscribe to input    blocks
  recv()            ──▶  next physical event   blocks
  free()            ──▶  close, NULL-safe      local`}</pre>
      </Card>

      <div id="program" data-search-target>
        <Card>
          <CardHeader title="The program" subtitle="Every call, with error checks" />
          <p>
            <code>check()</code> is the whole error story: compare against <code>MEDIUS_STATUS_OK</code>{' '}
            (which is <code>0</code>), and on anything else pull the text with{' '}
            <code>medius_last_error_message</code>. Results land through an out-pointer
            (<code>&amp;dev</code>, <code>&amp;v</code>, <code>&amp;events</code>), never the return value.
          </p>
          <pre><code class="language-c">{`#include <stdio.h>
#include <medius.h>

/* Returns 0 on success, 1 on failure (after printing the last error). */
static int check(MediusStatus s, const char *what) {
    if (s == MEDIUS_STATUS_OK) return 0;
    char msg[256];
    medius_last_error_message(msg, sizeof msg);   /* detail for the last failure */
    fprintf(stderr, "%s failed (status %d): %s\\n", what, (int)s, msg);
    return 1;
}

int main(void) {
    MediusDevice *dev = NULL;
    if (check(medius_device_find(&dev), "find"))            /* open first box + handshake */
        return 1;

    printf("medius-capi %s (abi %u)\\n", medius_version_string(), medius_abi_version());

    MediusVersion v;
    if (!check(medius_device_query_version(dev, &v), "query_version"))
        printf("firmware %u.%u.%u (proto %u)\\n", v.fw_major, v.fw_minor, v.fw_patch, v.proto_ver);

    check(medius_device_move_rel(dev, 100, -50), "move_rel");   /* fire-and-forget */
    check(medius_device_press(dev, MEDIUS_BUTTON_LEFT), "press");
    check(medius_device_soft_release(dev, MEDIUS_BUTTON_LEFT), "release");

    MediusEventStream *events = NULL;
    if (!check(medius_device_catch_events(dev, MEDIUS_CATCH_MASK_ALL, &events), "catch_events")) {
        MediusCatchEvent ev;                                   /* blocks for one physical event */
        if (medius_event_stream_recv(events, &ev) == MEDIUS_STATUS_OK &&
            ev.kind == MEDIUS_CATCH_EVENT_KIND_MOUSE)
            printf("mouse: dx=%d dy=%d buttons=0x%02x\\n",
                   ev.data.mouse.dx, ev.data.mouse.dy, ev.data.mouse.buttons);
        medius_event_stream_free(events);                      /* unsubscribe */
    }

    medius_device_free(dev);                                   /* close link, join threads */
    return 0;
}`}</code></pre>
          <div class="api-response-label">PRINTS (numbers depend on your box)</div>
          <pre><code class="language-c">{`medius-capi 2.3.0 (abi 1)
firmware 2.3.2 (proto 2)
mouse: dx=12 dy=-4 buttons=0x00`}</code></pre>
          <div class="callout callout--info">
            <p>
              <A href="/bindings/c/api#streams"><code>medius_event_stream_recv</code></A> blocks until the user touches the mouse or
              keyboard. To poll instead, or to loop over many events, see{' '}
              <A href="/bindings/c/streams">Streams</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="build" data-search-target>
        <Card>
          <CardHeader title="Run it" subtitle="gcc or clang, link libmedius_capi" />
          <p>
            Run from the unpacked release, with <code>medius.h</code> under <code>include/</code> and{' '}
            <A href="/bindings/c"><code>libmedius_capi.so</code></A> beside it. <code>cc</code>,{' '}
            <a href="https://gcc.gnu.org/" target="_blank" rel="noreferrer"><code>gcc</code></a>, and{' '}
            <a href="https://clang.llvm.org/" target="_blank" rel="noreferrer"><code>clang</code></a> all work.
          </p>
          <pre><code class="language-bash">{`cc first.c -Iinclude -L. -lmedius_capi -o first
LD_LIBRARY_PATH=. ./first      # so the loader finds libmedius_capi.so`}</code></pre>
          <table class="api-params">
            <thead>
              <tr><th>Flag</th><th>What it does</th></tr>
            </thead>
            <tbody>
              <tr><td><code>-Iinclude</code></td><td>Where <code>medius.h</code> lives.</td></tr>
              <tr><td><code>-L.</code></td><td>Where <code>libmedius_capi</code> lives (here, the current dir).</td></tr>
              <tr><td><code>-lmedius_capi</code></td><td>Link the library (file name is <code>libmedius_capi</code>).</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              Static linking (<code>libmedius_capi.a</code>), Windows, and the{' '}
              <A href="/library/features/mock">mock</A> / <A href="/library/features/flash">flash</A>{' '}
              feature macros are on <A href="/bindings/c/build">Build &amp; features</A>.
            </p>
          </div>
        </Card>
      </div>

      <div id="mechanics" data-search-target>
        <Card>
          <CardHeader title="Walkthrough" subtitle="Errors, out-params, freeing, blocking" />
          <table class="api-params">
            <thead>
              <tr><th>Mechanic</th><th>How it works in C</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Errors</td>
                <td>
                  Every fallible call returns a <code>MediusStatus</code>;{' '}
                  <code>MEDIUS_STATUS_OK</code> is <code>0</code>, everything else is a failure.
                  Read the human text with <code>medius_last_error_message(buf, cap)</code>{' '}
                  right after the failing call.
                </td>
              </tr>
              <tr>
                <td>Results</td>
                <td>
                  Return values are status codes, so data comes back through an out-pointer:{' '}
                  <A href="/bindings/c/api#queries"><code>medius_device_query_version(dev, &amp;v)</code></A> fills <code>v</code>.
                </td>
              </tr>
              <tr>
                <td>Freeing</td>
                <td>
                  Each handle has a <code>*_free</code>: <A href="/bindings/c/api#connect"><code>medius_device_free</code></A>,{' '}
                  <A href="/bindings/c/api#streams"><code>medius_event_stream_free</code></A>, <A href="/bindings/c/api#streams"><code>medius_log_stream_free</code></A>. All are
                  NULL-safe no-ops. Catch events are fixed-size structs, so there's nothing to free
                  per event.
                </td>
              </tr>
              <tr>
                <td>
                  <span class="api-badge api-badge--executed">Fire-and-forget</span>
                </td>
                <td>
                  <A href="/bindings/c/api#move"><code>move_rel</code></A>, <A href="/bindings/c/api#move"><code>wheel</code></A>, <A href="/bindings/c/api#inject"><code>press</code></A>, <A href="/bindings/c/api#inject"><code>inject</code></A>,
                  and the <A href="/bindings/c/api#lock">lock</A> / <A href="/bindings/c/api#led-admin-options">LED</A> calls queue a <A href="/native/frame">frame</A> and return at
                  once. This is the <A href="/native/injection#fire-and-forget">fire-and-forget</A> model.
                </td>
              </tr>
              <tr>
                <td>
                  <span class="api-badge api-badge--responded">Blocks</span>
                </td>
                <td>
                  <A href="/bindings/c/api#connect"><code>medius_device_find</code></A> / <code>_open</code> (the{' '}
                  <A href="/native/connection#handshake">handshake</A>), every{' '}
                  <code>medius_device_query_*</code>, and <code>medius_event_stream_recv</code> wait
                  for a <A href="/native/commands/requests">reply</A> or an event.
                </td>
              </tr>
              <tr>
                <td>Sharing</td>
                <td>
                  <A href="/bindings/c/api#connect"><code>medius_device_clone</code></A> / <A href="/bindings/c/api#streams"><code>medius_event_stream_clone</code></A> hand back
                  another handle to the same link; each clone must be freed. See{' '}
                  <A href="/library/lifecycle">Lifecycle</A>.
                </td>
              </tr>
            </tbody>
          </table>
          <pre class="api-signature">{`MediusStatus medius_device_find(MediusDevice **out);
uintptr_t    medius_last_error_message(char *buf, uintptr_t cap);  /* returns full length */`}</pre>
          <div class="callout callout--warning">
            <p>
              <code>medius_last_error_message</code> is per-thread and reflects only the most recent
              failure on that thread, so read it before the next call overwrites it. It returns the
              full message length (excluding the NUL), so size your buffer and retry if it was truncated.
            </p>
          </div>
        </Card>
      </div>

      <div id="commands" data-search-target>
        <Card>
          <CardHeader title="Call reference" subtitle="Each call's Library and Native page" />
          <table class="api-params">
            <thead>
              <tr><th>In the program</th><th>What it means</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>medius_device_find</code></td>
                <td><A href="/library/connection">Connection</A> · the <A href="/native/connection#handshake">handshake</A></td>
              </tr>
              <tr>
                <td><code>medius_device_query_version</code></td>
                <td><A href="/library/requests">Requests</A></td>
              </tr>
              <tr>
                <td><code>medius_device_move_rel</code></td>
                <td><A href="/library/move">Move</A> · <A href="/native/commands/move#move">Native move</A></td>
              </tr>
              <tr>
                <td><code>medius_device_press</code> / <code>_soft_release</code></td>
                <td><A href="/library/inject">Inject</A> · the <A href="/native/injection">injection model</A></td>
              </tr>
              <tr>
                <td><code>medius_device_catch_events</code> / <code>_recv</code></td>
                <td><A href="/library/catch">Catch</A> · consuming them in C on <A href="/bindings/c/streams">Streams</A></td>
              </tr>
              <tr>
                <td><code>medius_device_free</code></td>
                <td><A href="/library/lifecycle">Lifecycle</A></td>
              </tr>
            </tbody>
          </table>
          <p>
            Every call and type is indexed on <A href="/bindings/c/api">API index</A> and{' '}
            <A href="/bindings/c/types">Types &amp; errors</A>. These mirror the{' '}
            <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer">medius</a> crate
            (<a href="https://github.com/K4HVH/medius" target="_blank" rel="noreferrer">source</a>).
          </p>
        </Card>
      </div>
    </>
  );
};

export default Quickstart;
