import { InspectRequest, SearchRequest, ReadRequest, PatchRequest } from '@md-safeedit/protocol';
export interface ServiceError {
    code: string;
    message: string;
    retryable: boolean;
    recommended_action: string;
    details?: any;
}
export declare function formatError(code: string, message: string, details?: any): {
    ok: false;
    error: ServiceError;
};
/**
 * Service: inspect
 */
export declare function inspectService(request: InspectRequest, allowedRoots: string[]): {
    ok: false;
    error: ServiceError;
} | {
    ok: boolean;
    protocol_version: string;
    document: {
        display_path: string;
        revision: string;
        dialect: string;
        size_bytes: number;
        line_ending: import("@md-safeedit/core").LineEnding;
    };
    outline: {
        runtime_id: string;
        type: string;
        title: string;
        level: number;
        path: {
            heading: string;
            level: number;
            occurrence: number;
        }[];
        child_count: number;
    }[];
    warnings: never[];
};
/**
 * Service: search
 */
export declare function searchService(request: SearchRequest, allowedRoots: string[]): {
    ok: false;
    error: ServiceError;
} | {
    ok: boolean;
    document_revision: string;
    matches: {
        runtime_id: string;
        type: import("@md-safeedit/markdown").NodeType;
        path: {
            heading: string;
            level: number;
            occurrence: number;
        }[];
        preview: string;
        match_ranges: {
            start: number;
            end: number;
        }[];
    }[];
};
/**
 * Service: read
 */
export declare function readService(request: ReadRequest, allowedRoots: string[]): {
    ok: false;
    error: ServiceError;
} | {
    ok: boolean;
    document_revision: string;
    nodes: any[];
};
/**
 * Service: patch
 */
export declare function patchService(request: PatchRequest, allowedRoots: string[]): {
    ok: false;
    error: ServiceError;
} | {
    ok: boolean;
    status: string;
    source_revision: string;
    result_revision: string;
    relocated: boolean;
    diff: string;
    operations: any[];
    warnings: never[];
    new_revision?: undefined;
} | {
    ok: boolean;
    status: string;
    source_revision: string;
    new_revision: string;
    relocated: boolean;
    diff: string;
    operations: any[];
    result_revision?: undefined;
    warnings?: undefined;
};
