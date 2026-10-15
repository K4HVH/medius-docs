// Checks the head a link unfurler reads: one of each tag, the large card at its size and type, the stripe
// colour in theme-color ahead of the script that blacks it out, and the page's address and title. `url`
// null: a page kept out of search, which names no address.

export interface CardHead {
  image: string;
  alt: string;
  url: string | null;
  title: string;
  colour: string;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const KEYS: [string, string][] = [
  ['property', 'og:url'],
  ['property', 'og:title'],
  ['property', 'og:description'],
  ['property', 'og:image'],
  ['property', 'og:image:type'],
  ['property', 'og:image:width'],
  ['property', 'og:image:height'],
  ['property', 'og:image:alt'],
  ['name', 'twitter:card'],
  ['name', 'twitter:title'],
  ['name', 'twitter:description'],
  ['name', 'twitter:image'],
  ['name', 'description'],
];

export function cardHeadProblems(html: string, want: CardHead): string[] {
  const head = html.slice(0, html.indexOf('</head>'));
  const all = (attr: string, key: string) =>
    [...head.matchAll(new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`, 'g'))].map((m) => decode(m[1]));
  const one = (attr: string, key: string) => all(attr, key)[0] ?? null;
  const problems: string[] = [];
  for (const [attr, key] of KEYS) {
    const n = all(attr, key).length;
    if (n > 1) problems.push(`${n} ${key} tags`);
  }
  const expect = (attr: string, key: string, value: string | null) => {
    const got = one(attr, key);
    if (got !== value) problems.push(`${key} ${got}, want ${value ?? 'none'}`);
  };
  expect('property', 'og:image', want.image);
  expect('name', 'twitter:image', want.image);
  expect('property', 'og:image:type', 'image/png');
  expect('property', 'og:image:width', '1200');
  expect('property', 'og:image:height', '630');
  expect('property', 'og:image:alt', want.alt);
  expect('name', 'twitter:card', 'summary_large_image');
  expect('property', 'og:url', want.url);
  expect('property', 'og:title', want.title);
  expect('name', 'twitter:title', want.title);
  const theme = `<meta name="theme-color" content="${want.colour}" data-embed="${want.colour}">`;
  const black = `<script>document.querySelector('meta[name="theme-color"]').content = '#000000';</script>`;
  const at = head.indexOf(theme);
  if (at < 0 || head.slice(at + theme.length).trimStart().indexOf(black) !== 0)
    problems.push(`theme-color is not ${want.colour} ahead of the script that blacks it out`);
  return problems;
}
