# Publishing the MCP server to the official registry

Lists `net.k4tech/docs` (the remote MCP server at `https://medius.k4tech.net/mcp`)
in the official MCP Registry so agents can discover it. Do this after the site is
deployed and live. `server.json` in this repo is the manifest.

## 1. Install the CLI

```bash
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
sudo mv mcp-publisher /usr/local/bin/
# or: brew install mcp-publisher
mcp-publisher validate        # checks server.json against the schema
```

## 2. Prove domain ownership (one time)

Generate a keypair and a DNS record:

```bash
openssl genpkey -algorithm Ed25519 -out mcp-registry-key.pem
PUBLIC_KEY="$(openssl pkey -in mcp-registry-key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "TXT record value:  v=MCPv1; k=ed25519; p=${PUBLIC_KEY}"
```

Add a **TXT** record on `k4tech.net` (the apex, not a `_mcp-auth` selector):

```
Name:  k4tech.net
Type:  TXT
Value: v=MCPv1; k=ed25519; p=<PUBLIC_KEY from above>
```

Proving `k4tech.net` also authorizes `net.k4tech.*`. Keep `mcp-registry-key.pem`
private (it is gitignored). Wait for DNS to propagate.

## 3. Log in and publish

```bash
PRIVATE_KEY="$(openssl pkey -in mcp-registry-key.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
mcp-publisher login dns --domain "k4tech.net" --private-key "$PRIVATE_KEY"
mcp-publisher publish
```

## 4. Verify

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=net.k4tech/docs"
```

## Updating later

Bump `version` in `server.json` (published versions are immutable), then re-run
`mcp-publisher publish`. To remove: `mcp-publisher status --status deleted --message "..." net.k4tech/docs <version>`.

Notes: the registry is in preview (no pre-publish review; the entry is queryable
immediately, downstream catalogs ingest on their own schedule). The `type` must
be exactly `streamable-http`, and the name namespace must match the proven domain.
