export interface GMCPMessage {
    packageName: string;
    payload: unknown;
    rawPayload: string;
    error?: string;
}

export interface CharacterVitals {
    hp?: number;
    max_hp?: number;
    jing?: number;
    max_jing?: number;
    jingli?: number;
    max_jingli?: number;
    neili?: number;
    max_neili?: number;
}

export interface RoomInfo {
    name?: string;
    area?: string;
    exits: string[];
    room_id?: string;
    hash?: string;
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

const decoder = new TextDecoder('utf-8');

export const GMCP_CLIENT_HELLO = {
    client: 'Yanhuang Web',
    version: '0.2.1',
};

export const GMCP_SUPPORTS = [
    'Char.Vitals 1',
    'Room.Info 1',
    'Room.Entities 1',
    'Char.Inventory 1',
    'Char.Equipment 1',
];

export const GMCP_INITIAL_GETS = [
    'Char.Vitals.Get',
    'Room.Info.Get',
    'Room.Entities.Get',
    'Char.Inventory.Get',
    'Char.Equipment.Get',
];

const itemActions = new Set([
    'look', 'drop', 'eat', 'drink', 'wield', 'unwield', 'wear', 'remove',
]);
const entityActions = new Set([
    'look', 'get', 'talk', 'ask', 'fight', 'kill', 'give',
]);
const itemIdPattern = /^i-[A-Za-z0-9]+-[0-9]+$/;
const entityIdPattern = /^e-[A-Za-z0-9]+-[0-9]+$/;

export interface WebItemActionRequest {
    item_id: string;
    action: string;
}

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
    return {
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
