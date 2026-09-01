import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { RoomMapExit, RoomMapSnapshot } from '../../protocol/gmcp/gmcp';
import {
    applyRoomMapSnapshot,
    EMPTY_EXPLORED_MAP_GRAPH,
    exploredMapCounts,
    type ExploredMapGraph,
} from './exploredMap';
import { addMapPoint, exitOffset, layoutExploredMap, type MapPoint } from './mapLayout';

export interface MapViewProps {
    connected: boolean;
    snapshot: RoomMapSnapshot | null;
    onMove: (exitId: string) => void;
    exploredMap?: ExploredMapGraph;
}

const clampZoom = (value: number): number =>
    Number.isFinite(value) ? Math.min(2, Math.max(0.5, Number(value.toFixed(2)))) : 1;

const MapHeading = ({
    connected,
    nodeCount,
    edgeCount,
}: {
    connected: boolean;
    nodeCount: number;
    edgeCount: number;
}) => (
    <div className="page-heading">
        <div className="page-heading-icon map-heading-mark" aria-hidden="true">图</div>
        <div>
            <h1>地图</h1>
            <p className="page-heading-description">服务器确认移动后，逐步记录本次连接中真正走过的房间。</p>
        </div>
        <div className="page-heading-action map-heading-stats">
            <span className={'map-status ' + (connected ? 'map-status-live' : 'map-status-muted')}>
                {connected ? '实时同步' : '未同步'}
            </span>
            <small>{nodeCount} 房间 · {edgeCount} 路线</small>
        </div>
    </div>
);

const ExitStatus = ({ exit }: { exit: RoomMapExit }) => {
    if (exit.dynamic) {
        return <span className="map-exit-status">特殊通路</span>;
    }
    if (!exit.resolved) {
        return <span className="map-exit-status">尚未探索</span>;
    }
    if (exit.conditional) {
        return <span className="map-exit-status">可能受条件影响</span>;
    }
    return <span className="map-exit-status">已知邻接</span>;
};

const MapExitButton = ({
    connected,
    exit,
    onMove,
}: {
    connected: boolean;
    exit: RoomMapExit;
    onMove: (exitId: string) => void;
}) => {
    const canMove = connected && !exit.dynamic;
    const description = exit.destination_name || (exit.dynamic ? '特殊通路' : '尚未探索');
    return (
        <button
            className={'map-exit-button ' + (exit.resolved ? 'is-known' : 'is-unknown') + (exit.conditional ? ' is-conditional' : '')}
            data-exit-id={exit.exit_id}
            disabled={!canMove}
            onClick={() => onMove(exit.exit_id)}
            title={description}
            type="button"
        >
            <span className="map-exit-label">{exit.label}</span>
            <span className="map-exit-copy">{description}</span>
            <ExitStatus exit={exit} />
        </button>
    );
};

const nodeLabel = (name: string): string => name || '未命名房间';

const edgePairKey = (fromRoomId: string, toRoomId: string): string =>
    JSON.stringify([fromRoomId, toRoomId].sort());

const edgeLaneMap = (edges: ExploredMapGraph['edges']): Record<string, number> => {
    const groups = new Map<string, ExploredMapGraph['edges'][string][]>();
    Object.values(edges).forEach((edge) => {
        const key = edgePairKey(edge.from_room_id, edge.to_room_id);
        groups.set(key, [...(groups.get(key) ?? []), edge]);
    });

    const lanes: Record<string, number> = {};
    groups.forEach((group) => {
        group.sort((left, right) => left.edge_id.localeCompare(right.edge_id));
        group.forEach((edge, index) => {
            lanes[edge.edge_id] = index - (group.length - 1) / 2;
        });
    });
    return lanes;
};

const lanePoint = (point: MapPoint, perpendicular: MapPoint, lane: number): MapPoint => ({
    x: point.x + perpendicular.x * lane * 0.12,
    y: point.y + perpendicular.y * lane * 0.12,
});

