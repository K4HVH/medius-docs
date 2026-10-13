import type { Component } from 'solid-js';
import { ComparisonPage } from './parts';

// A move as each box's control port reads it.
const FRAMES = `  Stock, text:
  km.move(1,0) and a line end
  Stock, binary:
  [DE AD][LEN][CMD][PAYLOAD]
  Medius:
  [A5][TYPE][SEQ][LEN][PAYLOAD][CRC16]

  Stock reads text up to the line end,
  and binary with no checksum. Medius
  drops a frame whose checksum fails
  and reads on from the next A5.`;

const ControlLink: Component = () => (
  <ComparisonPage
    path="/comparison/control-link"
    lead={<p>The control port between a program and the box: how many commands each box takes, what too many or broken ones do, and how soon a query is answered.</p>}
    before={{ 'malformed-input': <pre class="diagram">{FRAMES}</pre> }}
  />
);

export default ControlLink;
