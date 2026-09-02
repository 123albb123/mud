import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { serviceWorkerTemplate } from './serviceWorkerTemplate';

class TestResponse {
    constructor(body, status = 200) {
        this.body = body;
        this.status = status;
        this.ok = status >= 200 && status < 300;
    }

    clone() {
        return new TestResponse(this.body, this.status);
    }

    static error() {
        return new TestResponse('', 0);
    }
}

const requestPath = (request) => {
    const url = typeof request === 'string' ? new URL(request, 'https://mud.example.test') : new URL(request.url);
    return url.pathname;
};

const createWorker = (cachedPaths = [], clients = []) => {
    const listeners = new Map();
    const entries = new Map(cachedPaths.map((path) => [path, new TestResponse(`cached:${path}`)]));
    const networkFetch = vi.fn(async () => {
        throw new TypeError('offline');
    });
    const cache = {
        addAll: vi.fn(async () => undefined),
        put: vi.fn(async (request, response) => {
            entries.set(requestPath(request), response);
        }),
    };
    const caches = {
        delete: vi.fn(async () => true),
        keys: vi.fn(async () => ['yanhuang-web-old']),
        match: vi.fn(async (request) => entries.get(requestPath(request))),
        open: vi.fn(async () => cache),
    };
    const openWindow = vi.fn(async () => undefined);
    const selfObject = {
        addEventListener: (type, handler) => listeners.set(type, handler),
        clients: {
            claim: vi.fn(async () => undefined),
            matchAll: vi.fn(async () => clients),
            openWindow,
        },
        location: { origin: 'https://mud.example.test' },
        skipWaiting: vi.fn(),
    };
    const source = serviceWorkerTemplate
        .replace('__CACHE_NAME__', JSON.stringify('yanhuang-web-v0.1.0-testhash'))
        .replace('__PRECACHE_ENTRIES__', JSON.stringify([
            '/app/index.html',
            '/app/manifest.json',
            '/app/assets/index.js',
        ]));
    runInNewContext(source, {
        Promise,
        Response: TestResponse,
        Set,
        URL,
        caches,
        fetch: networkFetch,
        self: selfObject,
    });
    return { cache, caches, entries, listeners, networkFetch, openWindow };
};

const dispatchFetch = async (worker, request) => {
    const event = {
        request,
        respondWith: (response) => {
            event.response = response;
        },
    };
    worker.listeners.get('fetch')?.(event);
    return event.response;
};

describe('generated Service Worker behavior', () => {
    it('pre-caches the App Shell and removes old versioned caches', async () => {
        const worker = createWorker();
        const installEvent = {
            waitUntil(promise) { this.promise = promise; },
        };
        worker.listeners.get('install')?.(installEvent);
        await installEvent.promise;
        expect(worker.cache.addAll).toHaveBeenCalledWith([
            '/app/index.html',
            '/app/manifest.json',
            '/app/assets/index.js',
        ]);

        const activateEvent = {
            waitUntil(promise) { this.promise = promise; },
        };
        worker.listeners.get('activate')?.(activateEvent);
        await activateEvent.promise;
        expect(worker.caches.delete).toHaveBeenCalledWith('yanhuang-web-old');
    });

    it('falls back to the App Shell only for navigation requests', async () => {
        const worker = createWorker(['/app/index.html']);
        const navigation = await dispatchFetch(worker, {
            destination: 'document',
            method: 'GET',
            mode: 'navigate',
            url: 'https://mud.example.test/app/room',
        });
        expect(navigation.body).toBe('cached:/app/index.html');

        for (const [destination, path] of [
            ['script', '/app/assets/missing.js'],
            ['style', '/app/assets/missing.css'],
            ['image', '/app/icons/missing.png'],
            ['font', '/app/assets/missing.woff2'],
            ['manifest', '/app/manifest.json'],
        ]) {
            const response = await dispatchFetch(worker, {
                destination,
                method: 'GET',
                mode: 'no-cors',
                url: `https://mud.example.test${path}`,
            });
            expect(response.status).toBe(0);
            expect(response.body).not.toContain('cached:/app/index.html');
        }
    });

    it('returns cached static assets without going to the network', async () => {
        const worker = createWorker(['/app/assets/index.js']);
        const response = await dispatchFetch(worker, {
            destination: 'script',
            method: 'GET',
            mode: 'no-cors',
            url: 'https://mud.example.test/app/assets/index.js',
        });

        expect(response.body).toBe('cached:/app/assets/index.js');
        expect(worker.networkFetch).not.toHaveBeenCalled();
    });

    it('focuses an existing App client or opens the App Shell', async () => {
        const focus = vi.fn(async () => undefined);
        const existingWorker = createWorker([], [{ focus, url: 'https://mud.example.test/app/index.html' }]);
        const existingEvent = {
            notification: { close: vi.fn() },
            waitUntil(promise) { this.promise = promise; },
        };
        existingWorker.listeners.get('notificationclick')?.(existingEvent);
        await existingEvent.promise;
        expect(existingEvent.notification.close).toHaveBeenCalledOnce();
        expect(focus).toHaveBeenCalledOnce();
        expect(existingWorker.openWindow).not.toHaveBeenCalled();

        const newWorker = createWorker();
        const newEvent = {
            notification: { close: vi.fn() },
            waitUntil(promise) { this.promise = promise; },
        };
        newWorker.listeners.get('notificationclick')?.(newEvent);
        await newEvent.promise;
        expect(newEvent.notification.close).toHaveBeenCalledOnce();
        expect(newWorker.openWindow).toHaveBeenCalledWith('/app/index.html');
    });
});
