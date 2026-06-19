import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { inspectService, searchService, readService, patchService } from '../src/services.js';
const tempDir = path.join(process.cwd(), 'packages/cli/test-temp');
describe('CLI Service Handlers', () => {
    const filePath = 'doc.md';
    const fullPath = path.join(tempDir, filePath);
    beforeEach(() => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const initialContent = `# Hardware\n## Battery\nThis is the charging paragraph.\n- Item A\n- Item B\n`;
        fs.writeFileSync(fullPath, initialContent);
    });
    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    it('inspects document outline correctly', () => {
        const res = inspectService({ file: { path: fullPath } }, [tempDir]);
        expect(res.ok).toBe(true);
        expect(res.outline.length).toBe(2);
        expect(res.outline[0].title).toBe('Hardware');
        expect(res.outline[1].title).toBe('Battery');
    });
    it('searches for nodes matching text query and filters', () => {
        const res = searchService({
            file: { path: fullPath },
            query: 'charging',
            filters: {
                include_types: ['paragraph']
            }
        }, [tempDir]);
        expect(res.ok).toBe(true);
        expect(res.matches.length).toBe(1);
        expect(res.matches[0].preview).toContain('charging');
        expect(res.matches[0].type).toBe('paragraph');
    });
    it('reads nodes and issues mutation-capable anchors', () => {
        // First inspect to get a runtime ID
        const inspectRes = inspectService({ file: { path: fullPath } }, [tempDir]);
        const sectionId = inspectRes.outline[1].runtime_id; // Battery section
        const readRes = readService({
            file: { path: fullPath },
            targets: [{ runtime_id: sectionId }]
        }, [tempDir]);
        expect(readRes.ok).toBe(true);
        expect(readRes.nodes.length).toBe(1);
        expect(readRes.nodes[0].content).toContain('Battery');
        expect(readRes.nodes[0].anchor_token).toMatch(/^mdse_a1_/);
    });
    it('applies a safe replace patch and commits atomically', () => {
        // 1. Inspect to get Battery section runtime ID
        const inspectRes = inspectService({ file: { path: fullPath } }, [tempDir]);
        const sectionId = inspectRes.outline[1].runtime_id;
        // 2. Read node to obtain the anchor token
        const readRes = readService({
            file: { path: fullPath },
            targets: [{ runtime_id: sectionId }]
        }, [tempDir]);
        const token = readRes.nodes[0].anchor_token;
        // 3. Dry run patch
        const patchDryRes = patchService({
            file: { path: fullPath },
            operations: [{
                    op: 'replace',
                    anchor_token: token,
                    content: `## Battery\nThis is the updated charging paragraph.\n- Item A\n- Item B\n`
                }],
            options: { dry_run: true }
        }, [tempDir]);
        expect(patchDryRes.ok).toBe(true);
        expect(patchDryRes.status).toBe('preview');
        expect(patchDryRes.diff).toContain('+This is the updated charging paragraph.');
        // Confirm original file is untouched in dry run
        expect(fs.readFileSync(fullPath, 'utf-8')).not.toContain('updated charging');
        // 4. Commit patch
        const patchCommitRes = patchService({
            file: { path: fullPath },
            operations: [{
                    op: 'replace',
                    anchor_token: token,
                    content: `## Battery\nThis is the updated charging paragraph.\n- Item A\n- Item B\n`
                }],
            options: { dry_run: false }
        }, [tempDir]);
        expect(patchCommitRes.ok).toBe(true);
        expect(patchCommitRes.status).toBe('committed');
        // Confirm write persisted
        expect(fs.readFileSync(fullPath, 'utf-8')).toContain('updated charging');
    });
    it('rejects patch if target changed concurrently', () => {
        // 1. Get token
        const inspectRes = inspectService({ file: { path: fullPath } }, [tempDir]);
        const sectionId = inspectRes.outline[1].runtime_id;
        const readRes = readService({
            file: { path: fullPath },
            targets: [{ runtime_id: sectionId }]
        }, [tempDir]);
        const token = readRes.nodes[0].anchor_token;
        // 2. Modify document outside MD SafeEdit (simulating concurrent edit)
        fs.writeFileSync(fullPath, `# Hardware\n## Battery\nThis is the charging paragraph.\n- Item A\n- Item B altered!\n`);
        // 3. Patch should fail with DOCUMENT_CHANGED (because file changed and revision mismatched)
        const patchRes = patchService({
            file: { path: fullPath },
            operations: [{
                    op: 'replace',
                    anchor_token: token,
                    content: '## Battery\nNew text\n'
                }],
            options: { dry_run: false }
        }, [tempDir]);
        expect(patchRes.ok).toBe(false);
        expect(patchRes.error.code).toBe('TARGET_CHANGED');
        // Original concurrent modification should remain intact
        expect(fs.readFileSync(fullPath, 'utf-8')).toContain('altered!');
    });
    it('relocates target node when file revision changes but target content is unchanged', () => {
        // 1. Get token for Battery section in original state
        const inspectRes = inspectService({ file: { path: fullPath } }, [tempDir]);
        const sectionId = inspectRes.outline[1].runtime_id;
        const readRes = readService({
            file: { path: fullPath },
            targets: [{ runtime_id: sectionId }]
        }, [tempDir]);
        const token = readRes.nodes[0].anchor_token;
        // 2. Prepend an unrelated heading and paragraph to the file, shifting offsets and changing revision
        fs.writeFileSync(fullPath, `# Preface\nIntroductory remarks.\n\n# Hardware\n## Battery\nThis is the charging paragraph.\n- Item A\n- Item B\n`);
        // 3. Patch should succeed because target content is raw-identical and structurally matched
        const patchRes = patchService({
            file: { path: fullPath },
            operations: [{
                    op: 'replace',
                    anchor_token: token,
                    content: '## Battery\nUpdated text in relocated section.\n'
                }],
            options: { dry_run: false }
        }, [tempDir]);
        expect(patchRes.ok).toBe(true);
        expect(patchRes.relocated).toBe(true);
        expect(patchRes.status).toBe('committed');
        // Verify file content reflects the patch
        const content = fs.readFileSync(fullPath, 'utf-8');
        expect(content).toContain('Updated text in relocated section.');
        expect(content).toContain('# Preface'); // Untouched parts are preserved
    });
});
//# sourceMappingURL=services.test.js.map