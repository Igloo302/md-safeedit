import { ByteRange } from '@md-safeedit/core';
export type NodeType = 'document' | 'section' | 'heading' | 'paragraph' | 'list_item' | 'code_block' | 'table_row' | 'frontmatter' | 'frontmatter_field' | 'blockquote' | 'list' | 'table' | 'raw';
export interface StructuralPathSegment {
    heading: string;
    level: number;
    occurrence: number;
}
export interface MarkdownNode {
    runtimeId: string;
    type: NodeType;
    range: ByteRange;
    contentRange?: ByteRange;
    parentRuntimeId?: string;
    childRuntimeIds: string[];
    structuralPath: StructuralPathSegment[];
    rawHash: string;
    content: string;
    level?: number;
    blockId?: string;
    calloutType?: string;
}
/**
 * Walk the mdast AST to extract supported block nodes and calculate exact byte ranges.
 */
export declare function parseMarkdownToNodes(bytes: Uint8Array, content: string): MarkdownNode[];
