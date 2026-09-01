export interface GMCPMessage {
    packageName: string;
    payload: unknown;
    rawPayload: string;
    error?: string;
}

export interface CharacterVitals {
    version?: number;
    snapshot?: true;
    revision?: number;
    sequence?: number;
    hp?: number;
    max_hp?: number;
    jing?: number;
    max_jing?: number;
    jingli?: number;
    max_jingli?: number;
    neili?: number;
    max_neili?: number;
}

export interface SkillAssignment {
    slot: string;
    skill_id: string;
    name: string;
}

export interface CharacterWeapon {
    name: string;
    skill_type: string;
    skill_id?: string;
    skill_name?: string;
}

export interface CharacterStatus {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    busy: boolean;
    fighting: boolean;
    can_act: boolean;
    ghost: boolean;
    unconscious: boolean;
    anger: number;
    food: number;
    water: number;
    exp: number;
    potential: number;
    weapon: CharacterWeapon | null;
    enabled: SkillAssignment[];
    prepared: SkillAssignment[];
}

export type CombatRelation = 'fight' | 'kill';
export type CombatHealth = 'healthy' | 'injured' | 'badly_injured' | 'near_death' | 'unconscious' | 'unknown';

export interface CombatTarget {
    entity_id: string;
    name: string;
    relation: CombatRelation;
    health: CombatHealth;
}

export interface CombatStateSnapshot {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    in_combat: boolean;
    busy: boolean;
    can_act: boolean;
    targets: CombatTarget[];
    primary_target?: string;
}

export interface CharacterSkill {
    skill_id: string;
    name: string;
    level: number;
    progress: number;
    type: string;
    is_basic: boolean;
    enabled_for: string[];
    prepared_for: string[];
    /** Basic slots the server says this skill can currently be prepared for. */
    prepare_slots: string[];
    enable_slots: string[];
}

export interface SkillsSnapshot {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    skills: CharacterSkill[];
}

export type CombatActionKind = 'fight' | 'kill' | 'perform' | 'exert';
export type CombatTargetMode = 'none' | 'optional' | 'required';
export type CombatTargetType = 'npc' | 'player';

export interface CombatAction {
    action_id: string;
    label: string;
    kind: CombatActionKind;
    requires_target: boolean;
    target_mode?: CombatTargetMode;
    target_types?: CombatTargetType[];
}

export interface CombatActionsSnapshot {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    actions: CombatAction[];
}

export interface RoomInfo {
    name?: string;
    area?: string;
    exits: string[];
    room_id?: string;
    hash?: string;
}

export type RoomMapExitKind = 'direction' | 'vertical' | 'portal' | 'special';

export interface RoomMapRoom {
    room_id: string;
    name: string;
    area?: string;
}

export interface RoomMapExit {
    exit_id: string;
    command: string;
    label: string;
    kind: RoomMapExitKind;
    resolved: boolean;
    dynamic: boolean;
    conditional?: boolean;
    destination_room_id?: string;
    destination_name?: string;
}

export interface RoomMapSnapshot {
    version: 1;
    snapshot: true;
    revision: number;
    sequence: number;
    current_room_id: string;
    room: RoomMapRoom;
    exits: RoomMapExit[];
}

export interface GMCPAction {
    id: string;
    label?: string;
}

export interface InventoryItem {
    item_id: string;
    name: string;
    command_id: string;
    amount: number;
    unit: string;
    weight: number;
    category: string;
    equipped: boolean;
    actions: GMCPAction[];
}

export interface InventorySnapshot {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    items: InventoryItem[];
}

export interface EquipmentSlot {
    slot: string;
    item_id: string;
    name: string;
    command_id: string;
    type: string;
    actions: GMCPAction[];
}

export interface EquipmentSnapshot {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    slot_order: string[];
    slots: EquipmentSlot[];
}

export type RoomEntityType = 'npc' | 'player' | 'item' | 'corpse' | 'unknown';

export interface RoomEntity {
    entity_id: string;
    type: RoomEntityType;
    name: string;
    title?: string;
    actions: GMCPAction[];
}

export interface RoomEntitiesSnapshot {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    entities: RoomEntity[];
}

export type QuestStatus = 'active' | 'available' | 'completed' | 'failed';
export type QuestSystem = 'traditional' | 'quest2' | 'ultra' | 'mirror' | 'daily';

export interface QuestObjective {
    kind: string;
    title: string;
    detail?: string;
    target_id?: string;
    current?: number;
    required?: number;
}

export interface QuestRecord {
    quest_id: string;
    system: QuestSystem;
    category: string;
    title: string;
    detail: string;
    status: QuestStatus;
    level?: number;
    deadline?: number;
    objectives: QuestObjective[];
}

export interface QuestStats {
    traditional_completed?: number;
    mirror_completed?: number;
    active_count?: number;
    completed_count?: number;
}

export interface QuestListSnapshot {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    quests: QuestRecord[];
    completed: QuestRecord[];
    stats: QuestStats;
}

export interface ChatActor {
    name: string;
    id?: string;
}

