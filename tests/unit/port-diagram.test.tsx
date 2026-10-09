import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { ClearPort, InstallPorts, WiringPorts } from '../../src/app/pages/dashboard/PortDiagram';

afterEach(cleanup);

// Which port carries which text, not just that the text exists somewhere: the key under the board names
// each port with where its cable goes, and the socket in the drawing carries the port's state.
const keyFor = (container: HTMLElement, port: string) =>
  [...container.querySelectorAll('.key li')].find((li) => li.querySelector('b')?.textContent === port);
const labelFor = (container: HTMLElement, port: string) => keyFor(container, port)?.querySelector('span')?.textContent ?? '';
const socketState = (container: HTMLElement, port: string) =>
  [...container.querySelectorAll('text.pl')].find((t) => t.textContent === port)?.classList[1];
const cue = (container: HTMLElement) => container.querySelector('.cue')?.textContent ?? '';

describe('InstallPorts', () => {
  it('sends the cable to THIS computer, whatever that socket does afterwards', () => {
    // USB1 ends up on the game PC, but during an install it has to reach the computer doing the
    // installing, so its final role is the wrong thing to print here.
    const { container } = render(() => <InstallPorts socket="usb1" />);
    expect(labelFor(container, 'USB1')).toBe('This computer');
    expect(socketState(container, 'USB1')).toBe('in');
    expect(container.textContent).not.toContain('Game PC');
  });

  it('every other cable has to be out', () => {
    const { container } = render(() => <InstallPorts socket="usb3" />);
    expect(labelFor(container, 'USB3')).toBe('This computer');
    expect(labelFor(container, 'USB1')).toBe('Unplug');
    expect(labelFor(container, 'USB2')).toBe('Unplug');
    expect(socketState(container, 'USB1')).toBe('out');
  });

  it('names the button by its own socket, never left/right or a chip, and holds that button', () => {
    const { container } = render(() => <InstallPorts socket="usb3" />);
    expect(cue(container)).toMatch(/button next to USB3/i);
    expect(cue(container)).not.toMatch(/\bleft\b|\bright\b|main chip|mouse-side chip/i);
    expect(container.textContent).not.toMatch(/button next to USB1/i);
    expect(container.querySelectorAll('.bt.hold')).toHaveLength(1);
    expect(container.querySelector('.ic.on')?.getAttribute('data-chip')).toBe('mouse');
  });
});

describe('ClearPort', () => {
  it('marks the one cable to pull and says nothing about the others', () => {
    const { container } = render(() => <ClearPort socket="usb1" />);
    expect(labelFor(container, 'USB1')).toBe('Unplug');
    expect(keyFor(container, 'USB2')).toBeUndefined();
    expect(keyFor(container, 'USB3')).toBeUndefined();
  });
});

describe('WiringPorts', () => {
  it('puts USB2 on this computer, which is the only one that can connect to it', () => {
    const { container } = render(() => <WiringPorts />);
    expect(labelFor(container, 'USB2')).toBe('This computer');
    expect(labelFor(container, 'USB1')).toBe('Game PC');
    expect(labelFor(container, 'USB3')).toBe('Mouse/keyboard');
  });

  it('carries no install instruction, and lights the chips a step names', () => {
    const { container } = render(() => <WiringPorts chips={['main']} />);
    expect(container.textContent).not.toMatch(/button next|unplug/i);
    expect([...container.querySelectorAll('.ic.on')].map((g) => g.getAttribute('data-chip'))).toEqual(['main']);
  });
});
