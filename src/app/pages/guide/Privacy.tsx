import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { PageHeader } from '../../shell/PageHeader';
import { DocSection } from '../../shell/DocSection';
import { LINKS } from '../../site';

const Privacy: Component = () => (
  <>
    <PageHeader>
      <p>
        K4TECH runs this site and Clanker, the bot in the Medius{' '}
        <a href={LINKS.discord} target="_blank" rel="noreferrer">Discord server</a>. It keeps the data below to run
        them, on the lawful basis of legitimate interests, and sells none of it. Cloudflare and Discord process some of
        it in the US, under the Data Privacy Framework.
      </p>
    </PageHeader>

    <DocSection id="site" title="Site">
      <p>
        The site sets no cookies. Cloudflare carries every request, so it sees your IP address. The server holds your
        IP address in memory for up to 10 minutes to rate-limit requests. Everything the site saves for you stays in
        your browser.
      </p>
    </DocSection>

    <DocSection id="usage-stats" title="Usage stats">
      <p>
        The dashboard always reports each box it connects to, the device the box clones and each flash, for the
        totals on <A href="/dashboard/stats">Stats</A> and the list on <A href="/guide/compatibility">Devices</A>. The
        server records the Box ID as a keyed hash, when the box connected, firmware and protocol versions, operating
        system and browser, country, the device's USB ID, kind and name, and each flash's details and result. Records
        are kept until you have them deleted.
      </p>
    </DocSection>

    <DocSection id="discord-bot" title="Discord bot">
      <p>
        The bot reads the server's messages to moderate it. Staff read device reports through it for the Devices
        list, and keep nothing about who posted them.
      </p>
      <div class="table-scroll">
        <table class="api-params names">
          <colgroup>
            <col />
            <col style={{ width: '32%' }} />
          </colgroup>
          <thead><tr><th>Data</th><th>Retention</th></tr></thead>
          <tbody>
            <tr><td>Moderation history and <span class="nw">mod-log</span> posts</td><td>1 year</td></tr>
            <tr><td>Tickets and transcripts</td><td>1 year after closing</td></tr>
            <tr><td>Edited and deleted messages, joins, leaves, verifications, role and name changes</td><td>90 days</td></tr>
            <tr><td>Ticket check results</td><td>Up to 30 days</td></tr>
            <tr><td>Captchas</td><td>5 minutes</td></tr>
            <tr><td>Scam links and image fingerprints</td><td>1 year after last added</td></tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="rights" title="Your rights">
      <p>
        Open a ticket in the Discord server to have your data copied, corrected, restricted or deleted, or to object
        to its use. For usage stats, give the Box ID from the dashboard's <A href="/dashboard">Device</A> tab. A
        deletion doesn't lift a ban or timeout. You can complain to your data protection authority.
      </p>
    </DocSection>

    <p class="src">Last changed 13 October 2026.</p>
  </>
);

export default Privacy;
