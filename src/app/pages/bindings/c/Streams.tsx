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
          Three live channels from <A href="/native/hardware">the box</A>: raw catch events, the same
          input decoded into edges, and device log lines
          (<A href="/library/diagnostics">Logs &amp; counters</A>). Subscribe, then pull fixed-size{' '}
          <a href="https://en.cppreference.com/w/cpp/named_req/PODType" target="_blank" rel="noreferrer">POD</a> events off the handle.
        </p>
        <pre class="diagram">{`  medius_device_catch_events(dev, filters, n, &stream)  ──  raw events, every class
  medius_device_input_events(dev, filters, n, &stream)  ──  decoded press/release edges
  medius_device_logs(dev, &stream)                      ──  device log lines
          │
          ▼   a background reader thread fills a host-side queue
  medius_event_stream_recv(stream, &event)              ──  pull one (blocks)
  medius_input_stream_recv(stream, &event)              ──  the same, decoded
  medius_log_stream_recv(stream, &line)                 ──  the same, for logs
          │
          ▼   loop until MEDIUS_STATUS_ERR_DISCONNECTED
  medius_event_stream_free(stream)                      ──  unsubscribe
  medius_input_stream_free(stream)                      ──  the same, decoded
  medius_log_stream_free(stream)                        ──  the same, for logs`}</pre>
      </Card>

      <div id="subscribe" data-search-target>
        <Card>
          <CardHeader title="Subscribe" subtitle="Open an event or log stream" />
          <p>
            Both return a <A href="/bindings/c/types#errors"><code>MediusStatus</code></A> and write
            an opaque handle through an out-param. A catch subscription is an array of{' '}
            <A href="/bindings/c/types#catch-filter"><code>MediusCatchFilter</code></A> entries, each
            built by a <A href="/bindings/c/api#catch-filters"><code>medius_catch_filter_*</code></A>{' '}
            helper. The array is read during the call and not retained, so it can live on the stack.
          </p>
          <pre class="api-signature">{`MediusStatus medius_device_catch_events(struct MediusDevice *dev,
                                        const MediusCatchFilter *filters,
                                        uintptr_t n_filters,
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
              <tr><td><code>id</code></td><td>class-specific, or <code>MEDIUS_CATCH_ID_ANY</code></td><td>Which button, usage, axis, interface, or endpoint. <code>ID_ANY</code> is one blanket entry, not an expansion.</td></tr>
              <tr><td><code>direction</code></td><td>a <code>MEDIUS_DIRECTION_*</code></td><td>The press/release edge for an input class; the transfer direction for a traffic class (<code>POSITIVE</code> = IN, <code>NEGATIVE</code> = OUT).</td></tr>
              <tr><td><code>capture</code></td><td><code>0</code> to <code>255</code></td><td>Bytes kept per event, <code>0</code> = the whole packet. Traffic classes only: an input class carries no packet.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">CATCH CLASSES</div>
          <table class="api-params">
            <thead><tr><th>Constant</th><th>Value</th><th>Subscribes to</th><th>Arrives as</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_CATCH_CLASS_BTN</code></td><td><code>0</code></td><td>mouse buttons</td><td rowspan="3"><code>data.usages</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_KEY</code></td><td><code>1</code></td><td>keyboard keys and modifiers</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_MEDIA</code></td><td><code>2</code></td><td>media (Consumer) usages</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_AXIS</code></td><td><code>3</code></td><td>X, Y, and the wheel</td><td><code>data.motion</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_HID_IN</code></td><td><code>4</code></td><td>a cloned HID interface's reports</td><td rowspan="7"><code>data.traffic</code></td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_HID_OUT</code></td><td><code>5</code></td><td>an interrupt-OUT endpoint</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_VENDOR_INTERRUPT</code></td><td><code>6</code></td><td>a vendor interrupt endpoint</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_VENDOR_BULK</code></td><td><code>7</code></td><td>a vendor bulk endpoint</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_CONTROL</code></td><td><code>8</code></td><td>a control endpoint, one event per completed transaction</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_EMIT</code></td><td><code>9</code></td><td>what the clone actually put on the wire</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_BUS</code></td><td><code>10</code></td><td>resets, suspends, configuration and attach changes</td></tr>
              <tr><td><code>MEDIUS_CATCH_CLASS_ANY</code></td><td><code>0xFF</code></td><td>every class at once (<code>id</code> must be <code>MEDIUS_CATCH_ID_ANY</code>)</td><td>any arm</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-c">{`MediusCatchFilter filters[3] = {
    /* every physical button and axis, in full */
    medius_catch_filter_watch_class(MEDIUS_CLASS_BUTTON),
    medius_catch_filter_watch_axes(),
    /* plus one vendor endpoint's IN traffic, first 16 bytes of each packet */
    medius_catch_filter_with_capture(
        medius_catch_filter_inbound(
            medius_catch_filter_traffic(MEDIUS_CATCH_CLASS_VENDOR_INTERRUPT, 0x83)),
        16),
};

MediusEventStream *events = NULL;
medius_device_catch_events(dev, filters, 3, &events);`}</code></pre>
          <p>
            The box's table holds{' '}
            <A href="/bindings/c/types#capacities"><code>MEDIUS_MAX_CATCH_ENTRIES</code></A> (32)
            entries. Asking for more, or for a filter the box cannot honour, fails the whole call with
            its own <A href="/bindings/c/types#errors"><code>MediusStatus</code></A> rather than
            quietly narrowing the subscription.
          </p>
          <div class="callout callout--info">
            <p>
              The control link runs at 4 Mbaud and vendor bulk alone measures 250 KiB/s through the
              box, so subscribing to everything at full length cannot be delivered.
            </p>
            <p>
              Delivery is four strict-priority queues (input and bus, then the other traffic classes,
              then control, then vendor bulk), and bulk can starve entirely under a busy mouse. Use{' '}
              <code>capture</code> to buy headroom.
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
            <a href="https://en.cppreference.com/w/c/language/union" target="_blank" rel="noreferrer">union</a>. A usage arm holds class-tagged{' '}
            <A href="/bindings/c/types#input"><code>MediusUsage</code></A> values
            (a button, key, or media <a href="https://www.usb.org/document-library/hid-usage-tables-14" target="_blank" rel="noreferrer">HID usage</a>).
          </p>
          <p>
            Every variable-length payload is an inline array with a count beside it, never a pointer:
            the usage list caps at{' '}
            <A href="/bindings/c/types#capacities"><code>MEDIUS_MAX_USAGES</code></A> (256), a
            captured packet at <code>MEDIUS_MAX_TRAFFIC_BYTES</code> (180). An event you copy stays
            valid, and nothing needs freeing.
          </p>
          <pre><code class="language-c">{`typedef struct MediusCatchEvent {
    MediusCatchEventKind kind;          // MOTION=0, USAGES=1, TRAFFIC=2
    uint32_t ts_us;                     // box microseconds, wraps every ~71.6 min
    MediusClockDomain clock;            // HOST_CHIP=0, DEVICE_CHIP=1: which chip stamped ts_us
    union MediusCatchEventData data;    // read the arm for kind
} MediusCatchEvent;

struct MediusMotionEvent { int16_t dx, dy, dz; };   // cursor + wheel deltas

struct MediusUsageEvent {               // one class's held usages
    MediusClass class_;                 // BUTTON / KEY / MEDIA
    uint8_t direction;                  // POSITIVE = the set grew, NEGATIVE = it shrank
    uint16_t n;
    MediusUsage usages[256];
};

struct MediusTrafficEvent {             // one captured packet
    MediusCatchClass class_;            // which class matched
    uint16_t id;                        // endpoint address / endpoint no. / interface no.
    uint8_t direction;                  // POSITIVE = IN, NEGATIVE = OUT
    uint8_t flags;                      // class-specific; the kind, for BUS
    uint16_t true_len;                  // length on the bus, before capture
    uint16_t len;                       // bytes kept in bytes[]
    uint8_t bytes[180];                 // valid over bytes[0..len]
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
          <p>
            Host-chip stamps cover motion, usages, <code>HID_IN</code> and IN traffic; device-chip
            stamps cover <code>HID_OUT</code>, OUT traffic, <code>CONTROL</code>, <code>EMIT</code>{' '}
            and <code>BUS</code>. The two chips boot independently, so put both on your own clock with
            a <A href="/bindings/c/streams#timeline"><code>MediusTimeline</code></A>.
          </p>
          <div class="api-response-label">INSPECTORS</div>
          <table class="api-params">
            <thead><tr><th>Helper</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_usage_event_is_held(&amp;ev.data.usages, usage)</code></td><td><code>bool</code>: true if that <code>MediusUsage</code> usage (button, key, or media) is held.</td></tr>
              <tr><td><code>medius_traffic_event_truncated(&amp;ev.data.traffic)</code></td><td><code>bool</code>: true if <code>len &lt; true_len</code>, so the packet was cut at the matching entry's <code>capture</code>. Without it a cut packet and a genuinely short one read identically.</td></tr>
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
MediusCatchFilter filters[2] = {
    medius_catch_filter_with_capture(medius_catch_filter_everything(), 16),
    medius_catch_filter_inbound(
        medius_catch_filter_traffic(MEDIUS_CATCH_CLASS_VENDOR_INTERRUPT, 0x83)),
};

MediusEventStream *events = NULL;
if (medius_device_catch_events(dev, filters, 2, &events) != MEDIUS_STATUS_OK) {
    char msg[256];
    medius_last_error_message(msg, sizeof msg);
    fprintf(stderr, "subscribe failed: %s\\n", msg);
    return 1;
}

MediusCatchEvent ev;
while (medius_event_stream_recv(events, &ev) == MEDIUS_STATUS_OK) {
    const char *dom = ev.clock == MEDIUS_CLOCK_DOMAIN_HOST_CHIP ? "host" : "device";
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
               medius_traffic_event_truncated(&ev.data.traffic) ? " (cut)" : "");
        break;
    }
}
/* recv returned MEDIUS_STATUS_ERR_DISCONNECTED: the box reset or the link dropped */
printf("dropped while behind: %llu\\n",
       (unsigned long long)medius_event_stream_dropped(events));
