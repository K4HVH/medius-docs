import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Input: Component = () => <ComparisonPage path="/comparison/input" lead={<p>Button and key latency, native and injected presses held together, locks on native input, and clicks and typing timed by the box.</p>} />;

export default Input;
