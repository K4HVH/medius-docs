import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const SmoothMotion: Component = () => {
  return (
    <>
      <div id="smooth-motion" data-search-target>
        <Card>
          <CardHeader title="Smooth motion" subtitle="Glide instead of teleport, and 1 kHz loops" />
          <p>
            There's no <code>move_smooth</code>: subdivide and loop with a ~1 ms sleep for ~1 kHz glide.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::thread::sleep;
use std::time::Duration;

// Glide ~400 counts to the right over 200 steps (~200 ms at 1 kHz).
for _ in 0..200 {
    device.move_rel(2, 0)?;
    sleep(Duration::from_millis(1));
}`}</code></pre>
          <div class="callout callout--warning">
            <p>
              The library applies no rate limit. A no-sleep loop floods the 4 Mbaud link; pace your
              own steps.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default SmoothMotion;
