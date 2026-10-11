import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as rtlRender, cleanup, fireEvent } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { BearingMode, EmitMode, RenderMode } from '../../src/dashboard/protocol';

const settle = () => new Promise((r) => setTimeout(r, 20));

const mock = vi.hoisted(() => ({
  bearing: { windowMs: 20, mode: 0 } as { windowMs: number; mode: number },
  emit: { mode: 0, fixedHz: 0, resolvedHz: 0 } as { mode: number; fixedHz: number; resolvedHz: number },
  render: { mode: 2, full: false, ready: false } as { mode: number; full: boolean; ready: boolean },
  spread: { percent: 100, spanUs: 8000 } as { percent: number; spanUs: number },
  // Every option write the card made, as [call, args].
  sent: [] as [string, unknown[]][],
  // Every value the card asked the box for.
  asked: new Set<string>(),
}));

vi.mock('../../src/app/pages/dashboard/context', () => {
  const values: Record<string, unknown> = {
    imperfect: { allowed: false, overCapacity: false, cloneImperfect: false },
    moveRide: 0,
    version: { name: 'Medius-1A2B' },
  };
  return {
    useDashboard: () => ({
      status: () => 'connected',
      updateOnly: () => false,
      link: () => ({
        setBearing: async (...args: unknown[]) => {
          mock.sent.push(['bearing', args]);
        },
        setMovementRiding: async (...args: unknown[]) => {
          mock.sent.push(['riding', args]);
        },
        setEmitPace: async (...args: unknown[]) => {
          mock.sent.push(['emit', args]);
        },
        setRender: async () => {},
        setSpread: async () => {},
        setName: async () => {
          throw new Error('The box refused that.');
        },
      }),
      poll: (key: string) => (mock.asked.add(key), () =>
        key === 'bearing' ? mock.bearing
          : key === 'emit' ? mock.emit
          : key === 'render' ? mock.render
          : key === 'spread' ? mock.spread
          : (values[key] ?? null)),
      refreshPoll: () => {},
    }),
  };
});

import DeviceOptions from '../../src/app/pages/dashboard/DeviceOptions';

// The options link to the Guide through the router.
const render = (view: () => JSX.Element) => {
  const history = createMemoryHistory();
  history.set({ value: '/dashboard#options' });
  return rtlRender(() => (
    <MemoryRouter history={history}>
      <Route path="*" component={view} />
    </MemoryRouter>
  ));
};
import { OPTION_PLACES } from '../../src/app/pages/dashboard/optionPlaces';

const button = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

afterEach(() => {
  cleanup();
  mock.bearing = { windowMs: 20, mode: 0 };
  mock.emit = { mode: 0, fixedHz: 0, resolvedHz: 0 };
  mock.render = { mode: 2, full: false, ready: false };
  mock.spread = { percent: 100, spanUs: 8000 };
  mock.sent = [];
});

