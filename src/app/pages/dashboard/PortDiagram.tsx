import { BoardFigure, WIRING, type Chip, type Port, type PortSpec } from '../../shell/Board';

export type PortId = 'usb1' | 'usb2' | 'usb3';

const PORT: Record<PortId, Port> = { usb1: 'USB1', usb2: 'USB2', usb3: 'USB3' };
const ORDER: PortId[] = ['usb1', 'usb2', 'usb3'];

export const holdButton = (id: PortId) => `Hold the button next to ${PORT[id]} while plugging it in`;

// Flashing one chip: its cable into this computer while its BOOT button is held, every other cable out.
// A chip powered through another port skips download mode.
export const InstallPorts = (props: { socket: PortId }) => {
  const ports = Object.fromEntries(
    ORDER.map((id): [Port, PortSpec] => [
      PORT[id],
      id === props.socket ? { state: 'in', label: 'This computer', tone: 'pc' } : { state: 'out', label: 'Unplug' },
    ]),
  ) as Record<Port, PortSpec>;
  const chip: Chip = props.socket === 'usb3' ? 'mouse' : 'main';
  return (
    <>
      <p class="cue hold">{holdButton(props.socket)}.</p>
      <BoardFigure ports={ports} hold={PORT[props.socket]} chips={[chip]} motion="loop" />
    </>
  );
};

// Taking a chip's cable out after it was flashed.
export const ClearPort = (props: { socket: PortId }) => (
  <BoardFigure ports={{ [PORT[props.socket]]: { state: 'unp', label: 'Unplug', tone: 'gone' } }} motion="unplug" />
);

// The box wired for use. USB2 must reach this computer to connect; `chips` lights the chips a step acts on.
export const WiringPorts = (props: { chips?: Chip[] }) => <BoardFigure ports={WIRING} chips={props.chips} />;