export type ChatKind = 'channel' | 'say' | 'tell' | 'reply';
export type ChatDirection = 'in' | 'out';

export interface ChatMessage {
    version: number;
    message_id: string;
    timestamp: number;
    kind: ChatKind;
    direction: ChatDirection;
    sender: ChatActor;
    recipient?: ChatActor;
    channel?: string;
    emote?: boolean;
    text: string;
}

export interface ChatChannel {
    id: string;
    name: string;
    can_send: boolean;
}

export interface ChatCapabilities {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    channels: ChatChannel[];
    can_say: boolean;
    can_tell: boolean;
    can_reply: boolean;
    max_text: number;
}

export interface ChatTarget {
    player_id: string;
    name: string;
    id?: string;
}

export interface ChatTargetsSnapshot {
    version: number;
    snapshot: true;
    revision: number;
    sequence: number;
    players: ChatTarget[];
}

export type WebChatSendRequest =
    | { kind: 'say'; text: string }
    | { kind: 'reply'; text: string }
    | { kind: 'tell'; target_player_id: string; text: string }
    | { kind: 'tell'; target_entity_id: string; text: string }
    | { kind: 'channel'; channel: string; text: string; emote?: boolean };

export interface WebRoomMoveRequest {
    exit_id: string;
}

const decoder = new TextDecoder('utf-8');

export const GMCP_CLIENT_HELLO = {
    client: 'Yanhuang Web',
    version: '0.5.0',
};

export const GMCP_SUPPORTS = [
    'Char.Vitals 1',
    'Char.Status 1',
    'Room.Info 1',
    'Room.Map 1',
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
];

export const GMCP_INITIAL_GETS = [
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
];

const itemActions = new Set([
    'look', 'drop', 'eat', 'drink', 'wield', 'unwield', 'wear', 'remove',
]);
const entityActions = new Set([
    'look', 'get', 'talk', 'ask', 'fight', 'kill', 'give',
]);
const itemIdPattern = /^i-[A-Za-z0-9]+-[0-9]+$/;
const entityIdPattern = /^e-[A-Za-z0-9]+-[0-9]+$/;
const questIdPattern = /^q-[A-Za-z0-9]+-[0-9]+$/;
const roomMapRoomIdPattern = /^[A-Za-z0-9_-]{1,96}$/;
const roomMapExitIdPattern = /^x-[A-Za-z0-9]+-[0-9]+$/;
const chatMessageIdPattern = /^m-[A-Za-z0-9]+-[0-9]+$/;
const chatPlayerIdPattern = /^p-[A-Za-z0-9]+-[0-9]+$/;
const chatChannelPattern = /^[a-z0-9_-]{1,32}$/;
const skillIdPattern = /^[a-z0-9_-]{1,64}$/;
const combatActionIdPattern = /^(fight|kill|perform:[a-z0-9_-]{1,64}:[a-z0-9_-]{1,64}|exert:force:[a-z0-9_-]{1,64})$/;
const noTargetExertNames = new Set([
    'power', 'powerup', 'recover', 'regenerate', 'heal', 'inspire', 'roar',
    'tianmo', 'shield', 'resurrect', 'xun',
]);
const requiredTargetExertNames = new Set(['lifeheal', 'shot']);

const inferredCombatTargetMode = (actionId: string): CombatTargetMode => {
    if (typeof actionId !== 'string') {
        return 'optional';
    }
    if (actionId === 'fight' || actionId === 'kill') {
        return 'required';
    }
    const parts = actionId.split(':');
    if (parts[0] === 'exert' && parts[1] === 'force') {
        if (noTargetExertNames.has(parts[2])) {
            return 'none';
        }
        if (requiredTargetExertNames.has(parts[2])) {
            return 'required';
        }
    }
    return 'optional';
};

export interface WebItemActionRequest {
    item_id: string;
    action: string;
}

export const toWebRoomMoveRequest = (exitId: string): WebRoomMoveRequest | null => {
    if (!roomMapExitIdPattern.test(exitId)) {
        return null;
    }
    return { exit_id: exitId };
};

export const toWebItemActionRequest = (
    itemId: string,
    action: string,
): WebItemActionRequest | null => {
    if (!itemIdPattern.test(itemId) || !itemActions.has(action)) {
        return null;
    }
    return { item_id: itemId, action };
};

export interface WebEntityActionRequest {
    entity_id: string;
    action: string;
    text?: string;
}

export const toWebEntityActionRequest = (
    entityId: string,
    action: string,
    text?: string,
): WebEntityActionRequest | null => {
    if (!entityIdPattern.test(entityId) || !entityActions.has(action)) {
        return null;
    }
    if (text !== undefined && (typeof text !== 'string' || /[\r\n]/.test(text) || text.length > 200)) {
        return null;
    }
    if (action === 'ask' && (!text || text.length === 0)) {
        return null;
    }
    return text === undefined
        ? { entity_id: entityId, action }
        : { entity_id: entityId, action, text };
};

export interface WebEntityGiveRequest {
    item_id: string;
    entity_id: string;
}

