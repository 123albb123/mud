import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../protocol/gmcp/gmcp';
import {
    createPrecacheEntries,
    getCacheName,
    getInstallPlatform,
    getNotificationPermission,
    isIosSafari,
    isSafeMudUrl,
    isStandaloneMode,
    notificationBody,
    notificationTitle,
    shouldNotifyForChat,
    truncateNotificationText,
} from './pwa';

const incomingTell: ChatMessage = {
    version: 1,
    message_id: 'm-notification-1',
    timestamp: 1,
    kind: 'tell',
    direction: 'in',
    sender: { name: '张三', id: 'player-1' },
    text: '江湖见。',
};

describe('PWA utilities', () => {
    it('creates a versioned cache name and only precaches app assets', () => {
        expect(getCacheName('0.1.0', 'fd36891')).toBe('yanhuang-web-v0.1.0-fd36891');
        expect(createPrecacheEntries(['assets/index.js', 'assets/index.css', 'chunks/chunk.js'])).toEqual([
            '/app/index.html',
            '/app/manifest.json',
            '/app/icons/icon-192.png',
            '/app/icons/icon-512.png',
            '/app/icons/icon-maskable-512.png',
            '/app/icons/apple-touch-icon.png',
            '/app/assets/index.js',
            '/app/assets/index.css',
        ]);
    });

    it('detects standalone mode through media query or iOS navigator fallback', () => {
        expect(isStandaloneMode({ matchMedia: () => ({ matches: true }) })).toBe(true);
        expect(isStandaloneMode({ navigator: { standalone: true } })).toBe(true);
        expect(isStandaloneMode({ matchMedia: () => ({ matches: false }), navigator: { standalone: false } })).toBe(false);
    });

    it('distinguishes iOS Safari from other mobile browsers', () => {
        const safari = {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
            vendor: 'Apple Computer, Inc.',
            maxTouchPoints: 5,
        };
        expect(isIosSafari(safari)).toBe(true);
        expect(getInstallPlatform(safari)).toBe('ios-safari');
        expect(getInstallPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' })).toBe('android');
        expect(getInstallPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' })).toBe('desktop');
    });

    it('only notifies for incoming private messages while the page is unfocused', () => {
        expect(shouldNotifyForChat(incomingTell, false)).toBe(true);
        expect(shouldNotifyForChat(incomingTell, true)).toBe(false);
        expect(shouldNotifyForChat({ ...incomingTell, kind: 'say' }, false)).toBe(false);
        expect(shouldNotifyForChat({ ...incomingTell, direction: 'out' }, false)).toBe(false);
        expect(notificationTitle(incomingTell)).toBe('张三发来消息');
        expect(notificationBody(incomingTell, 'summary')).toBe('收到新消息');
        expect(notificationBody(incomingTell, 'body')).toBe('江湖见。');
    });

    it('does not expose excessive notification text or credentials in stored URLs', () => {
        expect(truncateNotificationText('a'.repeat(130))).toHaveLength(120);
        expect(isSafeMudUrl('ws://127.0.0.1:8888')).toBe(true);
        expect(isSafeMudUrl('wss://example.com:8888')).toBe(true);
        expect(isSafeMudUrl('ws://user:password@example.com:8888')).toBe(false);
        expect(isSafeMudUrl('ws://example.com:8888/?token=secret')).toBe(false);
    });

    it('reports unsupported notification APIs honestly', () => {
        expect(getNotificationPermission({})).toBe('unsupported');
        expect(getNotificationPermission({ Notification: { permission: 'default', requestPermission: async () => 'granted' } })).toBe('default');
        expect(getNotificationPermission({ Notification: { permission: 'denied', requestPermission: async () => 'denied' } })).toBe('denied');
    });
});
