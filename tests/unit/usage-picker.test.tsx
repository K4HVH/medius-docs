import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { UsagePicker, type PickerClass, type UsageValue } from '../../src/app/pages/dashboard/UsagePicker';

afterEach(cleanup);

const AXES: PickerClass = {
  value: 3,
  label: 'Axis',
  blanket: 0xff,
  blanketLabel: 'Every axis',
  table: [
    { id: 0, name: 'X (left/right)' },
    { id: 1, name: 'Y (up/down)' },
    { id: 2, name: 'Wheel' },
  ],
} as PickerClass;

describe('UsagePicker', () => {
  it('picks the first match on Enter, never the wildcard or the current input when neither matches', async () => {
    const [value, setValue] = createSignal<UsageValue>({ cls: 3, id: 0 });
    const { container } = render(() => <UsagePicker name="t" classes={[AXES]} value={value()} onChange={setValue} />);
    fireEvent.click(container.querySelector('.dd-b')!);
    await new Promise((r) => setTimeout(r, 0));
    const input = container.querySelector<HTMLInputElement>('.dd-f')!;
    fireEvent.input(input, { target: { value: 'wheel' } });
    await new Promise((r) => setTimeout(r, 0));
    expect([...container.querySelectorAll('[role="option"]')][0].textContent).toContain('Wheel');
    fireEvent.keyDown(container.querySelector('.dd-l')!, { key: 'Enter' });
    expect(value()).toEqual({ cls: 3, id: 2 });
  });

  it('offers the wildcard while the filter matches it', async () => {
    const [value, setValue] = createSignal<UsageValue>({ cls: 3, id: 0 });
    const { container } = render(() => <UsagePicker name="t" classes={[AXES]} value={value()} onChange={setValue} />);
    fireEvent.click(container.querySelector('.dd-b')!);
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.input(container.querySelector('.dd-f')!, { target: { value: 'every' } });
    await new Promise((r) => setTimeout(r, 0));
    expect([...container.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toContain('Every axis');
  });
});
