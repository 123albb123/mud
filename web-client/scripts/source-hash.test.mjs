import { relative } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { getSourceContentHash, listFingerprintFiles } from './source-hash.mjs';

const webClientRoot = cwd();

describe('source content build hash', () => {
    it('fingerprints stable source inputs without including www/app output', () => {
        const relativeFiles = listFingerprintFiles(webClientRoot)
            .map((filePath) => relative(webClientRoot, filePath).replaceAll('\\', '/'));

        expect(relativeFiles).toContain('package.json');
        expect(relativeFiles).toContain('index.html');
        expect(relativeFiles).toContain('vite.config.ts');
        expect(relativeFiles).toContain('scripts/build.mjs');
        expect(relativeFiles).toContain('src/pwa/pwa.ts');
        expect(relativeFiles).toContain('public/manifest.json');
        expect(relativeFiles.some((filePath) => filePath.startsWith('www/'))).toBe(false);

        const hash = getSourceContentHash(webClientRoot);
        expect(hash).toMatch(/^[0-9a-f]{8}$/);
        expect(getSourceContentHash(webClientRoot)).toBe(hash);
    });
});
