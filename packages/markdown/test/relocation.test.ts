import { describe, it, expect } from 'vitest';
import { parseMarkdownToNodes } from '../src/parser/parser.js';
import { buildLogicalSections } from '../src/sections/sections.js';
import { relocateNode } from '../src/relocation/relocation.js';
import { AnchorPayloadV1 } from '@md-safeedit/protocol';

describe('Exact Relocation Scoring Engine', () => {
  it('relocates an unchanged paragraph when content is inserted before it', () => {
    // 1. Initial document state
    const mdInitial = `# Section 1\nThis is the target paragraph.\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);

    const targetNode = nodesInitial.find(n => n.type === 'paragraph')!;

    // Build the mock token payload simulating a read operation on the initial document
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initialrevisionhash',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: 'Section 1',
        parentFingerprint: nodesInitial.find(n => n.type === 'section')!.rawHash,
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    // 2. Updated document state (an unrelated paragraph is prepended, changing revision and byte offsets)
    const mdCurrent = `# Section 1\nSome prepended text.\n\nThis is the target paragraph.\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);

    // Call relocate
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeDefined();
    expect(relocated!.content).toBe('This is the target paragraph.');
    expect(relocated!.range.start).not.toBe(targetNode.range.start); // range offset shifted
  });

  it('rejects relocation if multiple identical candidates create ambiguity', () => {
    // 1. Initial state
    const mdInitial = `# Section 1\nDuplicate item\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'paragraph')!;

    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: 'Section 1',
        parentFingerprint: nodesInitial.find(n => n.type === 'section')!.rawHash,
        siblingOccurrence: undefined
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    // 2. Current state has two identical paragraphs under the same section, causing tie score
    const mdCurrent = `# Section 1\nDuplicate item\n\nDuplicate item\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);

    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull(); // Rejected as ambiguous
  });

  it('prioritizes a candidate with a higher structural score over a candidate with a lower structural score but closer distance', () => {
    // 1. Initial state
    const mdInitial = `# Section A\nItem X\n\nItem X\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    
    // We target the second "Item X" under Section A (sibling occurrence = 2)
    const targetNode = nodesInitial.filter(n => n.type === 'paragraph')[1]!;

    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: 'Section A',
        parentFingerprint: nodesInitial.find(n => n.type === 'section')!.rawHash,
        siblingOccurrence: 2
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    // 2. Current state:
    // Candidate 1: The first "Item X" under Section A (sibling occurrence = 1).
    // It is located at the exact original offset of the first paragraph, meaning distance = 0 (distance score = 5).
    // Its structural score is 25 (heading path matches, but sibling occurrence does not). Total score = 30.
    // Candidate 2: The second "Item X" under Section A (sibling occurrence = 2).
    // It is shifted far down, so its distance score is 0.
    // Its structural score is 30 (heading path matches + sibling occurrence matches). Total score = 30.
    // We want to make sure Candidate 2 is selected because it is structurally stronger (score 30 vs 25),
    // even though Candidate 1 has a higher distance score.
    const mdCurrent = `# Section A\nItem X\n` + `\n`.repeat(100) + `Item X\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);

    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    // It must select Candidate 2 (the second paragraph)
    const paragraphs = nodesCurrent.filter(n => n.type === 'paragraph');
    expect(relocated!.range.start).toBe(paragraphs[1].range.start);
  });

  it('relocates using Obsidian block ID as a strong anchor', () => {
    // 1. Initial state
    const mdInitial = `# Section A\nItem X ^my-block-1\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'paragraph')!;

    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      blockId: 'my-block-1',
      structuralEvidence: {
        pathFingerprint: 'Section A',
        parentFingerprint: nodesInitial.find(n => n.type === 'section')!.rawHash,
        blockId: 'my-block-1'
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    // 2. Current state (paragraph moved to Section B but block ID is preserved)
    const mdCurrent = `# Section B\nItem X ^my-block-1\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);

    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.blockId).toBe('my-block-1');
  });

  it('relocates a table row when a table column or prepended text shifts it', () => {
    // 1. Initial state
    const mdInitial = `# Table Section\n| Col 1 | Col 2 |\n|---|---|\n| cell 1 | cell 2 |\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    
    // Target the data row
    const targetNode = nodesInitial.filter(n => n.type === 'table_row')[1]!;

    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: 'Table Section',
        parentFingerprint: nodesInitial.find(n => n.type === 'table')!.rawHash,
        siblingOccurrence: 2 // Second row in the table
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    // 2. Current state (shifted by text inserted before the table)
    const mdCurrent = `# Table Section\nSome description text before table.\n\n| Col 1 | Col 2 |\n|---|---|\n| cell 1 | cell 2 |\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);

    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toBe('| cell 1 | cell 2 |');
  });

  it('relocates a list item inside a nested list when list items are shifted', () => {
    // 1. Initial state
    const mdInitial = `# List Section\n- Item A\n- Item B\n  - Nested 1\n  - Nested 2\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    
    // Target the "Nested 2" list item
    const targetNode = nodesInitial.find(n => n.content === '- Nested 2')!;

    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: 'List Section',
        siblingOccurrence: 2 // Second item under its parent sublist
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    // 2. Current state (an item is prepended at the top level of the list)
    const mdCurrent = `# List Section\n- Prepended Item\n- Item A\n- Item B\n  - Nested 1\n  - Nested 2\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);

    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toBe('- Nested 2');
  });

  it('relocates a frontmatter field when fields around it are modified, added, or removed', () => {
    // 1. Initial state
    const mdInitial = `---\ntitle: spec\nstatus: draft\ntags:\n  - doc\n  - guide\n---\n# Title\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);

    // Target the "status: draft" field
    const targetNode = nodesInitial.find(n => n.content === 'status: draft')!;

    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: '',
        parentFingerprint: nodesInitial.find(n => n.type === 'frontmatter')!.rawHash,
        siblingOccurrence: 2
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    // 2. Current state
    const mdCurrent = `---\nauthor: Google\ntitle: MD SafeEdit\nstatus: draft\ntags:\n  - doc\n  - guide\n---\n# Title\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);

    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toBe('status: draft');
  });
});
