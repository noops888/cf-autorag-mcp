# Cloudflare AutoRAG MCP Server

A Model Context Protocol (MCP) server that provides search capabilities for Cloudflare AutoRAG instances. This server enables AI assistants like Claude to directly search and query your AutoRAG knowledge base using three distinct search methods.

## Features

- 🔍 **Basic Search** - Vector similarity search without query rewriting or answer generation
- ✏️ **Rewrite Search** - Vector search with AI query rewriting but no answer generation (returns document chunks only)
- 🤖 **AI Search** - Full AI-powered search with optional AI response and configurable query rewriting
- ⚙️ **Configurable Parameters** - Support for `score_threshold` (default: 0.5), `max_num_results`, and metadata filtering
- 🌐 **Remote Deployment** - Runs on Cloudflare Workers for scalability
- 🔗 **MCP Compatible** - Works with Claude Desktop and other MCP clients

## Tools

### `autorag_basic_search`
Performs a basic vector similarity search in your Cloudflare AutoRAG index without AI query rewriting or answer generation. Returns raw document chunks only.

**Parameters:**
- `query` (string, required) - The search query text
- `score_threshold` (number, optional) - Minimum similarity score threshold (0.0-1.0, default: 0.5)
- `max_num_results` (number, optional) - Maximum number of results to return
- `filters` (object, optional) - Metadata filters for multitenancy (e.g., `{"folder": "tenant1"}`)

### `autorag_rewrite_search`
Performs a vector search with AI query rewriting but **no answer generation**. Uses Cloudflare's `search()` method with configurable `rewrite_query` for better semantic matching and returns only document chunks.

**Parameters:**
- `query` (string, required) - The search query text  
- `score_threshold` (number, optional) - Minimum similarity score threshold (0.0-1.0, default: 0.5)
- `max_num_results` (number, optional) - Maximum number of results to return
- `filters` (object, optional) - Metadata filters for multitenancy (e.g., `{"folder": "tenant1"}`)
- `rewrite_query` (boolean, optional) - Whether to rewrite query for better matching (default: true)

### `autorag_ai_search`
Performs AI-powered search using Cloudflare's `aiSearch()` method with optional AI-generated response. Returns document chunks and optionally an AI answer based on the `include_ai_response` parameter.

**Parameters:**
- `query` (string, required) - The search query text  
- `score_threshold` (number, optional) - Minimum similarity score threshold (0.0-1.0, default: 0.5)
- `max_num_results` (number, optional) - Maximum number of results to return
- `filters` (object, optional) - Metadata filters for multitenancy (e.g., `{"folder": "tenant1"}`)
- `rewrite_query` (boolean, optional) - Whether to rewrite the query for better semantic matching (default: true)
- `include_ai_response` (boolean, optional) - Whether to include the AI-generated response in the output (default: false)

**Response includes:**
- `data` - Array of source document chunks with scores and metadata (always included)
- `response` - AI-generated answer based on retrieved documents (only when `include_ai_response: true`)

## Prerequisites

1. **Cloudflare Account** with AutoRAG access
2. **AutoRAG Instance** - Created and indexed in your Cloudflare account
3. **Wrangler CLI** - For deployment (`npm install --save-dev wrangler`)

## Deployment

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd cf-autorag-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your AutoRAG instance and index names:**
   Edit `wrangler.toml` and update the `AUTORAG_NAME` variable and your vectorize index name:
   ```toml
   [vars]
   AUTORAG_NAME = "your-autorag-instance-name"

   [[vectorize]]
   index_name = "your-autorag-index-name"
   ```

4. **Deploy to Cloudflare Workers:**
   ```bash
   npx wrangler deploy
   ```

   This will output your Worker URL, which you'll need for the MCP client configuration.

## Claude Desktop Configuration

To use this MCP server with Claude Desktop, add the following configuration to your Claude Desktop config file:

### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

### Windows
Edit `%APPDATA%/Claude/claude_desktop_config.json`:

