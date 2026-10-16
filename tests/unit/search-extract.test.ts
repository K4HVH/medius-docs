import { describe, expect, it } from 'vitest';
import { extractPage, type PageInfo } from '../../src/app/search/extract';

const dom = (html: string) => {
  const root = document.createElement('div');
  root.className = 'docs-page';
  root.innerHTML = html;
  return root;
};

const LOCK: PageInfo = {
  path: '/native/commands/lock',
  title: 'LOCK',
  description: 'Block, pass or amplify physical input.',
  section: 'Native API',
  group: 'Commands',
  nav: 'LOCK',
  app: false,
};

const docs = dom(`
  <header class="page-header" id="top" data-search-target>
    <div class="page-header__bar"><nav>Native API / Commands</nav><button>Copy page</button></div>
    <div class="page-header__row"><h1>LOCK</h1></div>
    <p>Intro paragraph about locks.</p>
  </header>
  <section class="doc-section" id="lock" data-search-target>
    <h2 class="doc-h2">Scale<span class="doc-caption caps">Block, pass, or amplify</span></h2>
    <p>Sets how much of one input reaches the PC. Uses <code>set_lock</code> once.</p>
    <pre class="language-rust"><code>box.set_lock(LockClass::Button, 0xFFFF)?; <span class="token comment">// the whole class</span> <span class="token string">"quoted"</span></code></pre>
    <table><thead><tr><th>Byte</th><th>Field</th></tr></thead><tbody><tr><td>0</td><td>class</td></tr></tbody></table>
    <div id="blanket" data-search-target><div class="api-response-label">BLANKET</div><p>An id of 0xFFFF addresses the whole class.</p></div>
    <svg><text>axis</text></svg>
    <div data-search-skip><p>Loading...</p></div>
    <span aria-hidden="true">decor</span>
  </section>
  <div class="qa" id="bsod" data-search-target><h3>My PC blue-screens</h3><p>Update the driver.</p></div>
  <div id="titled" data-search-target data-search-title="Custom title"><p>Body</p></div>
  <div id="full" data-search-target class="api-response-label">FULL</div>
  <div id="wrap" data-search-target><p>Loose words.</p></div>
`);

const byPath = (entries: ReturnType<typeof extractPage>) => new Map(entries.map((e) => [e.path, e]));

describe('extractPage on a docs page', () => {
  const got = byPath(extractPage(docs, LOCK));

  it('makes one entry for the page, holding its description and what no section holds', () => {
    const page = got.get('/native/commands/lock')!;
    expect(page).toMatchObject({ title: 'LOCK', kind: 'page', section: 'Native API', crumb: 'Commands' });
    expect(page.text).toBe('Block, pass or amplify physical input.\nIntro paragraph about locks.\nLoose words.');
  });

  it('makes one per section, its title without the caption, and the caption apart', () => {
    const s = got.get('/native/commands/lock#lock')!;
    expect(s).toMatchObject({ title: 'Scale', caption: 'Block, pass, or amplify', kind: 'section', crumb: 'Commands / LOCK' });
  });

  it('reads a section without its nested anchors, charts, skipped blocks or hidden decoration', () => {
    const s = got.get('/native/commands/lock#lock')!;
    expect(s.text).toBe('Sets how much of one input reaches the PC. Uses set_lock once.\nByte · Field\n0 · class');
  });

  it('takes the names in code, and keeps a code sample out of the text', () => {
    const s = got.get('/native/commands/lock#lock')!;
    expect(s.code).toEqual(expect.arrayContaining(['set_lock', 'LockClass', 'Button']));
    expect(s.code).not.toContain('0xFFFF');
    expect(s.code).not.toContain('xFFFF');
    expect(s.code).not.toContain('whole');
    expect(s.code).not.toContain('quoted');
    expect(s.text).not.toContain('LockClass');
  });

  it('titles an anchor by its label, an answer by its heading, and either by an explicit title', () => {
    expect(got.get('/native/commands/lock#blanket')).toMatchObject({ title: 'BLANKET', kind: 'anchor', text: 'An id of 0xFFFF addresses the whole class.' });
    expect(got.get('/native/commands/lock#bsod')).toMatchObject({ title: 'My PC blue-screens', text: 'Update the driver.' });
    expect(got.get('/native/commands/lock#titled')!.title).toBe('Custom title');
  });

  it('titles a label that is itself the anchor by its text', () => {
    expect(got.get('/native/commands/lock#full')!.title).toBe('FULL');
  });

  it('gives what an untitled anchor holds to the entry around it', () => {
    expect(got.has('/native/commands/lock#wrap')).toBe(false);
    expect(got.get('/native/commands/lock')!.text).toContain('Loose words.');
  });

  it('leaves the page header to the page entry', () => {
    expect(got.has('/native/commands/lock#top')).toBe(false);
  });
});

