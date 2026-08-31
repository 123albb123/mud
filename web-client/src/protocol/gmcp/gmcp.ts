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
