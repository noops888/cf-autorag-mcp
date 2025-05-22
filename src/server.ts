import { z } from 'zod';

/**
 * Cloudflare AutoRAG MCP Server
 * Provides search and aiSearch tools for Cloudflare AutoRAG instances
 */

interface Env {
  AI: {
    autorag: (name: string) => {
      search: (params: AutoRAGSearchParams) => Promise<AutoRAGSearchResponse>;
      aiSearch: (params: AutoRAGAiSearchParams) => Promise<AutoRAGAiSearchResponse>;
    };
  };
  VECTORIZE: VectorizeIndex;
  AUTORAG_NAME: string;
}

interface AutoRAGSearchParams {
  query: string;
  rewrite_query?: boolean;
  max_num_results?: number;
  ranking_options?: {
    score_threshold?: number;
  };
  filters?: Record<string, any>;
}

interface AutoRAGAiSearchParams {
  query: string;
  rewrite_query?: boolean;
  max_num_results?: number;
  ranking_options?: {
    score_threshold?: number;
  };
  filters?: Record<string, any>;
  stream?: boolean;
}

interface AutoRAGSearchResponse {
  object: string;
  search_query: string;
  data: Array<{
    file_id: string;
    content: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
}

interface AutoRAGAiSearchResponse {
  object: string;
  search_query: string;
  response: string;
  data?: Array<{
    file_id: string;
    content: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
}

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

interface McpServerInfo {
  name: string;
  version: string;
}

interface McpCapabilities {
  tools?: {};
  logging?: {};
}

class WorkersMcpServer {
  private serverInfo: McpServerInfo;
  private capabilities: McpCapabilities;
  private tools: Map<string, {
    description: string;
    inputSchema: any;
    handler: (params: any) => Promise<{ content: Array<{ type: string; text: string }> }>;
  }> = new Map();

  constructor(serverInfo: McpServerInfo, options: { capabilities: McpCapabilities }) {
    this.serverInfo = serverInfo;
    this.capabilities = options.capabilities;
  }

  addTool(
    name: string,
    description: string,
    inputSchema: z.ZodSchema,
    handler: (params: any) => Promise<{ content: Array<{ type: string; text: string }> }>
  ) {
    this.tools.set(name, {
      description,
      inputSchema: this.zodToJsonSchema(inputSchema),
      handler
    });
  }

  private zodToJsonSchema(schema: z.ZodSchema): any {
    // Basic Zod to JSON Schema conversion
    if (schema instanceof z.ZodObject) {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      const shape = schema.shape;
      for (const [key, value] of Object.entries(shape)) {
        if (value instanceof z.ZodString) {
          properties[key] = { type: 'string', description: value.description };
          if (!value.isOptional()) required.push(key);
        } else if (value instanceof z.ZodNumber) {
          properties[key] = { type: 'number', description: value.description };
          if (!value.isOptional()) required.push(key);
        } else if (value instanceof z.ZodRecord) {
          properties[key] = { type: 'object', description: value.description };
          if (!value.isOptional()) required.push(key);
        } else if (value instanceof z.ZodOptional) {
          const innerType = value._def.innerType;
          if (innerType instanceof z.ZodString) {
            properties[key] = { type: 'string', description: innerType.description };
          } else if (innerType instanceof z.ZodNumber) {
            properties[key] = { type: 'number', description: innerType.description };
          } else if (innerType instanceof z.ZodRecord) {
            properties[key] = { type: 'object', description: innerType.description };
          }
        }
      }
      
      return {
        type: 'object',
        properties,
        required
      };
    }
    return { type: 'object' };
  }

  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params, id } = request;

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: this.capabilities,
              serverInfo: this.serverInfo
            }
          };

        case 'tools/list':
          const tools: Tool[] = Array.from(this.tools.entries()).map(([name, tool]) => ({
            name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }));
          
          return {
            jsonrpc: '2.0',
            id,
            result: { tools }
          };

        case 'tools/call':
          const { name, arguments: args } = params;
          const tool = this.tools.get(name);
          
          if (!tool) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Tool '${name}' not found`
              }
            };
          }

          const result = await tool.handler(args);
          return {
            jsonrpc: '2.0',
            id,
            result
          };

        case 'resources/list':
          return {
            jsonrpc: '2.0',
            id,
            result: { resources: [] }
          };

        case 'prompts/list':
          return {
            jsonrpc: '2.0',
            id,
            result: { prompts: [] }
          };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method '${method}' not supported`
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Internal error: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }
}

