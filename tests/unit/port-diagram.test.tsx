import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { PortDiagram } from '../../src/app/pages/dashboard/PortDiagram';

afterEach(cleanup);

describe('PortDiagram', () => {
  // Which port carries which note, not just that the note exists somewhere: all three labels always
  // render, so asserting the container contains "USB1" passed however the ports were marked.
  const noteFor = (container: HTMLElement, label: string) => {
    const tile = [...container.querySelectorAll('div')].find((d) => {
      const strong = d.querySelector(':scope > div');
      return strong?.textContent === label;
    });
    return tile?.textContent ?? '';
  };

  it('marks the cable that has to come out, and only that one', () => {
    const { container } = render(() => <PortDiagram plug={['usb3']} out={['usb1']} />);
    expect(noteFor(container, 'USB1')).toContain('must be empty');
    expect(noteFor(container, 'USB3')).toContain('plug in');
    expect(noteFor(container, 'USB2')).toContain('nothing here');
  });

  it('marks a port that belongs on another machine without telling anyone to plug it in here', () => {
    const { container } = render(() => <PortDiagram plug={['usb2']} other={['usb1']} />);
    expect(noteFor(container, 'USB1')).toContain('not this computer');
    expect(noteFor(container, 'USB2')).toContain('plug in');
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
