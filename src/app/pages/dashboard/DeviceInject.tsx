// Drive the clone: move the cursor, turn the wheel, and hold any button, key, or media usage.
//
// The card tracks what it has pressed so it can release exactly that on unmount. Without it, a hold
// whose pointerup never arrived (tab switch, drag off the button, navigating away mid-press) stayed
// down on the game PC with nothing able to clear it.

import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import { Button } from '../../../components/inputs/Button';
import { Checkbox } from '../../../components/inputs/Checkbox';
import { NumberInput } from '../../../components/inputs/NumberInput';
import {
  type Usage,
  Action,
  BUTTONS,
  INJ_BTN,
  INJ_KEY,
  INJ_MEDIA,
  KEYS,
  MEDIA,
  usageName,
} from '../../../dashboard/protocol';
import { useDashboard } from './context';
import { UsageChips, UsagePicker, type PickerClass } from './UsagePicker';
import { Section } from './Section';
import { checkColumn, chips, label, muted, row, section } from './ui';

const CLASSES: PickerClass[] = [
  { value: INJ_BTN, label: 'Button', table: BUTTONS },
  { value: INJ_KEY, label: 'Key', table: KEYS },
  { value: INJ_MEDIA, label: 'Media', table: MEDIA },
];

// A usage the dashboard is currently overriding, and which way.
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
  // Both flags, because they mean different things: the clone can be configured by the game PC
  // while carrying no mouse collection at all, and every motion and button command is then dropped
  // by the box in silence.
  const mouseReady = () => health()?.cloneConfigured === true && health()?.mouseAttached === true;
  const kbdReady = () => health()?.kbdAttached === true;

  const [step, setStep] = createSignal(20);
  const [detents, setDetents] = createSignal(1);
  // With movement riding on, an ordinary move waits for a real cursor report to carry it, so nothing
  // this card sends reaches the game PC while the real mouse sits still. Bypassing sends it on the
  // box's own clock instead. With riding off it changes nothing.
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

  // Recorded before the send resolves, and taken back if it fails. Waiting for the round trip
  // instead would lose the release of a click faster than one: pointerup would find nothing held
  // and send nothing, leaving the button down on the game PC.
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

  // One soft-release per usage rather than a RESET, which would also drop every lock, the whole
  // catch subscription, and a loaded clip.
  const releaseAll = () => {
    const held = holds();
    setHolds([]);
    for (const h of held) void send(h.cls, h.id, Action.SoftRelease);
  };

  onCleanup(() => {
    const l = link();
    for (const h of holds()) void l?.inject(h.cls, h.id, Action.SoftRelease)?.catch(() => {});
  });

  // The box drops every injected usage after a second of control-link silence, which a backgrounded
  // tab can cause on its own. Without this the chips keep claiming holds the box let go of.
  //
  // Only a true to false transition counts. The flag is read from a poll, so it is legitimately
  // false for up to one interval after a press lands, and treating that as a drop would clear the
  // hold the user just made.
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

  // Hold while the pointer is down, releasing exactly what went down. Capturing the usage at
  // pointerdown matters for the picker's button: its usage is reactive, so releasing whatever is
  // picked at pointerup would leave the pressed one held and release an unrelated one.
  const holdWhilePressed = (u: Usage) => ({
    onPointerDown: () => void hold(u, Action.Press),
    onPointerUp: () => {
      if (holds().some((h) => key(h) === key(u))) release(u);
    },
    onPointerLeave: () => {
      if (holds().some((h) => key(h) === key(u))) release(u);
    },
  });

  // The picker's hold button needs its own latch: this object is built once, so the usage captured
  // at pointerdown survives the picker changing under a held pointer.
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

  // One delta per delivered move. The browser coalesces pointermove to the frame rate, and the box
  // accumulates and paces what it is sent, so splitting a frame back into its coalesced points
  // would send the same total distance in more frames.
  const onPadMove = (e: PointerEvent) => {
    if (!last) return;
    // A move with no button down means capture was lost without a pointerup, which would otherwise
    // leave the pad injecting from a passing cursor.
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
      <Card>
        <CardHeader title="Injection" subtitle="Drive the clone's inputs from here" />

        <Section title="Cursor" first>
          <Show when={mouseReady()} fallback={<p style={muted}>No mouse is cloned.</p>}>
          <div
            style={pad}
            onPointerDown={onPadDown}
            onPointerMove={onPadMove}
            onPointerUp={onPadUp}
            onPointerCancel={onPadUp}
            onLostPointerCapture={endDrag}
            role="application"
            aria-label="Cursor drag pad. The buttons below move the cursor by a fixed step instead."
          >
            <span style={muted}>
              <Show when={dragging()} fallback="Drag here to move the cursor">
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
            Bypass applies to the cursor and the wheel; the buttons send or drop motion already waiting.
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

          <Section title="Buttons">
            <div style={chips}>
              <For each={BUTTONS}>
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
          fallback={<p style={muted}>Nothing is cloned to inject into.</p>}
        >
          <Show when={!kbdReady()}>
            <p style={muted}>No keyboard is attached, so the box discards key and media holds.</p>
          </Show>
          <UsagePicker
            name="inject-usage"
            classes={CLASSES}
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
            Mask forces the input up, overriding a physical hold; Release clears either
            override.
          </p>
        </Show>
        </Section>

        <Show when={dropped()}>
          <div class="callout callout--warning" style={section}>
            The box cleared every injected hold. It does that after one second with no control frame,
            which a backgrounded tab can cause.
          </div>
        </Show>
        <Show when={err()}>
          <div class="callout callout--danger" role="alert" style={section}>
            {err()}
          </div>
        </Show>

        <Section title="Held now">
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
    </Show>
  );
};

export default DeviceInject;
