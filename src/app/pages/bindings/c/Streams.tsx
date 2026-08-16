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
        <pre class="diagram">{`  medius_device_catch_events(dev, filters, n, &stream)  ──  subscribe to the addressed classes
  medius_device_logs(dev, &stream)                      ──  subscribe to log lines
          │
          ▼   a background reader thread fills a host-side queue
  medius_event_stream_recv(stream, &event)              ──  pull one (blocks)
  medius_log_stream_recv(stream, &line)                 ──  the same, for logs
          │
          ▼   loop until MEDIUS_STATUS_ERR_DISCONNECTED
  medius_event_stream_free(stream)                      ──  unsubscribe
  medius_log_stream_free(stream)                        ──  the same, for logs`}</pre>
      </Card>

      <div id="subscribe" data-search-target>
        <Card>
          <CardHeader title="Subscribe" subtitle="Open an event or log stream" />
          <p>
            Both return a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A> and write
            an opaque handle through an out-param. A catch subscription is an array of{' '}
            <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A> entries: each
            names a <A href="/bindings/c/types#catch-class">class</A>, an id inside that class (or{' '}
            <code>MEDIUS_CATCH_ID_ALL</code> for all of them), a direction, and how many bytes to
            capture. The array is read during the call and not retained, so it can live on the stack.
          </p>
          <pre class="api-signature">{`MediusStatus medius_device_catch_events(struct MediusDevice *dev,
                                        const MediusCatchFilter *filters,
                                        size_t n_filters,
                                        struct MediusEventStream **out);

MediusStatus medius_device_logs(struct MediusDevice *dev,
                                struct MediusLogStream **out);`}</pre>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_device_catch_events(dev, filters, n_filters, &amp;out)</code></td><td>Subscribe to everything the filters address. See <A href="/library/catch">Catch</A>.</td></tr>
              <tr><td><code>medius_device_logs(dev, &amp;out)</code></td><td>Open the device LOG channel. See <A href="/library/diagnostics">Logs</A>.</td></tr>
              <tr><td><code>medius_event_stream_clone(stream)</code> / <code>medius_log_stream_clone(stream)</code></td><td>Another handle to the same subscription. Null in &rarr; null out.</td></tr>
              <tr><td><code>medius_event_stream_free(stream)</code> / <code>medius_log_stream_free(stream)</code></td><td>Release a handle (unsubscribes when the last clone drops). Null is a no-op.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">ONE FILTER ENTRY</div>
          <table class="api-params">
            <thead><tr><th>Field</th><th>Value</th><th>What it decides</th></tr></thead>
            <tbody>
              <tr><td><code>class_</code></td><td>a <code>MEDIUS_CATCH_CLASS_*</code></td><td>The address space, and which event arm the matches arrive on.</td></tr>
              <tr><td><code>id</code></td><td>class-specific, or <code>MEDIUS_CATCH_ID_ALL</code></td><td>Which button, usage, axis, interface, or endpoint. <code>ID_ALL</code> is one blanket entry, not an expansion.</td></tr>
              <tr><td><code>direction</code></td><td>a <code>MEDIUS_LOCK_DIRECTION_*</code></td><td>The press/release edge for an input class; the transfer direction for a traffic class (<code>POSITIVE</code> = IN, <code>NEGATIVE</code> = OUT).</td></tr>
              <tr><td><code>snaplen</code></td><td><code>0</code> to <code>255</code></td><td>Bytes captured per event, <code>0</code> = the whole packet. Per entry, because a 64-byte vendor interrupt report is worth capturing whole while a bulk pipe traced for framing is worth 16 bytes.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CATCH CLASSES</div>
          <table class="api-params">
            <thead><tr><th>Constant</th><th>Value</th><th>Subscribes to</th><th>Arrives as</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_CLASS_BUTTON</code></td><td><code>0</code></td><td>mouse buttons</td><td rowspan="3"><code>data.usages</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_KEY</code></td><td><code>1</code></td><td>keyboard keys and modifiers</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_MEDIA</code></td><td><code>2</code></td><td>media (Consumer) usages</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_AXIS</code></td><td><code>3</code></td><td>X, Y, and the wheel</td><td><code>data.motion</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_HID_IN</code></td><td><code>4</code></td><td>a cloned HID interface's reports</td><td rowspan="7"><code>data.traffic</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_HID_OUT</code></td><td><code>5</code></td><td>an interrupt-OUT endpoint</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_VEND_INTR</code></td><td><code>6</code></td><td>a vendor interrupt endpoint</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_VEND_BULK</code></td><td><code>7</code></td><td>a vendor bulk endpoint</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_CONTROL</code></td><td><code>8</code></td><td>a control endpoint, one event per completed transaction</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_EMIT</code></td><td><code>9</code></td><td>what the clone actually put on the wire</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_BUS</code></td><td><code>10</code></td><td>resets, suspends, configuration and attach changes</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_ANY</code></td><td><code>0xFF</code></td><td>every class at once (<code>id</code> must be <code>MEDIUS_CATCH_ID_ALL</code>)</td><td>any arm</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">SUBSCRIBING TO TWO CLASSES AT DIFFERENT DEPTHS</div>
          <pre><code class="language-c">{`MediusCatchFilter filters[] = {
    /* every physical input, in full */
    { .class_ = MEDIUS_CATCH_CLASS_BUTTON,    .id = MEDIUS_CATCH_ID_ALL,
      .direction = MEDIUS_LOCK_DIRECTION_BOTH, .snaplen = 0 },
    { .class_ = MEDIUS_CATCH_CLASS_AXIS,      .id = MEDIUS_CATCH_ID_ALL,
      .direction = MEDIUS_LOCK_DIRECTION_BOTH, .snaplen = 0 },
    /* plus one vendor endpoint's IN traffic, first 16 bytes of each packet */
    { .class_ = MEDIUS_CATCH_CLASS_VEND_INTR, .id = 0x83,
      .direction = MEDIUS_LOCK_DIRECTION_POSITIVE, .snaplen = 16 },
};

MediusEventStream *events = NULL;
medius_device_catch_events(dev, filters, sizeof filters / sizeof filters[0], &events);`}</code></pre>
          <div class="callout callout--warning">
            <p>
              The box's table holds{' '}
              <A href="/bindings/c/types#capacities"><code>MEDIUS_CATCH_TABLE_MAX</code></A> (32)
              entries and the subscription gets no reply, so an entry the box refused, whether because
              the table was full, the class was unknown, the direction was out of range, or{' '}
              <code>MEDIUS_CATCH_CLASS_ANY</code> carried a real <code>id</code>, is visible only as an
              absence. Read the accepted set back with{' '}
              <A href="/bindings/c/api#queries"><code>medius_device_query_catch</code></A> and check its{' '}
              <code>table_full</code> flag.
            </p>
          </div>
          <div class="callout callout--info">
            <p>
              The control link runs at 4 Mbaud, and vendor bulk alone measures 250 KiB/s through the
              box, so subscribing to everything at full length cannot be delivered. Delivery is four
              strict-priority queues (input and bus, then the other traffic classes, then control, then
              vendor bulk) over a transmit buffer that reserves a slice only input may spend, and bulk
              can starve entirely under a busy mouse. Address what you actually want, and use{' '}
              <code>snaplen</code> to buy headroom for the rest.
            </p>
          </div>
        </Card>
      </div>

      <div id="receive" data-search-target>
        <Card>
          <CardHeader title="Receive" subtitle="Pull one event off the queue" />
          <p>
            There's no iterator. Loop a receive call until it returns{' '}
            <code>MEDIUS_STATUS_ERR_DISCONNECTED</code> (the stream closes after a{' '}
            <A href="/library/admin">reset</A> or <A href="/library/connection">link loss</A>). Each
            writes one event through <code>*out</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Returns</th><th>Blocks?</th></tr></thead>
            <tbody>
              <tr><td><code>medius_event_stream_recv(stream, &amp;out)</code></td><td><code>MediusStatus</code> (<code>MEDIUS_STATUS_ERR_DISCONNECTED</code> on close)</td><td>Yes, until the next event</td></tr>
              <tr><td><code>medius_event_stream_try_recv(stream, &amp;out)</code></td><td><code>bool</code> (<code>false</code> if the queue is empty)</td><td>No, returns at once</td></tr>
              <tr><td><code>medius_event_stream_recv_timeout(stream, timeout_ms, &amp;out)</code></td><td><code>bool</code> (<code>false</code> on timeout or close)</td><td>Up to <code>timeout_ms</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">LOGS MIRROR THIS</div>
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
            Every variable-length payload is an inline array with a count beside it, never a pointer:
            the usage list is fixed at{' '}
            <A href="/bindings/c/types#capacities"><code>MEDIUS_MAX_USAGES</code></A> (256) and a
            captured packet at <code>MEDIUS_TRAFFIC_MAX_BYTES</code> (500), so an event you copy stays
            valid and nothing needs freeing. It holds class-tagged{' '}
            <A href="/bindings/c/types#input"><code>MediusUsage</code></A> usages
            (a button, key, or media <a href="https://www.usb.org/document-library/hid-usage-tables-14" target="_blank" rel="noreferrer">HID usage</a>).
          </p>
          <pre><code class="language-c">{`typedef struct MediusCatchEvent {
    MediusCatchEventKind kind;          // MOTION=0, USAGES=1, TRAFFIC=2
    uint32_t ts_us;                     // box microseconds, wraps every ~71.6 min
    MediusClockDomain clk;              // HOST=0, DEVICE=1: which chip stamped ts_us
    union MediusCatchEventData data;    // read the arm for kind
} MediusCatchEvent;

struct MediusMotionEvent { int16_t dx, dy, dz; };                     // cursor + wheel deltas
struct MediusUsageEvent  { uint16_t n; MediusUsage usages[256]; };    // class-tagged held usages

struct MediusTrafficEvent {             // one captured packet
    MediusCatchClass class_;            // which class matched
    uint16_t id;                        // endpoint address / endpoint no. / interface no.
    MediusLockDirection direction;      // POSITIVE = IN, NEGATIVE = OUT
    uint8_t flags;                      // class-specific; the kind, for BUS
    uint16_t true_len;                  // length on the bus, before snaplen
    uint16_t len;                       // bytes captured into bytes[]
    uint8_t bytes[500];                 // valid over bytes[0..len]
};

typedef struct MediusLogLine {          // from medius_log_stream_recv
    MediusLogLevel level;               // ERROR=0, WARN=1, INFO=2, DEBUG=3, VERBOSE=4
    char text[512];                     // NUL-terminated
} MediusLogLine;`}</code></pre>
          <table class="api-params">
            <thead><tr><th>When <code>kind</code> is</th><th>Read</th><th>Fields</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_MOTION</code></td><td><code>data.motion</code></td><td><code>dx</code>, <code>dy</code>, <code>dz</code> (cursor and wheel deltas)</td></tr>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_USAGES</code></td><td><code>data.usages</code></td><td><code>usages[0..n]</code>, each a class-tagged <code>MediusUsage</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_EVENT_KIND_TRAFFIC</code></td><td><code>data.traffic</code></td><td><code>class_</code>, <code>id</code>, <code>direction</code>, <code>flags</code>, and <code>bytes[0..len]</code> of a <code>true_len</code>-byte packet</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">THE TIMESTAMP IS PER DOMAIN</div>
          <p>
            <code>ts_us</code> and <A href="/bindings/c/types#clock-domain"><code>clk</code></A> sit on
            the event, not inside the arms, because all three arms carry a stamp, so the pair is common
            to every one of them. <code>clk</code> is there because the domain is <em>not</em> common:
            the two ESP32-S3s boot independently and neither clock relates to the other or to your PC,
            so subtract stamps only within one domain. Host-chip stamps cover motion, usages,{' '}
            <code>HID_IN</code>, and IN traffic; device-chip stamps cover <code>HID_OUT</code>, OUT
            traffic, <code>CONTROL</code>, <code>EMIT</code>, and <code>BUS</code>. To bridge them, read
            the clock estimate on{' '}
            <A href="/bindings/c/types#catch-state"><code>MediusCatchState</code></A>.
          </p>
          <div class="api-response-label">INSPECTORS</div>
          <table class="api-params">
            <thead><tr><th>Helper</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_usage_event_is_held(&amp;ev.data.usages, usage)</code></td><td><code>bool</code>: true if that <code>MediusUsage</code> usage (button, key, or media) is held.</td></tr>
              <tr><td><code>medius_traffic_event_truncated(&amp;ev.data.traffic)</code></td><td><code>bool</code>: true if <code>len &lt; true_len</code>, so the packet was cut at the matching entry's <code>snaplen</code>. Without it a snapped packet and a genuinely short one read identically.</td></tr>
              <tr><td><code>medius_event_stream_dropped(stream)</code></td><td><code>uint64_t</code>: events dropped because the consumer fell behind (host-side back-pressure).</td></tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              <code>medius_event_stream_dropped</code> counts what <em>your</em> consumer lost.
              What the box shed before it ever reached the wire is on{' '}
              <A href="/bindings/c/types#catch-state"><code>MediusCatchState</code></A>: a box-wide
              total, plus a per-entry count so you can tell which subscription is the expensive one.
            </p>
          </div>
        </Card>
      </div>

      <div id="example" data-search-target>
        <Card>
          <CardHeader title="Consume loop" subtitle="Subscribe, drain until disconnect, free" />
          <pre><code class="language-c">{`#include <medius.h>
#include <stdio.h>

/* a blanket over every class at 16 bytes a packet, plus one vendor endpoint's IN traffic in full */
MediusCatchFilter filters[] = {
    { .class_ = MEDIUS_CATCH_CLASS_ANY,       .id = MEDIUS_CATCH_ID_ALL,
      .direction = MEDIUS_LOCK_DIRECTION_BOTH, .snaplen = 16 },
    { .class_ = MEDIUS_CATCH_CLASS_VEND_INTR, .id = 0x83,
      .direction = MEDIUS_LOCK_DIRECTION_POSITIVE, .snaplen = 0 },
};

MediusEventStream *events = NULL;
if (medius_device_catch_events(dev, filters, sizeof filters / sizeof filters[0], &events)
        != MEDIUS_STATUS_OK) {
    char msg[256];
    medius_last_error_message(msg, sizeof msg);
    fprintf(stderr, "subscribe failed: %s\\n", msg);
    return 1;
}

MediusCatchEvent ev;
while (medius_event_stream_recv(events, &ev) == MEDIUS_STATUS_OK) {
    const char *dom = ev.clk == MEDIUS_CLOCK_DOMAIN_HOST ? "host" : "device";
    switch (ev.kind) {
    case MEDIUS_CATCH_EVENT_KIND_MOTION:
        printf("[%s %u] motion dx=%d dy=%d dz=%d\\n", dom, ev.ts_us,
               ev.data.motion.dx, ev.data.motion.dy, ev.data.motion.dz);
        break;
    case MEDIUS_CATCH_EVENT_KIND_USAGES:
        printf("[%s %u] held usages=%u  LMB=%d  W=%d\\n", dom, ev.ts_us, ev.data.usages.n,
               medius_usage_event_is_held(&ev.data.usages, medius_usage_button(MEDIUS_BUTTON_LEFT)),
               medius_usage_event_is_held(&ev.data.usages, medius_usage_key(MEDIUS_KEY_W)));
        break;
    case MEDIUS_CATCH_EVENT_KIND_TRAFFIC:
        printf("[%s %u] class=%u id=0x%02X %u/%u bytes%s\\n", dom, ev.ts_us,
               ev.data.traffic.class_, ev.data.traffic.id,
               ev.data.traffic.len, ev.data.traffic.true_len,
               medius_traffic_event_truncated(&ev.data.traffic) ? " (snapped)" : "");
        break;
    }
}
/* recv returned MEDIUS_STATUS_ERR_DISCONNECTED: the box reset or the link dropped */
printf("dropped while behind: %llu\\n",
       (unsigned long long)medius_event_stream_dropped(events));
medius_event_stream_free(events);`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="No async" subtitle="Build it on the non-blocking receives" />
          <div class="callout callout--warning">
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
