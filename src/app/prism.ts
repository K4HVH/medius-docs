// Prism syntax highlighting for the doc code blocks. Languages are imported in dependency order
// (clike before c).
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-cmake';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-json';

Prism.manual = true;

export default Prism;
