import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Controllers: Component = () => (
  <ComparisonPage
    path="/comparison/controllers"
    lead={<p>Game pads through the box: relayed to the PC, and read or driven by a program.</p>}
  />
);

export default Controllers;
