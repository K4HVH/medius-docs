type Highlighter = typeof import('./prism').default;

let prism: Highlighter | undefined;
let fetching: Promise<Highlighter> | undefined;

// The highlighter, which every page that shows code brings with it (lazyPages.ts). After a failed fetch, the
// next call tries again.
export const loadHighlighter = (): Promise<Highlighter> =>
  (fetching ??= import('./prism').then(
    (m) => (prism = m.default),
    (e: unknown) => {
      fetching = undefined;
      throw e;
    },
  ));

export const highlighter = (): Highlighter | undefined => prism;
