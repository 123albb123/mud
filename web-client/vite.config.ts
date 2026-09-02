import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import packageJson from './package.json' with { type: 'json' };
import { serviceWorkerTemplate } from './src/pwa/serviceWorkerTemplate.js';

const staticAppPaths = [
    '/app/index.html',
    '/app/manifest.json',
    '/app/icons/icon-192.png',
    '/app/icons/icon-512.png',
    '/app/icons/icon-maskable-512.png',
    '/app/icons/apple-touch-icon.png',
];

const stageSevenServiceWorker = (buildHash: string): Plugin => ({
    name: 'stage-seven-service-worker',
    generateBundle(_options, bundle) {
        const assetPaths = Object.keys(bundle)
            .filter((fileName) => fileName.startsWith('assets/'))
            .map((fileName) => `/app/${fileName}`);
        const precacheEntries = [...new Set([...staticAppPaths, ...assetPaths])];
        const cacheName = `yanhuang-web-v${packageJson.version}-${buildHash}`;
        const source = serviceWorkerTemplate
            .replace('__CACHE_NAME__', JSON.stringify(cacheName))
            .replace('__PRECACHE_ENTRIES__', JSON.stringify(precacheEntries));
        this.emitFile({ type: 'asset', fileName: 'service-worker.js', source });
    },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const buildHash = env.VITE_BUILD_HASH || 'local';
    return {
        base: '/app/',
        plugins: [react(), stageSevenServiceWorker(buildHash)],
        build: {
            outDir: '../www/app',
            emptyOutDir: true,
            sourcemap: false,
        },
        test: {
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
        },
    };
});
