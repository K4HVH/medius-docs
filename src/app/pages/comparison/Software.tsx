import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Software: Component = () => (
  <ComparisonPage
    path="/comparison/software"
    lead={<p>The programs, libraries and tools around each firmware, and how widely each is used.</p>}
  />
);

export default Software;
