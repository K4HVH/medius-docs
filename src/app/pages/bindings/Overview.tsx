import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const Overview: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Bindings" subtitle="Drive the box from C, C++, or Python" />
        <p>
          A <A href="/native/hardware">medius box</A> sits inline between a mouse and a PC: the real
          device passes through untouched, and your program{' '}
          <A href="/native/injection">injects input</A> of its own over a{' '}
          <A href="/native/frame">USB-serial link</A>. These bindings let you write that program in{' '}
          <A href="/bindings/c">C or C++</A> or <A href="/bindings/python">Python</A> instead of{' '}
          <a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer">Rust</a>. They
          cover the whole feature set and put the exact same bytes on the wire.
        </p>
        <pre class="diagram">{`        your program   ( C / C++ / Python )
                       │
        ┌──────────────▼──────────────┐
        │      language binding       │   ◀ these pages
        └──────────────┬──────────────┘
                       │   C ABI · medius.h + libmedius_capi
        ┌──────────────▼──────────────┐
        │     medius (Rust core)      │   ◀ the client library
        └──────────────┬──────────────┘
                       │   4 Mbaud USB-serial frames
        ┌──────────────▼──────────────┐
        │       the medius box        │   ──▶ mouse + game PC
        └─────────────────────────────┘`}</pre>
        <div class="callout callout--info">
          <p>
            C and C++ are one binding: the C header (<A href="/bindings/c"><code>medius.h</code></A>)
            compiles as both, so a C++ program includes it and calls the same functions. New to
            medius? Start with the <A href="/native/quickstart">Quickstart</A> for what the box does;
            these pages link to the <A href="/library">Rust Library</A> and{' '}
            <A href="/native">Native API</A> for what each command means.
          </p>
        </div>
      </Card>

      <div id="pick" data-search-target>
        <Card>
          <CardHeader title="Languages" subtitle="Same capabilities, different ergonomics" />
          <table class="api-params">
            <thead>
              <tr><th>Language</th><th>Install</th><th>Errors</th><th>Cleanup</th><th>Reach for it when</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/bindings/python"><code>Python</code></A></td>
                <td><code><a href="https://pip.pypa.io" target="_blank" rel="noreferrer">pip</a> install medius</code></td>
                <td>raises <A href="/bindings/python/types"><code>MediusError</code></A></td>
                <td>automatic (<code><a href="https://docs.python.org/3/reference/datamodel.html#context-managers" target="_blank" rel="noreferrer">with</a></code> / <a href="https://docs.python.org/3/glossary.html#term-garbage-collection" target="_blank" rel="noreferrer">GC</a>)</td>
                <td>scripting, automation, fast prototyping</td>
              </tr>
              <tr>
                <td><A href="/bindings/c"><code>C / C++</code></A></td>
                <td>download the prebuilt library</td>
                <td>returns <A href="/bindings/c/types#errors"><code>MediusStatus</code></A></td>
                <td>manual (<A href="/bindings/c/api"><code>*_free</code></A>)</td>
                <td>a C or C++ app, embedding, a base for another <a href="https://en.wikipedia.org/wiki/Foreign_function_interface" target="_blank" rel="noreferrer">FFI</a></td>
              </tr>
            </tbody>
          </table>
          <p>Every language does everything. Pick by ergonomics, not capability.</p>
        </Card>
      </div>

      <div id="coverage" data-search-target>
        <Card>
          <CardHeader title="Coverage" subtitle="Every box feature, in every language" />
          <table class="api-params">
            <thead>
              <tr><th>Capability</th><th>C / C++</th><th>Python</th></tr>
            </thead>
            <tbody>
              <tr><td><A href="/library/connection">Connect, find, clone the link</A></td><td>✓</td><td>✓</td></tr>
              <tr><td><A href="/library/move">Move &amp; wheel</A></td><td>✓</td><td>✓</td></tr>
              <tr><td><A href="/library/inject">Inject buttons, keys, media</A></td><td>✓</td><td>✓</td></tr>
              <tr><td><A href="/library/lock">Lock physical input</A></td><td>✓</td><td>✓</td></tr>
              <tr><td><A href="/library/catch">Catch live input (streams)</A></td><td>✓</td><td>✓</td></tr>
              <tr><td><A href="/library/options">Options &amp; LED</A></td><td>✓</td><td>✓</td></tr>
              <tr><td><A href="/library/requests">Queries (version, health, caps…)</A></td><td>✓</td><td>✓</td></tr>
              <tr><td><A href="/library/features/mock">Mock box (testing)</A></td><td>build flag</td><td>build flag</td></tr>
              <tr><td><A href="/library/features/flash">Flash firmware</A></td><td>build flag</td><td>build flag</td></tr>
              <tr><td><A href="/library/features/async">Async</A></td><td colspan="2">sync only — build it on the stream timeouts (see each Streams page)</td></tr>
            </tbody>
          </table>
          <p>
            Mock and flash are off by default; each binding's <strong>Build &amp; features</strong>{' '}
            page shows how to turn them on.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Overview;
