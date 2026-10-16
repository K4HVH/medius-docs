import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const ControlLink: Component = () => <ComparisonPage path="/comparison/control-link" lead={<p>How fast each box replies to a query, how many moves it accepts (paced or clumped), and what it does with malformed input.</p>} />;

export default ControlLink;
