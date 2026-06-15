import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Tracing: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Tracing" subtitle="Structured diagnostics over the link" />
        <p>
          The <code>tracing</code> feature wires the crate into{' '}
          <a href="https://docs.rs/tracing" target="_blank" rel="noreferrer"><code>tracing</code></a>,
          the Rust ecosystem's structured, leveled diagnostics framework. With it on, the library
          emits spans and events as it works the link, and your program collects them through whatever
          subscriber it installs. It changes no behavior; it only reports.
        </p>
      </Card>

      <div id="feature" data-search-target>
        <Card>
          <CardHeader title="The tracing feature" subtitle="Build-time opt-in" />
          <p>
            The instrumentation sits behind the <code>tracing</code> Cargo feature, off by default.
            Turn it on with <code>cargo add medius --features tracing</code>. With it off, the calls
            compile to nothing, so there is no cost when you don't use it.
          </p>
          <p>
            Nothing is printed until a subscriber is installed. Add{' '}
            <a href="https://docs.rs/tracing-subscriber" target="_blank" rel="noreferrer"><code>tracing-subscriber</code></a>{' '}
            (or any subscriber) to print the events or forward them to your logging stack; with none
            installed, the spans and events are dropped.
          </p>
        </Card>
      </div>

      <div id="coverage" data-search-target>
        <Card>
          <CardHeader title="What it instruments" subtitle="The connection lifecycle" />
          <p>
            The spans and events follow the connection lifecycle, the same stages documented across
            these pages:
          </p>
          <table class="api-params">
            <thead>
              <tr><th>Stage</th><th>Traced</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><A href="/library/connection#handshake">Connect</A></td>
                <td>Opening the port and the version handshake.</td>
              </tr>
              <tr>
                <td><A href="/library/lifecycle#keepalive">Keepalive</A></td>
                <td>The periodic frame that holds a pressed override alive.</td>
              </tr>
              <tr>
                <td><A href="/library/lifecycle#reconnect">Reconnect</A></td>
                <td>A dropped link, the back-off, and the reopen.</td>
              </tr>
            </tbody>
          </table>
          <div class="callout callout--info">
            <p>
              The other features are <A href="/library/features/async"><code>async</code></A>,{' '}
              <A href="/library/features/mock"><code>mock</code></A>, and{' '}
              <A href="/library/features/flash"><code>flash</code></A>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Tracing;