export const toWebEntityGiveRequest = (
    itemId: string,
    entityId: string,
): WebEntityGiveRequest | null => {
    if (!itemIdPattern.test(itemId) || !entityIdPattern.test(entityId)) {
        return null;
    }
    return { item_id: itemId, entity_id: entityId };
};

export interface WebSkillActionRequest {
    skill_id: string;
    action: 'enable' | 'prepare';
    slot?: string;
}

export const toWebSkillActionRequest = (
    skillId: string,
    action: 'enable' | 'prepare',
    slot?: string,
): WebSkillActionRequest | null => {
    if (!skillIdPattern.test(skillId)) {
        return null;
    }
    if (action === 'enable') {
        if (!slot || !skillIdPattern.test(slot)) {
            return null;
        }
        return { skill_id: skillId, action, slot };
    }
    if (slot !== undefined) {
        return null;
    }
    return { skill_id: skillId, action };
};

export interface WebCombatActionRequest {
    action_id: string;
    target_entity_id?: string;
}

export const toWebCombatActionRequest = (
    actionId: string,
    targetEntityId?: string,
    targetMode?: CombatTargetMode,
): WebCombatActionRequest | null => {
    if (!combatActionIdPattern.test(actionId)) {
        return null;
    }
    if (targetEntityId !== undefined && !entityIdPattern.test(targetEntityId)) {
        return null;
    }
    const inferredMode = inferredCombatTargetMode(actionId);
    const mode = targetMode ?? inferredMode;
    if (mode !== 'none' && mode !== 'optional' && mode !== 'required') {
        return null;
    }
    if (mode === 'required' && targetEntityId === undefined) {
        return null;
    }
    if (mode === 'none' && targetEntityId !== undefined) {
        return null;
    }
    if ((actionId === 'fight' || actionId === 'kill') && mode !== 'required') {
        return null;
    }
    return targetEntityId === undefined
        ? { action_id: actionId }
        : { action_id: actionId, target_entity_id: targetEntityId };
};

export const parseGMCP = (bytes: Uint8Array): GMCPMessage => {
    const message = decoder.decode(bytes);
    const separator = message.indexOf(' ');
    const packageName = (separator === -1 ? message : message.slice(0, separator)).trim();
    const rawPayload = separator === -1 ? '' : message.slice(separator + 1).trim();

    if (!rawPayload) {
        return { packageName, payload: null, rawPayload };
    }

    try {
        return { packageName, payload: JSON.parse(rawPayload), rawPayload };
    } catch (error) {
        return {
            packageName,
            payload: null,
            rawPayload,
            error: error instanceof Error ? error.message : 'Invalid JSON',
        };
    }
};

const finiteNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const booleanFlag = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === 0) {
        return false;
    }
    if (value === 1) {
        return true;
    }
    return undefined;
};

export const toCharacterVitals = (payload: unknown): CharacterVitals | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const data = payload as Record<string, unknown>;
    const header = snapshotHeader(payload);
    return {
        ...(header ? {
            version: header.version as number,
            snapshot: true,
            revision: header.revision as number,
            sequence: header.sequence as number,
        } : {}),
        hp: finiteNumber(data.hp),
        max_hp: finiteNumber(data.max_hp),
        jing: finiteNumber(data.jing),
        max_jing: finiteNumber(data.max_jing),
        jingli: finiteNumber(data.jingli),
        max_jingli: finiteNumber(data.max_jingli),
        neili: finiteNumber(data.neili),
        max_neili: finiteNumber(data.max_neili),
    };
};

export const toRoomInfo = (payload: unknown): RoomInfo | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const data = payload as Record<string, unknown>;
    return {
        name: typeof data.name === 'string' ? data.name : undefined,
        area: typeof data.area === 'string' ? data.area : undefined,
        exits: Array.isArray(data.exits)
            ? data.exits.filter((exit): exit is string => typeof exit === 'string')
            : [],
        room_id: typeof data.room_id === 'string' ? data.room_id : undefined,
        hash: typeof data.hash === 'string' ? data.hash : undefined,
    };
};

const snapshotHeader = (payload: unknown): Record<string, unknown> | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const data = payload as Record<string, unknown>;
    if (data.version !== 1 || (data.snapshot !== true && data.snapshot !== 1)) {
        return null;
    }
    const revision = finiteNumber(data.revision);
    const sequence = finiteNumber(data.sequence);
    if (revision === undefined || sequence === undefined || revision < 0 || sequence < 0) {
        return null;
    }
    return data;
};

const safeProtocolText = (value: unknown, required = true): string | null => {
    if (typeof value !== 'string' || value.length > 256 || /[\r\n]/.test(value) ||
        (required && value.length === 0)) {
        return null;
    }
    return value;
};

const safeDisplayText = (
    value: unknown,
    maxLength: number,
    multiline = false,
    required = true,
): string | null => {
    if (typeof value !== 'string' || value.length > maxLength ||
        (multiline
            ? /[\r\u0000-\u0008\u000b-\u001f\u007f]/.test(value)
            : /[\r\n\u0000-\u001f\u007f]/.test(value)) ||
        (required && value.length === 0)) {
        return null;
    }
    return value;
};

