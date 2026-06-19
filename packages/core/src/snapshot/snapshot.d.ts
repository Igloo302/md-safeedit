export type LineEnding = 'lf' | 'crlf' | 'mixed';
export type Encoding = 'utf-8' | 'utf-8-bom';
export interface ByteRange {
    start: number;
    end: number;
}
export interface FileIdentity {
    device: number;
    inode: number;
}
export interface DocumentSnapshot {
    canonicalPath: string;
    fileIdentity?: FileIdentity;
    bytes: Uint8Array;
    content: string;
    revision: string;
    encoding: Encoding;
    lineEnding: LineEnding;
    createdAt: string;
}
/**
 * Resolves symlinks and ensures the path is canonical and resides within the configured allowed roots.
 * Throws an error if path traversal is detected.
 */
export declare function authorizeAndCanonicalizePath(targetPath: string, allowedRoots: string[]): string;
/**
 * Detects encoding (UTF-8 vs UTF-8-BOM) and line endings (LF vs CRLF vs mixed) from content bytes.
 */
export declare function detectFileMetadata(bytes: Uint8Array): {
    encoding: Encoding;
    lineEnding: LineEnding;
    cleanContent: string;
};
/**
 * Creates a DocumentSnapshot from a file path.
 */
export declare function createSnapshot(targetPath: string, allowedRoots: string[]): DocumentSnapshot;
/**
 * Helper class to map between JS character offsets and UTF-8 byte offsets.
 */
export declare class OffsetMapper {
    private charToByte;
    private byteToChar;
    constructor(bytes: Uint8Array, str: string);
    toByteOffset(charOffset: number): number;
    toCharOffset(byteOffset: number): number;
}
