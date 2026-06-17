import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Threading: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Threading & Clone" subtitle="Sharing one connection across threads and tasks" />
        <p>
          <code>Device</code> clones cheaply over a shared link; the cards below cover the sync
          threading model and running async queries concurrently.
        </p>
      </Card>

      <div id="threading" data-search-target>
        <Card>
          <CardHeader title="Threading model" subtitle="Thread-safe, cheap to clone" />
          <p>
            <code>Device</code> is <code>Send + Sync</code> and clones cheaply (an <a href="https://doc.rust-lang.org/std/sync/struct.Arc.html" target="_blank" rel="noreferrer"><code>Arc</code></a> inside), so one connection shares across threads.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::thread;

// clone is cheap (bumps an Arc); the port is not re-opened:
let worker = device.clone();
let handle = thread::spawn(move || {
    worker.move_rel(10, 0)
});
handle.join().unwrap()?;`}</code></pre>
        </Card>
      </div>

      <div id="concurrency" data-search-target>
        <Card>
          <CardHeader title="Running queries concurrently" subtitle="join and cloning across tasks" />
          <p>
            <a href="https://docs.rs/futures/latest/futures/future/fn.join.html" target="_blank" rel="noreferrer"><code>futures::future::join</code></a> polls both queries together.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let (v, h) = futures::future::join(
    device.query_version(),
    device.query_health(),
).await;
let v = v?;
let h = h?;
println!("{v}, link_up={}", h.link_up);`}</code></pre>

          <p>
            <code>AsyncDevice</code> is <code>Clone</code> over a shared <code>Link</code>, so hand a clone to another task.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`let mover = device.clone();
mover.move_rel(40, 0)?;                     // fire-and-forget, no .await
let v = device.query_version().await?;      // awaited on the other handle`}</code></pre>

          <div class="callout callout--info">
            <p>
              Mutators never block; only the two queries need <code>.await</code>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Threading;
