import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Input: Component = () => (
  <ComparisonPage
    path="/comparison/input"
    lead={<p>Buttons and keys injected through the box, and locks that hold physical input back.</p>}
  />
);

export default Input;