describe('extractPage on a page whose first section repeats its title', () => {
  const page = dom(`
    <p>Before.</p>
    <section class="doc-section" id="clip" data-search-target>
      <h2 class="doc-h2">CLIP<span class="doc-caption caps">Play a recording</span></h2>
      <p>Plays it back.</p>
      <div id="trigger" data-search-target><h3>Trigger</h3><p>Starts it.</p></div>
    </section>`);
  const got = byPath(extractPage(page, { ...LOCK, path: '/native/commands/clip', title: 'CLIP', nav: 'Clip' }));

  it('folds that section into the page entry, caption and text', () => {
    expect(got.has('/native/commands/clip#clip')).toBe(false);
    expect(got.get('/native/commands/clip')).toMatchObject({ caption: 'Play a recording', text: 'Block, pass or amplify physical input.\nBefore.\nPlays it back.' });
    expect(got.get('/native/commands/clip#trigger')!.title).toBe('Trigger');
  });
});

const CONTROL: PageInfo = {
  path: '/dashboard/control',
  title: 'Control',
  description: 'Inject input and watch the box.',
  section: 'Dashboard',
  group: 'Dashboard',
  nav: 'Control',
  app: true,
};

const app = dom(`
  <header class="page-header"><h1>Control</h1></header>
  <div class="ptabs">
    <div class="ptabs-list" role="tablist">
      <button role="tab" data-tab="injection">Injection</button><button role="tab" data-tab="input-locks">Input locks</button><button role="tab" data-tab="log">Log</button>
    </div>
    <button class="cl" aria-label="Copy link to Injection" data-for="injection" data-search-skip data-agent-hide><svg></svg></button>
  </div>
  <section data-pane="injection" role="tabpanel">
    <div class="pn" id="move" data-search-target><div class="ph"><h2>Move</h2></div><div class="pb">
      <p>Moves the cursor.</p>
      <label>Delta X <input value="12" placeholder="pixels"></label>
      <button>Send</button>
      <table><thead><tr><th>Field</th></tr></thead><tbody><tr><td>Desk</td></tr></tbody></table>
      <select aria-label="Mode"><option>Relative</option></select>
      <button class="dd-b" aria-label="Via" data-search-text="Control port, USB2&#10;ROM download"><span data-search-skip>Control port, USB2 (Desk)</span></button>
      <span class="v">58:8C:81:DF:1E:28</span>
    </div></div>
  </section>
  <section data-pane="log" role="tabpanel" hidden>
    <div class="pn" id="device-log" data-search-target><div class="pb"><p>Lines the box logged.</p><dl><dt>Lines</dt></dl></div></div>
  </section>
  <section data-pane="input-locks" role="tabpanel" hidden>
    <div class="pn" id="locks" data-search-target><div class="ph"><h2>Input locks</h2></div><div class="pb"><p>Weigh input.</p></div></div>
  </section>
`);

