import type { RoomInfo, RoomMapSnapshot, RoomMapTransition } from '../../protocol/gmcp/gmcp';

export interface ExploredMapNode {
    room_id: string;
    name: string;
    area?: string;
    first_seen: number;
    last_seen: number;
    visit_count: number;
}

export interface ExploredMapEdge {
    edge_id: string;
    from_room_id: string;
    to_room_id: string;
    command: string;
    label: string;
    kind: 'move';
    area?: boolean;
    first_seen: number;
    last_seen: number;
    traversals: number;
}

export interface ExploredMapGraph {
    nodes: Record<string, ExploredMapNode>;
    edges: Record<string, ExploredMapEdge>;
    visited_order: string[];
    pending_transitions: RoomMapTransition[];
    current_room_id: string | null;
    last_transition_sequence: number;
}

export const createEmptyExploredMapGraph = (): ExploredMapGraph => ({
    nodes: {},
    edges: {},
    visited_order: [],
    pending_transitions: [],
    current_room_id: null,
    last_transition_sequence: 0,
});

export const EMPTY_EXPLORED_MAP_GRAPH = createEmptyExploredMapGraph();

const roomIdPattern = /^[A-Za-z0-9_-]{1,96}$/;

const validRoomId = (value: unknown): value is string =>
    typeof value === 'string' && roomIdPattern.test(value);

const nowValue = (now?: number): number =>
    typeof now === 'number' && Number.isFinite(now) ? now : Date.now();

const nodeName = (name: string | undefined): string =>
    name && name.trim() ? name : '未命名房间';

const sameOptionalText = (value: string | undefined): string | undefined =>
    value && value.trim() ? value : undefined;

const mergeNode = (
    graph: ExploredMapGraph,
    roomId: string,
    name: string | undefined,
    area: string | undefined,
    now: number,
): ExploredMapGraph => {
    if (!validRoomId(roomId)) {
        return graph;
    }

    const current = graph.nodes[roomId];
    const nameValue = nodeName(name);
    const areaValue = sameOptionalText(area);
    const entered = graph.current_room_id !== roomId;
    const nextNode: ExploredMapNode = current
        ? {
            ...current,
            name: nameValue === '未命名房间' && current.name !== '未命名房间'
                ? current.name
                : nameValue,
            ...(areaValue ? { area: areaValue } : {}),
            last_seen: now,
            visit_count: current.visit_count + (entered ? 1 : 0),
        }
        : {
            room_id: roomId,
            name: nameValue,
            ...(areaValue ? { area: areaValue } : {}),
            first_seen: now,
            last_seen: now,
            visit_count: 1,
        };

    return {
        ...graph,
        nodes: { ...graph.nodes, [roomId]: nextNode },
        visited_order: current ? graph.visited_order : [...graph.visited_order, roomId],
        current_room_id: roomId,
    };
};

const edgeId = (transition: RoomMapTransition): string =>
    JSON.stringify([transition.from_room_id, transition.command, transition.to_room_id]);

const applyOrderedTransition = (
    graph: ExploredMapGraph,
    transition: RoomMapTransition,
    now: number,
): ExploredMapGraph => {
    if (!graph.nodes[transition.from_room_id] || !graph.nodes[transition.to_room_id]) {
        return graph;
    }

    const id = edgeId(transition);
    const current = graph.edges[id];
    const nextEdge: ExploredMapEdge = current
        ? {
            ...current,
            label: transition.label,
            ...(transition.area === undefined ? {} : { area: transition.area }),
            last_seen: now,
            traversals: current.traversals + 1,
        }
        : {
            edge_id: id,
            from_room_id: transition.from_room_id,
            to_room_id: transition.to_room_id,
            command: transition.command,
            label: transition.label,
            kind: 'move',
            ...(transition.area === undefined ? {} : { area: transition.area }),
            first_seen: now,
            last_seen: now,
            traversals: 1,
        };

    return {
        ...graph,
        edges: { ...graph.edges, [id]: nextEdge },
    };
};

const drainPendingTransitions = (input: ExploredMapGraph, now: number): ExploredMapGraph => {
    let graph = input;
    let pending = [...input.pending_transitions]
        .sort((left, right) => left.sequence - right.sequence);

    while (pending.length > 0) {
        const next = pending[0];
        if (next.sequence <= graph.last_transition_sequence) {
            pending = pending.slice(1);
            continue;
        }
        if (next.sequence !== graph.last_transition_sequence + 1 ||
            !graph.nodes[next.from_room_id] || !graph.nodes[next.to_room_id]) {
            break;
        }
        graph = applyOrderedTransition(graph, next, now);
        graph = { ...graph, last_transition_sequence: next.sequence };
        pending = pending.slice(1);
    }

    return pending.length === input.pending_transitions.length && graph === input
        ? input
        : { ...graph, pending_transitions: pending };
};

const addPendingTransition = (
    graph: ExploredMapGraph,
    transition: RoomMapTransition,
): ExploredMapGraph => {
    if (transition.sequence <= graph.last_transition_sequence ||
        graph.pending_transitions.some((item) => item.sequence === transition.sequence)) {
        return graph;
    }
    return {
        ...graph,
        pending_transitions: [...graph.pending_transitions, transition],
    };
};

export const applyRoomMapSnapshot = (
    graph: ExploredMapGraph,
    snapshot: RoomMapSnapshot,
    now?: number,
): ExploredMapGraph => {
    const timestamp = nowValue(now);
    const next = mergeNode(
        graph,
        snapshot.current_room_id,
        snapshot.room.name,
        snapshot.room.area,
        timestamp,
    );
    return drainPendingTransitions(next, timestamp);
};

export const applyRoomInfo = (
    graph: ExploredMapGraph,
    room: RoomInfo,
    now?: number,
): ExploredMapGraph => {
    if (!validRoomId(room.room_id)) {
        return graph;
    }
    const timestamp = nowValue(now);
    const next = mergeNode(graph, room.room_id, room.name, room.area, timestamp);
    return drainPendingTransitions(next, timestamp);
};

export const applyRoomMapTransition = (
    graph: ExploredMapGraph,
    transition: RoomMapTransition,
    now?: number,
): ExploredMapGraph => {
    if (transition.version !== 1 || transition.kind !== 'move' ||
        !Number.isInteger(transition.sequence) || transition.sequence <= 0 ||
        !validRoomId(transition.from_room_id) || !validRoomId(transition.to_room_id) ||
        transition.from_room_id === transition.to_room_id) {
        return graph;
    }

    const queued = addPendingTransition(graph, transition);
    if (queued === graph) {
        return graph;
    }
    return drainPendingTransitions(queued, nowValue(now));
};

export const exploredMapCounts = (graph: ExploredMapGraph): { nodes: number; edges: number } => ({
    nodes: Object.keys(graph.nodes).length,
    edges: Object.keys(graph.edges).length,
});