const toRoomMapRoom = (value: unknown): RoomMapRoom | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const roomId = typeof data.room_id === 'string' && roomMapRoomIdPattern.test(data.room_id)
        ? data.room_id
        : null;
    const name = safeDisplayText(data.name, 160, false, false);
    if (!roomId || name === null) {
        return null;
    }
    const room: RoomMapRoom = { room_id: roomId, name };
    if (data.area !== undefined) {
        const area = safeDisplayText(data.area, 160);
        if (area === null) {
            return null;
        }
        room.area = area;
    }
    return room;
};

const roomMapExitKinds = new Set<RoomMapExitKind>([
    'direction', 'vertical', 'portal', 'special',
]);

const toRoomMapExit = (value: unknown): RoomMapExit | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const exitId = typeof data.exit_id === 'string' && roomMapExitIdPattern.test(data.exit_id)
        ? data.exit_id
        : null;
    const command = safeDisplayText(data.command, 96);
    const label = safeDisplayText(data.label, 160);
    const kind = typeof data.kind === 'string' && roomMapExitKinds.has(data.kind as RoomMapExitKind)
        ? data.kind as RoomMapExitKind
        : null;
    const resolved = booleanFlag(data.resolved);
    const dynamic = booleanFlag(data.dynamic);
    if (!exitId || !command || command.includes('/') || command.includes('\\') ||
        !label || !kind || resolved === undefined || dynamic === undefined ||
        (resolved && dynamic)) {
        return null;
    }

    const exit: RoomMapExit = {
        exit_id: exitId,
        command,
        label,
        kind,
        resolved,
        dynamic,
    };
    if (data.conditional !== undefined) {
        const conditional = booleanFlag(data.conditional);
        if (conditional === undefined) {
            return null;
        }
        exit.conditional = conditional;
    }
    if (data.destination_room_id !== undefined) {
        if (typeof data.destination_room_id !== 'string' ||
            !roomMapRoomIdPattern.test(data.destination_room_id)) {
            return null;
        }
        exit.destination_room_id = data.destination_room_id;
    }
    if (data.destination_name !== undefined) {
        const destinationName = safeDisplayText(data.destination_name, 160);
        if (destinationName === null) {
            return null;
        }
        exit.destination_name = destinationName;
    }
    if (exit.resolved && !exit.destination_room_id) {
        return null;
    }
    return exit;
};

export const toRoomMapSnapshot = (payload: unknown): RoomMapSnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data) {
        return null;
    }
    const revision = finiteNumber(data.revision);
    const sequence = finiteNumber(data.sequence);
    const currentRoomId = typeof data.current_room_id === 'string' &&
        roomMapRoomIdPattern.test(data.current_room_id)
        ? data.current_room_id
        : null;
    const room = toRoomMapRoom(data.room);
    if (revision === undefined || sequence === undefined ||
        !Number.isInteger(revision) || !Number.isInteger(sequence) ||
        revision < 0 || sequence < 0 || !currentRoomId || !room ||
        room.room_id !== currentRoomId || !Array.isArray(data.exits)) {
        return null;
    }

    const seen = new Set<string>();
    const exits = data.exits
        .slice(0, 64)
        .map(toRoomMapExit)
        .filter((exit): exit is RoomMapExit => {
            if (!exit || seen.has(exit.exit_id)) {
                return false;
            }
            seen.add(exit.exit_id);
            return true;
        });
    return {
        version: 1,
        snapshot: true,
        revision,
        sequence,
        current_room_id: currentRoomId,
        room,
        exits,
    };
};

const nonNegativeInteger = (value: unknown, max = 1_000_000_000): number | undefined => {
    const number = finiteNumber(value);
    return number !== undefined && Number.isInteger(number) && number >= 0 && number <= max
        ? number
        : undefined;
};

const questStatuses = new Set<QuestStatus>(['active', 'available', 'completed', 'failed']);
const questSystems = new Set<QuestSystem>(['traditional', 'quest2', 'ultra', 'mirror', 'daily']);

const parseQuestObjective = (value: unknown): QuestObjective | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const kind = safeDisplayText(data.kind, 64);
    const title = safeDisplayText(data.title, 256);
    if (!kind || !title || kind.includes('/') || kind.includes('\\')) {
        return null;
    }
    const objective: QuestObjective = { kind, title };
    const detail = data.detail === undefined ? null : safeDisplayText(data.detail, 1024, true);
    if (detail) {
        objective.detail = detail;
    }
    if (data.target_id !== undefined && typeof data.target_id === 'string' && entityIdPattern.test(data.target_id)) {
        objective.target_id = data.target_id;
    }
    const current = finiteNumber(data.current);
    if (current !== undefined && current >= 0) {
        objective.current = current;
    }
    const required = finiteNumber(data.required);
    if (required !== undefined && required >= 0) {
        objective.required = required;
    }
    return objective;
};

const parseQuestObjectives = (value: unknown): QuestObjective[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .slice(0, 64)
        .map(parseQuestObjective)
        .filter((objective): objective is QuestObjective => objective !== null);
};

