import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    base: '/app/',
    plugins: [react()],
    build: {
        outDir: '../www/app',
        emptyOutDir: true,
        sourcemap: false,
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
    },
});
