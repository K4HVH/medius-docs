import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

// A held button when the program holding it stops talking to the box.
const SILENCE = `  program  holds left ... stops
                          |
  Stock    held ----------+-------->
  Medius   held ----------+- 1 s -+

  Stock holds the button until a
  command releases it. Medius releases
  it after 1 s of silence, with the
  program's locks and subscriptions.
  Saved options stay.`;

const Recovery: Component = () => (
  <ComparisonPage
    path="/comparison/recovery"
    lead={<p>What each box does when the program, the device or the PC goes away and comes back.</p>}
    before={{ 'program-exit': <pre class="diagram">{SILENCE}</pre> }}
  />
);

export default Recovery;
