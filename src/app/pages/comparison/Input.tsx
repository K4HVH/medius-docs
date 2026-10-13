import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Input: Component = () => <ComparisonPage path="/comparison/input" lead={<p>Native and injected presses held together, and locks on native input.</p>} />;

export default Input;
