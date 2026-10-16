import { A } from '@solidjs/router';
import { CLAIM } from '../../site';
import { Arrow } from '../../shell/Arrow';
import type { HomeFigures } from '../../data/homeFigures';
import type { FeedFrame } from '../../data/sampleTypes';
import { ReportFeed } from './ReportFeed';
import { Vitals } from './Vitals';

export function Hero(props: { frames: readonly FeedFrame[]; figures: HomeFigures | null }) {
  return (
    <section class="hero frame" aria-labelledby="hero-h">
      <div class="hero-copy">
        <h1 id="hero-h">
          <span class="ln">
            <span>{CLAIM[0]}</span>
          </span>{' '}
          <span class="ln l2">
            <span>{CLAIM[1]}</span>
          </span>
        </h1>
        <div class="actions">
          <A class="btn primary" href="/guide" end activeClass="" inactiveClass="">
            Install Medius <Arrow />
          </A>
          <A class="btn" href="/native" end activeClass="" inactiveClass="">
            Docs <Arrow />
          </A>
        </div>
      </div>
      <ReportFeed frames={props.frames} />
      <Vitals figures={props.figures} />
    </section>
  );
}
