import { For, onCleanup, onMount, Show } from 'solid-js';
import { prefersReducedMotion } from './motion';

// The MAKCU box from above, chips up, drawn from measured photos of the board: the two chips with the
// CH343 between, flash chips, headers, crystals, the corner standoffs, the clear plates' edges, the BOOT
// buttons on the short ends and the three sockets on one long edge.

export type Port = 'USB1' | 'USB2' | 'USB3';
export type PortState = 'in' | 'out' | 'unp' | 'idle';
export type Tone = 'pc' | 'dev' | 'gone' | '';
export interface PortSpec {
  state: PortState;
  label: string;
  tone?: Tone;
}
export type Chip = 'main' | 'mouse';

const BX = 70, BY = 24, BW = 560, BH = 310;
const X = (f: number) => BX + f * BW;
const Y = (f: number) => BY + f * BH;
const SOCK: Record<Port, number> = { USB1: X(0.218), USB2: X(0.5), USB3: X(0.773) };
const SW = 0.204 * BW, STOP = Y(0.69), MOUTH = BY + BH + 4;
const r1 = (n: number) => n.toFixed(1);

const soic = (cx: number, cy: number, w: number, h: number, n: number, cls = 'part') => {
  const pitch = (w - 12) / (n - 1);
  let legs = '';
  for (let i = 0; i < n; i++) {
    const x = r1(cx - w / 2 + 6 + i * pitch);
    legs += `M${x} ${r1(cy - h / 2 - 5)}v5M${x} ${r1(cy + h / 2)}v5`;
  }
  return { cls, x: cx - w / 2, y: cy - h / 2, w, h, legs };
};

// The parts that never change, worked out once.
const ACR = (() => {
  const s = 0.093 * BW, top = Y(0.22), bot = Y(0.7), half = (bot - top) / 2, r = (half * half + s * s) / (2 * s);
  return [
    `M${BX} ${r1(top)} A${r1(r)} ${r1(r)} 0 0 1 ${BX} ${r1(bot)}M${BX + BW} ${r1(top)} A${r1(r)} ${r1(r)} 0 0 0 ${BX + BW} ${r1(bot)}`,
    `M${r1(X(0.09))} ${BY + BH} V${r1(Y(0.715))} H${r1(X(0.91))} V${BY + BH}`,
  ];
})();
const STANDS = [[0.042, 0.108], [0.944, 0.108], [0.042, 0.8], [0.944, 0.8]].map(([fx, fy]) => ({ cx: X(fx), cy: Y(fy) }));
const HEADERS = [[0.244, 0.356, 0.069, 0.138], [0.277, 0.39, 0.242, 0.311], [0.757, 0.867, 0.083, 0.152], [0.836, 0.945, 0.26, 0.33]].map(
  ([x0, x1, y0, y1]) => ({
    box: { x: X(x0) - 12, y: Y(y0) - 12, w: X(x1) - X(x0) + 24, h: Y(y1) - Y(y0) + 24 },
    pins: [0, 1, 2, 3].flatMap((c) =>
      [Y(y0), Y(y1)].map((py) => ({ x: X(x0) + (c * (X(x1) - X(x0))) / 3, y: py, square: c === 3 && py === Y(y0) })),
    ),
  }),
);
const FLASH = [soic(X(0.34), Y(0.53), 0.062 * BW, 0.15 * BH, 4), soic(X(0.895), Y(0.53), 0.062 * BW, 0.15 * BH, 4)];
const BRIDGE = soic(X(0.507), Y(0.4), 84, 26, 8, 'ic part');
const XTALS = [[0.167, 0.164], [0.674, 0.148]].map(([fx, fy]) => ({ x: X(fx) - 11, y: Y(fy) - 7 }));
const SMDS = [[0.07, 0.96], [0.93, 0.96], [0.04, 0.61]].map(([fx, fy]) => ({ x: X(fx) - 6, y: Y(fy) - 3 }));
const CS = 0.106 * BW;
const CHIPS: { key: Chip; x: number; name: string }[] = [
  { key: 'main', x: X(0.184), name: 'Main chip' },
  { key: 'mouse', x: X(0.709), name: 'Mouse-side chip' },
];
const BUTTONS: { port: Port; x: number; anchor: 'end' | 'start'; tx: number }[] = [
  { port: 'USB1', x: X(0.024), anchor: 'end', tx: BX - 14 },
  { port: 'USB3', x: X(0.978), anchor: 'start', tx: BX + BW + 14 },
];
const PORTS: Port[] = ['USB1', 'USB2', 'USB3'];

