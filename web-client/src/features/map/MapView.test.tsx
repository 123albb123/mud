import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { roomMapFixture } from '../../test/fixtures/gmcp';
import {
    applyRoomMapSnapshot,
    applyRoomMapTransition,
    createEmptyExploredMapGraph,
} from './exploredMap';
import { MapView } from './MapView';

const graphWithConfirmedEdge = () => {
    let graph = createEmptyExploredMapGraph();
    graph = applyRoomMapSnapshot(graph, roomMapFixture, 1);
    graph = applyRoomMapSnapshot(graph, {
        ...roomMapFixture,
        current_room_id: 'r-test-0002',
        room: { room_id: 'r-test-0002', name: '北面街道', area: 'city' },
        exits: [],
    }, 2);
    graph = applyRoomMapSnapshot(graph, roomMapFixture, 3);
    return applyRoomMapTransition(graph, {
        version: 1,
        sequence: 1,
        from_room_id: 'r-test-0001',
        to_room_id: 'r-test-0002',
        command: 'north',
        label: '北',
        kind: 'move',
    }, 4);
};

describe('MapView', () => {
    it('renders real current and adjacent rooms and sends an opaque exit id', () => {
        const onMove = vi.fn();
        render(<MapView connected snapshot={roomMapFixture} onMove={onMove} />);

        expect(screen.getByRole('heading', { name: '地图' })).toBeInTheDocument();
        expect(screen.getByText('扬州客店')).toBeInTheDocument();
        expect(screen.getByText('北面街道')).toBeInTheDocument();
        expect(screen.getAllByText('尚未探索').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: /东东面渡口/ }));
        expect(onMove).toHaveBeenCalledWith('x-test-0002');
        expect(onMove).not.toHaveBeenCalledWith('east');
        expect(screen.getByRole('button', { name: /桃花渡/ })).toBeDisabled();
    });

    it('keeps unresolved and conditional exits actionable while disabling dynamic exits', () => {
        const onMove = vi.fn();
        render(<MapView connected snapshot={roomMapFixture} onMove={onMove} />);

        const unresolved = screen.getByRole('button', { name: /^西/ });
        const conditional = screen.getByRole('button', { name: /^上/ });
        expect(unresolved).not.toBeDisabled();
        expect(conditional).not.toBeDisabled();
        expect(screen.getAllByText('尚未探索').length).toBeGreaterThan(0);
        expect(screen.getByText('可能受条件影响')).toBeInTheDocument();

        fireEvent.click(unresolved);
        fireEvent.click(conditional);
        expect(onMove).toHaveBeenNthCalledWith(1, 'x-test-0006');
        expect(onMove).toHaveBeenNthCalledWith(2, 'x-test-0003');
        expect(screen.getByRole('button', { name: /桃花渡/ })).toBeDisabled();
    });

    it('keeps disconnected and empty map states free of movement controls', () => {
        const onMove = vi.fn();
        render(<MapView connected={false} snapshot={null} onMove={onMove} />);

        expect(screen.getByText('尚未连接江湖')).toBeInTheDocument();
        expect(screen.getByText('连接服务器后显示当前房间地图。')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /东/ })).not.toBeInTheDocument();
        expect(onMove).not.toHaveBeenCalled();
    });

    it('renders confirmed graph edges and keeps viewport controls local and non-optimistic', () => {
        const onMove = vi.fn();
        const { container } = render(
            <MapView
                connected
                exploredMap={graphWithConfirmedEdge()}
                onMove={onMove}
                snapshot={roomMapFixture}
            />,
        );

        expect(screen.getByRole('button', { name: '扬州客店，当前位置' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '北面街道' })).toBeInTheDocument();
        expect(container.querySelectorAll('.map-graph-edge')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: '放大地图' }));
        expect(screen.getByText('110%')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '缩小地图' }));
        expect(screen.getByText('100%')).toBeInTheDocument();

        const canvas = screen.getByLabelText('会话探索地图画布');
        const graphGroup = container.querySelector('.map-graph-svg > g');
        const beforePan = graphGroup?.getAttribute('transform');
        fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
        fireEvent.pointerMove(canvas, { clientX: 140, clientY: 120, pointerId: 1 });
        fireEvent.pointerUp(canvas, { clientX: 140, clientY: 120, pointerId: 1 });
        expect(graphGroup?.getAttribute('transform')).not.toBe(beforePan);

        fireEvent.click(screen.getByRole('button', { name: /^西/ }));
        expect(onMove).toHaveBeenCalledWith('x-test-0006');
        expect(container.querySelectorAll('.map-graph-edge')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: '北面街道' }));
        expect(screen.getByLabelText('房间详情')).toBeInTheDocument();
        expect(screen.getByText('到访')).toBeInTheDocument();
    });
});
