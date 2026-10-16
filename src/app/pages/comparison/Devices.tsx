import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Devices: Component = () => <ComparisonPage path="/comparison/devices" lead={<p>Which devices each box clones, how faithful each clone is, and whether native data reaches the PC.</p>} />;

export default Devices;