### Configuration
```json
{
  "mcpServers": {
    "cf-autorag-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker-url.workers.dev/"
      ]
    }
  }
}
```

**Replace `https://your-worker-url.workers.dev/` with your actual deployed Worker URL.**

After updating the configuration:
1. Restart Claude Desktop
2. You should see the AutoRAG search tools available in your conversation

## Configuration

### Environment Variables

The server uses the following Cloudflare Worker bindings:

- `AI` - Cloudflare AI binding for AutoRAG access
- `VECTORIZE` - Vectorize index binding (automatically configured by AutoRAG)
- `AUTORAG_NAME` - Your AutoRAG instance name (set in `wrangler.toml`)

### Wrangler Configuration

The `wrangler.toml` file includes:

```toml
name = "cf-autorag-mcp"
main = "src/server.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
AUTORAG_NAME = "your-autorag-instance-name"

[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "your-autorag-index-name"
```

## Usage Examples

Once configured with Claude Desktop, you can use the tools like this:

**Basic Search (no query rewriting, no AI response):**
```
Search for documents about "machine learning" in my AutoRAG with a minimum score threshold of 0.7
```

**Rewrite Search (AI query rewriting, no AI response):**
```
Use rewrite search to find information about "deployment strategies" with query rewriting enabled
```

**AI Search with Document Chunks Only (default behavior):**
```
Use AI search to find information about "deployment strategies" for the "production" tenant with max 5 results
```

**AI Search with AI-Generated Response:**
```
Use AI search to find information about "deployment strategies" and include the AI-generated response
```

**Important Notes:** 
- `autorag_basic_search` performs pure vector search without any AI enhancements
- `autorag_rewrite_search` uses AI query rewriting but returns **document chunks only** 
- `autorag_ai_search` by default returns **document chunks only** (letting the client LLM generate responses), but can optionally include Cloudflare's AI-generated response
- All tools use a **default score threshold of 0.5** if not specified
- All tools support the same parameter structure for consistent usage

## Development

### Local Development
```bash
# Start local development server
npm run dev

# Build for production
npm run build
```

### Project Structure
```
cf-autorag-mcp/
├── src/
│   └── server.ts          # Main MCP server implementation
├── wrangler.toml          # Cloudflare Workers configuration
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## Technical Details

- **Protocol**: JSON-RPC 2.0 over HTTP
- **Runtime**: Cloudflare Workers with Node.js compatibility
- **MCP Version**: 2024-11-05
- **Transport**: HTTP-based (no streaming)
- **Default Score Threshold**: 0.5 for all search tools
- **Parameter Validation**: Comprehensive validation with clear error messages

## Troubleshooting

### Common Issues

1. **"AutoRAG instance not found"**
   - Verify your `AUTORAG_NAME` in `wrangler.toml`
   - Ensure your AutoRAG instance is properly created and indexed

2. **"MCP server disconnected"**
   - Check that your Worker URL is correct in the Claude Desktop config
   - Verify the Worker is deployed and accessible

3. **"Tool not found" errors**
   - Restart Claude Desktop after configuration changes
   - Check the Worker logs: `npx wrangler tail`

4. **Empty search results**
   - Try lowering the `score_threshold` parameter (default is 0.5)
   - Verify your AutoRAG index has been populated with documents
   - Check that your query terms exist in the indexed content

### Logs
View real-time logs from your deployed Worker:
```bash
npx wrangler tail
```

## Version History

- **v1.1.1** - Added `include_ai_response` parameter to AI search tool, default score threshold of 0.5, comprehensive parameter validation
- **v1.1.0** - Added three distinct search tools with boolean parameter support
- **v1.0.0** - Initial release

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues related to:
- **Cloudflare AutoRAG**: [Cloudflare AutoRAG Documentation](https://developers.cloudflare.com/autorag/)
- **Model Context Protocol**: [MCP Documentation](https://modelcontextprotocol.io/)
- **This Server**: Open an issue in this repository
