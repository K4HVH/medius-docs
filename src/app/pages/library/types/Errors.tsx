import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Errors: Component = () => {
  return (
    <>
      <div id="errors" data-search-target>
        <Card>
          <CardHeader title="Errors" subtitle="The Error enum and the Result alias" />
          <p>
            Every fallible call returns <code>Result&lt;T&gt;</code>, the crate's alias for{' '}
            <code>core::result::Result&lt;T, Error&gt;</code>.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::Device;

fn main() -> medius::Result<()> {
    let device = Device::find()?;       // ? bubbles a NotFound / NoReply up
    let version = device.query_version()?;
    println!("{version}");
    Ok(())
}`}</code></pre>

          <p>
            <code>Error</code> is{' '}
            <a
              href="https://doc.rust-lang.org/reference/attributes/type_system.html"
              target="_blank"
              rel="noreferrer"
            >
              <code>#[non_exhaustive]</code>
            </a>
            , so any <code>match</code> needs a wildcard arm.
          </p>

          <table class="api-params">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>Io(std::io::Error)</code></td>
                <td>An underlying serial or OS error.</td>
              </tr>
              <tr>
                <td><code>NotFound</code></td>
                <td>No device matched the expected VID/PID.</td>
              </tr>
              <tr>
                <td><code>NoReply</code></td>
                <td>
                  The box never answered the version query during the{' '}
                  <A href="/library/connection">handshake</A>: wrong port or baud, or not a Medius
                  box.
                </td>
              </tr>
              <tr>
                <td><code>BadProtoVer &#123; got &#125;</code></td>
                <td>
                  The box answered, but its <code>proto_ver</code> wasn't <code>1</code>;{' '}
                  <code>got</code> carries the reported value. See the{' '}
                  <A href="/library/connection">handshake</A>.
                </td>
              </tr>
              <tr>
                <td><code>QueryTimeout</code></td>
                <td>
                  A <A href="/library/requests"><code>query</code></A> hit its deadline with no{' '}
                  <A href="/native/commands/requests#resp"><code>RESP</code></A> back.
                </td>
              </tr>
              <tr>
                <td><code>Disconnected</code></td>
                <td>The device disconnected.</td>
              </tr>
              <tr>
                <td><code>FrameTooLong</code></td>
                <td>
                  A payload was over the <A href="/native/frame#layout">512-byte</A> frame limit.
                </td>
              </tr>
              <tr>
                <td><code>FlashTool(String)</code></td>
                <td>
                  The flash tool failed. Present only with the{' '}
                  <A href="/library/features/flash"><code>flash</code></A> feature.
                </td>
              </tr>
            </tbody>
          </table>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Device, Error};

fn connect() -> medius::Result<Device> {
    match Device::find() {
        Ok(device) => Ok(device),
        Err(Error::NotFound) => {
            eprintln!("no box plugged in");
            Err(Error::NotFound)
        }
        Err(Error::NoReply) => {
            eprintln!("found a port but it didn't answer the handshake");
            Err(Error::NoReply)
        }
        Err(Error::BadProtoVer { got }) => {
            eprintln!("box speaks protocol {got}, this build expects 1");
            Err(Error::BadProtoVer { got })
        }
        Err(Error::QueryTimeout) => Err(Error::QueryTimeout),
        Err(Error::Disconnected) => Err(Error::Disconnected),
        Err(Error::FrameTooLong) => Err(Error::FrameTooLong),
        // Required: Error is #[non_exhaustive], so the wildcard is mandatory.
        Err(other) => Err(other),
    }
}`}</code></pre>

          <div class="callout callout--warning">
            <p>
              <code>FlashTool(String)</code> only exists with the{' '}
              <A href="/library/features/flash"><code>flash</code></A> feature. On a default build the
              variant isn't in the enum, so a <code>match</code> arm naming it won't compile. Gate
              such arms behind <code>#[cfg(feature = "flash")]</code> or lean on the wildcard.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Errors;