describe('extractPage on a dashboard page', () => {
  const got = byPath(extractPage(app, CONTROL));

  it('reads a panel by its labels, never by the values a box fills in', () => {
    const move = got.get('/dashboard/control#move')!;
    expect(move).toMatchObject({ title: 'Move', kind: 'panel', crumb: 'Control / Injection' });
    expect(move.text.split('\n')).toEqual(['Moves the cursor.', 'Delta X', 'pixels', 'Send', 'Field', 'Mode', 'Relative', 'Via', 'Control port, USB2', 'ROM download']);
  });

  it('reads the panels of a tab that is closed', () => {
    expect(got.get('/dashboard/control#locks')).toMatchObject({ title: 'Input locks', text: 'Weigh input.' });
  });

  it('gives an untitled panel to its tab', () => {
    expect(got.has('/dashboard/control#device-log')).toBe(false);
    expect(got.get('/dashboard/control#log')).toMatchObject({ title: 'Log', text: 'Lines the box logged.\nLines' });
  });

  it('makes an entry for a tab, unless a panel in it carries the same name', () => {
    expect(got.get('/dashboard/control#injection')).toMatchObject({ title: 'Injection', kind: 'section', crumb: 'Control' });
    expect(got.has('/dashboard/control#input-locks')).toBe(false);
  });
});

describe('extractPage, as the review found it', () => {
  it('folds only the opening section into the page, never a later one of the same name', () => {
    const page = dom(`
      <section class="doc-section" id="lock" data-search-target><h2 class="doc-h2">LOCK</h2><p>Opening.</p></section>
      <section class="doc-section" id="scale" data-search-target><h2 class="doc-h2">Scale</h2><p>Middle.</p></section>
      <section class="doc-section" id="lock-again" data-search-target><h2 class="doc-h2">Lock</h2><p>Block one input.</p></section>`);
    const got = byPath(extractPage(page, LOCK));
    expect(got.get('/native/commands/lock')!.text).toContain('Opening.');
    expect(got.get('/native/commands/lock#lock-again')).toMatchObject({ title: 'Lock', text: 'Block one input.' });
  });

  it('reads diagrams as text, and takes code names from code alone', () => {
    const page = dom(`<section class="doc-section" id="flow" data-search-target><h2 class="doc-h2">Flow</h2>
      <pre class="diagram">mouse -> box\nnothing reaches the pc</pre></section>`);
    const flow = byPath(extractPage(page, LOCK)).get('/native/commands/lock#flow')!;
    expect(flow.text).toContain('nothing reaches the pc');
    expect(flow.code ?? []).not.toContain('nothing');
  });

  it('keeps links laid side by side apart', () => {
    const page = dom(`<div class="qa" id="q" data-search-target><h3>Question</h3><div style="display:flex"><a>Device fixes</a><a>Reporting a device</a></div></div>`);
    expect(byPath(extractPage(page, LOCK)).get('/native/commands/lock#q')!.text.split('\n')).toEqual(['Device fixes', 'Reporting a device']);
  });

  it('says what became of each element it was asked to read', () => {
    const seen: [string, string][] = [];
    extractPage(docs, LOCK, (id, fate) => seen.push([id, fate]));
    expect(Object.fromEntries(seen)).toMatchObject({ lock: 'entry', blanket: 'entry', bsod: 'entry', wrap: 'untitled', full: 'entry' });
  });
});

describe('extractPage on a dashboard page, as the review found it', () => {
  const page = dom(`
    <div class="pn" id="options-panel" data-search-target><div class="ph"><h2>Options</h2></div><div class="pb">
      <div id="wire-rate" data-search-target><span class="field-l">Wire rate</span>
        <div role="radiogroup" aria-label="Wire rate"><button>Matches native</button></div></div>
      <div role="radiogroup" aria-label="Rendered motion"><button>Off</button></div>
      <p class="mut" data-search-skip>Reading...</p>
    </div></div>`);
  const got = byPath(extractPage(page, CONTROL));

  it('titles an anchor by its field label, and reads a group by its name', () => {
    expect(got.get('/dashboard/control#wire-rate')).toMatchObject({ title: 'Wire rate' });
    expect(got.get('/dashboard/control#options-panel')!.text).toContain('Rendered motion');
  });
});
