import { describe, expect, it } from 'vitest';
import { defaultMudUrl } from './useMudClient';

describe('defaultMudUrl', () => {
    it('uses the current HTTP host and preserves its port', () => {
        expect(defaultMudUrl({ protocol: 'http:', host: '192.168.1.20:8888' })).toBe('ws://192.168.1.20:8888');
    });

    it('uses same-origin WSS for Lucky HTTPS without appending 8888', () => {
        expect(defaultMudUrl({ protocol: 'https:', host: 'mud.example.test' })).toBe('wss://mud.example.test');
        expect(defaultMudUrl({ protocol: 'https:', host: 'mud.example.test:8443' })).toBe('wss://mud.example.test:8443');
    });
});