function createServer(env: Env): WorkersMcpServer {
  const server = new WorkersMcpServer({
    name: 'cloudflare-autorag-mcp',
    version: '1.0.0',
  }, { 
    capabilities: { 
      tools: {},
      logging: {}
    } 
  });

  // Basic search tool
  server.addTool(
    'autorag_search',
    'Search for documents in Cloudflare AutoRAG without answer generation',
    z.object({
      query: z.string().describe('The search query to find relevant documents'),
      score_threshold: z.number().optional().describe('Minimum similarity score threshold (0.0 to 1.0). Default varies by AutoRAG configuration'),
      max_num_results: z.number().optional().describe('Maximum number of results to return. Default varies by AutoRAG configuration'),
      filters: z.record(z.any()).optional().describe('Metadata filters to apply to the search (e.g., {"folder": "tenant1"})'),
      rewrite_query: z.boolean().optional().describe('Whether to rewrite the query for better semantic matching. Default is true')
    }),
    async ({ query, score_threshold, max_num_results, filters, rewrite_query }) => {
      try {
        const searchParams: AutoRAGSearchParams = { 
          query,
          rewrite_query: rewrite_query ?? false // Default to false for basic search
        };
        
        if (score_threshold !== undefined) {
          searchParams.ranking_options = {
            score_threshold: score_threshold
          };
        }
        if (max_num_results !== undefined) {
          searchParams.max_num_results = max_num_results;
        }
        if (filters !== undefined) {
          searchParams.filters = filters;
        }

        const result = await env.AI.autorag(env.AUTORAG_NAME).search(searchParams);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error searching AutoRAG: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // AI search tool with ranking but NO AI generation - uses search method with rewrite_query=true
  server.addTool(
    'autorag_ai_search',
    'Search for documents in Cloudflare AutoRAG with AI-powered ranking but NO answer generation (returns document chunks only)',
    z.object({
      query: z.string().describe('The search query to find relevant documents with AI-powered ranking'),
      score_threshold: z.number().optional().describe('Minimum similarity score threshold (0.0 to 1.0). Default varies by AutoRAG configuration'),
      max_num_results: z.number().optional().describe('Maximum number of results to return. Default varies by AutoRAG configuration'),
      filters: z.record(z.any()).optional().describe('Metadata filters to apply to the search (e.g., {"folder": "tenant1"})')
    }),
    async ({ query, score_threshold, max_num_results, filters }) => {
      try {
        // Use search method with rewrite_query=true for AI-powered ranking without generation
        const searchParams: AutoRAGSearchParams = { 
          query,
          rewrite_query: true // Enable AI query rewriting for better ranking
        };
        
        if (score_threshold !== undefined) {
          searchParams.ranking_options = {
            score_threshold: score_threshold
          };
        }
        if (max_num_results !== undefined) {
          searchParams.max_num_results = max_num_results;
        }
        if (filters !== undefined) {
          searchParams.filters = filters;
        }

        // Use search method instead of aiSearch to avoid AI generation
        const result = await env.AI.autorag(env.AUTORAG_NAME).search(searchParams);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error in AutoRAG AI search: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Only handle POST requests for MCP
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request - only POST method supported'
          },
          id: null
        }), {
          status: 405,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      const body = await request.json() as JsonRpcRequest;
      const server = createServer(env);
      const response = await server.handleRequest(body);
      
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } catch (error) {
      console.error('Error handling MCP request:', error);
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Internal server error: ${error instanceof Error ? error.message : String(error)}`
        },
        id: null
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};