medius_event_stream_free(events);`}</code></pre>
        </Card>
      </div>

      <div id="input" data-search-target>
        <Card>
          <CardHeader title="Decoded input" subtitle="Press and release edges, not held sets" />
          <p>
            The box reports held-usage snapshots.{' '}
            <code>medius_device_input_events</code> diffs them into edges, so nothing on your side has
            to remember what was down last report.
          </p>
          <pre class="api-signature">{`MediusStatus medius_device_input_events(struct MediusDevice *dev,
                                        const MediusCatchFilter *filters,
                                        uintptr_t n_filters,
                                        struct MediusInputStream **out);`}</pre>
          <p>
            Every filter must name an input class and cover both edges. Build them with{' '}
            <A href="/bindings/c/api#catch-filters"><code>medius_catch_filter_watch*</code></A>, or
            take all four from <code>medius_catch_filter_all_input</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Function</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_input_stream_recv(stream, &amp;out)</code></td><td>Block for the next <A href="/bindings/c/types#input-event"><code>MediusInputEvent</code></A>; <code>MEDIUS_STATUS_ERR_DISCONNECTED</code> on close.</td></tr>
              <tr><td><code>medius_input_stream_try_recv(stream, &amp;out)</code></td><td><code>bool</code>: the next queued event, or <code>false</code> (never blocks).</td></tr>
              <tr><td><code>medius_input_stream_recv_timeout(stream, timeout_ms, &amp;out)</code></td><td><code>bool</code>: <code>false</code> on timeout or close.</td></tr>
              <tr><td><code>medius_input_stream_held(stream, class_, out, cap)</code></td><td>Write that class's currently held usages into <code>out[0..cap]</code>; returns how many there are. A return above <code>cap</code> means the buffer was short.</td></tr>
              <tr><td><code>medius_input_stream_dropped(stream)</code></td><td><code>uint64_t</code>: events the subscription dropped behind a slow consumer.</td></tr>
              <tr><td><code>medius_input_stream_free(stream)</code></td><td>Release the handle. Null is a no-op; this stream has no clone, because it owns the held sets it diffs.</td></tr>
            </tbody>
          </table>
          <table class="api-params">
            <thead><tr><th>Refused with</th><th>Because the filter was</th></tr></thead>
            <tbody>
              <tr><td><code>MEDIUS_STATUS_ERR_NOT_AN_INPUT_FILTER</code></td><td>A traffic class, which arrives as bytes and decodes into no edge.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_WILDCARD_NOT_INPUT</code></td><td><code>medius_catch_filter_everything</code>, which covers traffic too.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_HALF_EDGE_INPUT_FILTER</code></td><td>Narrowed with <code>_on_press</code> or <code>_on_release</code>: one edge cannot be diffed into two.</td></tr>
              <tr><td><code>MEDIUS_STATUS_ERR_INVALID_ARG</code></td><td>Carrying a <code>class_</code> or a <code>direction</code> byte no constant names. <code>medius_device_catch_events</code> refuses the same two.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-c">{`MediusCatchFilter filters[4];