const Soic = (p: ReturnType<typeof soic>) => (
  <g class={p.cls}>
    <rect x={r1(p.x)} y={r1(p.y)} width={r1(p.w)} height={r1(p.h)} />
    <path d={p.legs} />
  </g>
);

// `motion`: 'draw' runs each cable in once as the board comes into view; 'loop' shows the BOOT press
// (hold, plug in under it, let go) while on screen; 'unplug' slides the cable out once.
export function Board(props: {
  ports: Partial<Record<Port, PortSpec>>;
  hold?: Port;
  chips?: Chip[];
  motion?: 'draw' | 'loop' | 'unplug' | 'none';
  label?: string;
}) {
  let svg: SVGSVGElement | undefined;
  onMount(() => {
    const el = svg!;
    const motion = props.motion ?? 'draw';
    if (motion === 'none') return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      if (motion === 'loop') el.classList.add('plugged');
      if (motion === 'unplug') el.classList.add('unplug');
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const after = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const stop = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
    let running = false;
    const cycle = () => {
      if (!running) return;
      after(() => el.classList.add('pressing'), 500);
      after(() => el.classList.add('plugged'), 1200);
      after(() => el.classList.remove('pressing'), 3000);
      after(() => el.classList.add('fading'), 5000);
      after(() => {
        el.classList.add('snap');
        el.classList.remove('plugged', 'fading');
        void el.getBoundingClientRect();
        el.classList.remove('snap');
        cycle();
      }, 5400);
    };
    if (motion === 'draw') el.classList.add('pre');
    const io = new IntersectionObserver(
      ([e]) => {
        if (motion === 'draw' && e.isIntersecting) {
          io.disconnect();
          after(() => el.classList.remove('pre'), 150);
        } else if (motion === 'unplug' && e.isIntersecting) {
          io.disconnect();
          after(() => el.classList.add('unplug'), 700);
        } else if (motion === 'loop') {
          if (e.isIntersecting && !running) {
            running = true;
            cycle();
          } else if (!e.isIntersecting && running) {
            running = false;
            stop();
            el.classList.remove('plugged', 'pressing', 'fading');
          }
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    onCleanup(() => {
      io.disconnect();
      stop();
    });
  });

  const spec = (p: Port): PortSpec => props.ports[p] ?? { state: 'idle', label: '' };

  return (
    <svg
      ref={svg}
      class="boxd"
      classList={{ loop: props.motion === 'loop' }}
      viewBox="-46 12 792 414"
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={props.label ?? 'The MAKCU box, top view'}
    >
      <rect class="pcb" x={BX} y={BY} width={BW} height={BH} rx="6" />
      <path class="acr" d={ACR[0]} />
      <path class="acr" d={ACR[1]} />
      <For each={STANDS}>
        {(s) => (
          <>
            <circle class="stand" cx={r1(s.cx)} cy={r1(s.cy)} r="24" />
            <circle class="screw" cx={r1(s.cx)} cy={r1(s.cy)} r="10" />
            <path class="screw-x" d={`M${r1(s.cx - 4)} ${r1(s.cy)}h8M${r1(s.cx)} ${r1(s.cy - 4)}v8`} />
          </>
        )}
      </For>
      <For each={HEADERS}>
        {(h) => (
          <>
            <rect class="hdr" x={r1(h.box.x)} y={r1(h.box.y)} width={r1(h.box.w)} height={r1(h.box.h)} />
            <For each={h.pins}>
              {(p) =>
                p.square ? (
                  <rect class="pin" x={r1(p.x - 5)} y={r1(p.y - 5)} width="10" height="10" />
                ) : (
                  <circle class="pin" cx={r1(p.x)} cy={r1(p.y)} r="5" />
                )
              }
            </For>
          </>
        )}
      </For>
      <For each={FLASH}>{(f) => <Soic {...f} />}</For>
      <For each={XTALS}>{(x) => <rect class="xtal" x={r1(x.x)} y={r1(x.y)} width="22" height="14" rx="2" />}</For>
      <For each={SMDS}>{(s) => <rect class="smd" x={r1(s.x)} y={r1(s.y)} width="12" height="6" />}</For>
      <For each={CHIPS}>
        {(c) => (
          <g class="ic" classList={{ on: !!props.chips?.includes(c.key) }} data-chip={c.key}>
            <rect x={r1(c.x - CS / 2)} y={r1(Y(0.385) - CS / 2)} width={r1(CS)} height={r1(CS)} />
            <text x={r1(c.x)} y={r1(Y(0.385) + CS / 2 + 17)} text-anchor="middle">
              {c.name}
            </text>
          </g>
        )}
      </For>
      <Soic {...BRIDGE} />
      <For each={BUTTONS}>
        {(b) => (
          <g class="bt" classList={{ hold: props.hold === b.port }}>
            <rect class="btnb" x={r1(b.x - 8)} y={r1(Y(0.463) - 11)} width="16" height="22" rx="2" />
            <circle class="btnc" cx={r1(b.x)} cy={r1(Y(0.463))} r="5" />
            <text class="btnl" x={b.tx} y={r1(Y(0.463) + 4)} text-anchor={b.anchor}>
              BOOT
            </text>
            <rect class="ring" x={r1(b.x - 14)} y={r1(Y(0.463) - 17)} width="28" height="34" rx="3" />
          </g>
        )}
      </For>
      <For each={PORTS}>
        {(port) => {
          const cx = SOCK[port];
          const s = () => spec(port);
          return (
            <>
              <g class={`sock ${s().state}`}>
                <rect x={r1(cx - SW / 2)} y={r1(STOP)} width={r1(SW)} height={r1(MOUTH - STOP)} />
                <path d={`M${r1(cx - 30)} ${r1(STOP + 26)}v34h14v-34M${r1(cx + 16)} ${r1(STOP + 26)}v34h14v-34`} />
              </g>
              <text class={`pl ${s().state}`} x={r1(cx)} y={r1(STOP - 10)} text-anchor="middle">
                {port}
              </text>
              <Show when={s().state === 'in' || s().state === 'unp'}>
                <g class={`cable ${s().tone ?? ''}`} data-cable="">
                  <path class="cab" d={`M${r1(cx)} ${MOUTH + 62} V${MOUTH + 14}`} />
                  <rect class="plug" x={r1(cx - 22)} y={MOUTH} width="44" height="14" rx="1" />
                </g>
                <text class={`to ${s().tone ?? ''}`} x={r1(cx)} y={MOUTH + 84} text-anchor="middle">
                  {s().label}
                </text>
              </Show>
              <Show when={s().state === 'out'}>
                <path class="x" d={`M${r1(cx - 9)} ${MOUTH + 24}l18 18m0 -18l-18 18`} />
                <text class="to out" x={r1(cx)} y={MOUTH + 84} text-anchor="middle">
                  {s().label}
                </text>
              </Show>
            </>
          );
        }}
      </For>
    </svg>
  );
}

// The board with its caption, and on a narrow screen a list of where each cable goes under it.
export function BoardFigure(props: Parameters<typeof Board>[0]) {
  const items = () => PORTS.map((p) => ({ port: p, spec: props.ports[p] })).filter((x) => x.spec?.label);
  return (
    <figure class="board">
      <figcaption class="caps">Top view, chips up</figcaption>
      <Board {...props} />
      <ul class="key">
        <For each={items()}>
          {(it) => (
            <li class={`${it.spec!.state} ${it.spec!.tone ?? ''}`}>
              <b>{it.port}</b>
              <span>{it.spec!.label}</span>
            </li>
          )}
        </For>
      </ul>
    </figure>
  );
}

// The box wired for use: the game PC on USB1, this computer on USB2, the mouse or keyboard on USB3.
export const WIRING: Record<Port, PortSpec> = {
  USB1: { state: 'in', label: 'Game PC', tone: 'pc' },
  USB2: { state: 'in', label: 'This computer', tone: 'pc' },
  USB3: { state: 'in', label: 'Mouse/keyboard', tone: 'dev' },
};
