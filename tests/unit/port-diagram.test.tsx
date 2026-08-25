import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { ClearPort, InstallPorts, WiringPorts } from '../../src/app/pages/dashboard/PortDiagram';

afterEach(cleanup);

// Which port carries which text, not just that the text exists somewhere: all three labels always
// render, so matching the whole container passed however the ports were marked.
const tileFor = (container: HTMLElement, label: string) => {
  const tile = [...container.querySelectorAll('div')].find(
    (d) => d.querySelector(':scope > div')?.textContent === label,
  );
  return tile?.textContent ?? '';
};

describe('InstallPorts', () => {
  it('sends the cable to THIS device, whatever that socket does afterwards', () => {
    // USB1 ends up on the game PC, but during an install it has to reach the machine doing the
    // installing, so its final role is the wrong thing to print here.
    const { container } = render(() => <InstallPorts socket="usb1" />);
    expect(tileFor(container, 'USB1')).toContain('This device');
    expect(tileFor(container, 'USB1')).toContain('plug in');
    expect(tileFor(container, 'USB1')).not.toContain('Game PC');
  });

  it('every other cable has to be out', () => {
    const { container } = render(() => <InstallPorts socket="usb3" />);
    expect(tileFor(container, 'USB3')).toContain('This device');
    expect(tileFor(container, 'USB1')).toContain('unplug');
    expect(tileFor(container, 'USB2')).toContain('unplug');
  });

  it('names the button by its own socket, never left/right or a chip', () => {
    const { container } = render(() => <InstallPorts socket="usb3" />);
    expect(container.textContent).toMatch(/button next to USB3/i);
    expect(container.textContent).not.toMatch(/button next to USB1/i);
    expect(container.textContent).not.toMatch(/\bleft\b|\bright\b|main chip|mouse-side chip/i);
  });
});

describe('ClearPort', () => {
  it('marks the one cable to pull and says nothing about the others', () => {
    const { container } = render(() => <ClearPort socket="usb1" />);
    expect(tileFor(container, 'USB1')).toContain('unplug');
    expect(tileFor(container, 'USB2')).not.toContain('unplug');
    expect(tileFor(container, 'USB3')).not.toContain('unplug');
  });
});

describe('WiringPorts', () => {
  it('puts USB2 on this device, which is the only machine that can connect to it', () => {
    const { container } = render(() => <WiringPorts />);
    expect(tileFor(container, 'USB2')).toContain('This device');
    expect(tileFor(container, 'USB1')).toContain('Game PC');
    expect(tileFor(container, 'USB3')).toContain('Mouse/keyboard');
  });

  it('carries no install instruction', () => {
    const { container } = render(() => <WiringPorts />);
    expect(container.textContent).not.toMatch(/button|unplug/i);
  });
});
