import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Streams: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Streams" subtitle="Read live input and logs in C" />
        <p>
          Two live channels from <A href="/native/hardware">the box</A>: physical input
          (<A href="/library/catch">Catch</A>) and device log lines
          (<A href="/library/diagnostics">Logs &amp; counters</A>). Subscribe, then pull fixed-size{' '}
          <a href="https://en.cppreference.com/w/cpp/named_req/PODType" target="_blank" rel="noreferrer">POD</a> events off the handle.
        </p>
        <pre class="diagram">{`  medius_device_catch_events(dev, mask, &stream)    ──  live input
  medius_device_logs(dev, &stream)                  ──  log lines
          │
          ▼   a background reader thread fills a host-side queue
  medius_event_stream_recv(stream, &event)          ──  pull one (blocks)
          │
          ▼   loop until MEDIUS_STATUS_ERR_DISCONNECTED
  medius_event_stream_free(stream)                  ──  unsubscribe`}</pre>
      </Card>

      <div id="subscribe" data-search-target>
        <Card>
          <CardHeader title="Subscribe" subtitle="Open an event or log stream" />
          <p>
            Both return a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A> and write
            an opaque handle through an out-param. Pick the input classes with a{' '}
            <A href="/bindings/c/types#catch-mask"><code>MediusCatchMask</code></A>.
          </p>
          <pre class="api-signature">MediusStatus medius_device_catch_events(struct MediusDevice *dev,
                                        MediusCatchMask mask,
                                        struct MediusEventStream **out);

