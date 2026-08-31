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
    command: string;
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

const decoder = new TextDecoder('utf-8');

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

const parseAction = (value: unknown): GMCPAction | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    if (typeof data.id !== 'string' || typeof data.command !== 'string' || /[\r\n]/.test(data.command)) {
        return null;
    }
    return { id: data.id, command: data.command };
};

const parseActions = (value: unknown): GMCPAction[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map(parseAction).filter((action): action is GMCPAction => action !== null);
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
        actions: parseActions(data.actions),
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
        actions: parseActions(data.actions),
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
