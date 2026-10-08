import { figureText, type HomeFigures } from '../../data/homeFigures';

const cell = (figures: HomeFigures | null, key: keyof HomeFigures) => {
  const v = figures?.[key];
  return v === undefined ? '' : figureText(key, v);
};

// The strip under the hero. The server fills the live cells in the raw HTML; one whose source is down
// stays empty.
export function Vitals(props: { figures: HomeFigures | null }) {
  return (
    <dl class="vitals caps">
      <div>
        <dt>Firmware</dt>
        <dd data-fill="vital-firmware">{cell(props.figures, 'firmware')}</dd>
      </div>
      <div>
        <dt>Hardware</dt>
        <dd>MAKCU, 2× ESP32-S3</dd>
      </div>
      <div>
        <dt>Devices cloned</dt>
        <dd data-fill="vital-devices">{cell(props.figures, 'devices')}</dd>
      </div>
      <div>
        <dt>Boxes on Medius</dt>
        <dd data-fill="vital-boxes" classList={{ live: props.figures?.boxes !== undefined }}>
          {cell(props.figures, 'boxes')}
        </dd>
      </div>
    </dl>
  );
}