MediusStatus medius_device_logs(struct MediusDevice *dev,
                                struct MediusLogStream **out);</pre>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_catch_events(dev, mask, &amp;out)</code></td><td>Subscribe to physical input for the class <code>mask</code>; writes the stream to <code>*out</code>. See <A href="/library/catch">Catch</A>.</td></tr>
              <tr><td><code>medius_device_logs(dev, &amp;out)</code></td><td>Open the device LOG channel; writes the stream to <code>*out</code>. See <A href="/library/diagnostics">Logs</A>.</td></tr>
              <tr><td><code>medius_event_stream_clone(stream)</code> / <code>medius_log_stream_clone(stream)</code></td><td>Another handle to the same subscription. Null in &rarr; null out.</td></tr>
              <tr><td><code>medius_event_stream_free(stream)</code> / <code>medius_log_stream_free(stream)</code></td><td>Release a handle (unsubscribes when the last clone drops). Null is a no-op.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CATCH MASK BITS (OR THEM TOGETHER)</div>
          <table class="api-params">
            <thead><tr><th>Constant</th><th>Value</th><th>Class</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_MASK_MOTION</code></td><td><code>1</code></td><td>cursor motion (dx / dy)</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_WHEEL</code></td><td><code>2</code></td><td>wheel</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_BUTTONS</code></td><td><code>4</code></td><td>mouse buttons</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_KEYS</code></td><td><code>8</code></td><td>keyboard keys</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_MEDIA</code></td><td><code>16</code></td><td>media keys</td></tr>
              <tr><td><code>MEDIUS_CATCH_MASK_ALL</code></td><td><code>31</code></td><td>everything (<code>1 | 2 | 4 | 8 | 16</code>)</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="receive" data-search-target>
        <Card>
          <CardHeader title="Receive" subtitle="Pull one event off the queue" />
          <p>
            There's no iterator. Loop a receive call until it returns{' '}
            <code>MEDIUS_STATUS_ERR_DISCONNECTED</code> (the stream closes after a{' '}
            <A href="/library/admin">reset</A> or <A href="/library/connection">link loss</A>). The
            blocking <code>recv</code> returns a <code>MediusStatus</code>; the two non-blocking
            variants return a <code>bool</code>. Each writes one event through <code>*out</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th><th>Blocks?</th></tr></thead>
            <tbody>
              <tr><td><code>medius_event_stream_recv(stream, &amp;out)</code></td><td><code>MediusStatus</code> (<code>MEDIUS_STATUS_ERR_DISCONNECTED</code> on close)</td><td>Yes, until the next event</td></tr>
              <tr><td><code>medius_event_stream_try_recv(stream, &amp;out)</code></td><td><code>bool</code> (<code>false</code> if the queue is empty)</td><td>No, returns at once</td></tr>
              <tr><td><code>medius_event_stream_recv_timeout(stream, timeout_ms, &amp;out)</code></td><td><code>bool</code> (<code>false</code> on timeout or close)</td><td>Up to <code>timeout_ms</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">LOGS MIRROR THIS EXACTLY (writing a <A href="/bindings/c/types#log-line"><code>MediusLogLine</code></A> instead)</div>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>medius_log_stream_recv(stream, &amp;out)</code></td><td><code>MediusStatus</code> (<code>MEDIUS_STATUS_ERR_DISCONNECTED</code> on close)</td></tr>
              <tr><td><code>medius_log_stream_try_recv(stream, &amp;out)</code></td><td><code>bool</code> (<code>false</code> if none queued)</td></tr>
              <tr><td><code>medius_log_stream_recv_timeout(stream, timeout_ms, &amp;out)</code></td><td><code>bool</code> (<code>false</code> on timeout or close)</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="events" data-search-target>
        <Card>
          <CardHeader title="Event objects" subtitle="Fixed-size PODs, nothing to free per event" />
          <p>
            <code>medius_event_stream_recv</code> fills a{' '}
            <A href="/bindings/c/types#catch-event"><code>MediusCatchEvent</code></A>: a{' '}
            <code>kind</code> tag plus a{' '}
            <a href="https://en.cppreference.com/w/c/language/union" target="_blank" rel="noreferrer">union</a>. Read the union arm that matches <code>kind</code>.
            The usage list is length-prefixed by an inline <code>n</code> count; the backing array is
            fixed at{' '}
            <A href="/bindings/c/types#capacities"><code>MEDIUS_MAX_USAGES</code></A> (256), so nothing
            truncates. It holds class-tagged <A href="/bindings/c/types#input"><code>MediusInput</code></A> usages
            (a button, key, or media <a href="https://www.usb.org/document-library/hid-usage-tables-14" target="_blank" rel="noreferrer">HID usage</a>).
          </p>
          <pre><code class="language-c">{`typedef struct MediusCatchEvent {
    MediusCatchEventKind kind;          // MOTION=0, USAGES=1
    union MediusCatchEventData data;    // read the arm for kind
} MediusCatchEvent;

struct MediusMotionEvent { int16_t dx, dy, dz; };                     // cursor + wheel deltas
struct MediusUsageEvent  { uint16_t n; MediusInput usages[256]; };    // class-tagged held usages

typedef struct MediusLogLine {          // from medius_log_stream_recv
    MediusLogLevel level;               // ERROR=0, WARN=1, INFO=2, DEBUG=3, VERBOSE=4
    char text[512];                     // NUL-terminated
} MediusLogLine;`}</code></pre>
          <table class="api-params">
            <thead><tr><th>When <code>kind</code> is</th><th>Read</th><th>Fields</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_MOTION</code></td><td><code>data.motion</code></td><td><code>dx</code>, <code>dy</code>, <code>dz</code> (cursor and wheel deltas)</td></tr>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_USAGES</code></td><td><code>data.usages</code></td><td><code>usages[0..n]</code>, each a class-tagged <A href="/bindings/c/types#input"><code>MediusInput</code></A></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">INSPECTORS (test one usage without walking the array)</div>
          <table class="api-params">
            <thead><tr><th>Helper</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_usage_event_is_held(&amp;ev.data.usages, usage)</code></td><td><code>bool</code>: true if that <A href="/bindings/c/types#input"><code>MediusInput</code></A> usage (button, key, or media) is held.</td></tr>
              <tr><td><code>medius_event_stream_dropped(stream)</code></td><td><code>uint64_t</code>: events dropped because the consumer fell behind (host-side back-pressure).</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="example" data-search-target>
        <Card>
          <CardHeader title="Consume loop" subtitle="Subscribe, drain until disconnect, free" />
          <pre><code class="language-c">{`#include <medius.h>
#include <stdio.h>

MediusEventStream *events = NULL;
if (medius_device_catch_events(dev, MEDIUS_CATCH_MASK_ALL, &events) != MEDIUS_STATUS_OK) {
    char msg[256];
    medius_last_error_message(msg, sizeof msg);
    fprintf(stderr, "subscribe failed: %s\\n", msg);
    return 1;
}

MediusCatchEvent ev;
while (medius_event_stream_recv(events, &ev) == MEDIUS_STATUS_OK) {
    switch (ev.kind) {
    case MEDIUS_CATCH_EVENT_KIND_MOTION:
        printf("motion dx=%d dy=%d dz=%d\\n",
               ev.data.motion.dx, ev.data.motion.dy, ev.data.motion.dz);
        break;
    case MEDIUS_CATCH_EVENT_KIND_USAGES:
        printf("held usages=%u  LMB=%d  W=%d\\n", ev.data.usages.n,
               medius_usage_event_is_held(&ev.data.usages, medius_input_button(MEDIUS_BUTTON_LEFT)),
               medius_usage_event_is_held(&ev.data.usages, medius_input_key(MEDIUS_KEY_W)));
        break;
    }
}
/* recv returned MEDIUS_STATUS_ERR_DISCONNECTED: the box reset or the link dropped */
printf("dropped while behind: %llu\\n",
       (unsigned long long)medius_event_stream_dropped(events));
medius_event_stream_free(events);`}</code></pre>
        </Card>
      </div>

      <div id="no-async" data-search-target>
        <Card>
          <CardHeader title="No async" subtitle="Build it on the non-blocking receives" />
          <div class="callout callout--info">
            <p>
              The <A href="/bindings/c">C ABI</A> is synchronous; there's no <A href="/library/features/async">async</A> API.
              For a single-threaded event loop, poll with{' '}
              <code>medius_event_stream_try_recv</code> or block with a budget using{' '}
              <code>medius_event_stream_recv_timeout</code>; or run the blocking{' '}
              <code>recv</code> loop on its own thread. A stream handle is clonable, so each thread
              can hold its own.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Streams;
