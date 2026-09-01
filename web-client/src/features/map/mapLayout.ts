import type { ExploredMapGraph } from './exploredMap';

export interface MapPoint {
    x: number;
    y: number;
}

export interface MapBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface ExploredMapLayout {
    positions: Record<string, MapPoint>;
    bounds: MapBounds;
}

interface GridPoint {
    x: number;
    y: number;
    z: number;
}

interface LayoutNeighbor {
    roomId: string;
    command: string;
    vector: GridPoint;
}

const defaultBounds: MapBounds = {
    minX: -4,
    maxX: 4,
    minY: -3,
    maxY: 3,
};

const LAYOUT_STEP = 1.8;

const vector = (x: number, y: number, z = 0): GridPoint => ({ x, y, z });

const inverse = (value: GridPoint): GridPoint => vector(-value.x, -value.y, -value.z);

const hashCommand = (command: string): number => {
    let hash = 17;
    for (let index = 0; index < command.length; index += 1) {
        hash = (hash * 31 + command.charCodeAt(index)) >>> 0;
    }
    return hash;
};

const specialVector = (command: string): GridPoint => {
    const angle = (hashCommand(command) % 12) * (Math.PI / 6);
    return vector(Math.cos(angle), Math.sin(angle), 0);
};

export const commandVector = (command: string): GridPoint => {
    switch (command.toLowerCase()) {
        case 'north': return vector(0, -1);
        case 'south': return vector(0, 1);
        case 'east': return vector(1, 0);
        case 'west': return vector(-1, 0);
        case 'northeast': return vector(1, -1);
        case 'northwest': return vector(-1, -1);
        case 'southeast': return vector(1, 1);
        case 'southwest': return vector(-1, 1);
        case 'northup': return vector(0, -1, 1);
        case 'southup': return vector(0, 1, 1);
        case 'eastup': return vector(1, 0, 1);
        case 'westup': return vector(-1, 0, 1);
        case 'northdown': return vector(0, -1, -1);
        case 'southdown': return vector(0, 1, -1);
        case 'eastdown': return vector(1, 0, -1);
        case 'westdown': return vector(-1, 0, -1);
        case 'up': return vector(0, 0, 1);
        case 'down': return vector(0, 0, -1);
        default: return specialVector(command);
    }
};

const project = (point: GridPoint): MapPoint => ({
    x: point.x,
    y: point.y - point.z * 0.78,
});

const layoutVector = (point: GridPoint): GridPoint => vector(
    point.x * LAYOUT_STEP,
    point.y * LAYOUT_STEP,
    point.z * LAYOUT_STEP,
);

const add = (left: GridPoint, right: GridPoint): GridPoint => ({
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
});

const MIN_NODE_GAP = 0.95;

const collisionOffset = (attempt: number): MapPoint => {
    const ring = Math.floor((attempt + 1) / 4) + 1;
    const slot = attempt % 4;
    const amount = ring * 0.24;
    if (slot === 0) return { x: amount, y: 0 };
    if (slot === 1) return { x: -amount, y: 0 };
    if (slot === 2) return { x: 0, y: amount };
    return { x: 0, y: -amount };
};

const occupiedPoint = (
    point: MapPoint,
    occupied: MapPoint[],
    attemptStart = 0,
): MapPoint => {
    let candidate = point;
    for (let attempt = attemptStart; attempt < attemptStart + 128; attempt += 1) {
        if (!occupied.some((other) =>
            Math.hypot(candidate.x - other.x, candidate.y - other.y) < MIN_NODE_GAP)) {
            return candidate;
        }
        const offset = collisionOffset(attempt);
        candidate = { x: point.x + offset.x, y: point.y + offset.y };
    }
    return candidate;
};

const orderedNodeIds = (graph: ExploredMapGraph): string[] => {
    const known = new Set<string>(graph.visited_order);
    return [
        ...graph.visited_order,
        ...Object.keys(graph.nodes).filter((roomId) => !known.has(roomId)).sort(),
    ];
};

