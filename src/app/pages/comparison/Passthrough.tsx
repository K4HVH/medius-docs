import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

// When each box reads the device, against the PC's polls of the clone.
const READS = `            the PC polls the clone
             v         v         v
  PC     ----+---------+---------+---
  Medius ---+---------+---------+----
  Stock  -----+--------+----------+--

  Medius reads the device just before
  each poll. Stock reads it on a
  separate timer, which drifts against
  the PC's polls.`;

const Passthrough: Component = () => (
  <ComparisonPage
    path="/comparison/passthrough"
    lead={<p>The device's native reports relayed to the PC: what arrives, how evenly, and what the PC's requests do on the way back.</p>}
    before={{ 'relay-timing': <pre class="diagram">{READS}</pre> }}
  />
);

export default Passthrough;
