import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Capabilities: Component = () => (
  <ComparisonPage
    path="/comparison/capabilities"
    lead={<p>What a program can do through each box's commands, area by area. The Result column names the box that can do more.</p>}
  />
);

export default Capabilities;
