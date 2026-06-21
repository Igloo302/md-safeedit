#!/usr/bin/env node

import * as fs from 'fs';
import { createRequire } from 'module';
import { 
  InspectRequestSchema, 
  SearchRequestSchema, 
  ReadRequestSchema, 
  PatchRequestSchema 
} from '@md-safeedit/protocol';
import { 
  inspectService, 
  searchService, 
  readService, 
  patchService,
  formatError
} from './services.js';

const require = createRequire(import.meta.url);
let cliVersion = '0.1.2-dev';
try {
  const pkg = require('../package.json');
  cliVersion = pkg.version;
} catch (e) {
  // fallback
}

// Read allowed roots from environment variable or default to process.cwd()
const envRoots = process.env.MDSE_ALLOWED_ROOTS;
const allowedRoots = envRoots ? envRoots.split(',').map((r: string) => r.trim()) : [process.cwd()];

/**
 * Reads all content from stdin.
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: any) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', err => {
      reject(err);
    });
  });
}

function formatHumanFriendly(command: string, result: any): string {
  const header = `mdse CLI version: ${result.cli_version} | Protocol version: ${result.protocol_version}`;
  
  if (result.ok === false) {
    let out = `${header}\n`;
    out += `Error [${result.error?.code || 'UNKNOWN'}]: ${result.error?.message || 'An unexpected error occurred.'}\n`;
    if (result.error?.recommended_action) {
      out += `Recommended Action: ${result.error.recommended_action}\n`;
    }
    if (result.error?.details) {
      out += `Details: ${JSON.stringify(result.error.details, null, 2)}\n`;
    }
    return out;
  }

  let out = `${header}\n`;
  switch (command) {
    case 'inspect': {
      out += `File: ${result.document?.display_path || ''}\n`;
      out += `Revision: ${result.document?.revision || ''}\n`;
      out += `Size: ${result.document?.size_bytes || 0} bytes\n`;
      out += `Line Ending: ${result.document?.line_ending || ''}\n\n`;
      out += `Outline:\n`;
      if (Array.isArray(result.outline)) {
        for (const item of result.outline) {
          const indent = '  '.repeat(item.level);
          out += `${indent}${item.type === 'section' ? '#' : ''} ${item.title} (runtime_id: ${item.runtime_id})\n`;
        }
      }
      break;
    }
    case 'search': {
      out += `Document Revision: ${result.document_revision || ''}\n`;
      out += `Search results:\n`;
      if (Array.isArray(result.matches)) {
        if (result.matches.length === 0) {
          out += `  No matches found.\n`;
        }
        for (const match of result.matches) {
          const pathStr = match.path?.map((p: any) => p.heading).join(' > ') || 'Root';
          out += `  - [${pathStr}] (runtime_id: ${match.runtime_id})\n`;
          out += `    Preview: ${match.preview}\n`;
        }
      }
      break;
    }
    case 'read': {
      out += `Document Revision: ${result.document_revision || ''}\n`;
      out += `Nodes:\n`;
      if (Array.isArray(result.nodes)) {
        for (const node of result.nodes) {
          out += `----------------------------------------\n`;
          out += `Runtime ID: ${node.runtime_id || ''}\n`;
          out += `Type: ${node.type || ''}\n`;
          const pathStr = node.path?.map((p: any) => p.heading).join(' > ') || 'Root';
          out += `Path: ${pathStr}\n`;
          out += `Anchor Token: ${node.anchor_token || ''}\n`;
          if (node.neighbors) {
            if (node.neighbors.previous?.length) {
              out += `Neighbors (Previous):\n`;
              for (const prev of node.neighbors.previous) {
                out += `  [${prev.type}] ${prev.content.trim().slice(0, 40)}...\n`;
              }
            }
            if (node.neighbors.next?.length) {
              out += `Neighbors (Next):\n`;
              for (const nxt of node.neighbors.next) {
                out += `  [${nxt.type}] ${nxt.content.trim().slice(0, 40)}...\n`;
              }
            }
          }
          out += `Content:\n---\n${node.content}\n`;
          out += `----------------------------------------\n`;
        }
      }
      break;
    }
    case 'patch': {
      out += `Status: ${result.status || ''}\n`;
      out += `Source Revision: ${result.source_revision || ''}\n`;
      const rev = result.new_revision || result.result_revision || '';
      out += `Result/New Revision: ${rev}\n`;
      out += `Relocated: ${result.relocated ? 'Yes' : 'No'}\n`;
      out += `Diff:\n`;
      out += `----------------------------------------\n`;
      out += `${result.diff || 'No changes.'}\n`;
      out += `----------------------------------------\n`;
      break;
    }
    default:
      out += JSON.stringify(result, null, 2);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  
  // Extract --json flag
  const jsonIndex = args.indexOf('--json');
  const hasJsonFlag = jsonIndex !== -1;
  if (hasJsonFlag) {
    args.splice(jsonIndex, 1);
  }

  const command = args[0];

  // Handle version queries
  if (command === '--version' || command === '-v') {
    if (hasJsonFlag) {
      console.log(JSON.stringify({
        ok: true,
        cli_version: cliVersion,
        protocol_version: '1.0'
      }, null, 2));
    } else {
      console.log(`mdse CLI version: ${cliVersion}`);
      console.log(`Protocol version: 1.0`);
    }
    process.exit(0);
  }

  if (!command || ['--help', '-h'].includes(command)) {
    console.error('MD SafeEdit CLI');
    console.error('Usage:');
    console.error('  As command line tool:');
    console.error('    mdse inspect <filePath> [--json]');
    console.error('    mdse search <filePath> <query> [--json]');
    console.error('    mdse read <filePath> <runtimeId1> [runtimeId2 ...] [--json]');
    console.error('    mdse patch <filePath> <op: replace|delete|insert_before|insert_after> <anchorToken> [content] [--commit] [--json]');
    console.error('  As stdin/JSON tool (when no additional arguments are supplied):');
    console.error('    echo <JSON_PAYLOAD> | mdse <command>');
    process.exit(64);
  }

  // Determine if we should output JSON
  // Stdin mode is active if args.length is 1 (only command is supplied)
  const isStdinMode = args.length === 1;
  const useJson = hasJsonFlag || isStdinMode;

  let jsonPayload: any;

  // Check if args are provided for command-line arguments mode
  if (args.length > 1) {
    if (command === 'inspect') {
      jsonPayload = {
        file: { path: args[1] }
      };
    } else if (command === 'search') {
      if (args.length < 3) {
        console.error('Error: "search" requires a query string argument.');
        process.exit(64);
      }
      jsonPayload = {
        file: { path: args[1] },
        query: args[2]
      };
    } else if (command === 'read') {
      if (args.length < 3) {
        console.error('Error: "read" requires at least one runtime ID.');
        process.exit(64);
      }
      const runtimeIds = args.slice(2);
      jsonPayload = {
        file: { path: args[1] },
        targets: runtimeIds.map(id => ({ runtime_id: id }))
      };
    } else if (command === 'patch') {
      if (args.length < 4) {
        console.error('Error: "patch" requires operation (replace|delete|insert_before|insert_after) and anchor token.');
        process.exit(64);
      }
      const op = args[2];
      const anchorToken = args[3];
      
      const hasCommit = args.includes('--commit');
      const cleanArgs = args.filter(a => a !== '--commit');
      let content = '';
      if (op !== 'delete') {
        const potentialContent = cleanArgs[4];
        if (potentialContent) {
          content = potentialContent;
        } else {
          console.error(`Error: "patch" operation "${op}" requires a content string.`);
          process.exit(64);
        }
      }

      jsonPayload = {
        file: { path: args[1] },
        operations: [
          {
            op,
            anchor_token: anchorToken,
            ...(op !== 'delete' ? { content } : {})
          }
        ],
        options: {
          dry_run: !hasCommit
        }
      };
    } else {
      const errRes: any = formatError('IO_ERROR', `Unknown command: ${command}`);
      errRes.protocol_version = '1.0';
      errRes.cli_version = cliVersion;
      if (useJson) {
        console.log(JSON.stringify(errRes, null, 2));
      } else {
        console.log(formatHumanFriendly(command, errRes));
      }
      process.exit(64);
    }
  } else {
    // Read from stdin JSON
    let inputData = '';
    try {
      inputData = await readStdin();
    } catch (err: any) {
      const errRes: any = formatError('IO_ERROR', `Failed to read stdin: ${err.message}`);
      errRes.protocol_version = '1.0';
      errRes.cli_version = cliVersion;
      if (useJson) {
        console.log(JSON.stringify(errRes, null, 2));
      } else {
        console.log(formatHumanFriendly(command, errRes));
      }
      process.exit(64);
    }

    if (!inputData.trim()) {
      const errRes: any = formatError('IO_ERROR', 'Empty request payload from stdin.');
      errRes.protocol_version = '1.0';
      errRes.cli_version = cliVersion;
      if (useJson) {
        console.log(JSON.stringify(errRes, null, 2));
      } else {
        console.log(formatHumanFriendly(command, errRes));
      }
      process.exit(64);
    }

    try {
      jsonPayload = JSON.parse(inputData);
    } catch (err: any) {
      const errRes: any = formatError('IO_ERROR', `Invalid JSON payload: ${err.message}`);
      errRes.protocol_version = '1.0';
      errRes.cli_version = cliVersion;
      if (useJson) {
        console.log(JSON.stringify(errRes, null, 2));
      } else {
        console.log(formatHumanFriendly(command, errRes));
      }
      process.exit(64);
    }
  }

  let result: any;

  try {
    switch (command) {
      case 'inspect': {
        const parsedRequest = InspectRequestSchema.parse(jsonPayload);
        result = inspectService(parsedRequest, allowedRoots);
        break;
      }
      case 'search': {
        const parsedRequest = SearchRequestSchema.parse(jsonPayload);
        result = searchService(parsedRequest, allowedRoots);
        break;
      }
      case 'read': {
        const parsedRequest = ReadRequestSchema.parse(jsonPayload);
        result = readService(parsedRequest, allowedRoots);
        break;
      }
      case 'patch': {
        const parsedRequest = PatchRequestSchema.parse(jsonPayload);
        result = patchService(parsedRequest, allowedRoots);
        break;
      }
      default:
        result = formatError('IO_ERROR', `Unknown command: ${command}`);
    }
  } catch (err: any) {
    if (err.name === 'ZodError') {
      result = formatError('VALIDATION_FAILED', `Request validation failed: ${err.message}`, err.errors);
    } else {
      result = formatError('IO_ERROR', err.message || 'An unexpected error occurred.');
    }
  }

  // Inject protocol and CLI versions
  if (result && typeof result === 'object') {
    result.protocol_version = '1.0';
    result.cli_version = cliVersion;
  }

  // Output formatting
  if (useJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatHumanFriendly(command, result));
  }

  const exitCode = getExitCode(result);
  process.exit(exitCode);
}

function getExitCode(result: any): number {
  if (!result) return 6;
  if (result.ok !== false) return 0;
  
  const errorCode = result.error?.code;
  if (!errorCode) return 1;
  
  switch (errorCode) {
    case 'DOCUMENT_CHANGED':
    case 'TARGET_CHANGED':
    case 'TARGET_MISSING':
      return 2;
    case 'ANCHOR_EXPIRED':
      return 3;
    case 'ANCHOR_INVALID':
    case 'ANCHOR_AMBIGUOUS':
    case 'ANCHOR_INSUFFICIENT_EVIDENCE':
      return 4;
    case 'VALIDATION_FAILED':
    case 'INVALID_REPLACEMENT':
    case 'UNSUPPORTED_SYNTAX':
    case 'OVERLAPPING_OPERATIONS':
      return 5;
    case 'IO_ERROR':
    case 'COMMIT_RACE':
      return 6;
    default:
      return 6;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(6);
});
