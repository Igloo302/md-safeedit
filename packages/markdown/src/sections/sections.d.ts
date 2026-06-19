import { MarkdownNode } from '../parser/parser.js';
/**
 * Extracts clean heading text by stripping leading/trailing '#' and trimming spaces.
 */
export declare function getCleanHeadingText(headingContent: string): string;
/**
 * Reconstructs the node list to insert logical 'section' nodes.
 * Updates all parent/child pointers, propagates structural paths,
 * computes section byte ranges, and generates hashes for sections.
 */
export declare function buildLogicalSections(parsedNodes: MarkdownNode[], bytes: Uint8Array, content: string): MarkdownNode[];
