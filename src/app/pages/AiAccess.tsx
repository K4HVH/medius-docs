import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../components/surfaces/Card';
import '../../styles/docs.css';

const AiAccess: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="AI & LLM access" subtitle="Docs for agents" />
        <p>
          Every page is served as a <A href="/ai#markdown">Markdown twin</A>, indexed in{' '}
          <A href="/ai#llms">llms.txt</A>, and exposed by an <A href="/ai#mcp">MCP server</A>.
        </p>
      </Card>

      <div id="markdown" data-search-target>
        <Card>
          <CardHeader title="Markdown twins" subtitle="Any page as Markdown" />
          <p>
            Append <code>.md</code> to a doc URL, or send <code>Accept: text/markdown</code> to the page
            URL. Links point at the other <code>.md</code> pages.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-bash">{`# .md twin
curl https://medius.k4tech.net/library/clip.md

# content negotiation
curl -H "Accept: text/markdown" https://medius.k4tech.net/library/clip`}</code></pre>
        </Card>
      </div>

      <div id="llms" data-search-target>
        <Card>
          <CardHeader title="llms.txt" subtitle="Index and full corpus" />
          <p>
            <a href="https://medius.k4tech.net/llms.txt" target="_blank" rel="noreferrer">/llms.txt</a> lists
            every page as a Markdown link, per the{' '}
            <a href="https://llmstxt.org/" target="_blank" rel="noreferrer">llms.txt</a> convention;{' '}
            <a href="https://medius.k4tech.net/llms-full.txt" target="_blank" rel="noreferrer">/llms-full.txt</a>{' '}
            is every page in one file.
          </p>
        </Card>
      </div>

      <div id="mcp" data-search-target>
        <Card>
          <CardHeader title="MCP server" subtitle="Docs search and fetch for coding agents" />
          <p>
            Read-only <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">MCP</a>{' '}
            server at <code>https://medius.k4tech.net/mcp</code> (Streamable HTTP, no auth):{' '}
            <code>search</code> and <code>fetch</code> for ChatGPT deep research;{' '}
            <code>search_docs</code>, <code>get_page</code> and <code>list_pages</code> for other clients.
          </p>
          <div class="api-response-label">CLAUDE CODE</div>
          <pre><code class="language-bash">{`claude mcp add --transport http medius-docs https://medius.k4tech.net/mcp`}</code></pre>
          <div class="api-response-label">CURSOR / WINDSURF / VS CODE</div>
          <pre><code class="language-json">{`{
  "mcpServers": {
    "medius-docs": { "url": "https://medius.k4tech.net/mcp" }
  }
}`}</code></pre>
          <div class="api-response-label">CLAUDE DESKTOP / CLAUDE.AI / CHATGPT</div>
          <p>
            Add a custom connector for <code>https://medius.k4tech.net/mcp</code>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default AiAccess;
