import { describe, it, expect } from 'vitest';
import { parseMarkdownToNodes } from '../src/parser/parser.js';
import { buildLogicalSections } from '../src/sections/sections.js';
describe('Markdown Parser & Sections Builder', () => {
    it('parses ATX headings and builds correct section nesting', () => {
        const md = `# Title\nIntro text\n## Subtitle\nMore text\n# Another Title\nFinal text\n`;
        const bytes = new TextEncoder().encode(md);
        const parsed = parseMarkdownToNodes(bytes, md);
        const nodes = buildLogicalSections(parsed, bytes, md);
        // Verify root is document
        const doc = nodes.find(n => n.type === 'document');
        expect(doc).toBeDefined();
        // Verify sections exist
        const sections = nodes.filter(n => n.type === 'section');
        expect(sections.length).toBe(3); // s_0 (Title), s_1 (Subtitle), s_2 (Another Title)
        // s_0 (Title) contains Subtitle section as a child since Subtitle is level 2
        const s0 = sections[0];
        const s1 = sections[1];
        const s2 = sections[2];
        expect(s0.structuralPath.length).toBe(1);
        expect(s0.structuralPath[0].heading).toBe('Title');
        expect(s1.parentRuntimeId).toBe(s0.runtimeId);
        expect(s1.structuralPath.length).toBe(2);
        expect(s1.structuralPath[1].heading).toBe('Subtitle');
        expect(s2.parentRuntimeId).toBe(doc.runtimeId);
        expect(s2.structuralPath.length).toBe(1);
        expect(s2.structuralPath[0].heading).toBe('Another Title');
    });
    it('tracks heading occurrences correctly', () => {
        const md = `# Hardware\n## Battery\n# Hardware\n## Battery\n`;
        const bytes = new TextEncoder().encode(md);
        const parsed = parseMarkdownToNodes(bytes, md);
        const nodes = buildLogicalSections(parsed, bytes, md);
        const sections = nodes.filter(n => n.type === 'section');
        expect(sections.length).toBe(4);
        // First H1
        expect(sections[0].structuralPath[0].occurrence).toBe(1);
        // First H2 under first H1
        expect(sections[1].structuralPath[1].occurrence).toBe(1);
        // Second H1
        expect(sections[2].structuralPath[0].occurrence).toBe(2);
        // Second H2 under second H1
        expect(sections[3].structuralPath[1].occurrence).toBe(1); // new parent section, so occurrence resets to 1!
    });
    it('slices node content exactly matching the raw bytes', () => {
        const md = `# Section 1\n\nSome paragraph text here.\n\n- List item 1\n- List item 2\n\n\`\`\`ts\nconst x = 1;\n\`\`\`\n`;
        const bytes = new TextEncoder().encode(md);
        const parsed = parseMarkdownToNodes(bytes, md);
        const nodes = buildLogicalSections(parsed, bytes, md);
        for (const node of nodes) {
            if (node.type === 'document')
                continue;
            const slicedBytes = bytes.subarray(node.range.start, node.range.end);
            const decoded = new TextDecoder('utf-8').decode(slicedBytes);
            // Verify the byte slice exactly equals the node's sliced content
            expect(decoded).toBe(node.content);
        }
    });
    it('handles frontmatter, code blocks, and tables', () => {
        const md = `---\ntitle: spec\n---\n# Table Section\n| Col 1 | Col 2 |\n|---|---|\n| cell 1 | cell 2 |\n`;
        const bytes = new TextEncoder().encode(md);
        const parsed = parseMarkdownToNodes(bytes, md);
        const nodes = buildLogicalSections(parsed, bytes, md);
        const fm = nodes.find(n => n.type === 'frontmatter');
        expect(fm).toBeDefined();
        expect(fm.content).toBe('---\ntitle: spec\n---');
        const tableRows = nodes.filter(n => n.type === 'table_row');
        expect(tableRows.length).toBe(2); // Header row + data row
        expect(tableRows[0].content).toBe('| Col 1 | Col 2 |');
        expect(tableRows[1].content).toBe('| cell 1 | cell 2 |');
    });
    it('handles Unicode and Emoji strings accurately', () => {
        const md = `# 🚀 Emoji Title\nThis is a paragraph with CJK: 汉字 and emoji 😂.\n`;
        const bytes = new TextEncoder().encode(md);
        const parsed = parseMarkdownToNodes(bytes, md);
        const nodes = buildLogicalSections(parsed, bytes, md);
        const titleSec = nodes.find(n => n.type === 'section');
        expect(titleSec.structuralPath[0].heading).toBe('🚀 Emoji Title');
        const p = nodes.find(n => n.type === 'paragraph');
        const slicedBytes = bytes.subarray(p.range.start, p.range.end);
        expect(new TextDecoder('utf-8').decode(slicedBytes)).toBe('This is a paragraph with CJK: 汉字 and emoji 😂.');
    });
    it('parses Obsidian block IDs and Callouts correctly', () => {
        const md = `# Header\nThis is a paragraph ^p-id-123\n\n> [!info]\n> Callout text\n`;
        const bytes = new TextEncoder().encode(md);
        const parsed = parseMarkdownToNodes(bytes, md);
        const nodes = buildLogicalSections(parsed, bytes, md);
        const p = nodes.find(n => n.type === 'paragraph');
        expect(p.blockId).toBe('p-id-123');
        const callout = nodes.find(n => n.type === 'blockquote');
        expect(callout.calloutType).toBe('info');
    });
    it('parses YAML frontmatter top-level fields as individual sub-nodes', () => {
        const md = `---\ntitle: spec\nstatus: draft\ntags:\n  - doc\n  - guide\n---\n# Title\n`;
        const bytes = new TextEncoder().encode(md);
        const parsed = parseMarkdownToNodes(bytes, md);
        const nodes = buildLogicalSections(parsed, bytes, md);
        const fm = nodes.find(n => n.type === 'frontmatter');
        expect(fm).toBeDefined();
        const fields = nodes.filter(n => n.type === 'frontmatter_field');
        expect(fields.length).toBe(3);
        expect(fields[0].content).toBe('title: spec');
        expect(fields[1].content).toBe('status: draft');
        expect(fields[2].content).toBe('tags:\n  - doc\n  - guide');
        // Verify parent-child relationship
        expect(fm.childRuntimeIds).toContain(fields[0].runtimeId);
        expect(fm.childRuntimeIds).toContain(fields[1].runtimeId);
        expect(fm.childRuntimeIds).toContain(fields[2].runtimeId);
    });
});
//# sourceMappingURL=parser.test.js.map