describe('DeviceOptions', () => {
  it('shows a box on older firmware the options it has, and never asks it for the rest', async () => {
    const panels = (c: HTMLElement) => [...c.querySelectorAll('.pn[id]')].map((p) => p.id);
    mock.asked.clear();
    const five = render(() => <DeviceOptions proto={5} />);
    await settle();
    expect(panels(five.container)).toEqual(['box-name', 'imperfect-clone', 'movement-riding', 'bearing', 'emit-rate']);
    expect([...mock.asked]).not.toContain('render');
    expect([...mock.asked]).not.toContain('spread');
    expect(five.container.querySelector('#imperfect-clone')!.textContent).not.toContain('Advanced tab');
    cleanup();
    for (const proto of [6, 7, 8]) {
      const r = render(() => <DeviceOptions proto={proto} />);
      await settle();
      expect(panels(r.container), String(proto)).toEqual(['box-name', 'imperfect-clone', 'movement-riding', 'bearing', 'render', 'spread', 'emit-rate']);
      expect(r.container.querySelector('#imperfect-clone')!.textContent, String(proto)).not.toContain('Advanced tab');
      cleanup();
    }
    const now = render(() => <DeviceOptions proto={9} />);
    await settle();
    expect(now.container.querySelector('#imperfect-clone')!.textContent).toContain('Advanced tab');
  });

  it("keeps v3.3.0's rendered emit mode unless another is picked", async () => {
    mock.emit = { mode: 3, fixedHz: 0, resolvedHz: 1000 };
    const r = render(() => <DeviceOptions proto={5} />);
    await settle();
    const picked = r.container.querySelector('#emit-rate [role="radio"][aria-checked="true"]');
    expect(picked?.textContent).toBe('Rendered');
    const fixed = [...r.container.querySelectorAll<HTMLElement>('#emit-rate [role="radio"]')].find((b) => b.textContent === 'Fixed')!;
    fireEvent.click(fixed);
    fireEvent.click([...r.container.querySelectorAll<HTMLElement>('#emit-rate [role="radio"]')].find((b) => b.textContent === 'Rendered')!);
    await settle();
    expect(r.container.querySelector('#emit-rate')!.textContent).not.toContain('Unknown');
  });

  it('links each option to its section of the Guide', async () => {
    const { container, findByText } = render(() => <DeviceOptions />);
    await findByText('X and Y are compared with the injected direction separately.');
    for (const id of ['box-name', 'imperfect-clone', 'movement-riding', 'bearing', 'render', 'spread', 'emit-rate']) {
      const link = container.querySelector(`[id="${id}"] > .ph a.fix`);
      expect(link?.getAttribute('href'), id).toBe(`/guide/options#${id}`);
      expect(link?.textContent, id).toBe('Guide');
    }
    for (const id of ['render-full', 'wire-rate']) {
      expect(container.querySelector(`[id="${id}"] a.fix`)?.getAttribute('href'), id).toBe(`/guide/options#${id}`);
    }
  });

  it('has every place a link names, under the title the link names it by', async () => {
    const { container, findByText } = render(() => <DeviceOptions />);
    await findByText('X and Y are compared with the injected direction separately.');
    for (const [id, title] of Object.entries(OPTION_PLACES)) {
      if (id === 'options') continue;
      const el = container.querySelector(`[id="${id}"]`);
      expect(el, id).not.toBeNull();
      const named = el!.querySelector('h2')?.getAttribute('aria-label') ?? el!.querySelector('.field-l')?.textContent?.trim();
      expect(named, id).toBe(title);
    }
  });

  // Each multi-option control used to describe every option at once. Only the selected one is a
  // statement about the box you are looking at.
  it('describes only the selected bearing geometry', async () => {
    const { container, queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('X and Y are compared with the injected direction separately.');
    expect(queryByText(/along the injected vector is weighed/)).toBeNull();

    fireEvent.click(container.querySelector('[role="radio"][data-v="1"]')!);
    await settle();
    await findByText('Only native motion along the injected direction is scaled.');
    expect(queryByText('X and Y are compared with the injected direction separately.')).toBeNull();
  });

  it('describes only the selected emit mode', async () => {
    mock.emit = { mode: EmitMode.Fixed, fixedHz: 500, resolvedHz: 500 };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('The rate you pick.');
    expect(queryByText('The native report rate, measured as the mouse moves.')).toBeNull();
    expect(queryByText('The rate the clone declares.')).toBeNull();
  });

  // Emit rate was the only control that offered Revert, so a pending bearing or riding edit looked
  // like it had already been applied.
  it('offers Revert and marks the chip on every unapplied edit', async () => {
    const { container, findAllByText } = render(() => <DeviceOptions />);
    expect(button(container, 'Revert')).toBeUndefined();

    fireEvent.click(container.querySelector('[role="radio"][data-v="1"]')!);   // bearing geometry
    await settle();
    expect(button(container, 'Revert')).toBeTruthy();
    expect((await findAllByText('Not applied')).length).toBe(1);

    fireEvent.click(button(container, 'Revert')!);
    await settle();
    expect(button(container, 'Revert')).toBeUndefined();
  });

  it('describes only the selected texture, and only the setting in force', async () => {
    mock.render = { mode: RenderMode.Despiked, full: true, ready: true };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('The original smoother, ramped up over 8 ms.');
    expect(queryByText('An even stream at the Emit rate.')).toBeNull();
    await findByText('Native and injected motion are rendered as one stream.');
    expect(queryByText("Native motion is relayed untouched.")).toBeNull();
  });

  // `full` stores and reads back with the texture off, but nothing is rendered in that state: there is
  // no model in the path. Saying "rendered too" there reads as active when it is not.
  it('does not claim the mouse own motion is rendered while the mode is off', async () => {
    mock.render = { mode: RenderMode.Off, full: true, ready: true };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Nothing is rendered while Render is off.');
    await findByText('Native motion relayed');
    expect(queryByText('Native motion rendered')).toBeNull();
  });

  // The option can read back set while the box is still relaying, so the chip has to follow `ready`
  // and not the stored bytes.
  it('does not claim the mouse own motion is rendered before a profile arms', async () => {
    mock.render = { mode: RenderMode.Despiked, full: true, ready: false };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Native motion relayed');
    await findByText('Move the mouse to start');
    expect(queryByText('Native motion rendered')).toBeNull();
  });

  it('describes only the selected spread, and shows the interval in force', async () => {
    mock.spread = { percent: 50, spanUs: 4000 };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('Over half the command interval.');
    expect(queryByText('The whole delta, emitted on the next report.')).toBeNull();
    await findByText('Half · 4.0 ms');
  });

  // The percent reads back set while the box is still releasing a delta whole: it releases nothing
  // across an interval until it has learned the host's command period. Showing an interval there
  // would read as spreading when nothing is. Waiting is the normal state until the host's software sends,
  // so the chip is neutral.
  it('says it is waiting while no command period has been learned', async () => {
    mock.spread = { percent: 100, spanUs: 0 };
    const waiting = render(() => <DeviceOptions />);
    const chip = (await waiting.findByText('Waiting for injection')).closest('.chip')!;
    expect(chip.classList.contains('chip--neutral')).toBe(true);
    cleanup();

    mock.spread = { percent: 100, spanUs: 8002 };
    const learned = render(() => <DeviceOptions />);
    await learned.findByText('Full · 8.0 ms');
    expect(learned.queryByText('Waiting for injection')).toBeNull();
  });

  // Off is not "waiting": there is no interval to wait for.
  it('shows no interval chip at all with spreading off', async () => {
    mock.spread = { percent: 0, spanUs: 0 };
    const { container, queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('The whole delta, emitted on the next report.');
    expect(queryByText('Waiting for injection')).toBeNull();
    // Scoped to this section: the riding and bearing chips carry the same "Name . N ms" shape.
    expect(container.querySelector('#spread')!.textContent).not.toMatch(/ ms/);
  });

  // Nothing is rendered until the box has learned a profile, so a box set to a mode and a box rendering
  // with it are different states and the card has to say which one it is looking at. Neither is a fault,
  // so the chip is neutral.
  it('says the mouse has to move while no profile has armed', async () => {
    mock.render = { mode: RenderMode.Despiked, full: false, ready: false };
    const unarmed = render(() => <DeviceOptions />);
    const chip = (await unarmed.findByText('Move the mouse to start')).closest('.chip')!;
    expect(chip.classList.contains('chip--neutral')).toBe(true);
    cleanup();

    mock.render = { mode: RenderMode.Despiked, full: false, ready: true };
    const armed = render(() => <DeviceOptions />);
    await armed.findByText('The original smoother, ramped up over 8 ms.');
    expect(armed.queryByText('Move the mouse to start')).toBeNull();
  });

  // Off means the renderer is not in the path at all, so there is nothing waiting on a profile.
  it('does not ask for a profile while the renderer is off', async () => {
    mock.render = { mode: RenderMode.Off, full: false, ready: false };
    const { queryByText, findByText } = render(() => <DeviceOptions />);
    await findByText('An even stream at the Emit rate.');
    expect(queryByText('Move the mouse to start')).toBeNull();
  });

  // window = 0 makes with/against inert without clearing them, so the readback still reports scales
  // that no longer weigh anything. It is a wire value, not a control.
});

// A number field by its label, the nth one of that name inside `root`.
const numberField = (root: ParentNode, label: string, nth = 0): HTMLInputElement => {
  const labels = [...root.querySelectorAll('label.number-input__label')].filter((l) => l.textContent?.trim() === label);
  const el = labels[nth]?.parentElement?.querySelector('input');
  if (!el) throw new Error(`no number field labelled ${label}`);
  return el as HTMLInputElement;
};
// Types a fraction and leaves the field, which is when a number field takes what was typed.
const typeFraction = async (el: HTMLInputElement) => {
  fireEvent.input(el, { target: { value: '2.5' } });
  fireEvent.blur(el);
  await settle();
};

describe('DeviceOptions whole-number fields', () => {
  // Emit fixed at 500 Hz with the wire rate forced, so both rate fields are on screen.
  const forced = () => {
    mock.emit = { mode: EmitMode.Fixed, fixedHz: 500, resolvedHz: 500, forceHz: 1000 } as typeof mock.emit;
  };
  // The button beside a field, in the same row of controls.
  const beside = (el: HTMLElement, name: string) =>
    [...(el.closest('.acts')?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent?.trim() === name,
    ) as HTMLElement;

  it.each([
    ['movement riding window', 0, 'Turn on', 'riding', 0],
    ['bearing window', 1, 'Apply', 'bearing', 0],
  ] as const)('keeps the %s to a whole number, and sends what it shows', async (_what, nth, press, call, arg) => {
    const { container } = render(() => <DeviceOptions />);
    const el = numberField(container, 'Window', nth);
    await typeFraction(el);
    expect(el.value).toBe('3');
    fireEvent.click(beside(el, press));
    await settle();
    expect(mock.sent.filter(([c]) => c === call).map(([, a]) => a[arg])).toEqual([3]);
  });

  it.each([
    ['Emit rate', 1, 3],
    ['Wire rate', 2, 4],
  ] as const)('keeps the %s to a whole number, and sends what it shows', async (field, arg, want) => {
    forced();
    const { container } = render(() => <DeviceOptions />);
    const el = numberField(container, field);
    // The wire rate floor is 4 Hz, so 2.5 would clamp to it whole; 4.4 is a fraction above it.
    fireEvent.input(el, { target: { value: want === 4 ? '4.4' : '2.5' } });
    fireEvent.blur(el);
    await settle();
    expect(el.value).toBe(String(want));
    fireEvent.click(beside(el, 'Apply'));
    await settle();
    expect(mock.sent.filter(([c]) => c === 'emit').map(([, a]) => a[arg])).toEqual([want]);
  });
});

describe('DeviceOptions errors', () => {
  it('shows a refused write in the panel whose button sent it, and nowhere else', async () => {
    const { container } = render(() => <DeviceOptions />);
    fireEvent.click(button(container.querySelector('#box-name') as HTMLElement, 'Set')!);
    await settle();
    const alerts = [...container.querySelectorAll('[role="alert"]')];
    expect(alerts.map((a) => a.textContent)).toEqual(['The box refused that.']);
    expect(alerts[0].closest('.pn')!.id).toBe('box-name');
    // The next write elsewhere clears it.
    fireEvent.click(button(container.querySelector('#bearing') as HTMLElement, 'Apply')!);
    await settle();
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });
});