medius_catch_filter_all_input(filters);        /* buttons, keys, media, axes */

MediusInputStream *input = NULL;
if (medius_device_input_events(dev, filters, 4, &input) != MEDIUS_STATUS_OK)
    return 1;

MediusInputEvent ev;
while (medius_input_stream_recv(input, &ev) == MEDIUS_STATUS_OK) {
    switch (ev.kind) {
    case MEDIUS_INPUT_KIND_PRESS:
    case MEDIUS_INPUT_KIND_RELEASE:
        printf("[%u] %s usage %u:%u\\n", ev.ts_us,
               ev.kind == MEDIUS_INPUT_KIND_PRESS ? "down" : "up  ",
               (unsigned)ev.usage.kind, (unsigned)ev.usage.id);
        break;
    case MEDIUS_INPUT_KIND_MOTION:
        printf("[%u] move dx=%d dy=%d dz=%d\\n", ev.ts_us, ev.dx, ev.dy, ev.dz);
        break;
    }
}
medius_input_stream_free(input);`}</code></pre>
        </Card>
      </div>

      <div id="timeline" data-search-target>
        <Card>
          <CardHeader title="Timeline" subtitle="Put box stamps on your own clock" />
          <p>
            A catch stamp is microseconds on a chip that booted before your process did: it wraps every
            ~71.6 minutes and relates to nothing here. A <code>MediusTimeline</code> maps it.
          </p>
          <pre class="api-signature">{`struct MediusTimeline *medius_timeline_new(void);
