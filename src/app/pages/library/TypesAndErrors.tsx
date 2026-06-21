import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const TypesAndErrors: Component = () => {
  return (
    <>
      <div id="types-overview" data-search-target>
        <Card>
          <CardHeader
            title="Types & errors"
            subtitle="What you pass in, what you get back, and how calls fail"
          />
          <p>
            Every public type is re-exported at the crate root: import from{' '}
            <code>medius::</code>, not <code>medius::types::</code>. The argument{' '}
            <A href="/library/types/enums">enums</A>, the{' '}
            <A href="/library/types/structs">structs</A> the box reports back, and the one{' '}
            <A href="/library/types/errors"><code>Error</code></A> all live here.
          </p>

          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use medius::{Button, ButtonAction, Health, Version, Error, Result};

// One flat namespace. This does NOT work:
// use medius::types::Button;`}</code></pre>
        </Card>
      </div>

      <div id="sections" data-search-target>
        <Card>
          <CardHeader title="Reference pages" subtitle="Pick a group" />
          <div class="docs-grid">
            <A href="/library/types/enums" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Enums" subtitle="Button, ButtonAction, RebootTarget, LogLevel" />
              </Card>
            </A>
            <A href="/library/types/structs" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Structs" subtitle="Version, Health, MouseInfo, Caps, Rate, Stats, and more" />
              </Card>
            </A>
            <A href="/library/types/frames" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Frames" subtitle="FrameType, DecodedFrame" />
              </Card>
            </A>
            <A href="/library/types/errors" style={{ "text-decoration": "none" }}>
              <Card interactive variant="subtle" padding="compact">
                <CardHeader title="Errors" subtitle="Error, Result" />
              </Card>
            </A>
          </div>
        </Card>
      </div>

    </>
  );
};

export default TypesAndErrors;
