import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../../components/surfaces/Card';
import '../../../../styles/docs.css';

const Usage: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="Usage IDs" subtitle="The id numbers inject and lock take" />
        <p>
          <A href="/native/commands/inject#inject"><code>INJECT</code></A> and{' '}
          <A href="/native/commands/lock#lock"><code>LOCK</code></A> both name an input by an{' '}
          <code>id</code>, and the numbers depend on the class: a{' '}
          <A href="/native/commands/usage#buttons">button id</A> for the mouse, a{' '}
          <A href="/native/commands/usage#keycodes">HID keyboard usage</A> for a key, or a 16-bit{' '}
          <A href="/native/commands/usage#consumer">Consumer usage</A> for a media key. They're
          gathered here so the command pages stay short.
        </p>
      </Card>

      <div id="buttons" data-search-target>
        <Card>
          <CardHeader title="Button ids" subtitle="Mouse buttons (class = button)" />
          <p>
            A small semantic id, bound at clone time to the real mouse's buttons. A command for an id
            the mouse lacks is a no-op, so read{' '}
            <A href="/native/commands/requests#mouse-caps"><code>MOUSE_CAPS</code></A>{' '}
            <code>n_buttons</code> first. For a{' '}
            <A href="/native/commands/lock#lock"><code>LOCK</code></A> the button id maps to the lock
            target <code>3 + id</code>.
          </p>
          <table class="api-params">
            <thead><tr><th>Button</th><th>id</th></tr></thead>
            <tbody>
              <tr><td>Left</td><td><code>0</code></td></tr>
              <tr><td>Right</td><td><code>1</code></td></tr>
              <tr><td>Middle</td><td><code>2</code></td></tr>
              <tr><td>Side1 (first thumb)</td><td><code>3</code></td></tr>
              <tr><td>Side2 (second thumb)</td><td><code>4</code></td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div id="keycodes" data-search-target>
        <Card>
          <CardHeader title="HID keyboard usages" subtitle="Keys and modifiers (class = key)" />
          <p>
            The <code>id</code> is a HID Keyboard/Keypad usage from the{' '}
            <a href="https://www.usb.org/sites/default/files/hut1_5.pdf" target="_blank" rel="noreferrer">USB HID Usage Tables</a>{' '}
            (page 0x07). A usage of <code>0xE0</code>-<code>0xE7</code> is a modifier and folds into
            the modifier byte; any other usage fills a keycode slot. The common ones:
          </p>
          <table class="api-params">
            <thead><tr><th>Key</th><th>Usage</th></tr></thead>
            <tbody>
              <tr><td><code>A</code> .. <code>Z</code></td><td><code>0x04</code> .. <code>0x1D</code></td></tr>
              <tr><td><code>1</code> .. <code>9</code></td><td><code>0x1E</code> .. <code>0x26</code></td></tr>
              <tr><td><code>0</code></td><td><code>0x27</code></td></tr>
              <tr><td>Enter / Escape / Backspace / Tab</td><td><code>0x28</code> / <code>0x29</code> / <code>0x2A</code> / <code>0x2B</code></td></tr>
              <tr><td>Space</td><td><code>0x2C</code></td></tr>
              <tr><td>Caps Lock</td><td><code>0x39</code></td></tr>
              <tr><td><code>F1</code> .. <code>F12</code></td><td><code>0x3A</code> .. <code>0x45</code></td></tr>
              <tr><td>Insert / Home / Page Up</td><td><code>0x49</code> / <code>0x4A</code> / <code>0x4B</code></td></tr>
              <tr><td>Delete / End / Page Down</td><td><code>0x4C</code> / <code>0x4D</code> / <code>0x4E</code></td></tr>
              <tr><td>Right / Left / Down / Up</td><td><code>0x4F</code> / <code>0x50</code> / <code>0x51</code> / <code>0x52</code></td></tr>
            </tbody>
          </table>
          <div class="api-response-label">MODIFIERS</div>
          <table class="api-params">
            <thead><tr><th>Modifier</th><th>Usage</th></tr></thead>
            <tbody>
              <tr><td>Left Ctrl / Shift / Alt / GUI</td><td><code>0xE0</code> / <code>0xE1</code> / <code>0xE2</code> / <code>0xE3</code></td></tr>
              <tr><td>Right Ctrl / Shift / Alt / GUI</td><td><code>0xE4</code> / <code>0xE5</code> / <code>0xE6</code> / <code>0xE7</code></td></tr>
            </tbody>
          </table>
          <p>
            The Rust library exposes these as named{' '}
            <A href="/library/types/structs#key"><code>Key</code></A> constants
            (<code>Key::A</code>, <code>Key::LEFT_SHIFT</code>, ...).
          </p>
        </Card>
      </div>

      <div id="consumer" data-search-target>
        <Card>
          <CardHeader title="Consumer usages" subtitle="Media keys (class = media)" />
          <p>
            The <code>id</code> is a 16-bit usage from the Consumer page (0x0C) of the{' '}
            <a href="https://www.usb.org/sites/default/files/hut1_5.pdf" target="_blank" rel="noreferrer">USB HID Usage Tables</a>.
            Present-gated to a board with a Consumer collection, read from the{' '}
            <A href="/native/commands/requests#kbd-caps"><code>KBD_CAPS</code></A>{' '}
            <code>CONSUMER</code> flag. The usual transport controls:
          </p>
          <table class="api-params">
            <thead><tr><th>Media key</th><th>Usage</th></tr></thead>
            <tbody>
              <tr><td>Play / Pause toggle</td><td><code>0x00CD</code></td></tr>
              <tr><td>Play</td><td><code>0x00B0</code></td></tr>
              <tr><td>Pause</td><td><code>0x00B1</code></td></tr>
              <tr><td>Stop</td><td><code>0x00B7</code></td></tr>
              <tr><td>Next track</td><td><code>0x00B5</code></td></tr>
              <tr><td>Previous track</td><td><code>0x00B6</code></td></tr>
              <tr><td>Mute</td><td><code>0x00E2</code></td></tr>
              <tr><td>Volume up</td><td><code>0x00E9</code></td></tr>
              <tr><td>Volume down</td><td><code>0x00EA</code></td></tr>
            </tbody>
          </table>
          <p>
            The Rust library exposes these as named{' '}
            <A href="/library/types/structs#media-key"><code>MediaKey</code></A> constants
            (<code>MediaKey::VOLUME_UP</code>, ...).
          </p>
        </Card>
      </div>
    </>
  );
};

export default Usage;