const parseQuestRecord = (value: unknown): QuestRecord | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const questId = typeof data.quest_id === 'string' && questIdPattern.test(data.quest_id)
        ? data.quest_id
        : null;
    const system = typeof data.system === 'string' && questSystems.has(data.system as QuestSystem)
        ? data.system as QuestSystem
        : null;
    const category = safeDisplayText(data.category, 64);
    const title = safeDisplayText(data.title, 256);
    const detail = safeDisplayText(data.detail, 4096, true);
    const status = typeof data.status === 'string' && questStatuses.has(data.status as QuestStatus)
        ? data.status as QuestStatus
        : null;
    if (!questId || !system || !category || !title || !detail || !status) {
        return null;
    }
    const record: QuestRecord = {
        quest_id: questId,
        system,
        category,
        title,
        detail,
        status,
        objectives: parseQuestObjectives(data.objectives),
    };
    const level = finiteNumber(data.level);
    if (level !== undefined && level >= 0) {
        record.level = level;
    }
    const deadline = finiteNumber(data.deadline);
    if (deadline !== undefined && deadline >= 0) {
        record.deadline = deadline;
    }
    return record;
};

const parseQuestRecords = (value: unknown, limit: number): QuestRecord[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = new Set<string>();
    return value
        .slice(0, limit)
        .map(parseQuestRecord)
        .filter((record): record is QuestRecord => {
            if (!record || seen.has(record.quest_id)) {
                return false;
            }
            seen.add(record.quest_id);
            return true;
        });
};

const parseQuestStats = (value: unknown): QuestStats => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const data = value as Record<string, unknown>;
    const stats: QuestStats = {};
    (['traditional_completed', 'mirror_completed', 'active_count', 'completed_count'] as const).forEach((key) => {
        const count = nonNegativeInteger(data[key]);
        if (count !== undefined) {
            stats[key] = count;
        }
    });
    return stats;
};

export const toQuestListSnapshot = (payload: unknown): QuestListSnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.quests) || !Array.isArray(data.completed)) {
        return null;
    }
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        quests: parseQuestRecords(data.quests, 200),
        completed: parseQuestRecords(data.completed, 300),
        stats: parseQuestStats(data.stats),
    };
};

const chatKinds = new Set<ChatKind>(['channel', 'say', 'tell', 'reply']);
const chatDirections = new Set<ChatDirection>(['in', 'out']);

const parseChatActor = (value: unknown): ChatActor | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const name = safeDisplayText(data.name, 256);
    if (!name) {
        return null;
    }
    const actor: ChatActor = { name };
    if (data.id !== undefined) {
        const id = safeDisplayText(data.id, 128);
        if (id) {
            actor.id = id;
        }
    }
    return actor;
};

export const toChatMessage = (payload: unknown): ChatMessage | null => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const data = payload as Record<string, unknown>;
    const timestamp = finiteNumber(data.timestamp);
    const kind = typeof data.kind === 'string' && chatKinds.has(data.kind as ChatKind)
        ? data.kind as ChatKind
        : null;
    const direction = typeof data.direction === 'string' && chatDirections.has(data.direction as ChatDirection)
        ? data.direction as ChatDirection
        : null;
    const sender = parseChatActor(data.sender);
    const text = safeDisplayText(data.text, 2048);
    if (data.version !== 1 || typeof data.message_id !== 'string' ||
        !chatMessageIdPattern.test(data.message_id) || timestamp === undefined || timestamp < 0 ||
        !kind || !direction || !sender || !text) {
        return null;
    }
    if (kind === 'channel' && (typeof data.channel !== 'string' || !chatChannelPattern.test(data.channel))) {
        return null;
    }
    const message: ChatMessage = {
        version: 1,
        message_id: data.message_id,
        timestamp,
        kind,
        direction,
        sender,
        text,
    };
    if (kind === 'channel') {
        message.channel = data.channel as string;
    }
    if (data.recipient !== undefined) {
        const recipient = parseChatActor(data.recipient);
        if (recipient) {
            message.recipient = recipient;
        }
    }
    const emote = booleanFlag(data.emote);
    if (emote !== undefined) {
        message.emote = emote;
    }
    return message;
};

export const toChatCapabilitiesSnapshot = (payload: unknown): ChatCapabilities | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.channels)) {
        return null;
    }
    const canSay = booleanFlag(data.can_say);
    const canTell = booleanFlag(data.can_tell);
    const canReply = booleanFlag(data.can_reply);
    const maxText = nonNegativeInteger(data.max_text, 4096);
    if (canSay === undefined || canTell === undefined || canReply === undefined ||
        maxText === undefined || maxText < 1) {
        return null;
    }
    const seen = new Set<string>();
    const channels = data.channels
        .slice(0, 64)
        .map((value): ChatChannel | null => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                return null;
            }
            const channel = value as Record<string, unknown>;
            const id = typeof channel.id === 'string' && chatChannelPattern.test(channel.id)
                ? channel.id
                : null;
            const name = safeDisplayText(channel.name, 256);
            const canSend = booleanFlag(channel.can_send);
            if (!id || !name || canSend === undefined) {
                return null;
            }
            return { id, name, can_send: canSend };
        })
        .filter((channel): channel is ChatChannel => {
            if (!channel || seen.has(channel.id)) {
                return false;
            }
            seen.add(channel.id);
            return true;
        });
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        channels,
        can_say: canSay,
        can_tell: canTell,
        can_reply: canReply,
        max_text: maxText,
    };
};

