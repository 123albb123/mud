import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const fingerprintInputs = ['package.json', 'index.html', 'vite.config.ts', 'scripts/build.mjs', 'scripts/source-hash.mjs'];
const fingerprintDirectories = ['src', 'public'];
const compareNames = (left, right) => left < right ? -1 : left > right ? 1 : 0;

const collectFiles = (root, relativePath) => {
    const absolutePath = join(root, relativePath);
    if (statSync(absolutePath).isFile()) {
        return [absolutePath];
    }
    return readdirSync(absolutePath, { withFileTypes: true })
        .sort((left, right) => compareNames(left.name, right.name))
        .flatMap((entry) => collectFiles(root, join(relativePath, entry.name)));
};

export const listFingerprintFiles = (root) => [
    ...fingerprintInputs.map((filePath) => join(root, filePath)),
    ...fingerprintDirectories.flatMap((directoryPath) => collectFiles(root, directoryPath)),
].sort((left, right) => compareNames(
    relative(root, left).split(sep).join('/'),
    relative(root, right).split(sep).join('/'),
));

export const getSourceContentHash = (root, length = 8) => {
    const hash = createHash('sha256');
    for (const filePath of listFingerprintFiles(root)) {
        const normalizedPath = relative(root, filePath).split(sep).join('/');
        hash.update(normalizedPath);
        hash.update('\0');
        hash.update(readFileSync(filePath));
        hash.update('\0');
    }
    return hash.digest('hex').slice(0, length);
};
