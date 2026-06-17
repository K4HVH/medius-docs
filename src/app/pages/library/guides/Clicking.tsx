import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Clicking: Component = () => {
  return (
    <>
      <div id="clicking" data-search-target>
        <Card>
          <CardHeader title="Making a click" subtitle="Press, wait, release (there is no click helper)" />
          <p>
            No one-shot <code>click</code>: press, wait, then release with{' '}
            <A href="/library/buttons#soft-release"><code>soft_release</code></A> so you don't stomp a physical hold.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code>{`use std::{thread, time::Duration};
use medius::Button;

device.press(Button::Left)?;
thread::sleep(Duration::from_millis(20));
device.soft_release(Button::Left)?;`}</code></pre>
          <p>
            <A href="/library/admin#reset"><code>reset</code></A> drops every override at once; a held
            press is re-asserted on reconnect via{' '}
            <A href="/library/lifecycle#reapply"><code>reapply</code></A>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default Clicking;
