export interface StructuralEvidence {
    pathFingerprint: string;
    parentFingerprint?: string;
    previousFingerprint?: string;
    nextFingerprint?: string;
    siblingOccurrence?: number;
    blockId?: string;
}
export interface AnchorPayloadV1 {
    version: 1;
    fileKey: string;
    sourceRevision: string;
    range: {
        start: number;
        end: number;
    };
    rawHash: string;
    nodeType: string;
    structuralPath: {
        heading: string;
        level: number;
        occurrence: number;
    }[];
    structuralEvidence?: StructuralEvidence;
    blockId?: string;
    dialect: string;
    issuedAt: number;
    expiresAt?: number;
}
/**
 * Creates a signed, tamper-proof, opaque anchor token.
 */
export declare function createToken(payload: AnchorPayloadV1): string;
/**
 * Verifies a token's signature and expiry, returning the decoded payload on success.
 * Throws errors with stable codes: ANCHOR_INVALID, ANCHOR_EXPIRED.
 */
export declare function verifyToken(token: string): AnchorPayloadV1;
