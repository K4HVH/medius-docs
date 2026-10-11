import type { Component, JSX } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { LINKS } from '../../site';

const Details = (props: { head?: [string, string]; rows: [JSX.Element, JSX.Element][] }) => (
  <div class="table-scroll">
    <table class="api-params names fixed opts">
      <colgroup>
        <col class="k" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>{props.head?.[0] ?? 'Item'}</th>
          <th>{props.head?.[1] ?? 'Detail'}</th>
        </tr>
      </thead>
      <tbody>{props.rows.map(([k, v]) => <tr><td>{k}</td><td>{v}</td></tr>)}</tbody>
    </table>
  </div>
);

const Discord = () => <a href={LINKS.discord} target="_blank" rel="noreferrer">Discord server</a>;

const Privacy: Component = () => (
  <>
    <PageHeader />

    <DocSection id="operator" title="Operator">
      <p>
        K4TECH runs this site, the dashboard and Clanker, the bot in the Medius <Discord />. Questions and
        requests go through a ticket in the Discord server.
      </p>
    </DocSection>

    <DocSection id="site" title="Site">
      <Details
        rows={[
          ['Cloudflare', 'Carries every request, so it sees your IP address'],
          ['Cookies', 'None'],
          ['Analytics', <>None, apart from the <A href="/guide/privacy#usage-stats">usage stats</A></>],
        ]}
      />
      <p>Kept in your browser, and never sent anywhere:</p>
      <Details
        rows={[
          ['Boxes', "The boxes you've connected, the one picked and their icons"],
          ['Searches', 'Your last 5'],
          ['Device fixes', 'The ones you put away with Keep as it is'],
          ['Page position', 'Your place on each page, until the tab closes'],
        ]}
      />
    </DocSection>

    <DocSection id="usage-stats" title="Usage stats">
      <p>
        Always on. The dashboard reports each connect, device and flash to the site's server. Totals are public
        on <A href="/dashboard/stats">Stats</A>.
      </p>
      <Details
        head={['Field', 'Detail']}
        rows={[
          ['Box', "A keyed hash of the Box ID (the box's MAC); the Box ID itself is never stored"],
          ['Firmware', "Both chips' versions and the protocol version"],
          ['System', 'Operating system and browser'],
          ['Activity', 'Each day the box connected'],
          ['Device', "The cloned device's VID:PID, kind and product name"],
          ['Flash', 'What was flashed, from and to which versions, the result and how long it took'],
          ['Country', 'As Cloudflare reports it'],
          ['IP address', 'Held in memory for 1 minute to limit each address to 60 reports; never stored'],
          ['Kept', 'Until deleted on request'],
        ]}
      />
    </DocSection>

    <DocSection id="discord-bot" title="Discord bot">
      <p>
        Staff read #✅-device-reports through the bot to keep <A href="/guide/compatibility">Devices</A> current:
        device names only, never who posted them. What the bot keeps:
      </p>
      <Details
        head={['Data', 'Kept']}
        rows={[
          ['Warns, notes, bans and timeouts, with reasons', '1 year'],
          ['Tickets: subject and transcript', '1 year after closing'],
          ['Ticket check results', 'Until the pass expires, and a day after the last failure'],
          ['Captcha challenges', 'Until they expire'],
          ["A temp-ban's end", 'Until it lifts the ban'],
          ['Mod-log posts naming members', '1 year'],
          ['Member-log posts: edited and deleted messages, joins, leaves, role and name changes', '90 days'],
        ]}
      />
    </DocSection>

    <DocSection id="requests" title="Requests">
      <Details
        head={['Request', 'Detail']}
        rows={[
          ['A copy of your data', 'Open a ticket in the Discord server'],
          [
            'Bot data deleted',
            "Open a ticket. Moderation history, tickets and transcripts, check results, captchas, the bot's log posts naming you and its DMs to you are deleted. Bans and timeouts stay in force: Discord holds those.",
          ],
          [
            'Usage stats deleted',
            <>
              Open a ticket with the Box ID from the dashboard's <A href="/dashboard">Device</A> tab. Every
              record of that box is deleted.
            </>,
          ],
        ]}
      />
    </DocSection>

    <DocSection id="changes" title="Changes">
      <p>Last changed 11 October 2026.</p>
    </DocSection>
  </>
);

export default Privacy;
