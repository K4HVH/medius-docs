import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const ControlLink: Component = () => <ComparisonPage path="/comparison/control-link" lead={<p>How fast each box answers a query, and what it does with malformed input.</p>} />;

export default ControlLink;
