import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const ChoosingPort: Component = () => {
  return (
    <div id="choosing-a-port" data-search-target>
      <Card>
        <CardHeader title="Choosing a port" subtitle="When more than one box is plugged in" />
        <p>
          <code>find</code> grabs the first match. With more than one box, <code>find_medius</code>{' '}
          lists every match as a{' '}
          <A href="/library/types/structs#port-info"><code>PortInfo</code></A> (<code>path</code>,{' '}
          <code>vid</code>, <code>pid</code>) without opening, then <code>open</code> the chosen one.
        </p>
        <div class="api-response-label">EXAMPLE</div>
        <pre><code>{`use medius::{Device, find_medius};

let ports = find_medius();
for port in &ports {
    println!("{} (vid={:#06x} pid={:#06x})", port.path, port.vid, port.pid);
}

// open a chosen one (here, the first):
let port = ports.first().ok_or(medius::Error::NotFound)?;
let dev = Device::open(&port.path)?;`}</code></pre>
      </Card>
    </div>
  );
};

export default ChoosingPort;
