import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Passthrough: Component = () => <ComparisonPage path="/comparison/passthrough" lead={<p>Native reports relayed through each box, and the traffic between the PC and the real device.</p>} />;

export default Passthrough;