const parseChatTarget = (value: unknown): ChatTarget | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const playerId = typeof data.player_id === 'string' && chatPlayerIdPattern.test(data.player_id)
        ? data.player_id
        : null;
    const name = safeDisplayText(data.name, 256);
    if (!playerId || !name) {
        return null;
    }
    const target: ChatTarget = { player_id: playerId, name };
    if (data.id !== undefined) {
        const id = safeDisplayText(data.id, 128);
        if (!id || id.includes('/') || id.includes('\\')) {
            return null;
        }
        target.id = id;
    }
    return target;
};

export const toChatTargetsSnapshot = (payload: unknown): ChatTargetsSnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.players)) {
        return null;
    }
    const seen = new Set<string>();
    const players = data.players
        .slice(0, 300)
        .map(parseChatTarget)
        .filter((target): target is ChatTarget => {
            if (!target || seen.has(target.player_id)) {
                return false;
            }
            seen.add(target.player_id);
            return true;
        });
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        players,
    };
};

const safeChatInput = (value: string): boolean =>
    typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/[\r\n]/.test(value);

export const toWebChatSendRequest = (
    kind: ChatKind,
    text: string,
    options: {
        channel?: string;
        targetEntityId?: string;
        targetPlayerId?: string;
        emote?: boolean;
    } = {},
): WebChatSendRequest | null => {
    if (!chatKinds.has(kind) || !safeChatInput(text)) {
        return null;
    }
    if (kind === 'say') {
        return { kind, text };
    }
    if (kind === 'reply') {
        return { kind, text };
    }
    if (kind === 'tell') {
        if (options.targetEntityId !== undefined && options.targetPlayerId !== undefined) {
            return null;
        }
        if (options.targetPlayerId !== undefined) {
            return chatPlayerIdPattern.test(options.targetPlayerId)
                ? { kind, target_player_id: options.targetPlayerId, text }
                : null;
        }
        return options.targetEntityId !== undefined && entityIdPattern.test(options.targetEntityId)
            ? { kind, target_entity_id: options.targetEntityId, text }
            : null;
    }
    if (!options.channel || !chatChannelPattern.test(options.channel) ||
        (options.emote !== undefined && typeof options.emote !== 'boolean')) {
        return null;
    }
    return options.emote === undefined
        ? { kind, channel: options.channel, text }
        : { kind, channel: options.channel, text, emote: options.emote };
};

const parseSkillAssignment = (value: unknown): SkillAssignment | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const name = safeProtocolText(data.name);
    if (typeof data.slot !== 'string' || !skillIdPattern.test(data.slot) ||
        typeof data.skill_id !== 'string' || !skillIdPattern.test(data.skill_id) || !name) {
        return null;
    }
    return { slot: data.slot, skill_id: data.skill_id, name };
};

const parseSkillAssignments = (value: unknown): SkillAssignment[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = new Set<string>();
    return value.map(parseSkillAssignment).filter((assignment): assignment is SkillAssignment => {
        if (!assignment || seen.has(assignment.slot)) {
            return false;
        }
        seen.add(assignment.slot);
        return true;
    });
};

const parseWeapon = (value: unknown): CharacterWeapon | null => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const name = safeProtocolText(data.name);
    if (!name || typeof data.skill_type !== 'string' ||
        (data.skill_type !== '' && !skillIdPattern.test(data.skill_type))) {
        return null;
    }
    const weapon: CharacterWeapon = { name, skill_type: data.skill_type };
    if (typeof data.skill_id === 'string' && skillIdPattern.test(data.skill_id)) {
        weapon.skill_id = data.skill_id;
        const skillName = safeProtocolText(data.skill_name);
        if (skillName) {
            weapon.skill_name = skillName;
        }
    }
    return weapon;
};

export const toCharacterStatus = (payload: unknown): CharacterStatus | null => {
    const data = snapshotHeader(payload);
    if (!data) {
        return null;
    }
    const values = ['anger', 'food', 'water', 'exp', 'potential'].map((key) => finiteNumber(data[key]));
    const flags = ['busy', 'fighting', 'can_act', 'ghost', 'unconscious'].map((key) => booleanFlag(data[key]));
    if (values.some((value) => value === undefined) || flags.some((value) => value === undefined)) {
        return null;
    }
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        busy: flags[0] as boolean,
        fighting: flags[1] as boolean,
        can_act: flags[2] as boolean,
        ghost: flags[3] as boolean,
        unconscious: flags[4] as boolean,
        anger: values[0] as number,
        food: values[1] as number,
        water: values[2] as number,
        exp: values[3] as number,
        potential: values[4] as number,
        weapon: parseWeapon(data.weapon),
        enabled: parseSkillAssignments(data.enabled),
        prepared: parseSkillAssignments(data.prepared),
    };
};

