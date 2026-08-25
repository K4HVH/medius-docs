import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { PortDiagram } from '../../src/app/pages/dashboard/PortDiagram';

afterEach(cleanup);

describe('PortDiagram', () => {
  it('marks the cable that has to come out', () => {
    const { getByText, container } = render(() => <PortDiagram plug={['usb3']} out={['usb1']} />);
    expect(getByText('must be empty')).toBeTruthy();
    expect(container.textContent).toContain('USB1');
  });

  it('names the button by the socket beside it, never left/right or a chip', () => {
    const { container } = render(() => <PortDiagram plug={['usb1']} boot="usb1" />);
    expect(container.textContent).toMatch(/button next to USB1/i);
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
    expect(getAllByText('nothing here')).toHaveLength(2);
  });
});
