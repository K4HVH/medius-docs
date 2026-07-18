import { describe, it, expect } from 'vitest';
import { assemblePageMarkdown } from '../../scripts/lib/pageDoc';

describe('assemblePageMarkdown', () => {
  it('promotes the first section heading to the page H1 and records the source', () => {
    const content = '## Clip\n\n_Preload input_\n\nBody text.';
    expect(assemblePageMarkdown(content, 'https://medius.k4tech.net/library/clip')).toBe(
      '<!-- Source: https://medius.k4tech.net/library/clip -->\n# Clip\n\n_Preload input_\n\nBody text.\n',
    );
  });

  it('only promotes the FIRST heading, leaving later section headings as h2', () => {
    const content = '## Clip\n\nintro\n\n## clip\n\nmethod';
    expect(assemblePageMarkdown(content, 'https://x/y')).toBe(
      '<!-- Source: https://x/y -->\n# Clip\n\nintro\n\n## clip\n\nmethod\n',
    );
  });

  it('leaves content with no leading section heading unpromoted', () => {
    expect(assemblePageMarkdown('Just text.', 'https://x/y')).toBe(
      '<!-- Source: https://x/y -->\nJust text.\n',
    );
  });
});
