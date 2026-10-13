import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

// How each box emits one injected count into a still mouse, on its defaults.
const ONE_COUNT = `          command
             v
  Stock      [ ][ ][ ] ... [ ][1]
  Medius     [1]

  Stock emits a report on every poll,
  empty until the count, over a window
  that grows with the gap between
  commands. Medius emits one report,
  on the next poll.`;

const Injection: Component = () => (
  <ComparisonPage
    path="/comparison/injection"
    lead={<p>Moves a program sends through the box: how soon they reach the PC, how each box spreads them over reports, and whether every count arrives.</p>}
    before={{ 'move-latency': <pre class="diagram">{ONE_COUNT}</pre> }}
  />
);

export default Injection;