void     medius_timeline_free(struct MediusTimeline *t);
bool     medius_timeline_observe(struct MediusTimeline *t, const MediusCatchEvent *ev,
                                 uint64_t now_ns, MediusStamped *out);
void     medius_timeline_reset(struct MediusTimeline *t, MediusClockDomain domain);
uint64_t medius_timeline_samples(struct MediusTimeline *t, MediusClockDomain domain);`}</pre>
          <p>
            Feed every event in as it arrives, in order, with your own monotonic reading as{' '}
            <code>now_ns</code>. A <A href="/bindings/c/types#stamped"><code>MediusStamped</code></A>{' '}
            comes back on that same scale.
          </p>
          <table class="api-params">
            <thead><tr><th>Call</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td><code>medius_timeline_observe(t, &amp;ev, now_ns, &amp;out)</code></td><td>Place one event; <code>false</code> on a null argument.</td></tr>
              <tr><td><code>medius_timeline_reset(t, domain)</code></td><td>Forget that domain's rollover count and measured floor, for a chip that rebooted.</td></tr>
              <tr><td><code>medius_timeline_samples(t, domain)</code></td><td>Events observed for a domain. The floor is a minimum over these, so a handful is a loose estimate.</td></tr>
            </tbody>
          </table>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-c">{`MediusTimeline *tl = medius_timeline_new();

MediusCatchEvent ev;
while (medius_event_stream_recv(events, &ev) == MEDIUS_STATUS_OK) {
    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    uint64_t now_ns = (uint64_t)now.tv_sec * 1000000000ull + (uint64_t)now.tv_nsec;

    MediusStamped at;
    if (medius_timeline_observe(tl, &ev, now_ns, &at))
        printf("%llu ns  (box %llu us, %llu ns of jitter)\\n",
               (unsigned long long)at.host_ns,
               (unsigned long long)at.box_us,
               (unsigned long long)at.excess_ns);

    /* a chip reboot restarts its clock at zero, which no bus event announces:
       call medius_timeline_reset(tl, domain) when you know one happened. */
}
medius_timeline_free(tl);`}</code></pre>
        </Card>
      </div>

      <div id="async" data-search-target>
        <Card>
          <CardHeader title="No async" subtitle="Build it on the non-blocking receives" />
          <div class="callout callout--warning">
            <p>
              The <A href="/bindings/c">C ABI</A> is synchronous; there's no <A href="/library/features/async">async</A> API.
              Poll with <code>medius_event_stream_try_recv</code>, block with a budget using{' '}
              <code>medius_event_stream_recv_timeout</code>, or run the blocking{' '}
              <code>recv</code> loop on its own thread. Catch and log handles clone; an input stream
              does not.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Streams;
