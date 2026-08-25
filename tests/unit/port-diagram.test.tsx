import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { PortDiagram } from '../../src/app/pages/dashboard/PortDiagram';

afterEach(cleanup);

describe('PortDiagram', () => {
  it('marks the cable that has to come out', () => {
    const { getByText, container } = render(() => <PortDiagram plug={['usb3']} out={['usb1']} />);
    expect(getByText('unplug')).toBeTruthy();
    expect(container.textContent).toContain('USB1');
  });

  it('asks for both buttons, never one of them', () => {
    const { container } = render(() => <PortDiagram plug={['usb1']} boot />);
    expect(container.textContent).toContain('BOTH');
    expect(container.textContent).not.toMatch(/\bleft\b|\bright\b|main chip|mouse-side chip/i);
  });

  it('renames a port for the machine it ends up on', () => {
    const { getByText, queryByText } = render(() => (
      <PortDiagram plug={['usb1', 'usb2']} where={{ usb2: 'Other computer' }} />
    ));
    expect(getByText('Other computer')).toBeTruthy();
    expect(queryByText('Control PC')).toBeNull();
  });

  it('a port in no list at all is dimmed and left out', () => {
    const { getAllByText } = render(() => <PortDiagram plug={['usb1']} />);
    expect(getAllByText('leave out')).toHaveLength(2);
  });
});
