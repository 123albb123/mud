import { useMemo } from 'react';
import type { RoomMapExit, RoomMapSnapshot } from '../../protocol/gmcp/gmcp';

interface MapViewProps {
    connected: boolean;
    snapshot: RoomMapSnapshot | null;
    onMove: (exitId: string) => void;
}

interface MapPosition {
    left: number;
    top: number;
}

const directionPositions: Record<string, MapPosition> = {
    northwest: { left: 18, top: 16 },
    north: { left: 50, top: 10 },
    northeast: { left: 82, top: 16 },
    west: { left: 14, top: 47 },
    east: { left: 86, top: 47 },
    southwest: { left: 18, top: 78 },
    south: { left: 50, top: 84 },
    southeast: { left: 82, top: 78 },
};

const MapHeading = ({ connected }: { connected: boolean }) => (
    <div className="page-heading">
        <div className="page-heading-icon map-heading-mark" aria-hidden="true">图</div>
        <div>
            <h1>地图</h1>
            <p className="page-heading-description">服务器返回当前房间与真实邻接出口。</p>
        </div>
        <div className="page-heading-action">
            <span className={'map-status ' + (connected ? 'map-status-live' : 'map-status-muted')}>
                {connected ? '实时同步' : '未同步'}
            </span>
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
            className={'map-exit-button ' + (exit.resolved ? 'is-known' : 'is-unknown')}
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

const MapBoard = ({
    connected,
    snapshot,
    onMove,
}: MapViewProps) => {
    const gridExits = useMemo(
        () => snapshot?.exits.filter((exit) => Boolean(directionPositions[exit.command])) ?? [],
        [snapshot],
    );
    const auxiliaryExits = useMemo(
        () => snapshot?.exits.filter((exit) => !directionPositions[exit.command]) ?? [],
        [snapshot],
    );

    if (!snapshot) {
        return (
            <div className="map-board map-board-empty">
                <div className="map-grid-lines" />
                <div className="map-empty-state">
                    <div className="map-empty-mark" aria-hidden="true">图</div>
                    <strong>{connected ? '等待真实房间数据' : '尚未连接江湖'}</strong>
                    <span>{connected ? '服务器返回 Room.Map 后显示当前房间与邻接出口。' : '连接服务器后显示当前房间地图。'}</span>
                </div>
                <div className="map-compass" aria-hidden="true"><span>北</span><i /></div>
            </div>
        );
    }

    const roomName = snapshot.room.name || '当前房间';
    return (
        <div className="map-board">
            <div className="map-grid-lines" />
            <div className="map-water water-one" />
            <div className="map-water water-two" />
            <div className="map-plot" aria-label="当前房间与已知邻接房间">
                <svg aria-hidden="true" className="map-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {gridExits.filter((exit) => exit.resolved && !exit.dynamic && !exit.conditional).map((exit) => {
                        const position = directionPositions[exit.command];
                        return <line key={exit.exit_id} x1="50" x2={position.left} y1="50" y2={position.top} />;
                    })}
                </svg>
                <div className="map-current-node" title={roomName}>
                    <span className="map-node-kicker">当前位置</span>
                    <strong>{roomName}</strong>
                    {snapshot.room.area && <small>{snapshot.room.area}</small>}
                </div>
                {gridExits.map((exit) => {
                    const position = directionPositions[exit.command];
                    return (
                        <div
                            className="map-node-wrap"
                            key={exit.exit_id}
                            style={{ left: `${position.left}%`, top: `${position.top}%` }}
                        >
                            <MapExitButton connected={connected} exit={exit} onMove={onMove} />
                        </div>
                    );
                })}
            </div>
            {auxiliaryExits.length > 0 && (
                <div className="map-exit-dock" aria-label="垂直与特殊出口">
                    <div className="map-exit-dock-heading"><span>其他真实出口</span><small>点击后由原版规则处理</small></div>
                    <div className="map-exit-dock-list">
                        {auxiliaryExits.map((exit) => <MapExitButton connected={connected} exit={exit} key={exit.exit_id} onMove={onMove} />)}
                    </div>
                </div>
            )}
            <div className="map-compass" aria-hidden="true"><span>北</span><i /></div>
        </div>
    );
};

export const MapView = ({ connected, snapshot, onMove }: MapViewProps) => (
    <main className="page-main">
        <div className="page-surface map-surface">
            <MapHeading connected={connected} />
            <MapBoard connected={connected} onMove={onMove} snapshot={snapshot} />
            <div className="map-footer-note">
                <span className="note-mark" aria-hidden="true">实</span>
                <span>仅展示服务器当前快照中的真实出口；未解析或动态通路不会被客户端猜测。</span>
            </div>
        </div>
    </main>
);