const GraphCanvas = ({
    connected,
    snapshot,
    exploredMap,
    onMove,
}: {
    connected: boolean;
    snapshot: RoomMapSnapshot;
    exploredMap: ExploredMapGraph;
    onMove: (exitId: string) => void;
}) => {
    const layout = useMemo(() => layoutExploredMap(exploredMap), [exploredMap]);
    const currentPosition = layout.positions[snapshot.current_room_id] ?? { x: 0, y: 0 };
    const counts = exploredMapCounts(exploredMap);
    const viewBox = layout.bounds;
    const viewCenter = {
        x: (viewBox.minX + viewBox.maxX) / 2,
        y: (viewBox.minY + viewBox.maxY) / 2,
    };
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<MapPoint>({ x: 0, y: 0 });
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ pointerX: number; pointerY: number; pan: MapPoint } | null>(null);
    const previousRoomId = useRef<string | null>(null);

    const graphNodes = useMemo(
        () => Object.values(exploredMap.nodes),
        [exploredMap.nodes],
    );
    const graphEdges = useMemo(
        () => Object.values(exploredMap.edges),
        [exploredMap.edges],
    );
    const graphEdgeLanes = useMemo(() => edgeLaneMap(exploredMap.edges), [exploredMap.edges]);
    const previewExits = useMemo(() => {
        const lanes = new Map<string, number>();
        return snapshot.exits
            .filter((exit) => Boolean(exit.destination_room_id) && !exit.dynamic)
            .map((exit) => {
                const commandLane = lanes.get(exit.command) ?? 0;
                lanes.set(exit.command, commandLane + 1);
                const destination = exit.destination_room_id as string;
                const position = layout.positions[destination] ?? addMapPoint(
                    currentPosition,
                    exitOffset(exit.command, commandLane),
                );
                return {
                    exit,
                    destination,
                    position,
                    visited: Boolean(layout.positions[destination]),
                };
            });
    }, [currentPosition, layout.positions, snapshot.exits]);

    useEffect(() => {
        if (previousRoomId.current !== null && previousRoomId.current !== snapshot.current_room_id) {
            const nextZoom = clampZoom(Math.max(1.15, zoom));
            setZoom(nextZoom);
            setPan({
                x: viewCenter.x - nextZoom * currentPosition.x,
                y: viewCenter.y - nextZoom * currentPosition.y,
            });
        }
        previousRoomId.current = snapshot.current_room_id;
    }, [currentPosition.x, currentPosition.y, snapshot.current_room_id, viewCenter.x, viewCenter.y, zoom]);

    const changeZoom = (delta: number) => {
        setZoom((current) => clampZoom(current + delta));
    };

    const fitMap = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const locateCurrent = () => {
        const nextZoom = clampZoom(Math.max(1.2, zoom));
        setZoom(nextZoom);
        setPan({
            x: viewCenter.x - nextZoom * currentPosition.x,
            y: viewCenter.y - nextZoom * currentPosition.y,
        });
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, pan };
        setDragging(true);
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        const viewport = viewportRef.current;
        if (!drag || !viewport) {
            return;
        }
        const rect = viewport.getBoundingClientRect();
        const width = Math.max(rect.width, 1);
        const height = Math.max(rect.height, 1);
        setPan({
            x: drag.pan.x + ((event.clientX - drag.pointerX) / width) * (viewBox.maxX - viewBox.minX) / zoom,
            y: drag.pan.y + ((event.clientY - drag.pointerY) / height) * (viewBox.maxY - viewBox.minY) / zoom,
        });
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        dragRef.current = null;
        setDragging(false);
    };

    const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        changeZoom(event.deltaY > 0 ? -0.1 : 0.1);
    };

    const selectedNode = selectedRoomId ? exploredMap.nodes[selectedRoomId] : undefined;

    return (
        <div className="map-graph-shell">
            <div className="map-graph-toolbar">
                <div className="map-graph-summary">
                    <span><i className="map-legend-dot is-current" />当前位置</span>
                    <span><i className="map-legend-dot is-visited" />已走过</span>
                    <span><i className="map-legend-dot is-preview" />当前邻接</span>
                    <small>{counts.nodes} 房间 / {counts.edges} 条已确认路线</small>
                </div>
                <div className="map-graph-controls" aria-label="地图视图控制">
                    <button aria-label="缩小地图" onClick={() => changeZoom(-0.1)} type="button">−</button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button aria-label="放大地图" onClick={() => changeZoom(0.1)} type="button">＋</button>
                    <button aria-label="定位当前房间" onClick={locateCurrent} type="button">定位当前</button>
                    <button aria-label="适应整张地图" onClick={fitMap} type="button">适应地图</button>
                </div>
            </div>
            <div
                aria-label="会话探索地图画布"
                className={'map-graph-viewport' + (dragging ? ' is-dragging' : '')}
                onPointerCancel={handlePointerUp}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
                ref={viewportRef}
            >
                <svg className="map-graph-svg" role="img" viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.maxX - viewBox.minX} ${viewBox.maxY - viewBox.minY}`}>
                    <defs>
                        <marker id="map-edge-arrow" markerHeight="5" markerWidth="5" orient="auto-start-reverse" refX="4" refY="2.5" viewBox="0 0 5 5">
                            <path d="M 0 0 L 5 2.5 L 0 5 z" />
                        </marker>
                    </defs>
                    <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                        {graphEdges.map((edge) => {
                            const fromBase = layout.positions[edge.from_room_id];
                            const toBase = layout.positions[edge.to_room_id];
                            if (!fromBase || !toBase) {
                                return null;
                            }
                            const delta = { x: toBase.x - fromBase.x, y: toBase.y - fromBase.y };
                            const length = Math.hypot(delta.x, delta.y) || 1;
                            const perpendicular = { x: -delta.y / length, y: delta.x / length };
                            const lane = graphEdgeLanes[edge.edge_id] ?? 0;
                            const from = lanePoint(fromBase, perpendicular, lane);
                            const to = lanePoint(toBase, perpendicular, lane);
                            const midpoint = lanePoint({
                                x: (fromBase.x + toBase.x) / 2,
                                y: (fromBase.y + toBase.y) / 2,
                            }, perpendicular, lane);
                            return (
                                <g key={edge.edge_id} className="map-graph-edge-group">
                                    <line className="map-graph-edge" markerEnd="url(#map-edge-arrow)" x1={from.x} x2={to.x} y1={from.y} y2={to.y} />
                                    <text className="map-graph-edge-label" x={midpoint.x} y={midpoint.y}>{edge.label}</text>
                                </g>
                            );
                        })}
                        {previewExits.map(({ exit, position, destination, visited }) => (
                            <line
                                className={'map-graph-preview-edge' + (visited ? ' is-visited-destination' : '')}
                                key={`preview-${exit.exit_id}-${destination}`}
                                x1={currentPosition.x}
                                x2={position.x}
                                y1={currentPosition.y}
                                y2={position.y}
                            />
                        ))}
                        {graphNodes.map((node) => {
                            const position = layout.positions[node.room_id];
                            if (!position) {
                                return null;
                            }
                            const current = node.room_id === snapshot.current_room_id;
                            return (
                                <g
                                    aria-label={current ? `${nodeLabel(node.name)}，当前位置` : nodeLabel(node.name)}
                                    className={'map-graph-node' + (current ? ' is-current' : ' is-visited') + (selectedRoomId === node.room_id ? ' is-selected' : '')}
                                    key={node.room_id}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedRoomId(node.room_id);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setSelectedRoomId(node.room_id);
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <circle cx={position.x} cy={position.y} r={current ? 0.48 : 0.37} />
                                    <text x={position.x} y={position.y - (current ? 0.62 : 0.55)}>{nodeLabel(node.name)}</text>
                                </g>
                            );
                        })}
                        {previewExits.filter(({ visited }) => !visited).map(({ exit, position, destination }) => (
                            <g
                                aria-label={`${exit.label}，${exit.destination_name || '尚未探索'}`}
                                className={'map-graph-ghost-node' + (exit.conditional ? ' is-conditional' : '')}
                                key={`ghost-${exit.exit_id}-${destination}`}
                            >
                                <circle cx={position.x} cy={position.y} r="0.31" />
                                <text x={position.x} y={position.y - 0.5}>{exit.label}</text>
                            </g>
                        ))}
                    </g>
                </svg>
            </div>
            <div className="map-current-marker-note"><span className="map-current-marker-icon" />青色标记为当前位置；实线箭头只代表服务器发来的真实移动。</div>
            {selectedNode && (
                <div className="map-node-details" aria-label="房间详情">
                    <div><span>房间</span><strong>{nodeLabel(selectedNode.name)}</strong></div>
                    {selectedNode.area && <div><span>区域</span><strong>{selectedNode.area}</strong></div>}
                    <div><span>到访</span><strong>{selectedNode.visit_count} 次</strong></div>
                    <button onClick={() => setSelectedRoomId(null)} type="button">收起</button>
                </div>
            )}
            <div className="map-exit-dock map-current-exit-dock" aria-label="当前真实出口">
                <div className="map-exit-dock-heading"><span>当前真实出口</span><small>点击后由服务器重新校验并执行原版规则</small></div>
                <div className="map-exit-dock-list">
                    {snapshot.exits.map((exit) => <MapExitButton connected={connected} exit={exit} key={exit.exit_id} onMove={onMove} />)}
                </div>
            </div>
        </div>
    );
};

const MapBoard = ({
    connected,
    snapshot,
    exploredMap,
    onMove,
}: MapViewProps & { exploredMap: ExploredMapGraph }) => {
    if (!snapshot) {
        return (
            <div className="map-board map-board-empty">
                <div className="map-grid-lines" />
                <div className="map-empty-state">
                    <div className="map-empty-mark" aria-hidden="true">图</div>
                    <strong>{connected ? '等待真实房间数据' : '尚未连接江湖'}</strong>
                    <span>{connected ? '服务器返回 Room.Map 后显示当前房间与会话探索图。' : '连接服务器后显示当前房间地图。'}</span>
                </div>
                <div className="map-compass" aria-hidden="true"><span>北</span><i /></div>
            </div>
        );
    }

    return (
        <div className="map-board map-board-graph">
            <div className="map-grid-lines" />
            <div className="map-water water-one" />
            <div className="map-water water-two" />
            <GraphCanvas connected={connected} exploredMap={exploredMap} onMove={onMove} snapshot={snapshot} />
            <div className="map-compass" aria-hidden="true"><span>北</span><i /></div>
        </div>
    );
};

export const MapView = ({ connected, exploredMap, snapshot, onMove }: MapViewProps) => {
    const visibleGraph = useMemo(() => {
        const base = connected ? (exploredMap ?? EMPTY_EXPLORED_MAP_GRAPH) : EMPTY_EXPLORED_MAP_GRAPH;
        if (!snapshot || base.nodes[snapshot.current_room_id]) {
            return base;
        }
        return applyRoomMapSnapshot(base, snapshot, 0);
    }, [connected, exploredMap, snapshot]);
    const counts = exploredMapCounts(visibleGraph);

    return (
        <main className="page-main">
            <div className="page-surface map-surface">
                <MapHeading connected={connected} edgeCount={counts.edges} nodeCount={counts.nodes} />
                <MapBoard connected={connected} exploredMap={visibleGraph} onMove={onMove} snapshot={snapshot} />
                <div className="map-footer-note">
                    <span className="note-mark" aria-hidden="true">实</span>
                    <span>探索图只保存在本次连接：节点来自已到达的 Room.Map/Info，实线边只来自服务器确认的 Room.Map.Transition；传送、失败与动态通路不会被客户端猜测成路线。</span>
                </div>
            </div>
        </main>
    );
};
