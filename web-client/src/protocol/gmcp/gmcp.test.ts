import { describe, expect, it } from 'vitest';
import {
    GMCP_CLIENT_HELLO,
    GMCP_INITIAL_GETS,
    GMCP_SUPPORTS,
    parseGMCP,
    toCharacterVitals,
    toEquipmentSnapshot,
    toInventorySnapshot,
    toRoomInfo,
    toWebItemActionRequest,
} from './gmcp';

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

    it('uses client-directed Core.Hello and standard Core.Supports.Set strings', () => {
        expect(GMCP_CLIENT_HELLO).toEqual({
            client: 'Yanhuang Web',
            version: '0.2.1',
        });
        expect(GMCP_SUPPORTS).toEqual([
            'Char.Vitals 1',
            'Room.Info 1',
            'Char.Inventory 1',
            'Char.Equipment 1',
        ]);
        expect(GMCP_INITIAL_GETS).toEqual([
            'Char.Vitals.Get',
            'Room.Info.Get',
            'Char.Inventory.Get',
            'Char.Equipment.Get',
        ]);
    });

    it('builds Web.Item.Action from only an opaque item ID and allowlisted action', () => {
        expect(toWebItemActionRequest('i-session-0002', 'wield')).toEqual({
            item_id: 'i-session-0002',
            action: 'wield',
        });
        expect(toWebItemActionRequest('/clone/weapon/sword', 'wield')).toBeNull();
        expect(toWebItemActionRequest('i-session-0002\nlook room', 'wield')).toBeNull();
        expect(toWebItemActionRequest('i-session-0002', 'wield\nlook room')).toBeNull();
        expect(toWebItemActionRequest('i-session-0002', 'anything')).toBeNull();
    });

    it('normalizes real LPC inventory snapshots, including same-name item IDs', () => {
        const snapshot = toInventorySnapshot({
            version: 1,
            snapshot: 1,
            revision: 8,
            sequence: 8,
            future_field: 'ignored',
            items: [
                {
                    item_id: 'i-session-0001',
                    name: '长剑',
                    command_id: 'long sword',
                    amount: 1,
                    unit: '柄',
                    weight: 1200,
                    category: 'weapon',
                    equipped: 1,
                    actions: [{ id: 'unwield' }],
                    future_field: true,
                },
                {
                    item_id: 'i-session-0002',
                    name: '长剑',
                    command_id: 'long sword',
                    amount: 1,
                    unit: '柄',
                    weight: 1200,
                    category: 'weapon',
                    equipped: 0,
                    actions: [{ id: 'wield' }],
                },
            ],
        });

        expect(snapshot?.items).toHaveLength(2);
        expect(snapshot?.items.map((item) => item.item_id)).toEqual([
            'i-session-0001',
            'i-session-0002',
        ]);
        expect(snapshot?.items[0].equipped).toBe(true);
        expect(snapshot?.items[1].equipped).toBe(false);
    });

    it('accepts empty equipment snapshots and server-provided slots', () => {
        expect(toEquipmentSnapshot({
            version: 1,
            snapshot: 1,
            revision: 0,
            sequence: 0,
            slot_order: ['weapon', 'head'],
            slots: [],
        })).toMatchObject({ slot_order: ['weapon', 'head'], slots: [] });
    });

    it('filters malformed records and rejects an invalid snapshot header', () => {
        expect(toInventorySnapshot({
            version: 1,
            snapshot: 1,
            revision: 3,
            sequence: 3,
            items: [{ item_id: 'i-bad', name: '坏数据', equipped: 2 }],
        })?.items).toEqual([]);
        expect(toEquipmentSnapshot({
            version: 2,
            snapshot: true,
            revision: 0,
            sequence: 0,
            slot_order: [],
            slots: [],
        })).toBeNull();
    });
});
