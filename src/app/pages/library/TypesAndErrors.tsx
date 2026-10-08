import type { Component } from 'solid-js';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { IndexRow } from '../../shell/IndexRow';

const TypesAndErrors: Component = () => {
  return (
    <>
      <PageHeader lead="Arguments, results, and errors">
        <span id="types-overview" data-search-target />
        <p>
          Every public type is re-exported at the crate root: import from{' '}
          <code>medius::</code>, not <code>medius::types::</code>.
        </p>

        <div class="api-response-label">EXAMPLE</div>
        <pre><code class="language-rust">{`use medius::{Button, Action, Health, Version, Error, Result};

// One flat namespace. Does not compile:
// use medius::types::Button;`}</code></pre>
      </PageHeader>

      <DocSection id="sections" title="Reference pages" caption="Pick a group">
        <IndexRow href="/library/types/enums" title="Enums" tag="Button, Action, RebootTarget, LogLevel, CatchEvent" />
        <IndexRow href="/library/types/structs" title="Structs" tag="Version, Health, MouseCaps, KbdCaps, Key, MediaKey, and more" />
        <IndexRow href="/library/types/frames" title="Frames" tag="FrameType, DecodedFrame" />
        <IndexRow href="/library/types/errors" title="Errors" tag="Error, Result" />
      </DocSection>

    </>
  );
};

export default TypesAndErrors;