export const layoutExploredMap = (graph: ExploredMapGraph): ExploredMapLayout => {
    const nodeIds = orderedNodeIds(graph);
    if (nodeIds.length === 0) {
        return { positions: {}, bounds: defaultBounds };
    }

    const adjacency: Record<string, LayoutNeighbor[]> = {};
    nodeIds.forEach((roomId) => { adjacency[roomId] = []; });
    Object.values(graph.edges).forEach((edge) => {
        const edgeVector = layoutVector(commandVector(edge.command));
        if (!adjacency[edge.from_room_id]) adjacency[edge.from_room_id] = [];
        if (!adjacency[edge.to_room_id]) adjacency[edge.to_room_id] = [];
        adjacency[edge.from_room_id].push({
            roomId: edge.to_room_id,
            command: edge.command,
            vector: edgeVector,
        });
        adjacency[edge.to_room_id].push({
            roomId: edge.from_room_id,
            command: edge.command,
            vector: inverse(edgeVector),
        });
    });
    Object.values(adjacency).forEach((neighbors) => {
        neighbors.sort((left, right) => {
            const commandOrder = left.command.localeCompare(right.command);
            return commandOrder || left.roomId.localeCompare(right.roomId);
        });
    });

    const positions: Record<string, MapPoint> = {};
    const positioned = new Set<string>();
    let componentCursor = 0;
    const componentGap = 4.5;

    nodeIds.forEach((rootRoomId) => {
        if (positioned.has(rootRoomId)) {
            return;
        }
        const local: Record<string, GridPoint> = {
            [rootRoomId]: vector(0, 0, 0),
        };
        const queue = [rootRoomId];
        const localOccupied: MapPoint[] = [{ x: 0, y: 0 }];
        while (queue.length > 0) {
            const roomId = queue.shift() as string;
            (adjacency[roomId] ?? []).forEach((neighbor) => {
                if (local[neighbor.roomId]) {
                    return;
                }
                const candidateGrid = add(local[roomId], neighbor.vector);
                const candidate = project(candidateGrid);
                const placed = occupiedPoint(candidate, localOccupied);
                local[neighbor.roomId] = {
                    x: candidateGrid.x + placed.x - candidate.x,
                    y: candidateGrid.y + placed.y - candidate.y,
                    z: candidateGrid.z,
                };
                localOccupied.push(placed);
                queue.push(neighbor.roomId);
            });
        }

        const localPoints = Object.values(local).map(project);
        const localMinX = Math.min(...localPoints.map((point) => point.x));
        const localMaxX = Math.max(...localPoints.map((point) => point.x));
        const localMinY = Math.min(...localPoints.map((point) => point.y));
        const localMaxY = Math.max(...localPoints.map((point) => point.y));
        const shiftX = componentCursor - localMinX;
        const shiftY = -localMinY;
        Object.entries(local).forEach(([roomId, point]) => {
            const projected = project(point);
            positions[roomId] = {
                x: projected.x + shiftX,
                y: projected.y + shiftY,
            };
            positioned.add(roomId);
        });
        componentCursor += (localMaxX - localMinX) + componentGap;
    });

    const mapPoints = Object.values(positions);
    return {
        positions,
        bounds: {
            minX: Math.min(...mapPoints.map((point) => point.x)) - 1.6,
            maxX: Math.max(...mapPoints.map((point) => point.x)) + 1.6,
            minY: Math.min(...mapPoints.map((point) => point.y)) - 1.6,
            maxY: Math.max(...mapPoints.map((point) => point.y)) + 1.6,
        },
    };
};

export const exitOffset = (command: string, lane = 0): MapPoint => {
    const raw = project(commandVector(command));
    const length = Math.hypot(raw.x, raw.y) || 1;
    const perpendicular = { x: -raw.y / length, y: raw.x / length };
    const laneOffset = lane * 0.28;
    return {
        x: (raw.x / length) * 1.65 + perpendicular.x * laneOffset,
        y: (raw.y / length) * 1.65 + perpendicular.y * laneOffset,
    };
};

export const addMapPoint = (left: MapPoint, right: MapPoint): MapPoint => ({
    x: left.x + right.x,
    y: left.y + right.y,
});
