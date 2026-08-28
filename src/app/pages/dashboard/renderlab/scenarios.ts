// An injection pattern. `tick` returns the delta to inject at `elapsed` ms; a deterministic scenario
// returns the same sequence every run, so paced and rendered can be captured back to back and lined
// up. A pointer-driven scenario (mirror) takes its motion from the user instead.
export interface Scenario {
  id: string;
  label: string;
  blurb: string;
  deterministic: boolean;
  pointerDriven: boolean;
  tickMs: number;
  tick: (elapsed: number, mag: number, freq: number) => { dx: number; dy: number };
}

const TAU = Math.PI * 2;
// Deterministic pseudo-random in [-1, 1] from an integer, so "micro" replays identically.
const noise = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'aim',
    label: 'Aim curve',
    blurb: 'A smooth, continuous correction. Deterministic, so paced and rendered line up exactly.',
    deterministic: true,
    pointerDriven: false,
    tickMs: 8,
    tick: (t) => ({ dx: Math.round(5 * Math.cos(TAU * 0.8 * (t / 1000))), dy: Math.round(4 * Math.sin(TAU * 0.6 * (t / 1000))) }),
  },
  {
    id: 'track',
    label: 'Tracking',
    blurb: 'A larger sustained sweep, as if following a moving target.',
    deterministic: true,
    pointerDriven: false,
    tickMs: 8,
    tick: (t) => ({ dx: Math.round(9 * Math.cos(TAU * 0.35 * (t / 1000))), dy: Math.round(7 * Math.sin(TAU * 0.28 * (t / 1000))) }),
  },
  {
    id: 'flick',
    label: 'Flick',
    blurb: 'A discrete correction fired every 600 ms; watch each mode drain the burst.',
    deterministic: true,
    pointerDriven: false,
    tickMs: 8,
    tick: (t) => {
      const phase = t % 600;
      return phase < 96 ? { dx: 14, dy: 6 } : { dx: 0, dy: 0 };
    },
  },
  {
    id: 'micro',
    label: 'Micro-adjust',
    blurb: 'Tiny one-count corrections, the low-amplitude end of aiming.',
    deterministic: true,
    pointerDriven: false,
    tickMs: 16,
    tick: (t) => {
      const n = Math.floor(t / 16);
      return { dx: Math.round(1.5 * noise(n)), dy: Math.round(1.5 * noise(n + 7)) };
    },
  },
  {
    id: 'burst',
    label: 'Human burst',
    blurb: 'Motion for 150 ms then a 250 ms pause, the real hand on/off pattern.',
    deterministic: true,
    pointerDriven: false,
    tickMs: 8,
    tick: (t) => {
      const phase = t % 400;
      if (phase >= 150) return { dx: 0, dy: 0 };
      return { dx: Math.round(6 * Math.cos(TAU * 0.9 * (t / 1000))), dy: Math.round(5 * Math.sin(TAU * 0.7 * (t / 1000))) };
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    blurb: 'Set the magnitude and frequency yourself.',
    deterministic: true,
    pointerDriven: false,
    tickMs: 8,
    tick: (t, mag, freq) => ({ dx: Math.round(mag * Math.cos(TAU * freq * (t / 1000))), dy: Math.round(mag * Math.sin(TAU * freq * 0.75 * (t / 1000))) }),
  },
  {
    id: 'mirror',
    label: 'Mirror your mouse',
    blurb: 'Move your own mouse over the pad; it is mirrored as injection. Live only, never identical between runs.',
    deterministic: false,
    pointerDriven: true,
    tickMs: 8,
    tick: () => ({ dx: 0, dy: 0 }),
  },
];
