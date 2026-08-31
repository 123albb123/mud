import { describe, expect, it } from 'vitest';
import { parseGMCP, toCharacterVitals, toRoomInfo } from './gmcp';

const encode = (value: string) => new TextEncoder().encode(value);

describe('GMCP codec', () => {
    it('parses normal JSON', () => {
        const message = parseGMCP(encode('Char.Vitals {"hp":856,"max_hp":1000}'));
        expect(message.packageName).toBe('Char.Vitals');
        expect(message.payload).toEqual({ hp: 856, max_hp: 1000 });
        expect(toCharacterVitals(message.payload)).toMatchObject({ hp: 856, max_hp: 1000 });
    });

    it('accepts an empty payload', () => {
        expect(parseGMCP(encode('Char.Vitals.Get'))).toEqual({
            packageName: 'Char.Vitals.Get',
            payload: null,
            rawPayload: '',
        });
    });

    it('reports bad JSON without throwing', () => {
        const message = parseGMCP(encode('Room.Info {bad json'));
        expect(message.packageName).toBe('Room.Info');
        expect(message.payload).toBeNull();
        expect(message.error).toBeTruthy();
    });

    it('leaves unknown packages available to logging or ignore logic', () => {
        const message = parseGMCP(encode('Future.Package {"ok":true}'));
        expect(message.packageName).toBe('Future.Package');
        expect(message.payload).toEqual({ ok: true });
    });

    it('normalizes Room.Info without inventing fields', () => {
        expect(toRoomInfo({ name: '客店', exits: ['west', 7, 'south'] })).toEqual({
            name: '客店',
            area: undefined,
            exits: ['west', 'south'],
            room_id: undefined,
            hash: undefined,
        });
    });
});
