import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '../../scripts/lib/htmlToMarkdown';

describe('htmlToMarkdown', () => {
  it('renders CardHeader as an h2 with an italic subtitle', () => {
    const md = htmlToMarkdown(
      '<div class="card__header"><h3>Clip</h3><small>Preload input and let the box play it back</small></div>',
    );
    expect(md).toBe('## Clip\n\n_Preload input and let the box play it back_');
  });

  it('renders a CardHeader with no subtitle as a bare h2', () => {
    expect(htmlToMarkdown('<div class="card__header"><h3>clip</h3></div>')).toBe('## clip');
  });

  it('renders pre.api-signature as a fenced text block, decoding entities', () => {
    const md = htmlToMarkdown('<pre class="api-signature">fn clip(&amp;self) -&gt; ClipHandle</pre>');
    expect(md).toBe('```text\nfn clip(&self) -> ClipHandle\n```');
  });

  it('preserves whitespace exactly in pre.diagram', () => {
    const html = '<pre class="diagram">  +--------+\n  |  0x12  |\n  +--------+</pre>';
    expect(htmlToMarkdown(html)).toBe('```\n  +--------+\n  |  0x12  |\n  +--------+\n```');
  });

  it('renders a highlighted code block with its language and strips Prism spans', () => {
    const html =
      '<pre><code class="language-rust"><span class="token keyword">let</span> x = <span class="token number">1</span>;</code></pre>';
    expect(htmlToMarkdown(html)).toBe('```rust\nlet x = 1;\n```');
  });

  it('renders api-params as a GFM table', () => {
    const html =
      '<table class="api-params"><thead><tr><th>Method</th><th>Does</th></tr></thead><tbody><tr><td><code>start()</code></td><td>Play.</td></tr></tbody></table>';
    expect(htmlToMarkdown(html)).toBe('| Method | Does |\n| --- | --- |\n| `start()` | Play. |');
  });

  it('renders byte-table as a GFM table with its own header schema', () => {
    const html =
      '<table class="byte-table"><thead><tr><th>Offset</th><th>Field</th><th>Type</th><th>Notes</th></tr></thead><tbody><tr><td>0</td><td>opcode</td><td>u8</td><td>0x12</td></tr></tbody></table>';
    expect(htmlToMarkdown(html)).toBe(
      '| Offset | Field | Type | Notes |\n| --- | --- | --- | --- |\n| 0 | opcode | u8 | 0x12 |',
    );
  });

  it('renders api-response-label as an h4', () => {
    expect(htmlToMarkdown('<div class="api-response-label">PAYLOAD</div>')).toBe('#### PAYLOAD');
  });

  it('renders api-badge as an italic tag', () => {
    expect(htmlToMarkdown('<span class="api-badge api-badge--executed">Fire-and-forget</span>')).toBe(
      '_Fire-and-forget_',
    );
  });

  it('renders a warning callout as a labelled blockquote', () => {
    const html = '<div class="callout callout--warning"><p>Careful now.</p></div>';
    expect(htmlToMarkdown(html)).toBe('> **Warning**\n>\n> Careful now.');
  });

  it('renders an info callout with the Note label', () => {
    const html = '<div class="callout callout--info"><p>Heads up.</p></div>';
    expect(htmlToMarkdown(html)).toBe('> **Note**\n>\n> Heads up.');
  });

  it('rewrites internal links to .md and preserves the hash', () => {
    expect(htmlToMarkdown('<a href="/library/clip#builder">ClipBuilder</a>')).toBe(
      '[ClipBuilder](/library/clip.md#builder)',
    );
  });

  it('rewrites an internal link with no hash to .md', () => {
    expect(htmlToMarkdown('<a href="/library/move">move</a>')).toBe('[move](/library/move.md)');
  });

  it('leaves external links unchanged', () => {
    expect(
      htmlToMarkdown('<a href="https://crates.io/crates/medius" target="_blank" rel="noreferrer">medius</a>'),
    ).toBe('[medius](https://crates.io/crates/medius)');
  });

  it('renders a docs-grid nav tile block as a bullet list of links, not nested headings', () => {
    const html =
      '<div class="docs-grid">' +
      '<a href="/native/quickstart" style="text-decoration: none;">' +
      '<div class="card card--subtle"><div class="card__header"><h3>Quickstart</h3><small>Open the port and inject</small></div></div>' +
      '</a>' +
      '<a href="/native/architecture">' +
      '<div class="card"><div class="card__header"><h3>Architecture</h3></div></div>' +
      '</a>' +
      '</div>';
    expect(htmlToMarkdown(html)).toBe(
      '- [Quickstart](/native/quickstart.md): Open the port and inject\n- [Architecture](/native/architecture.md)',
    );
  });
});
