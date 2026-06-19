import { z } from 'zod';
export declare const FileRefSchema: z.ZodObject<{
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
}, {
    path: string;
}>;
export type FileRef = z.infer<typeof FileRefSchema>;
export declare const NodeTypeSchema: z.ZodEnum<["document", "section", "heading", "paragraph", "list_item", "blockquote", "code_block", "list", "table", "table_row", "frontmatter", "frontmatter_field", "raw"]>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export declare const StructuralPathSegmentSchema: z.ZodObject<{
    heading: z.ZodString;
    level: z.ZodNumber;
    occurrence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    heading: string;
    level: number;
    occurrence: number;
}, {
    heading: string;
    level: number;
    occurrence: number;
}>;
export type StructuralPathSegment = z.infer<typeof StructuralPathSegmentSchema>;
export declare const InspectRequestSchema: z.ZodObject<{
    file: z.ZodObject<{
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
    }, {
        path: string;
    }>;
    options: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        max_depth: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        include_counts: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        max_depth: number;
        include_counts: boolean;
    }, {
        max_depth?: number | undefined;
        include_counts?: boolean | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    file: {
        path: string;
    };
    options: {
        max_depth: number;
        include_counts: boolean;
    };
}, {
    file: {
        path: string;
    };
    options?: {
        max_depth?: number | undefined;
        include_counts?: boolean | undefined;
    } | undefined;
}>;
export type InspectRequest = z.infer<typeof InspectRequestSchema>;
export declare const SearchRequestSchema: z.ZodObject<{
    file: z.ZodObject<{
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
    }, {
        path: string;
    }>;
    query: z.ZodString;
    filters: z.ZodOptional<z.ZodObject<{
        include_types: z.ZodOptional<z.ZodArray<z.ZodEnum<["document", "section", "heading", "paragraph", "list_item", "blockquote", "code_block", "list", "table", "table_row", "frontmatter", "frontmatter_field", "raw"]>, "many">>;
        exclude_types: z.ZodOptional<z.ZodArray<z.ZodEnum<["document", "section", "heading", "paragraph", "list_item", "blockquote", "code_block", "list", "table", "table_row", "frontmatter", "frontmatter_field", "raw"]>, "many">>;
        under_path: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            level: z.ZodNumber;
            occurrence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            heading: string;
            level: number;
            occurrence: number;
        }, {
            heading: string;
            level: number;
            occurrence: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        include_types?: ("paragraph" | "document" | "section" | "heading" | "list_item" | "code_block" | "table_row" | "frontmatter" | "blockquote" | "list" | "table" | "raw" | "frontmatter_field")[] | undefined;
        exclude_types?: ("paragraph" | "document" | "section" | "heading" | "list_item" | "code_block" | "table_row" | "frontmatter" | "blockquote" | "list" | "table" | "raw" | "frontmatter_field")[] | undefined;
        under_path?: {
            heading: string;
            level: number;
            occurrence: number;
        }[] | undefined;
    }, {
        include_types?: ("paragraph" | "document" | "section" | "heading" | "list_item" | "code_block" | "table_row" | "frontmatter" | "blockquote" | "list" | "table" | "raw" | "frontmatter_field")[] | undefined;
        exclude_types?: ("paragraph" | "document" | "section" | "heading" | "list_item" | "code_block" | "table_row" | "frontmatter" | "blockquote" | "list" | "table" | "raw" | "frontmatter_field")[] | undefined;
        under_path?: {
            heading: string;
            level: number;
            occurrence: number;
        }[] | undefined;
    }>>;
    options: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        preview_chars: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        preview_chars: number;
    }, {
        limit?: number | undefined;
        preview_chars?: number | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    file: {
        path: string;
    };
    query: string;
    options: {
        limit: number;
        preview_chars: number;
    };
    filters?: {
        include_types?: ("paragraph" | "document" | "section" | "heading" | "list_item" | "code_block" | "table_row" | "frontmatter" | "blockquote" | "list" | "table" | "raw" | "frontmatter_field")[] | undefined;
        exclude_types?: ("paragraph" | "document" | "section" | "heading" | "list_item" | "code_block" | "table_row" | "frontmatter" | "blockquote" | "list" | "table" | "raw" | "frontmatter_field")[] | undefined;
        under_path?: {
            heading: string;
            level: number;
            occurrence: number;
        }[] | undefined;
    } | undefined;
}, {
    file: {
        path: string;
    };
    query: string;
    options?: {
        limit?: number | undefined;
        preview_chars?: number | undefined;
    } | undefined;
    filters?: {
        include_types?: ("paragraph" | "document" | "section" | "heading" | "list_item" | "code_block" | "table_row" | "frontmatter" | "blockquote" | "list" | "table" | "raw" | "frontmatter_field")[] | undefined;
        exclude_types?: ("paragraph" | "document" | "section" | "heading" | "list_item" | "code_block" | "table_row" | "frontmatter" | "blockquote" | "list" | "table" | "raw" | "frontmatter_field")[] | undefined;
        under_path?: {
            heading: string;
            level: number;
            occurrence: number;
        }[] | undefined;
    } | undefined;
}>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export declare const ReadRequestSchema: z.ZodObject<{
    file: z.ZodObject<{
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
    }, {
        path: string;
    }>;
    targets: z.ZodArray<z.ZodObject<{
        runtime_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        runtime_id: string;
    }, {
        runtime_id: string;
    }>, "many">;
    options: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        include_neighbors: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        include_children: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        include_neighbors: number;
        include_children: boolean;
    }, {
        include_neighbors?: number | undefined;
        include_children?: boolean | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    file: {
        path: string;
    };
    targets: {
        runtime_id: string;
    }[];
    options: {
        include_neighbors: number;
        include_children: boolean;
    };
}, {
    file: {
        path: string;
    };
    targets: {
        runtime_id: string;
    }[];
    options?: {
        include_neighbors?: number | undefined;
        include_children?: boolean | undefined;
    } | undefined;
}>;
export type ReadRequest = z.infer<typeof ReadRequestSchema>;
export declare const PatchOperationSchema: z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
    op: z.ZodLiteral<"replace">;
    anchor_token: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    op: "replace";
    anchor_token: string;
    content: string;
}, {
    op: "replace";
    anchor_token: string;
    content: string;
}>, z.ZodObject<{
    op: z.ZodLiteral<"delete">;
    anchor_token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    op: "delete";
    anchor_token: string;
}, {
    op: "delete";
    anchor_token: string;
}>, z.ZodObject<{
    op: z.ZodLiteral<"insert_before">;
    anchor_token: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    op: "insert_before";
    anchor_token: string;
    content: string;
}, {
    op: "insert_before";
    anchor_token: string;
    content: string;
}>, z.ZodObject<{
    op: z.ZodLiteral<"insert_after">;
    anchor_token: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    op: "insert_after";
    anchor_token: string;
    content: string;
}, {
    op: "insert_after";
    anchor_token: string;
    content: string;
}>]>;
export type PatchOperation = z.infer<typeof PatchOperationSchema>;
export declare const PatchRequestSchema: z.ZodObject<{
    file: z.ZodObject<{
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
    }, {
        path: string;
    }>;
    operations: z.ZodArray<z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
        op: z.ZodLiteral<"replace">;
        anchor_token: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        op: "replace";
        anchor_token: string;
        content: string;
    }, {
        op: "replace";
        anchor_token: string;
        content: string;
    }>, z.ZodObject<{
        op: z.ZodLiteral<"delete">;
        anchor_token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        op: "delete";
        anchor_token: string;
    }, {
        op: "delete";
        anchor_token: string;
    }>, z.ZodObject<{
        op: z.ZodLiteral<"insert_before">;
        anchor_token: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        op: "insert_before";
        anchor_token: string;
        content: string;
    }, {
        op: "insert_before";
        anchor_token: string;
        content: string;
    }>, z.ZodObject<{
        op: z.ZodLiteral<"insert_after">;
        anchor_token: z.ZodString;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        op: "insert_after";
        anchor_token: string;
        content: string;
    }, {
        op: "insert_after";
        anchor_token: string;
        content: string;
    }>]>, "many">;
    options: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        dry_run: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        atomic: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        validation_level: z.ZodDefault<z.ZodOptional<z.ZodEnum<["strict", "normal", "permissive"]>>>;
    }, "strip", z.ZodTypeAny, {
        dry_run: boolean;
        atomic: boolean;
        validation_level: "strict" | "normal" | "permissive";
    }, {
        dry_run?: boolean | undefined;
        atomic?: boolean | undefined;
        validation_level?: "strict" | "normal" | "permissive" | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    file: {
        path: string;
    };
    operations: ({
        op: "replace";
        anchor_token: string;
        content: string;
    } | {
        op: "delete";
        anchor_token: string;
    } | {
        op: "insert_before";
        anchor_token: string;
        content: string;
    } | {
        op: "insert_after";
        anchor_token: string;
        content: string;
    })[];
    options: {
        dry_run: boolean;
        atomic: boolean;
        validation_level: "strict" | "normal" | "permissive";
    };
}, {
    file: {
        path: string;
    };
    operations: ({
        op: "replace";
        anchor_token: string;
        content: string;
    } | {
        op: "delete";
        anchor_token: string;
    } | {
        op: "insert_before";
        anchor_token: string;
        content: string;
    } | {
        op: "insert_after";
        anchor_token: string;
        content: string;
    })[];
    options?: {
        dry_run?: boolean | undefined;
        atomic?: boolean | undefined;
        validation_level?: "strict" | "normal" | "permissive" | undefined;
    } | undefined;
}>;
export type PatchRequest = z.infer<typeof PatchRequestSchema>;
