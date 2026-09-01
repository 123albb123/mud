import { describe, expect, it } from 'vitest';
import type { RoomMapSnapshot, RoomMapTransition } from '../../protocol/gmcp/gmcp';
import {
    applyRoomMapSnapshot,
    applyRoomMapTransition,
    createEmptyExploredMapGraph,
} from './exploredMap';
import { commandVector, layoutExploredMap } from './mapLayout';

const snapshot = (roomId: string, name = roomId): RoomMapSnapshot => ({
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    current_room_id: roomId,
    room: { room_id: roomId, name },
    exits: [],
});

const transition = (
    sequence: number,
    fromRoomId: string,
    toRoomId: string,
    command = 'east',
): RoomMapTransition => ({
    version: 1,
    sequence,
    from_room_id: fromRoomId,
    to_room_id: toRoomId,
    command,
    label: command,
    kind: 'move',
});

describe('session explored map', () => {
    it('records each arrived room once per room change and does not infer teleport edges', () => {
        let graph = createEmptyExploredMapGraph();
        graph = applyRoomMapSnapshot(graph, snapshot('r-test-0001', '起点'), 1);
        graph = applyRoomMapSnapshot(graph, snapshot('r-test-0001', '起点'), 2);
        graph = applyRoomMapSnapshot(graph, snapshot('r-test-0002', '东街'), 3);
        graph = applyRoomMapSnapshot(graph, snapshot('r-test-0009', '传送点'), 4);

        expect(Object.keys(graph.nodes)).toHaveLength(3);
        expect(graph.nodes['r-test-0001'].visit_count).toBe(1);
        expect(graph.nodes['r-test-0002'].visit_count).toBe(1);
        expect(graph.nodes['r-test-0009'].visit_count).toBe(1);
        expect(Object.keys(graph.edges)).toHaveLength(0);
        expect(graph.current_room_id).toBe('r-test-0009');
    });

    it('waits for missing sequence and node metadata, then keeps directed traversals distinct', () => {
        let graph = createEmptyExploredMapGraph();
        graph = applyRoomMapSnapshot(graph, snapshot('r-test-0001', '一'), 1);
        graph = applyRoomMapSnapshot(graph, snapshot('r-test-0002', '二'), 2);
        graph = applyRoomMapSnapshot(graph, snapshot('r-test-0003', '三'), 3);

        graph = applyRoomMapTransition(graph, transition(2, 'r-test-0002', 'r-test-0003', 'south'), 5);
        expect(graph.pending_transitions).toHaveLength(1);
        graph = applyRoomMapTransition(graph, transition(1, 'r-test-0001', 'r-test-0002'), 6);
        expect(graph.pending_transitions).toHaveLength(0);
        expect(graph.last_transition_sequence).toBe(2);
        expect(Object.keys(graph.edges)).toHaveLength(2);

        graph = applyRoomMapTransition(graph, transition(3, 'r-test-0002', 'r-test-0003'), 7);
        graph = applyRoomMapTransition(graph, transition(3, 'r-test-0002', 'r-test-0003'), 8);
        graph = applyRoomMapTransition(graph, transition(4, 'r-test-0003', 'r-test-0002', 'west'), 9);
        graph = applyRoomMapTransition(graph, transition(5, 'r-test-0002', 'r-test-0003'), 10);
        expect(Object.keys(graph.edges)).toHaveLength(4);
        expect(graph.edges['["r-test-0002","east","r-test-0003"]'].traversals).toBe(2);
        expect(graph.edges['["r-test-0003","west","r-test-0002"]'].traversals).toBe(1);
    });

    it('handles 20, 100, and 500 nodes without NaN layout coordinates', () => {
        [20, 100, 500].forEach((count) => {
            let graph = createEmptyExploredMapGraph();
            for (let index = 0; index < count; index += 1) {
                graph = applyRoomMapSnapshot(graph, snapshot(`r-perf-${index}`, `房间${index}`), index + 1);
                if (index > 0) {
                    graph = applyRoomMapTransition(
                        graph,
                        transition(index, `r-perf-${index - 1}`, `r-perf-${index}`),
                        index + 1,
                    );
                }
            }
            const layout = layoutExploredMap(graph);
            expect(Object.keys(layout.positions)).toHaveLength(count);
            Object.values(layout.positions).forEach((point) => {
                expect(Number.isFinite(point.x)).toBe(true);
                expect(Number.isFinite(point.y)).toBe(true);
            });
            expect(Number.isFinite(layout.bounds.minX)).toBe(true);
            expect(Number.isFinite(layout.bounds.maxY)).toBe(true);
        });
    });

    it('keeps colliding visual positions separate and preserves vertical levels', () => {
        let graph = createEmptyExploredMapGraph();
        ['a', 'b', 'c', 'd'].forEach((roomId, index) => {
            graph = applyRoomMapSnapshot(graph, snapshot(`r-collision-${roomId}`), index + 1);
        });
        graph = applyRoomMapTransition(graph, transition(1, 'r-collision-a', 'r-collision-b', 'east'), 5);
        graph = applyRoomMapTransition(graph, transition(2, 'r-collision-b', 'r-collision-c', 'west'), 6);
        graph = applyRoomMapTransition(graph, transition(3, 'r-collision-b', 'r-collision-d', 'south'), 7);

        const layout = layoutExploredMap(graph);
        const points = Object.values(layout.positions);
        expect(points).toHaveLength(4);
        points.forEach((point, index) => {
            points.slice(index + 1).forEach((other) => {
                expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(0.95);
            });
        });
        expect(commandVector('up')).toMatchObject({ x: 0, y: 0, z: 1 });
        expect(commandVector('down')).toMatchObject({ x: 0, y: 0, z: -1 });
    });
});
