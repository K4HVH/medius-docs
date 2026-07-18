import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../../components/surfaces/Card';
import '../../../styles/docs.css';

const AiAccess: Component = () => {
  return (
    <>
      <Card>
        <CardHeader title="AI & LLM access" subtitle="Read these docs from an agent" />
        <p>
          Every page is also served as Markdown, indexed for LLMs, and exposed by an MCP server. Point
          your agent at whichever fits: a page's <A href="/native/ai#markdown">Markdown twin</A>, the{' '}
          <A href="/native/ai#llms">llms.txt</A> index, or the <A href="/native/ai#mcp">MCP server</A>.
        </p>
      </Card>

      <div id="markdown" data-search-target>
        <Card>
          <CardHeader title="Markdown twins" subtitle="Any page as clean Markdown" />
          <p>
            Append <code>.md</code> to a doc URL, or send <code>Accept: text/markdown</code> on the page URL.
            Both return the page as Markdown, with links rewritten to the other <code>.md</code> pages.
          </p>
          <div class="api-response-label">EXAMPLE</div>
          <pre><code class="language-bash">{`# the .md twin of any page
curl https://medius.k4tech.net/library/clip.md

# or content negotiation on the page URL
curl -H "Accept: text/markdown" https://medius.k4tech.net/library/clip`}</code></pre>
        </Card>
      </div>

      <div id="llms" data-search-target>
        <Card>
          <CardHeader title="llms.txt" subtitle="The index and the full corpus" />
          <p>
            <a href="https://medius.k4tech.net/llms.txt" target="_blank" rel="noreferrer">/llms.txt</a> lists
            every page as a Markdown link, following the{' '}
            <a href="https://llmstxt.org/" target="_blank" rel="noreferrer">llms.txt</a> convention;{' '}
            <a href="https://medius.k4tech.net/llms-full.txt" target="_blank" rel="noreferrer">/llms-full.txt</a>{' '}
            is the whole documentation in one file.
          </p>
        </Card>
      </div>

      <div id="mcp" data-search-target>
        <Card>
          <CardHeader title="MCP server" subtitle="Search and fetch the docs from a coding agent" />
          <p>
            A read-only <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">MCP</a>{' '}
            server at <code>https://medius.k4tech.net/mcp</code> (Streamable HTTP, no auth). It exposes{' '}
            <code>search</code> and <code>fetch</code> for ChatGPT deep research, plus <code>search_docs</code>,{' '}
            <code>get_page</code>, and <code>list_pages</code> for other clients.
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
            Add a custom connector with the URL <code>https://medius.k4tech.net/mcp</code>.
          </p>
        </Card>
      </div>
    </>
  );
};

export default AiAccess;
