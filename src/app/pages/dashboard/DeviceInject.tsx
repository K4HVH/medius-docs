// Tracks every hold to release it on unmount: a hold whose pointerup never arrives (tab switch, drag
// off the button, navigation) otherwise stays down on the game PC.

import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Checkbox } from '../../../components/inputs/Checkbox';
import { NumberInput } from '../../../components/inputs/NumberInput';
import {
  type Usage,
  Action,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  KEYS,
  MEDIA,
  buttonsUpTo,
  usageName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { UsageChips, UsagePicker, type PickerClass } from './UsagePicker';
import { Section } from './Section';
import { checkColumn, chips, label, muted, row, section } from './ui';

// A usage being overridden, and which way.
interface Hold extends Usage {
  action: Action.Press | Action.ForceRelease;
}

const key = (u: Usage) => `${u.cls}:${u.id}`;

const pad = {
  height: '7rem',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'text-align': 'center',
  border: '1px dashed var(--g-border-color)',
  'border-radius': 'var(--g-radius)',
  'touch-action': 'none',
  cursor: 'crosshair',
  'user-select': 'none',
} as const;

const DeviceInject = () => {
  const dash = useDashboard();
  const health = () => dash.health();
  // Both flags: a configured clone can carry no mouse collection, and the box then drops motion and
  // button commands with no reply.
  const mouseReady = () => health()?.cloneConfigured === true && health()?.mouseAttached === true;
  const kbdReady = () => health()?.kbdAttached === true;

  // Every declared button (RESP(CAPS) n_buttons): injecting one the mouse declares but never wires
  // is descriptor-faithful.
  const caps = dash.poll('caps');
  const buttons = () => buttonsUpTo(caps()?.mouse?.nButtons ?? 0);
  const classes = (): PickerClass[] => [
    { value: INJ_BTN, label: 'Button', table: buttons() },
    { value: INJ_KEY, label: 'Key', table: KEYS },
    { value: INJ_MEDIA, label: 'Media', table: MEDIA },
  ];

  const [step, setStep] = createSignal(20);
  const [detents, setDetents] = createSignal(1);
  const [pans, setPans] = createSignal(1);
  // With riding on, a move waits for physical motion to carry it. Bypass sends it on the box's next
  // mouse report, unspread and unrendered.
  const [bypass, setBypass] = createSignal(false);
  const [pick, setPick] = createSignal<Usage>({ cls: INJ_BTN, id: 0 });
  const [holds, setHolds] = createSignal<Hold[]>([]);
  const [dragging, setDragging] = createSignal(false);
  const [moved, setMoved] = createSignal({ dx: 0, dy: 0 });
  const [err, setErr] = createSignal<string | null>(null);
  const [dropped, setDropped] = createSignal(false);

  const link = () => dash.link();

  const send = async (cls: number, id: number, action: Action): Promise<boolean> => {
    try {
      await link()?.inject(cls, id, action);
      setErr(null);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const drop = (u: Usage) => setHolds((prev) => prev.filter((h) => key(h) !== key(u)));

  // Recorded before the send resolves and undone on failure, so a click faster than the round trip
  // still finds its hold at pointerup.
  const hold = (u: Usage, action: Action.Press | Action.ForceRelease) => {
    setHolds((prev) => [...prev.filter((h) => key(h) !== key(u)), { ...u, action }]);
    void send(u.cls, u.id, action).then((ok) => {
      if (!ok) drop(u);
    });
  };

  const release = (u: Usage) => {
    drop(u);
    void send(u.cls, u.id, Action.SoftRelease);
  };

  // Soft-release per usage: a RESET would also drop every lock, the catch subscription and the clip.
  const releaseAll = () => {
    const held = holds();
    setHolds([]);
    for (const h of held) void send(h.cls, h.id, Action.SoftRelease);
  };

  onCleanup(() => {
    const l = link();
    for (const h of holds()) void l?.inject(h.cls, h.id, Action.SoftRelease)?.catch(() => {});
  });

  // The box drops every injected usage after 1 s of control-link silence. Only true to false counts:
  // the polled flag reads false for up to one interval after a press.
  let sawActive = false;
  createEffect(() => {
    const active = health()?.injectionActive;
    if (active === true) {
      sawActive = true;
      return;
    }
    if (active === false && sawActive) {
      sawActive = false;
      if (holds().length > 0) {
        setHolds([]);
        setDropped(true);
      }
    }
  });

  const holdWhilePressed = (u: Usage) => ({
    onPointerDown: () => void hold(u, Action.Press),
    onPointerUp: () => {
      if (holds().some((h) => key(h) === key(u))) release(u);
    },
    onPointerLeave: () => {
      if (holds().some((h) => key(h) === key(u))) release(u);
    },
  });

  // Latched at pointerdown, so the picker changing under a held pointer releases the pressed usage.
  let picked: Usage | null = null;
  const holdPicked = {
    onPointerDown: () => {
      picked = pick();
      hold(picked, Action.Press);
    },
    onPointerUp: () => {
      if (picked) release(picked);
      picked = null;
    },
    onPointerLeave: () => {
      if (picked) release(picked);
      picked = null;
    },
  };

  let last: { x: number; y: number } | null = null;

  const onPadDown = (e: PointerEvent & { currentTarget: HTMLDivElement }) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY };
    setDragging(true);
    setMoved({ dx: 0, dy: 0 });
  };

  // One delta per delivered move: the box accumulates and paces, so splitting coalesced points only
  // adds frames.
  const onPadMove = (e: PointerEvent) => {
    if (!last) return;
    // No button down: capture was lost without a pointerup, so stop before a passing cursor injects.
    if (e.buttons === 0) {
      endDrag();
      return;
    }
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    if (dx === 0 && dy === 0) return;
    setMoved((m) => ({ dx: m.dx + dx, dy: m.dy + dy }));
    void moveCursor(dx, dy);
  };

  const endDrag = () => {
    last = null;
    setDragging(false);
  };

  const fail = (x: unknown) => setErr(x instanceof Error ? x.message : String(x));

  const moveCursor = (dx: number, dy: number) =>
    (bypass() ? link()?.moveRelNow(dx, dy) : link()?.moveRel(dx, dy))?.catch(fail);

  const scroll = (dz: number) => (bypass() ? link()?.wheelNow(dz) : link()?.wheel(dz))?.catch(fail);

  const panScroll = (dpan: number) =>
    (bypass() ? link()?.panNow(dpan) : link()?.pan(dpan))?.catch(fail);

  const onPadUp = (e: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    endDrag();
  };

  const heldItems = createMemo(() =>
    holds().map((h) => ({
      key: key(h),
      text: `${usageName(h.cls, h.id)}${h.action === Action.ForceRelease ? ' (masked)' : ''}`,
    })),
  );

  const pickName = () => usageName(pick().cls, pick().id);

  return (
    <Show when={dash.status() === 'connected'}>
      <div id="injection" data-search-target>
        <Card>
          <CardHeader title="Injection" subtitle="Drive the clone's inputs" />

          <Section title="Cursor" first>
            <Show when={mouseReady()} fallback={<p style={muted}>No mouse cloned.</p>}>
            <div
              style={pad}
              onPointerDown={onPadDown}
              onPointerMove={onPadMove}
              onPointerUp={onPadUp}
              onPointerCancel={onPadUp}
              onLostPointerCapture={endDrag}
              role="application"
              aria-label="Cursor drag pad. The buttons below move by a fixed step."
            >
              <span style={muted}>
                <Show when={dragging()} fallback="Drag to move the cursor">
                  {moved().dx}, {moved().dy}
                </Show>
              </span>
            </div>
            <div style={{ ...section, ...row, 'align-items': 'flex-end' }}>
              <div style={{ 'max-width': '7rem' }}>
                <NumberInput
                  label="Step"
                  value={step()}
                  min={1}
                  max={32767}
                  precision={0}
                  onChange={(v) => setStep(v ?? 1)}
                />
              </div>
              <Button variant="secondary" onClick={() => void moveCursor(-step(), 0)}>
                Move left
              </Button>
              <Button variant="secondary" onClick={() => void moveCursor(step(), 0)}>
                Move right
              </Button>
              <Button variant="secondary" onClick={() => void moveCursor(0, -step())}>
                Move up
              </Button>
              <Button variant="secondary" onClick={() => void moveCursor(0, step())}>
                Move down
              </Button>
            </div>

            <div style={{ ...section, ...checkColumn }}>
              <Checkbox
                label="Bypass movement riding"
                checked={bypass()}
                onChange={setBypass}
              />
            </div>
            <div style={{ ...section, ...row }}>
              <Button variant="secondary" onClick={() => void link()?.flushMotion()?.catch(fail)}>
                Send held motion
              </Button>
              <Button variant="secondary" onClick={() => void link()?.discardMotion()?.catch(fail)}>
                Drop held motion
              </Button>
            </div>
            <p style={muted}>
              Bypass covers cursor, wheel and pan.
            </p>

            </Show>
          </Section>

          <Show when={mouseReady()}>
            <Section title="Wheel">
              <div style={{ ...row, 'align-items': 'flex-end' }}>
              <div style={{ 'max-width': '7rem' }}>
                <NumberInput
                  label="Detents"
                  value={detents()}
                  min={1}
                  max={32767}
                  precision={0}
                  onChange={(v) => setDetents(v ?? 1)}
                />
              </div>
              <Button variant="secondary" onClick={() => void scroll(detents())}>
                Scroll up
              </Button>
              <Button variant="secondary" onClick={() => void scroll(-detents())}>
                Scroll down
              </Button>
            </div>

            </Section>

            <Section title="Pan">
              <div style={{ ...row, 'align-items': 'flex-end' }}>
              <div style={{ 'max-width': '7rem' }}>
                <NumberInput
                  label="Detents"
                  value={pans()}
                  min={1}
                  max={32767}
                  precision={0}
                  onChange={(v) => setPans(v ?? 1)}
                />
              </div>
              <Button variant="secondary" onClick={() => void panScroll(-pans())}>
                Pan left
              </Button>
              <Button variant="secondary" onClick={() => void panScroll(pans())}>
                Pan right
              </Button>
            </div>

            </Section>

            <Section title="Buttons">
              <div style={chips}>
                <For each={buttons()}>
                  {(b) => (
                    <Button variant="secondary" {...holdWhilePressed({ cls: INJ_BTN, id: b.id })}>
                      {b.name}
                    </Button>
                  )}
                </For>
              </div>
            </Section>
          </Show>

          <Section title="Any input">
          <Show
            when={kbdReady() || mouseReady()}
            fallback={<p style={muted}>Nothing cloned to inject into.</p>}
          >
            <Show when={!kbdReady()}>
              <p style={muted}>No keyboard attached: the box discards key and media holds.</p>
            </Show>
            <UsagePicker
              name="inject-usage"
              classes={classes()}
              value={pick()}
              onChange={setPick}
            />
            <div style={{ ...section, ...row }}>
              <Button variant="secondary" {...holdPicked}>
                Hold {pickName()}
              </Button>
              <Button variant="primary" onClick={() => hold(pick(), Action.Press)}>
                Press
              </Button>
              <Button variant="secondary" onClick={() => hold(pick(), Action.ForceRelease)}>
                Mask
              </Button>
              <Button variant="secondary" onClick={() => release(pick())}>
                Release
              </Button>
            </div>
            <p style={muted}>
              Mask forces the input up, even while physically held. Release clears either override.
            </p>
          </Show>
          </Section>

          <Show when={dropped()}>
            <div class="callout callout--warning" style={section}>
              The box cleared every injected hold after 1 s with no control frame, which a backgrounded
              tab can cause.
            </div>
          </Show>
          <Show when={err()}>
            <div class="callout callout--danger" role="alert" style={section}>
              {err()}
            </div>
          </Show>

          <Section title="Held">
          <Show when={holds().length > 0} fallback={<p>Nothing held.</p>}>
            <UsageChips
              items={heldItems()}
              variant="warning"
              onRemove={(k) => {
                const h = holds().find((x) => key(x) === k);
                if (h) release(h);
              }}
            />
            <div style={{ ...section, ...row }}>
              <Button variant="secondary" onClick={releaseAll}>
                Release all
              </Button>
            </div>
          </Show>
          </Section>
        </Card>
      </div>
    </Show>
  );
};

export default DeviceInject;
