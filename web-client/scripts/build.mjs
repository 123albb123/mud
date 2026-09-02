import { execFileSync, spawnSync } from 'node:child_process';

const getBuildHash = () => {
    if (process.env.VITE_BUILD_HASH) {
        return process.env.VITE_BUILD_HASH;
    }
    try {
        return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() || 'local';
    } catch {
        return 'local';
    }
};

const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
    env: { ...process.env, VITE_BUILD_HASH: getBuildHash() },
    stdio: 'inherit',
});

if (result.error) {
    console.error(result.error);
}
process.exit(result.status ?? 1);
