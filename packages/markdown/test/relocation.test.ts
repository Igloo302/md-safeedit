import { describe, it, expect } from 'vitest';
import { parseMarkdownToNodes } from '../src/parser/parser.js';
import { buildLogicalSections } from '../src/sections/sections.js';
import { relocateNode, getPathFingerprint, explainRelocationFailure } from '../src/relocation/relocation.js';
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
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
    expect(relocated).toBeNull();
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
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

  // --- 15 RELOCATION EDGE-CASE UNIT TESTS ---

  it('relocates when duplicate headings exist in different parents, disambiguated by path fingerprint', () => {
    const mdInitial = `# Section A\n## Target\nParagraph\n# Section B\n## Target\nParagraph\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'heading' && n.content.includes('Target') && n.structuralPath[0].heading === 'Section B')!;
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.runtimeId === targetNode.parentRuntimeId)?.rawHash,
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# Section A\n## Target\nParagraph\n# Section B\n## Target\nParagraph\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('relocates duplicate headings in the same parent, disambiguated by sibling occurrence', () => {
    const mdInitial = `# Section A\n## Target\n## Target\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targets = nodesInitial.filter(n => n.type === 'heading' && n.content.includes('Target'));
    const targetNode = targets[1];
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.runtimeId === targetNode.parentRuntimeId)?.rawHash,
        siblingOccurrence: 2
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# Section A\n## Target\n## Target\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('successfully relocates duplicate headings in the same parent even if siblingOccurrence is undefined, thanks to tuple path fingerprint', () => {
    const mdInitial = `# Section A\n## Target\n## Target\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.filter(n => n.type === 'heading' && n.content.includes('Target'))[0];
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.runtimeId === targetNode.parentRuntimeId)?.rawHash,
        siblingOccurrence: undefined
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# Section A\n## Target\n## Target\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('relocates a nested list item when shifts occur around it', () => {
    const mdInitial = `- A\n  - B\n  - C\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'list_item' && n.content.trim() === '- C')!;
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.runtimeId === targetNode.parentRuntimeId)?.rawHash,
        siblingOccurrence: 2
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `- A\n  - PREPENDED\n  - B\n  - C\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content.trim()).toBe('- C');
  });

  it('relocates nodes successfully in files with CRLF line endings', () => {
    const mdInitial = `# Header\r\nParagraph CRLF\r\n`;
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.runtimeId === targetNode.parentRuntimeId)?.rawHash,
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# Header\r\nPrepended\r\n\r\nParagraph CRLF\r\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toBe('Paragraph CRLF');
  });

  it('relocates nodes containing CJK text and Emojis', () => {
    const mdInitial = `# 🌟 标题\n测试段落 🌸\n`;
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.runtimeId === targetNode.parentRuntimeId)?.rawHash,
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# 🌟 标题\n新插入的内容\n\n测试段落 🌸\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toBe('测试段落 🌸');
  });

  it('rejects relocation if structural evidence is entirely missing in the token', () => {
    const mdInitial = `# Section\nParagraph\n`;
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
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# Section\nUnrelated\n\nParagraph\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('rejects relocation if structural evidence score is below the threshold', () => {
    const mdInitial = `# Old Section\nParagraph\n`;
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
        pathFingerprint: getPathFingerprint([{ heading: 'Some Other Section', level: 1, occurrence: 1 }]),
        parentFingerprint: 'sha256:mismatchedparent',
        siblingOccurrence: 5
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# New Section\nParagraph\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('rejects relocation if multiple candidates have the same highest structural score', () => {
    const mdInitial = `# Section\nParagraph\n`;
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.runtimeId === targetNode.parentRuntimeId)?.rawHash,
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# Section\nParagraph\nParagraph\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('relocates paragraph when a new section is prepended, shifting index/distance', () => {
    const mdInitial = `# Title\nParagraph text.\n`;
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.runtimeId === targetNode.parentRuntimeId)?.rawHash,
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `# Preface\nIntroductory remarks.\n\n# Title\nParagraph text.\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toBe('Paragraph text.');
  });

  it('relocates table row when the table header styling changes', () => {
    const mdInitial = `| Col |\n|---|\n| Cell |\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.content === '| Cell |')!;
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.type === 'table')!.rawHash,
        siblingOccurrence: 2
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `| Col |\n| :--- |\n| Cell |\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toBe('| Cell |');
  });

  it('relocates code block when other code blocks are added', () => {
    const mdInitial = `\`\`\`typescript\nconst x = 1;\n\`\`\`\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'code_block')!;
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `\`\`\`javascript\nconst x = 1;\n\`\`\`\n\n\`\`\`typescript\nconst x = 1;\n\`\`\`\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toContain('typescript');
  });

  it('relocates block and scores block ID matches correctly', () => {
    const mdInitial = `Paragraph ^block-a\n`;
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
      blockId: 'block-a',
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        blockId: 'block-a'
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `Paragraph ^block-b\n\nParagraph ^block-a\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.blockId).toBe('block-a');
  });

  it('relocates frontmatter fields when ordering is modified', () => {
    const mdInitial = `---\na: 1\nb: 2\n---\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.content === 'b: 2')!;
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.type === 'frontmatter')!.rawHash,
        siblingOccurrence: 2
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `---\nb: 2\na: 1\n---\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content).toBe('b: 2');
  });

  it('relocates list item inside shifted list hierarchies', () => {
    const mdInitial = `- Parent 1\n  - Child 1\n- Parent 2\n  - Child 2\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'list_item' && n.content.trim() === '- Child 1')!;
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };
    const mdCurrent = `- Prepended\n- Parent 1\n  - Child 1\n- Parent 2\n  - Child 2\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.content.trim()).toBe('- Child 1');
  });

  // --- 15 SECURITY REGRESSION TESTS (PR 7) ---

  it('1. rejects when duplicate section is prepended', () => {
    const mdInitial = `# Target Section\nTarget paragraph\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'section')!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Target Section\nTarget paragraph\n\n# Target Section\nTarget paragraph\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('2. rejects when duplicate section is appended', () => {
    const mdInitial = `# Target Section\nTarget paragraph\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'section')!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Target Section\nTarget paragraph\n\n# Target Section\nTarget paragraph\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('3. rejects when duplicate parent section is created', () => {
    const mdInitial = `# Section\n## Target\nText\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'heading' && n.content.includes('Target'))!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        siblingOccurrence: 1
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Section\n## Target\nText\n\n# Section\n## Target\nText\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('4. rejects when original is deleted and only new copy remains', () => {
    const mdInitial = `# Section A\nItem X\n# Section B\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.content.trim() === 'Item X')!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.content.includes('Section A'))?.rawHash
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Section A\n# Section B\nItem X\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('5. rejects two identical headings and identical body paragraphs', () => {
    const mdInitial = `# Title\nParagraph\n`;
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath)
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Title\nParagraph\n\n# Title\nParagraph\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('6. rejects three identical list items', () => {
    const mdInitial = `- Item A\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'list_item')!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath)
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `- Item A\n- Item A\n- Item A\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('7. rejects three identical table rows', () => {
    const mdInitial = `| A | B |\n|---|---|\n| 1 | 2 |\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
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
        pathFingerprint: getPathFingerprint(targetNode.structuralPath)
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `| A | B |\n|---|---|\n| 1 | 2 |\n| 1 | 2 |\n| 1 | 2 |\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('8. rejects identical code block duplicates', () => {
    const mdInitial = '\`\`\`js\nconsole.log(1);\n\`\`\`\n';
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'code_block')!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath)
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = '\`\`\`js\nconsole.log(1);\n\`\`\`\n\n\`\`\`js\nconsole.log(1);\n\`\`\`\n';
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('9. rejects when new copy occupies the original byte range', () => {
    const mdInitial = `# Section\nTarget\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.content.includes('Target'))!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath)
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Section\nTarget\n\nTarget\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('10. rejects when new copy inherits the original occurrence', () => {
    const mdInitial = `# Section A\nTarget\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.content.includes('Target'))!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath)
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Section A\nTarget\n\nTarget\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('11. rejects when new copy is closer to old offset than original', () => {
    const mdInitial = `\n\n\nTarget\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.content.includes('Target'))!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath)
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `\nTarget\n` + `\n`.repeat(100) + `Target\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('12. rejects same content in different parent headings with same name', () => {
    const mdInitial = `# Section\nTarget\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'paragraph' && n.content.includes('Target'))!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        parentFingerprint: nodesInitial.find(n => n.type === 'section')!.rawHash
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Section\nTarget\n\n# Section\nTarget\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('13. relocates correctly when unique block ID is present on duplicates', () => {
    const mdInitial = `# Section A\nItem X ^block-a\n`;
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
      blockId: 'block-a',
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        blockId: 'block-a'
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Section A\nItem X ^block-a\n\n# Section B\nItem X ^block-b\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).not.toBeNull();
    expect(relocated!.blockId).toBe('block-a');
  });

  it('14. rejects block ID match if block ID is duplicated', () => {
    const mdInitial = `# Section A\nItem X ^block-a\n`;
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
      blockId: 'block-a',
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath),
        blockId: 'block-a'
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Section A\nItem X ^block-a\n\n# Section B\nItem X ^block-a\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);
    const relocated = relocateNode(token, nodesCurrent, bytesCurrent.length);
    expect(relocated).toBeNull();
  });

  it('15. returns ANCHOR_AMBIGUOUS for explainRelocationFailure on duplicates', () => {
    const mdInitial = `# Section\nTarget\n`;
    const bytesInitial = new TextEncoder().encode(mdInitial);
    const parsedInitial = parseMarkdownToNodes(bytesInitial, mdInitial);
    const nodesInitial = buildLogicalSections(parsedInitial, bytesInitial, mdInitial);
    const targetNode = nodesInitial.find(n => n.type === 'paragraph' && n.content.includes('Target'))!;
    
    const token: AnchorPayloadV1 = {
      version: 1,
      fileKey: 'test.md',
      sourceRevision: 'sha256:initial',
      range: targetNode.range,
      rawHash: targetNode.rawHash,
      nodeType: targetNode.type,
      structuralPath: targetNode.structuralPath,
      structuralEvidence: {
        pathFingerprint: getPathFingerprint(targetNode.structuralPath)
      },
      dialect: 'commonmark+gfm',
      issuedAt: Date.now()
    };

    const mdCurrent = `# Section\nTarget\n\n# Section\nTarget\n`;
    const bytesCurrent = new TextEncoder().encode(mdCurrent);
    const parsedCurrent = parseMarkdownToNodes(bytesCurrent, mdCurrent);
    const nodesCurrent = buildLogicalSections(parsedCurrent, bytesCurrent, mdCurrent);

    const candidates = nodesCurrent.filter(n => n.type === token.nodeType && n.rawHash === token.rawHash);
    const reason = explainRelocationFailure(token, candidates, nodesCurrent, bytesCurrent.length);
    expect(reason).toBe('ANCHOR_AMBIGUOUS');
  });
});
