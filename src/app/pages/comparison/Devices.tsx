import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

// What each box does with a device it can't present exactly.
const UNFIT = `  a device the box can't present
  exactly
     |
     +--> Stock: trims it to fit,
     |    removing interfaces and
     |    clamping endpoints
     |
     +--> Medius: refuses it, with no
          clone. With Imperfect clone
          on, it clones it as closely
          as it can`;

const Devices: Component = () => (
  <ComparisonPage
    path="/comparison/devices"
    lead={<p>Which USB devices each box clones, and how closely each clone matches its device, down to the descriptors and endpoint 0.</p>}
    before={{ shapes: <pre class="diagram">{UNFIT}</pre> }}
  />
);

export default Devices;
