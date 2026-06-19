#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

import { 
  inspectService, 
  searchService, 
  readService, 
  patchService,
  formatError
} from '@md-safeedit/cli/services.js';
import { 
  InspectRequestSchema,
  SearchRequestSchema,
  ReadRequestSchema,
  PatchRequestSchema
} from '@md-safeedit/protocol';

// Allowed roots configuration
const envRoots = process.env.MDSE_ALLOWED_ROOTS;
const allowedRoots = envRoots ? envRoots.split(',').map((r: string) => r.trim()) : [process.cwd()];

const server = new Server(
  {
    name: 'md-safeedit',
    version: '0.1.0-dev'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define tools matching the protocol spec
const TOOLS = [
  {
    name: 'inspect',
    description: 'Get the structural outline headings of a Markdown file. MUST use this tool first when you want to modify, understand, or edit a Markdown document, to locate target nodes by their runtime_id before reading or patching.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to target Markdown file.' }
          },
          required: ['path']
        },
        options: {
          type: 'object',
          properties: {
            max_depth: { type: 'number', description: 'Max heading outline depth.' },
            include_counts: { type: 'boolean', description: 'Whether to count child nodes.' }
          }
        }
      },
      required: ['file']
    }
  },
  {
    name: 'search',
    description: 'Search for text patterns inside a Markdown file, returning matching AST logical nodes. Use this to quickly find specific sections, list items, or tables to edit in a large Markdown document without reading the entire file.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        },
        query: { type: 'string', description: 'Text phrase to search for.' },
        filters: {
          type: 'object',
          properties: {
            include_types: { type: 'array', items: { type: 'string' } },
            exclude_types: { type: 'array', items: { type: 'string' } },
            under_path: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  heading: { type: 'string' },
                  level: { type: 'number' },
                  occurrence: { type: 'number' }
                },
                required: ['heading', 'level', 'occurrence']
              }
            }
          }
        },
        options: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            preview_chars: { type: 'number' }
          }
        }
      },
      required: ['file', 'query']
    }
  },
  {
    name: 'read',
    description: 'Read the contents of specific Markdown nodes by their runtime_id and acquire cryptographically signed anchor_tokens. You MUST call this tool to read the node before applying any patch, as the patch tool requires the anchor_token returned here.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        },
        targets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              runtime_id: { type: 'string', description: 'Node runtime ID.' }
            },
            required: ['runtime_id']
          }
        },
        options: {
          type: 'object',
          properties: {
            include_neighbors: { type: 'number', description: 'Count of sibling nodes context.' },
            include_children: { type: 'boolean' }
          }
        }
      },
      required: ['file', 'targets']
    }
  },
  {
    name: 'patch',
    description: 'Safely edit (replace, delete, insert) Markdown node contents using signed anchor_tokens. This is the ONLY authorized way to modify Markdown files, preventing silent overwrites and concurrent conflicts. Do NOT use generic write_file or edit_file tools for Markdown files.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        },
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['replace', 'delete', 'insert_before', 'insert_after'] },
              anchor_token: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['op', 'anchor_token']
          }
        },
        options: {
          type: 'object',
          properties: {
            dry_run: { type: 'boolean', default: true },
            atomic: { type: 'boolean', default: true },
            validation_level: { type: 'string', enum: ['strict', 'normal', 'permissive'], default: 'normal' }
          }
        }
      },
      required: ['file', 'operations']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'inspect': {
        const parsedRequest = InspectRequestSchema.parse(args);
        const result = inspectService(parsedRequest, allowedRoots);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.ok
        };
      }
      case 'search': {
        const parsedRequest = SearchRequestSchema.parse(args);
        const result = searchService(parsedRequest, allowedRoots);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.ok
        };
      }
      case 'read': {
        const parsedRequest = ReadRequestSchema.parse(args);
        const result = readService(parsedRequest, allowedRoots);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.ok
        };
      }
      case 'patch': {
        const parsedRequest = PatchRequestSchema.parse(args);
        const result = patchService(parsedRequest, allowedRoots);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.ok
        };
      }
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (err: any) {
    let errMsg = err.message || 'An unexpected error occurred.';
    if (err.name === 'ZodError' && Array.isArray(err.errors) && err.errors.length > 0) {
      // Summarise only the first validation issue to keep the message concise
      const first = err.errors[0];
      const fieldPath = first.path?.length ? ` at "${first.path.join('.')}"` : '';
      errMsg = `Request validation failed${fieldPath}: ${first.message}`;
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(formatError('VALIDATION_FAILED', errMsg), null, 2) }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MD SafeEdit MCP Server running on stdio');
}

main().catch(err => {
  console.error('Fatal error in MCP Server:', err);
  process.exit(1);
});
