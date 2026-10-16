import { describe, it, expect } from 'vitest';
import { cardHeadProblems } from '../../scripts/lib/cardHead';

const WANT = {
  image: 'https://medius.k4tech.net/og/guide.png?v=12345678',
  alt: 'Start here',
  url: 'https://medius.k4tech.net/guide',
  title: 'Start here · Medius',
  colour: '#0080ff',
};

const head = (over: Record<string, string | null> = {}, extra = '') => {
  const tags: [string, string, string][] = [
    ['property', 'og:url', WANT.url],
    ['property', 'og:title', WANT.title],
    ['property', 'og:image', WANT.image],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', WANT.alt],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', WANT.title],
    ['name', 'twitter:image', WANT.image],
  ];
  const metas = tags
    .filter(([, key]) => over[key] !== null)
    .map(([attr, key, value]) => `<meta ${attr}="${key}" content="${over[key] ?? value}">`)
    .join('');
  const theme = `<meta name="theme-color" content="${WANT.colour}" data-embed="${WANT.colour}"><script>document.querySelector('meta[name="theme-color"]').content = '#000000';</script>`;
  return `<html><head>${theme}${metas}${extra}</head><body></body></html>`;
};

describe('cardHeadProblems', () => {
  it('passes a head an unfurler reads right', () => {
    expect(cardHeadProblems(head(), WANT)).toEqual([]);
  });

  it('fails a second og:image, which an unfurler may take instead', () => {
    expect(cardHeadProblems(head({}, '<meta property="og:image" content="https://medius.k4tech.net/favicon.png">'), WANT)).toEqual(['2 og:image tags']);
  });

  it('fails a missing og:image:type or twitter:card', () => {
    expect(cardHeadProblems(head({ 'og:image:type': null }), WANT)).toEqual(['og:image:type null, want image/png']);
    expect(cardHeadProblems(head({ 'twitter:card': null }), WANT)).toEqual(['twitter:card null, want summary_large_image']);
  });

  it("fails an og:url or og:title naming another page", () => {
    expect(cardHeadProblems(head({ 'og:url': 'https://medius.k4tech.net/' }), WANT)).toEqual([`og:url https://medius.k4tech.net/, want ${WANT.url}`]);
    expect(cardHeadProblems(head({ 'og:title': 'Medius' }), WANT)).toEqual([`og:title Medius, want ${WANT.title}`]);
  });

  it('fails an og:url on a noindex page, which names no address', () => {
    expect(cardHeadProblems(head(), { ...WANT, url: null })).toEqual([`og:url ${WANT.url}, want none`]);
  });
});
