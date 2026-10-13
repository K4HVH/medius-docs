import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

const Software: Component = () => <ComparisonPage path="/comparison/software" lead={<p>The tools, libraries, updates and community around each firmware.</p>} />;

export default Software;
