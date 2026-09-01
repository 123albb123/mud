import { describe, expect, it } from 'vitest';
import {
    GMCP_CLIENT_HELLO,
    GMCP_INITIAL_GETS,
    GMCP_SUPPORTS,
    parseGMCP,
    toChatCapabilitiesSnapshot,
    toChatTargetsSnapshot,
    toChatMessage,
    toCharacterVitals,
    toCharacterStatus,
    toCombatActionsSnapshot,
    toCombatStateSnapshot,
    toEquipmentSnapshot,
    toInventorySnapshot,
    toRoomInfo,
    toRoomEntitiesSnapshot,
    toWebEntityActionRequest,
    toWebEntityGiveRequest,
    toWebItemActionRequest,
    toWebCombatActionRequest,
    toWebChatSendRequest,
    toWebSkillActionRequest,
    toQuestListSnapshot,
    toSkillsSnapshot,
    toRoomMapSnapshot,
    toRoomMapTransition,
    toWebRoomMoveRequest,
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

    it('accepts only bounded opaque Room.Map snapshots and preserves dynamic exits', () => {
        const snapshot = toRoomMapSnapshot({
            version: 1,
            snapshot: true,
            revision: 4,
            sequence: 4,
            current_room_id: 'r-session-0001',
            room: { room_id: 'r-session-0001', name: '客店', area: '扬州' },
            exits: [
                {
                    exit_id: 'x-session-0001',
                    command: 'east',
                    label: '东',
                    kind: 'direction',
                    resolved: 1,
                    dynamic: 0,
                    destination_room_id: 'r-session-0002',
                    destination_name: '东街',
                },
                {
                    exit_id: 'x-session-0002',
                    command: 'enter',
                    label: '进入',
                    kind: 'portal',
                    resolved: 0,
                    dynamic: 1,
                },
                {
                    exit_id: '/clone/room#1',
                    command: 'bad',
                    label: '坏出口',
                    kind: 'special',
                    resolved: 1,
                    dynamic: 0,
                    destination_room_id: '/clone/room#2',
                },
                {
                    exit_id: 'x-session-0003',
                    command: 'bad/path',
                    label: '坏路径',
                    kind: 'special',
                    resolved: 1,
                    dynamic: 0,
                    destination_room_id: 'r-session-0003',
                },
            ],
        });

        expect(snapshot).toMatchObject({
            current_room_id: 'r-session-0001',
            room: { name: '客店' },
            revision: 4,
            exits: [
                { exit_id: 'x-session-0001', resolved: true, dynamic: false },
                { exit_id: 'x-session-0002', resolved: false, dynamic: true },
            ],
        });
        expect(snapshot?.exits).toHaveLength(2);
        expect(toRoomMapSnapshot({
            version: 1,
            snapshot: true,
            revision: 1.5,
            sequence: 1.5,
            current_room_id: 'r-session-0001',
            room: { room_id: 'r-session-0001', name: '客店' },
            exits: [],
        })).toBeNull();
    });

    it('builds Web.Room.Move from only a syntactically opaque exit token', () => {
        expect(toWebRoomMoveRequest('x-session-0001')).toEqual({ exit_id: 'x-session-0001' });
        expect(toWebRoomMoveRequest('east')).toBeNull();
        expect(toWebRoomMoveRequest('/d/city/room')).toBeNull();
        expect(toWebRoomMoveRequest('x-session-0001\nlook')).toBeNull();
    });

    it('accepts only ordered-safe Room.Map.Transition payloads', () => {
        expect(toRoomMapTransition({
            version: 1,
            sequence: 7,
            from_room_id: 'r-session-0001',
            to_room_id: 'r-session-0002',
            command: 'northup',
            label: '北上',
            kind: 'move',
            area: 1,
        })).toEqual({
            version: 1,
            sequence: 7,
            from_room_id: 'r-session-0001',
            to_room_id: 'r-session-0002',
            command: 'northup',
            label: '北上',
            kind: 'move',
            area: true,
        });
        expect(toRoomMapTransition({
            version: 1,
            sequence: 0,
            from_room_id: 'r-session-0001',
            to_room_id: 'r-session-0002',
            command: 'north',
            label: '北',
            kind: 'move',
        })).toBeNull();
        expect(toRoomMapTransition({
            version: 1,
            sequence: 8,
            from_room_id: 'r-session-0001',
            to_room_id: 'r-session-0002',
            command: '/d/city/room',
            label: '北',
            kind: 'move',
        })).toBeNull();
        expect(toRoomMapTransition({
            version: 1,
            sequence: 9,
            from_room_id: 'r-session-0001',
            to_room_id: 'r-session-0002',
            command: 'north',
            label: '北\n坏',
            kind: 'move',
        })).toBeNull();
    });

    it('uses client-directed Core.Hello and standard Core.Supports.Set strings', () => {
        expect(GMCP_CLIENT_HELLO).toEqual({
            client: 'Yanhuang Web',
            version: '0.5.0',
        });
        expect(GMCP_SUPPORTS).toEqual([
            'Char.Vitals 1',
            'Char.Status 1',
            'Room.Info 1',
            'Room.Map 1',
            'Room.Map.Transition 1',
            'Room.Entities 1',
            'Char.Inventory 1',
            'Char.Equipment 1',
            'Char.Skills 1',
            'Combat.State 1',
            'Combat.Actions 1',
            'Quest.List 1',
            'Chat.Message 1',
            'Chat.Capabilities 1',
            'Chat.Targets 1',
        ]);
        expect(GMCP_INITIAL_GETS).toEqual([
            'Char.Vitals.Get',
            'Char.Status.Get',
            'Room.Info.Get',
            'Room.Map.Get',
            'Room.Entities.Get',
            'Char.Inventory.Get',
            'Char.Equipment.Get',
            'Char.Skills.Get',
            'Combat.State.Get',
            'Combat.Actions.Get',
            'Quest.List.Get',
            'Chat.Capabilities.Get',
            'Chat.Targets.Get',
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

    it('normalizes Room.Entities with opaque IDs, duplicate names, and allowlisted actions', () => {
        const snapshot = toRoomEntitiesSnapshot({
            version: 1,
            snapshot: true,
            revision: 4,
            sequence: 4,
            entities: [
                {
                    entity_id: 'e-session-0001',
                    type: 'npc',
                    name: '店小二',
                    title: '客店伙计',
                    actions: [{ id: 'look' }, { id: 'talk' }, { id: 'hack' }],
                },
                {
                    entity_id: 'e-session-0002',
                    type: 'item',
                    name: '长剑',
                    actions: [{ id: 'look' }, { id: 'get' }],
                },
                {
                    entity_id: 'e-session-0002',
                    type: 'item',
                    name: '长剑',
                    actions: [{ id: 'get' }],
                },
                { entity_id: '/clone/thing#1', type: 'item', name: '不应出现', actions: [] },
                { entity_id: 'e-session-0003', type: 'player', name: '坏\n名字', actions: [] },
            ],
        });

        expect(snapshot?.entities).toHaveLength(2);
        expect(snapshot?.entities.map((entity) => entity.entity_id)).toEqual([
            'e-session-0001',
            'e-session-0002',
        ]);
        expect(snapshot?.entities[0].actions.map((action) => action.id)).toEqual(['look', 'talk']);
    });

    it('validates entity action and give requests without exposing paths or newlines', () => {
        expect(toWebEntityActionRequest('e-session-0001', 'ask', '掌柜在哪里？')).toEqual({
            entity_id: 'e-session-0001',
            action: 'ask',
            text: '掌柜在哪里？',
        });
        expect(toWebEntityActionRequest('e-session-0001', 'ask')).toBeNull();
        expect(toWebEntityActionRequest('/clone/npc#1', 'look')).toBeNull();
        expect(toWebEntityActionRequest('e-session-0001', 'look\n')).toBeNull();
        expect(toWebEntityActionRequest('e-session-0001', 'talk', `${'x'.repeat(201)}`)).toBeNull();
        expect(toWebEntityGiveRequest('i-session-0002', 'e-session-0001')).toEqual({
            item_id: 'i-session-0002',
            entity_id: 'e-session-0001',
        });
        expect(toWebEntityGiveRequest('i-session-0002', '/clone/npc#1')).toBeNull();
    });

    it('normalizes strict Char.Status and Combat.State snapshots', () => {
        const status = toCharacterStatus({
            version: 1, snapshot: 1, revision: 4, sequence: 4,
            busy: 1, fighting: true, can_act: 0, ghost: 0, unconscious: false,
            anger: 12, food: 80, water: 70, exp: 900, potential: 30,
            weapon: { name: '长剑', skill_type: 'sword', skill_id: 'taiji-sword', skill_name: '太极剑法' },
            enabled: [{ slot: 'sword', skill_id: 'taiji-sword', name: '太极剑法' }],
            prepared: [],
        });
        expect(status).toMatchObject({ busy: true, can_act: false, weapon: { skill_id: 'taiji-sword' } });
        expect(toCharacterStatus({ version: 1, snapshot: 1, revision: 1, sequence: 1 })).toBeNull();

        const combat = toCombatStateSnapshot({
            version: 1, snapshot: true, revision: 7, sequence: 7,
            in_combat: 1, busy: 0, can_act: true, primary_target: 'e-session-0001',
            targets: [
                { entity_id: 'e-session-0001', name: '欧阳克', relation: 'kill', health: 'badly_injured' },
                { entity_id: 'e-session-0001', name: '重复', relation: 'fight', health: 'healthy' },
                { entity_id: 'e-session-0002', name: '坏数据', relation: 'enemy', health: 'healthy' },
            ],
        });
        expect(combat?.targets).toEqual([{
            entity_id: 'e-session-0001', name: '欧阳克', relation: 'kill', health: 'badly_injured',
        }]);
        expect(toCombatStateSnapshot({ version: 1, snapshot: true, revision: 1, sequence: 1, targets: [] })).toBeNull();
    });

    it('normalizes skills and only server-shaped combat actions', () => {
        const skills = toSkillsSnapshot({
            version: 1, snapshot: true, revision: 2, sequence: 2,
            skills: [{
                skill_id: 'taiji-sword', name: '太极剑法', level: 120, progress: 36,
                type: 'martial', is_basic: 0, enabled_for: ['sword'], prepared_for: [], prepare_slots: ['unarmed'], enable_slots: ['sword'],
            }, {
                skill_id: 'bad\nname', name: '坏', level: 1, progress: 0,
                type: 'martial', is_basic: 0, enabled_for: [], prepared_for: [], enable_slots: [],
            }],
        });
        expect(skills?.skills).toHaveLength(1);
        expect(skills?.skills[0].is_basic).toBe(false);
        expect(skills?.skills[0].prepare_slots).toEqual(['unarmed']);

        const actions = toCombatActionsSnapshot({
            version: 1, snapshot: 1, revision: 3, sequence: 3,
            actions: [
                { action_id: 'fight', label: '切磋', kind: 'fight', requires_target: 1 },
                { action_id: 'perform:sword:chan', label: '太极剑·缠', kind: 'perform', requires_target: 0 },
                { action_id: 'exert:force:recover', label: '恢复', kind: 'exert', requires_target: 0 },
                { action_id: 'perform:/tmp:bad', label: '坏', kind: 'perform', requires_target: 0 },
            ],
        });
        expect(actions?.actions.map((action) => action.action_id)).toEqual([
            'fight', 'perform:sword:chan', 'exert:force:recover',
        ]);
        expect(actions?.actions[0]).toMatchObject({ target_mode: 'required', target_types: [] });
        expect(actions?.actions[1]).toMatchObject({ target_mode: 'optional', target_types: [] });
        expect(actions?.actions[2]).toMatchObject({ target_mode: 'none', target_types: [] });
        expect(toCombatActionsSnapshot({
            version: 1, snapshot: 1, revision: 3, sequence: 3,
            actions: [{
                action_id: 'fight', label: '坏能力', kind: 'fight', requires_target: 1,
                target_mode: 'optional', target_types: ['npc'],
            }],
        })?.actions).toEqual([]);
    });

    it('builds only bounded Web.Skill.Action and Web.Combat.Action payloads', () => {
        expect(toWebSkillActionRequest('taiji-sword', 'enable', 'sword')).toEqual({
            skill_id: 'taiji-sword', action: 'enable', slot: 'sword',
        });
        expect(toWebSkillActionRequest('taiji-sword', 'prepare')).toEqual({
            skill_id: 'taiji-sword', action: 'prepare',
        });
        expect(toWebSkillActionRequest('../../skill', 'prepare')).toBeNull();
        expect(toWebSkillActionRequest('taiji-sword', 'prepare', 'sword')).toBeNull();
        expect(toWebCombatActionRequest('fight', 'e-session-0001')).toEqual({
            action_id: 'fight', target_entity_id: 'e-session-0001',
        });
        expect(toWebCombatActionRequest('perform:sword:chan')).toEqual({ action_id: 'perform:sword:chan' });
        expect(toWebCombatActionRequest('perform:sword:chan', 'e-session-0001')).toEqual({
            action_id: 'perform:sword:chan', target_entity_id: 'e-session-0001',
        });
        expect(toWebCombatActionRequest('perform:sword:chan', 'e-session-0001', 'none')).toBeNull();
        expect(toWebCombatActionRequest('exert:force:recover', 'e-session-0001')).toBeNull();
        expect(toWebCombatActionRequest('exert:force:suck')).toEqual({
            action_id: 'exert:force:suck',
        });
        expect(toWebCombatActionRequest('exert:force:suck', 'e-session-0001')).toEqual({
            action_id: 'exert:force:suck', target_entity_id: 'e-session-0001',
        });
        expect(toWebCombatActionRequest('exert:force:lifeheal')).toBeNull();
        expect(toWebCombatActionRequest('exert:force:lifeheal', 'e-session-0001')).toEqual({
            action_id: 'exert:force:lifeheal', target_entity_id: 'e-session-0001',
        });
        expect(toWebCombatActionRequest('fight', 'e-session-0001', 'optional')).toBeNull();
        expect(toWebCombatActionRequest('perform:/tmp:chan')).toBeNull();
        expect(toWebCombatActionRequest('kill\nlook', 'e-session-0001')).toBeNull();
        expect(toWebCombatActionRequest('kill', 'e-session-0001\n')).toBeNull();
    });

    it('normalizes real task snapshots without accepting paths or unbounded text', () => {
        const snapshot = toQuestListSnapshot({
            version: 1,
            snapshot: 1,
            revision: 4,
            sequence: 4,
            quests: [{
                quest_id: 'q-session-0001',
                system: 'quest2',
                category: 'quest2',
                title: '幻境心魔',
                detail: '斩杀心魔。\n当前进度。',
                status: 'active',
                objectives: [{ kind: 'kill', title: '心魔', current: 3, required: 20 }],
                internal_path: '/adm/daemons/quest/_0_tutorial7.c',
            }],
            completed: [{
                quest_id: 'q-session-0002',
                system: 'daily',
                category: 'daily',
                title: '祈福',
                detail: '已完成',
                status: 'completed',
                objectives: [],
            }],
            stats: { traditional_completed: 8, ignored: '/tmp' },
        });
        expect(snapshot?.quests[0]).toMatchObject({
            quest_id: 'q-session-0001',
            detail: '斩杀心魔。\n当前进度。',
            objectives: [{ kind: 'kill', current: 3, required: 20 }],
        });
        expect(snapshot?.quests[0]).not.toHaveProperty('internal_path');
        expect(snapshot?.stats).toEqual({ traditional_completed: 8 });
        expect(toQuestListSnapshot({
            version: 1,
            snapshot: true,
            revision: 1,
            sequence: Number.NaN,
            quests: [],
            completed: [],
        })).toBeNull();
    });

    it('validates structured chat events and capability snapshots safely', () => {
        const message = toChatMessage({
            version: 1,
            message_id: 'm-session-0001',
            timestamp: 123,
            kind: 'channel',
            direction: 'in',
            sender: { name: '侠客', id: 'xia' },
            channel: 'chat',
            text: '你好',
            hidden_path: '/clone/user/user.c',
        });
        expect(message).toMatchObject({ kind: 'channel', sender: { name: '侠客' }, text: '你好' });
        expect(toChatMessage({
            version: 1,
            message_id: 'm-session-0002',
            timestamp: 123,
            kind: 'say',
            direction: 'out',
            sender: { name: '侠客' },
            text: '不允许\n注入',
        })).toBeNull();
        expect(toChatCapabilitiesSnapshot({
            version: 1,
            snapshot: true,
            revision: 2,
            sequence: 2,
            channels: [
                { id: 'chat', name: '闲聊', can_send: true },
                { id: 'chat', name: '重复', can_send: false },
                { id: '/tmp', name: '坏频道', can_send: true },
            ],
            can_say: 1,
            can_tell: true,
            can_reply: false,
            max_text: 2048,
        })?.channels).toEqual([{ id: 'chat', name: '闲聊', can_send: true }]);

        expect(toChatTargetsSnapshot({
            version: 1,
            snapshot: true,
            revision: 3,
            sequence: 3,
            players: [
                { player_id: 'p-session-0001', name: '在线侠客', id: 'xia' },
                { player_id: 'p-session-0001', name: '重复项' },
                { player_id: 'e-session-0002', name: '错误前缀' },
                { player_id: 'p-session-0003', name: '坏路径', id: '/clone/user/user.c' },
                { player_id: 'p-session-0004', name: '换行\n名字' },
            ],
        })).toEqual({
            version: 1,
            snapshot: true,
            revision: 3,
            sequence: 3,
            players: [{ player_id: 'p-session-0001', name: '在线侠客', id: 'xia' }],
        });
        expect(toChatTargetsSnapshot({
            version: 1,
            snapshot: true,
            revision: 4,
            sequence: 4,
            players: [],
        })?.players).toEqual([]);
        expect(toChatTargetsSnapshot({
            version: 1,
            snapshot: true,
            revision: 5,
            sequence: 5,
            players: [{ player_id: 'p-session-0001/path', name: '坏目标' }],
        })?.players).toEqual([]);
        const manyTargets = Array.from({ length: 301 }, (_, index) => ({
            player_id: `p-session-${index + 1}`,
            name: `在线侠客${index + 1}`,
        }));
        const cappedTargets = toChatTargetsSnapshot({
            version: 1,
            snapshot: true,
            revision: 6,
            sequence: 6,
            players: manyTargets,
        });
        expect(cappedTargets?.players).toHaveLength(300);
        expect(cappedTargets?.players.at(-1)?.player_id).toBe('p-session-300');
    });

    it('builds only fixed, newline-free chat send requests', () => {
        expect(toWebChatSendRequest('channel', '你好', { channel: 'chat' })).toEqual({
            kind: 'channel', channel: 'chat', text: '你好',
        });
        expect(toWebChatSendRequest('tell', '在吗', { targetPlayerId: 'p-session-0001' })).toEqual({
            kind: 'tell', target_player_id: 'p-session-0001', text: '在吗',
        });
        expect(toWebChatSendRequest('tell', '兼容', { targetEntityId: 'e-session-0001' })).toEqual({
            kind: 'tell', target_entity_id: 'e-session-0001', text: '兼容',
        });
        expect(toWebChatSendRequest('say', '坏\n命令')).toBeNull();
        expect(toWebChatSendRequest('channel', '你好', { channel: '/cmds/std/say' })).toBeNull();
        expect(toWebChatSendRequest('tell', '你好', { targetEntityId: 'player-name' })).toBeNull();
        expect(toWebChatSendRequest('tell', '你好', { targetPlayerId: 'p-session-0001/path' })).toBeNull();
        expect(toWebChatSendRequest('tell', '你好', {
            targetEntityId: 'e-session-0001',
            targetPlayerId: 'p-session-0001',
        })).toBeNull();
    });
});
