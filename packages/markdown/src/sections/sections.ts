import * as crypto from 'crypto';
import { ByteRange } from '@igloo302/core';
import { MarkdownNode, StructuralPathSegment } from '../parser/parser.js';

/**
 * Extracts clean heading text by stripping leading/trailing '#' and trimming spaces.
 */
export function getCleanHeadingText(headingContent: string): string {
  return headingContent.replace(/^#+\s+/, '').replace(/\s+#+$/, '').trim();
}

/**
 * Reconstructs the node list to insert logical 'section' nodes.
 * Updates all parent/child pointers, propagates structural paths,
 * computes section byte ranges, and generates hashes for sections.
 */
export function buildLogicalSections(
  parsedNodes: MarkdownNode[],
  bytes: Uint8Array,
  content: string
): MarkdownNode[] {
  const nodeMap = new Map<string, MarkdownNode>();
  for (const node of parsedNodes) {
    // Clone nodes to avoid mutating the original parsed array
    nodeMap.set(node.runtimeId, { ...node, childRuntimeIds: [...node.childRuntimeIds] });
  }

  const documentNode = Array.from(nodeMap.values()).find(n => n.type === 'document');
  if (!documentNode) {
    return parsedNodes;
  }

  const resultNodes: MarkdownNode[] = [];
  const sectionPointers = new Map<string, string[]>(); // new section child ids
  
  // Track heading occurrences under each parent section/document node
  // key: parentId -> map of "level:text" -> count
  const occurrenceTracker = new Map<string, Map<string, number>>();

  let secCounter = 0;
  function nextSecId(): string {
    return `sec_${secCounter++}`;
  }

  // Active sections stack: level 0 is the document itself.
  interface ActiveSection {
    runtimeId: string;
    level: number;
    structuralPath: StructuralPathSegment[];
  }

  const stack: ActiveSection[] = [
    {
      runtimeId: documentNode.runtimeId,
      level: 0,
      structuralPath: []
    }
  ];

  // The document node's children are the top-level blocks in the AST
  const topLevelChildren = [...documentNode.childRuntimeIds];
  documentNode.childRuntimeIds = []; // We will rebuild this

  for (const childId of topLevelChildren) {
    const childNode = nodeMap.get(childId);
    if (!childNode) continue;

    if (childNode.type !== 'heading') {
      // Add to the active section at the top of the stack
      const active = stack[stack.length - 1];
      childNode.parentRuntimeId = active.runtimeId;
      
      if (active.runtimeId === documentNode.runtimeId) {
        documentNode.childRuntimeIds.push(childId);
      } else {
        let siblings = sectionPointers.get(active.runtimeId);
        if (!siblings) {
          siblings = [];
          sectionPointers.set(active.runtimeId, siblings);
        }
        siblings.push(childId);
      }
    } else {
      // It is a heading. Determine level.
      const headingLevel = childNode.level || 1;

      // Pop from stack until we find a section with level < headingLevel
      while (stack.length > 1 && stack[stack.length - 1].level >= headingLevel) {
        stack.pop();
      }

      const parentSection = stack[stack.length - 1];
      const sectionId = nextSecId();

      // Track occurrence
      let tracker = occurrenceTracker.get(parentSection.runtimeId);
      if (!tracker) {
        tracker = new Map<string, number>();
        occurrenceTracker.set(parentSection.runtimeId, tracker);
      }
      const headingText = getCleanHeadingText(childNode.content);
      const trackerKey = `${headingLevel}:${headingText}`;
      const occurrence = (tracker.get(trackerKey) || 0) + 1;
      tracker.set(trackerKey, occurrence);

      const segment: StructuralPathSegment = {
        heading: headingText,
        level: headingLevel,
        occurrence
      };

      const sectionPath = [...parentSection.structuralPath, segment];

      // Create the new section node
      const sectionNode: MarkdownNode = {
        runtimeId: sectionId,
        type: 'section',
        range: { start: childNode.range.start, end: childNode.range.end }, // temporary
        parentRuntimeId: parentSection.runtimeId,
        childRuntimeIds: [childNode.runtimeId],
        structuralPath: sectionPath,
        rawHash: '', // temporary
        content: ''  // temporary
      };

      nodeMap.set(sectionId, sectionNode);
      sectionPointers.set(sectionId, [childNode.runtimeId]);

      // Update heading node parent and path
      childNode.parentRuntimeId = sectionId;
      childNode.structuralPath = sectionPath;

      // Add section to parent's children
      if (parentSection.runtimeId === documentNode.runtimeId) {
        documentNode.childRuntimeIds.push(sectionId);
      } else {
        let siblings = sectionPointers.get(parentSection.runtimeId);
        if (!siblings) {
          siblings = [];
          sectionPointers.set(parentSection.runtimeId, siblings);
        }
        siblings.push(sectionId);
      }

      // Push to stack
      stack.push({
        runtimeId: sectionId,
        level: headingLevel,
        structuralPath: sectionPath
      });
    }
  }

  // Update all childRuntimeIds for sections in nodeMap
  for (const [secId, children] of sectionPointers.entries()) {
    const secNode = nodeMap.get(secId);
    if (secNode) {
      secNode.childRuntimeIds = children;
    }
  }

  // Recursive post-order helper to:
  // 1. Propagate structural paths down the tree
  // 2. Compute range, contentRange, rawHash, and content for section nodes
  function finalizeNode(nodeId: string, currentPath: StructuralPathSegment[]): ByteRange {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return { start: 0, end: 0 };
    }

    if (node.type !== 'section' && node.type !== 'document') {
      node.structuralPath = currentPath;
    }

    if (node.type !== 'section') {
      // For leaf or standard block nodes, recursively process children but keep original ranges
      for (const childId of node.childRuntimeIds) {
        finalizeNode(childId, currentPath);
      }
      return node.range;
    }

    // For logical sections:
    const headingId = node.childRuntimeIds[0];
    const headingNode = nodeMap.get(headingId)!;

    // Process all children (heading + body blocks + nested sections)
    let minStart = headingNode.range.start;
    let maxEnd = headingNode.range.end;

    // Heading child has the section path
    finalizeNode(headingId, node.structuralPath);

    // Body children inherit the section path
    for (let i = 1; i < node.childRuntimeIds.length; i++) {
      const childRange = finalizeNode(node.childRuntimeIds[i], node.structuralPath);
      minStart = Math.min(minStart, childRange.start);
      maxEnd = Math.max(maxEnd, childRange.end);
    }

    node.range = { start: minStart, end: maxEnd };
    node.contentRange = { start: headingNode.range.end, end: maxEnd };

    // Update section raw hash and slice content
    const sectionBytes = bytes.subarray(node.range.start, node.range.end);
    node.rawHash = `sha256:${crypto.createHash('sha256').update(sectionBytes).digest('hex')}`;
    
    // Slice string content
    const textDecoder = new TextDecoder('utf-8');
    node.content = textDecoder.decode(sectionBytes);

    return node.range;
  }

  // Finalize document root
  finalizeNode(documentNode.runtimeId, []);

  // Return nodes in a stable order (e.g. topological/pre-order)
  const orderedNodes: MarkdownNode[] = [];
  function collect(nodeId: string) {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    orderedNodes.push(node);
    for (const childId of node.childRuntimeIds) {
      collect(childId);
    }
  }
  collect(documentNode.runtimeId);

  return orderedNodes;
}
