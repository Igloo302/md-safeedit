import { z } from 'zod';
export const FileRefSchema = z.object({
    path: z.string()
});
export const NodeTypeSchema = z.enum([
    'document',
    'section',
    'heading',
    'paragraph',
    'list_item',
    'blockquote',
    'code_block',
    'list',
    'table',
    'table_row',
    'frontmatter',
    'frontmatter_field',
    'raw'
]);
export const StructuralPathSegmentSchema = z.object({
    heading: z.string(),
    level: z.number(),
    occurrence: z.number()
});
export const InspectRequestSchema = z.object({
    file: FileRefSchema,
    options: z.object({
        max_depth: z.number().optional().default(4),
        include_counts: z.boolean().optional().default(true)
    }).optional().default({})
});
export const SearchRequestSchema = z.object({
    file: FileRefSchema,
    query: z.string(),
    filters: z.object({
        include_types: z.array(NodeTypeSchema).optional(),
        exclude_types: z.array(NodeTypeSchema).optional(),
        under_path: z.array(StructuralPathSegmentSchema).optional()
    }).optional(),
    options: z.object({
        limit: z.number().optional().default(20),
        preview_chars: z.number().optional().default(160)
    }).optional().default({})
});
export const ReadRequestSchema = z.object({
    file: FileRefSchema,
    targets: z.array(z.object({
        runtime_id: z.string()
    })),
    options: z.object({
        include_neighbors: z.number().optional().default(0),
        include_children: z.boolean().optional().default(false)
    }).optional().default({})
});
export const PatchOperationSchema = z.discriminatedUnion('op', [
    z.object({
        op: z.literal('replace'),
        anchor_token: z.string(),
        content: z.string()
    }),
    z.object({
        op: z.literal('delete'),
        anchor_token: z.string()
    }),
    z.object({
        op: z.literal('insert_before'),
        anchor_token: z.string(),
        content: z.string()
    }),
    z.object({
        op: z.literal('insert_after'),
        anchor_token: z.string(),
        content: z.string()
    })
]);
export const PatchRequestSchema = z.object({
    file: FileRefSchema,
    operations: z.array(PatchOperationSchema),
    options: z.object({
        dry_run: z.boolean().optional().default(true),
        atomic: z.boolean().optional().default(true),
        validation_level: z.enum(['strict', 'normal', 'permissive']).optional().default('normal')
    }).optional().default({})
});
//# sourceMappingURL=schemas.js.map