import { createResource, onCleanup, onMount, type Component } from 'solid-js';
import { GridBackground } from '../../components/surfaces/GridBackground';
import { SiteNav } from '../shell/SiteNav';
import { SiteFooter } from '../shell/SiteFooter';
import { armReveals } from '../shell/motion';
import { DESCRIPTOR_SAMPLE, FEED_SAMPLE } from '../data/samples';
import type { HomeFigures } from '../data/homeFigures';
import { Hero } from './home/Hero';
import { DescriptorPanel } from './home/DescriptorPanel';
import { IndexRows } from './home/IndexRows';

export const REVEAL_HOME = '.score, .dside, .index > .label, .go, .site-footer > div';

// The figures the server put in the page, else a fetch: the prerendered copy carries none.
const embedded = (): HomeFigures | null => {
  try {
    const el = document.getElementById('home-data');
    return el ? (JSON.parse(el.textContent ?? '') as HomeFigures) : null;
  } catch {
    return null;
  }
};
const load = async (): Promise<HomeFigures | null> =>
  embedded() ??
  fetch('/api/home')
    .then((r) => (r.ok ? (r.json() as Promise<HomeFigures>) : null))
    .catch(() => null);

const Home: Component = () => {
  const [figures] = createResource(load);
  let root: HTMLDivElement | undefined;

  onMount(() => {
    let dispose = () => {};
    let live = true;
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (live && root) dispose = armReveals(root, REVEAL_HOME);
    });
    onCleanup(() => {
      live = false;
      dispose();
    });
  });

  return (
    <div class="landing" ref={root}>
      <GridBackground gridSize={10} />
      <SiteNav overHero />
      <main id="home">
        <Hero frames={FEED_SAMPLE.frames} figures={figures() ?? null} />
        <DescriptorPanel sample={DESCRIPTOR_SAMPLE} />
        <IndexRows discord={figures()?.discord} />
      </main>
      <SiteFooter />
    </div>
  );
};

export default Home;