const combatRelations = new Set<CombatRelation>(['fight', 'kill']);
const combatHealthStates = new Set<CombatHealth>([
    'healthy', 'injured', 'badly_injured', 'near_death', 'unconscious', 'unknown',
]);

const parseCombatTarget = (value: unknown): CombatTarget | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const name = safeProtocolText(data.name);
    if (typeof data.entity_id !== 'string' || !entityIdPattern.test(data.entity_id) || !name ||
        typeof data.relation !== 'string' || !combatRelations.has(data.relation as CombatRelation) ||
        typeof data.health !== 'string' || !combatHealthStates.has(data.health as CombatHealth)) {
        return null;
    }
    return {
        entity_id: data.entity_id,
        name,
        relation: data.relation as CombatRelation,
        health: data.health as CombatHealth,
    };
};

export const toCombatStateSnapshot = (payload: unknown): CombatStateSnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.targets)) {
        return null;
    }
    const inCombat = booleanFlag(data.in_combat);
    const busy = booleanFlag(data.busy);
    const canAct = booleanFlag(data.can_act);
    if (inCombat === undefined || busy === undefined || canAct === undefined ||
        (data.primary_target !== undefined &&
            (typeof data.primary_target !== 'string' || data.primary_target !== '' && !entityIdPattern.test(data.primary_target)))) {
        return null;
    }
    const seen = new Set<string>();
    const targets = data.targets.map(parseCombatTarget).filter((target): target is CombatTarget => {
        if (!target || seen.has(target.entity_id)) {
            return false;
        }
        seen.add(target.entity_id);
        return true;
    });
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        in_combat: inCombat,
        busy,
        can_act: canAct,
        targets,
        ...(typeof data.primary_target === 'string' && data.primary_target !== ''
            ? { primary_target: data.primary_target }
            : {}),
    };
};

const parseCharacterSkill = (value: unknown): CharacterSkill | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const name = safeProtocolText(data.name);
    const type = safeProtocolText(data.type);
    const level = finiteNumber(data.level);
    const progress = finiteNumber(data.progress);
    if (typeof data.skill_id !== 'string' || !skillIdPattern.test(data.skill_id) || !name || !type ||
        level === undefined || progress === undefined || !Array.isArray(data.enabled_for) ||
        !Array.isArray(data.prepared_for) ||
        (data.prepare_slots !== undefined && !Array.isArray(data.prepare_slots)) ||
        !Array.isArray(data.enable_slots) ||
        booleanFlag(data.is_basic) === undefined) {
        return null;
    }
    return {
        skill_id: data.skill_id,
        name,
        level,
        progress: Math.max(0, Math.min(100, progress)),
        type,
        is_basic: booleanFlag(data.is_basic) as boolean,
        enabled_for: data.enabled_for.filter((slot): slot is string => typeof slot === 'string' && skillIdPattern.test(slot)),
        prepared_for: data.prepared_for.filter((slot): slot is string => typeof slot === 'string' && skillIdPattern.test(slot)),
        prepare_slots: (Array.isArray(data.prepare_slots) ? data.prepare_slots : [])
            .filter((slot): slot is string => typeof slot === 'string' && skillIdPattern.test(slot)),
        enable_slots: data.enable_slots.filter((slot): slot is string => typeof slot === 'string' && skillIdPattern.test(slot)),
    };
};

export const toSkillsSnapshot = (payload: unknown): SkillsSnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.skills)) {
        return null;
    }
    const seen = new Set<string>();
    const skills = data.skills.map(parseCharacterSkill).filter((skill): skill is CharacterSkill => {
        if (!skill || seen.has(skill.skill_id)) {
            return false;
        }
        seen.add(skill.skill_id);
        return true;
    });
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        skills,
    };
};

const combatActionKinds = new Set<CombatActionKind>(['fight', 'kill', 'perform', 'exert']);
const combatTargetModes = new Set<CombatTargetMode>(['none', 'optional', 'required']);
const combatTargetTypes = new Set<CombatTargetType>(['npc', 'player']);

const parseCombatAction = (value: unknown): CombatAction | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const label = safeProtocolText(data.label);
    const requiresTarget = booleanFlag(data.requires_target);
    const targetMode = data.target_mode === undefined
        ? (requiresTarget ? 'required' : inferredCombatTargetMode(data.action_id as string))
        : data.target_mode;
    const targetTypes = data.target_types === undefined
        ? []
        : data.target_types;
    if (typeof data.action_id !== 'string' || !combatActionIdPattern.test(data.action_id) || !label ||
        typeof data.kind !== 'string' || !combatActionKinds.has(data.kind as CombatActionKind) ||
        requiresTarget === undefined || typeof targetMode !== 'string' ||
        !combatTargetModes.has(targetMode as CombatTargetMode) ||
        (targetMode === 'required') !== requiresTarget ||
        ((data.kind === 'fight' || data.kind === 'kill') && targetMode !== 'required') ||
        !Array.isArray(targetTypes) ||
        targetTypes.some((targetType) => typeof targetType !== 'string' ||
            !combatTargetTypes.has(targetType as CombatTargetType)) ||
        (targetMode === 'none' && targetTypes.length > 0)) {
        return null;
    }
    return {
        action_id: data.action_id,
        label,
        kind: data.kind as CombatActionKind,
        requires_target: requiresTarget,
        target_mode: targetMode as CombatTargetMode,
        target_types: targetTypes as CombatTargetType[],
    };
};

