#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  inspectService,
  searchService,
  readService,
  patchService,
  formatError,
  safeReplaceService,
  safePatchService,
} from "@md-safeedit/cli/services.js";
import {
  InspectRequestSchema,
  SearchRequestSchema,
  ReadRequestSchema,
  PatchRequestSchema,
  SafeReplaceRequestSchema,
  SafePatchRequestSchema,
} from "@md-safeedit/protocol";

// Allowed roots configuration
const envRoots = process.env.MDSE_ALLOWED_ROOTS;
const allowedRoots = envRoots
  ? envRoots.split(",").map((r: string) => r.trim())
  : [process.cwd()];

const server = new Server(
  {
    name: "md-safeedit",
    version: "0.1.0-dev",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Define tools matching the protocol spec
const TOOLS = [
  {
    name: "inspect",
    description:
      "Extracts the structural outline (headings, levels, and runtime IDs) of an existing Markdown file. Recommended for understanding document layout and locating specific nodes before reading or editing, saving token overhead on large files.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to target Markdown file.",
            },
          },
          required: ["path"],
        },
        options: {
          type: "object",
          properties: {
            max_depth: {
              type: "number",
              description: "Max heading outline depth.",
            },
            include_counts: {
              type: "boolean",
              description: "Whether to count child nodes.",
            },
          },
        },
      },
      required: ["file"],
    },
  },
  {
    name: "search",
    description:
      "Searches for text patterns inside an existing Markdown file and maps them to AST logical nodes (sections, list items, tables). Recommended for finding specific modification targets in large files without reading the entire document.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
        query: { type: "string", description: "Text phrase to search for." },
        filters: {
          type: "object",
          properties: {
            include_types: { type: "array", items: { type: "string" } },
            exclude_types: { type: "array", items: { type: "string" } },
            under_path: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string" },
                  level: { type: "number" },
                  occurrence: { type: "number" },
                },
                required: ["heading", "level", "occurrence"],
              },
            },
          },
        },
        options: {
          type: "object",
          properties: {
            limit: { type: "number" },
            preview_chars: { type: "number" },
          },
        },
      },
      required: ["file", "query"],
    },
  },
  {
    name: "read",
    description:
      "Reads the text contents of specific Markdown nodes by their runtime_id and generates cryptographically signed anchor_tokens. Use this tool to inspect targeted content and obtain the token required by the patch tool for safe editing.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
        targets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              runtime_id: { type: "string", description: "Node runtime ID." },
            },
            required: ["runtime_id"],
          },
        },
        options: {
          type: "object",
          properties: {
            include_neighbors: {
              type: "number",
              description: "Count of sibling nodes context.",
            },
            include_children: { type: "boolean" },
          },
        },
      },
      required: ["file", "targets"],
    },
  },
  {
    name: "patch",
    description:
      "Performs safe, structure-aware mutations (replace, delete, insert) to specific Markdown nodes using signed anchor_tokens. Strongly preferred over full-file rewrites for updating existing sections, list items, or tables to prevent formatting loss and concurrent conflicts. (Use generic file tools for file creation, deletion, or non-structural modifications).",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: {
                type: "string",
                enum: ["replace", "delete", "insert_before", "insert_after"],
              },
              anchor_token: { type: "string" },
              content: { type: "string" },
            },
            required: ["op", "anchor_token"],
          },
        },
        options: {
          type: "object",
          properties: {
            dry_run: { type: "boolean", default: true },
            atomic: { type: "boolean", default: true },
            validation_level: {
              type: "string",
              enum: ["strict", "normal", "permissive"],
              default: "normal",
            },
          },
        },
      },
      required: ["file", "operations"],
    },
  },
  {
    name: "safe_replace",
    description:
      "A high-level, atomic tool that combines search, read, and patch. It locates a unique node containing the specified search text, verifies its structure, and replaces it with the new text. Reduces round-trips and saves tokens. If search text is ambiguous, it returns an error.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to target Markdown file.",
            },
          },
          required: ["path"],
        },
        search: {
          type: "string",
          description: "Exact search text to locate the target node.",
        },
        replace: { type: "string", description: "Replacement content string." },
        options: {
          type: "object",
          properties: {
            dry_run: {
              type: "boolean",
              default: true,
              description:
                "Preview diff only if true, commit to disk if false.",
            },
            validation_level: {
              type: "string",
              enum: ["strict", "normal", "permissive"],
              default: "normal",
            },
          },
        },
      },
      required: ["file", "search", "replace"],
    },
  },
  {
    name: "safe_patch",
    description:
      "A high-level, atomic tool that combines search, read, and patch for multiple operations. It locates unique nodes matching search queries and applies replace, delete, insert_before, or insert_after operations atomically. Reduces round-trips and saves tokens.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to target Markdown file.",
            },
          },
          required: ["path"],
        },
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: {
                type: "string",
                enum: ["replace", "delete", "insert_before", "insert_after"],
              },
              search: {
                type: "string",
                description: "Exact search text to locate the target node.",
              },
              content: {
                type: "string",
                description:
                  "Replacement or inserted content string (optional for delete).",
              },
            },
            required: ["op", "search"],
          },
        },
        options: {
          type: "object",
          properties: {
            dry_run: {
              type: "boolean",
              default: true,
              description:
                "Preview diff only if true, commit to disk if false.",
            },
            validation_level: {
              type: "string",
              enum: ["strict", "normal", "permissive"],
              default: "normal",
            },
          },
        },
      },
      required: ["file", "operations"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "inspect": {
        const parsedRequest = InspectRequestSchema.parse(args);
        const result = inspectService(parsedRequest, allowedRoots);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.ok,
        };
      }
      case "search": {
        const parsedRequest = SearchRequestSchema.parse(args);
        const result = searchService(parsedRequest, allowedRoots);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.ok,
        };
      }
      case "read": {
        const parsedRequest = ReadRequestSchema.parse(args);
        const result = readService(parsedRequest, allowedRoots);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.ok,
        };
      }
      case "patch": {
        const parsedRequest = PatchRequestSchema.parse(args);
        const result = patchService(parsedRequest, allowedRoots);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.ok,
        };
      }
      case "safe_replace": {
        const parsedRequest = SafeReplaceRequestSchema.parse(args);
        const result = safeReplaceService(parsedRequest, allowedRoots);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.ok,
        };
      }
      case "safe_patch": {
        const parsedRequest = SafePatchRequestSchema.parse(args);
        const result = safePatchService(parsedRequest, allowedRoots);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: !result.ok,
        };
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err: any) {
    let errMsg = err.message || "An unexpected error occurred.";
    if (
      err.name === "ZodError" &&
      Array.isArray(err.errors) &&
      err.errors.length > 0
    ) {
      // Summarise only the first validation issue to keep the message concise
      const first = err.errors[0];
      const fieldPath = first.path?.length
        ? ` at "${first.path.join(".")}"`
        : "";
      errMsg = `Request validation failed${fieldPath}: ${first.message}`;
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            formatError("VALIDATION_FAILED", errMsg),
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MD SafeEdit MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in MCP Server:", err);
  process.exit(1);
});
