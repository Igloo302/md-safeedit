#!/usr/bin/env node

import * as fs from 'fs';
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

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || ['--help', '-h'].includes(command)) {
    console.error('MD SafeEdit CLI');
    console.error('Usage:');
    console.error('  As command line tool:');
    console.error('    mdse inspect <filePath>');
    console.error('    mdse search <filePath> <query>');
    console.error('    mdse read <filePath> <runtimeId1> [runtimeId2 ...]');
    console.error('    mdse patch <filePath> <op: replace|delete|insert_before|insert_after> <anchorToken> [content] [--commit]');
    console.error('  As stdin/JSON tool (when no additional arguments are supplied):');
    console.error('    echo <JSON_PAYLOAD> | mdse <command>');
    process.exit(1);
  }

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
        process.exit(1);
      }
      jsonPayload = {
        file: { path: args[1] },
        query: args[2]
      };
    } else if (command === 'read') {
      if (args.length < 3) {
        console.error('Error: "read" requires at least one runtime ID.');
        process.exit(1);
      }
      const runtimeIds = args.slice(2);
      jsonPayload = {
        file: { path: args[1] },
        targets: runtimeIds.map(id => ({ runtime_id: id }))
      };
    } else if (command === 'patch') {
      if (args.length < 4) {
        console.error('Error: "patch" requires operation (replace|delete|insert_before|insert_after) and anchor token.');
        process.exit(1);
      }
      const op = args[2];
      const anchorToken = args[3];
      
      const hasCommit = args.includes('--commit');
      let content = '';
      if (op !== 'delete') {
        const potentialContent = args[4];
        if (potentialContent && potentialContent !== '--commit') {
          content = potentialContent;
        } else {
          console.error(`Error: "patch" operation "${op}" requires a content string.`);
          process.exit(1);
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
      console.log(JSON.stringify(formatError('IO_ERROR', `Unknown command: ${command}`)));
      process.exit(1);
    }
  } else {
    // Read from stdin JSON
    let inputData = '';
    try {
      inputData = await readStdin();
    } catch (err: any) {
      console.log(JSON.stringify(formatError('IO_ERROR', `Failed to read stdin: ${err.message}`)));
      process.exit(1);
    }

    if (!inputData.trim()) {
      console.log(JSON.stringify(formatError('IO_ERROR', 'Empty request payload from stdin.')));
      process.exit(1);
    }

    try {
      jsonPayload = JSON.parse(inputData);
    } catch (err: any) {
      console.log(JSON.stringify(formatError('IO_ERROR', `Invalid JSON payload: ${err.message}`)));
      process.exit(1);
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

  // Print JSON result to stdout
  console.log(JSON.stringify(result, null, 2));

  if (result && result.ok === false) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