export const toCombatActionsSnapshot = (payload: unknown): CombatActionsSnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.actions)) {
        return null;
    }
    const seen = new Set<string>();
    const actions = data.actions.map(parseCombatAction).filter((action): action is CombatAction => {
        if (!action || seen.has(action.action_id)) {
            return false;
        }
        seen.add(action.action_id);
        return true;
    });
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        actions,
    };
};

const parseAction = (value: unknown, allowedActions: Set<string>): GMCPAction | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    if (typeof data.id !== 'string' || !allowedActions.has(data.id)) {
        return null;
    }
    if (typeof data.label === 'string' && !/[\r\n]/.test(data.label)) {
        return { id: data.id, label: data.label };
    }
    return { id: data.id };
};

const parseActions = (value: unknown, allowedActions: Set<string>): GMCPAction[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = new Set<string>();
    return value
        .map((action) => parseAction(action, allowedActions))
        .filter((action): action is GMCPAction => {
            if (!action || seen.has(action.id)) {
                return false;
            }
            seen.add(action.id);
            return true;
        });
};

const parseInventoryItem = (value: unknown): InventoryItem | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const amount = finiteNumber(data.amount);
    const weight = finiteNumber(data.weight);
    const equipped = booleanFlag(data.equipped);
    if (typeof data.item_id !== 'string' || typeof data.name !== 'string' ||
        typeof data.command_id !== 'string' || amount === undefined || weight === undefined ||
        typeof data.unit !== 'string' || typeof data.category !== 'string' ||
        equipped === undefined) {
        return null;
    }
    return {
        item_id: data.item_id,
        name: data.name,
        command_id: data.command_id,
        amount,
        unit: data.unit,
        weight,
        category: data.category,
        equipped,
        actions: parseActions(data.actions, itemActions),
    };
};

export const toInventorySnapshot = (payload: unknown): InventorySnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.items)) {
        return null;
    }
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        items: data.items
            .map(parseInventoryItem)
            .filter((item): item is InventoryItem => item !== null),
    };
};

const parseEquipmentSlot = (value: unknown): EquipmentSlot | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    if (typeof data.slot !== 'string' || typeof data.item_id !== 'string' ||
        typeof data.name !== 'string' || typeof data.command_id !== 'string' ||
        typeof data.type !== 'string') {
        return null;
    }
    return {
        slot: data.slot,
        item_id: data.item_id,
        name: data.name,
        command_id: data.command_id,
        type: data.type,
        actions: parseActions(data.actions, itemActions),
    };
};

export const toEquipmentSnapshot = (payload: unknown): EquipmentSnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.slot_order) || !Array.isArray(data.slots)) {
        return null;
    }
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        slot_order: data.slot_order.filter((slot): slot is string => typeof slot === 'string'),
        slots: data.slots
            .map(parseEquipmentSlot)
            .filter((slot): slot is EquipmentSlot => slot !== null),
    };
};

const entityTypes = new Set<RoomEntityType>(['npc', 'player', 'item', 'corpse', 'unknown']);

const safeEntityText = (value: unknown, required: boolean): string | undefined => {
    if (typeof value !== 'string' || /[\r\n]/.test(value) || value.length > 256 ||
        (required && value.length === 0)) {
        return undefined;
    }
    return value;
};

const parseRoomEntity = (value: unknown): RoomEntity | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const type = data.type;
    const name = safeEntityText(data.name, true);
    if (typeof data.entity_id !== 'string' || !entityIdPattern.test(data.entity_id) ||
        typeof type !== 'string' || !entityTypes.has(type as RoomEntityType) || !name) {
        return null;
    }
    const title = data.title === undefined ? undefined : safeEntityText(data.title, false);
    return {
        entity_id: data.entity_id,
        type: type as RoomEntityType,
        name,
        ...(title === undefined ? {} : { title }),
        actions: parseActions(data.actions, entityActions),
    };
};

export const toRoomEntitiesSnapshot = (payload: unknown): RoomEntitiesSnapshot | null => {
    const data = snapshotHeader(payload);
    if (!data || !Array.isArray(data.entities)) {
        return null;
    }
    const seen = new Set<string>();
    const entities = data.entities
        .map(parseRoomEntity)
        .filter((entity): entity is RoomEntity => {
            if (!entity || seen.has(entity.entity_id)) {
                return false;
            }
            seen.add(entity.entity_id);
            return true;
        });
    return {
        version: data.version as number,
        snapshot: true,
        revision: data.revision as number,
        sequence: data.sequence as number,
        entities,
    };
};
