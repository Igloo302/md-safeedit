export interface BaselineResult {
    ok: boolean;
    status?: string;
    error?: string;
}
/**
 * B1: Full-File Rewrite
 * Overwrites the entire file blindly with the planned content from the original snapshot.
 */
export declare function runFullFileRewrite(filePath: string, initialContent: string, targetRange: {
    start: number;
    end: number;
}, replacementContent: string): BaselineResult;
/**
 * B2: Exact String Replacement
 * Finds the exact target original content in the current file.
 * Replaces it if uniquely found; rejects if missing or ambiguous.
 */
export declare function runExactStringReplace(filePath: string, targetNodeContent: string, replacementContent: string): BaselineResult;
/**
 * B3: Unified Diff
 * Generates a unified diff from initialContent -> initialContentWithEdit.
 * Tries to apply this diff to the current file, allowing for line shifts.
 */
export declare function runUnifiedDiff(filePath: string, initialContent: string, targetRange: {
    start: number;
    end: number;
}, replacementContent: string): BaselineResult;
/**
 * B4: Line-Range Hash Patch
 * Agent targets a specific line range and verifies its content hash.
 */
export declare function runLineHashPatch(filePath: string, initialContent: string, targetRange: {
    start: number;
    end: number;
}, replacementContent: string): BaselineResult;
/**
 * B5: MD SafeEdit
 * Uses the safe read-patch protocol with relocation support.
 */
export declare function runMDSafeEdit(filePath: string, initialContent: string, currentContent: string, targetRuntimeId: string, replacementContent: string, allowedRoots: string[]): BaselineResult;
