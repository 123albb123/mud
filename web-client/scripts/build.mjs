import { spawnSync } from 'node:child_process';
import { getSourceContentHash } from './source-hash.mjs';

const getBuildHash = () => {
    return getSourceContentHash(process.cwd());
};

const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
    env: { ...process.env, VITE_BUILD_HASH: getBuildHash() },
    stdio: 'inherit',
});

if (result.error) {
    console.error(result.error);
}
process.exit(result.status ?? 1);
