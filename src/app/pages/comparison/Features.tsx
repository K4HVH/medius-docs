import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Features: Component = () => <ComparisonPage path="/comparison/features" lead={<p>What each firmware's commands can do, taken from its documentation.</p>} />;

export default Features;
