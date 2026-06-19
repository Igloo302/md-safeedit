import { AnchorPayloadV1 } from '@igloo302/protocol';
import { MarkdownNode } from '../parser/parser.js';
/**
 * Searches for raw-identical candidates in the parsed node tree and ranks them using structural scoring.
 * Returns the relocated node on a high-confidence unique match, or null on mismatch/ambiguity.
 */
export declare function relocateNode(token: AnchorPayloadV1, currentNodes: MarkdownNode[], docLength: number): MarkdownNode | null;
