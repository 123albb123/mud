import type { RoomInfo, RoomMapExit, RoomMapSnapshot } from '../../protocol/gmcp/gmcp';

interface RoomPanelProps {
    connected?: boolean;
    room: RoomInfo | null;
    roomMap: RoomMapSnapshot | null;
    disabled: boolean;
    onMove: (exitId: string) => void;
}

const directions = [
    ['northwest', '西北', 'nw'],
    ['north', '北', 'n'],
    ['northeast', '东北', 'ne'],
    ['west', '西', 'w'],
    ['', '●', 'here'],
    ['east', '东', 'e'],
    ['southwest', '西南', 'sw'],
    ['south', '南', 's'],
    ['southeast', '东南', 'se'],
] as const;

const verticalDirections = [
    ['up', '上'],
    ['down', '下'],
] as const;

const specialLabels: Record<string, string> = {
    enter: '进入',
    in: '进入',
    out: '出去',
    climb: '攀爬',
    cross: '穿过',
};

export const RoomPanel = ({ connected = true, room, roomMap, disabled, onMove }: RoomPanelProps) => {
    const mapExits = roomMap?.exits ?? [];
    const exitsByCommand = new Map(mapExits.map((exit) => [exit.command, exit]));
    const standard = new Set<string>([
        ...directions.map(([command]) => command).filter(Boolean),
        ...verticalDirections.map(([command]) => command),
    ]);
    const otherExits = mapExits.filter((exit) => !standard.has(exit.command));
    const roomName = roomMap?.room.name || room?.name || (connected ? '当前房间' : '尚未连接江湖');
    const roomArea = roomMap?.room.area || room?.area || (connected ? '当前区域未知' : '连接江湖后显示房间区域');
    const isMoveAvailable = (exit: RoomMapExit | undefined) => Boolean(
        exit && connected && !disabled && exit.resolved && !exit.dynamic && !exit.conditional,
    );

    return (
        <section className="panel room-panel" aria-labelledby="room-title">
            <div className="panel-heading">
                <span className="seal">境</span>
                <div>
                    <h2 id="room-title">{roomName}</h2>
                    <p>{roomArea}</p>
                </div>
            </div>
            {!roomMap ? (
                <p className="room-empty-state">{connected ? '等待服务器返回真实地图出口' : '连接江湖后显示房间'}</p>
            ) : <>
            <div className="direction-grid" aria-label="方向">
                {directions.map(([command, label, position]) => command ? (
                    (() => {
                        const exit = exitsByCommand.get(command);
                        return (
                    <button
                        className={`direction ${position}`}
                        disabled={!isMoveAvailable(exit)}
                        key={position}
                        onClick={() => exit && onMove(exit.exit_id)}
                        type="button"
                    >
                        {label}
                    </button>
                        );
                    })()
                ) : <span className="direction-current" key={position} aria-hidden="true">{label}</span>)}
            </div>
            <div className="vertical-directions">
                {verticalDirections.map(([command, label]) => (
                    (() => {
                        const exit = exitsByCommand.get(command);
                        return (
                    <button
                        disabled={!isMoveAvailable(exit)}
                        key={command}
                        onClick={() => exit && onMove(exit.exit_id)}
                        type="button"
                    >
                        {label}
                    </button>
                        );
                    })()
                ))}
            </div>
            {otherExits.length > 0 && (
                <div className="other-exits">
                    <h3>其他出口</h3>
                    <div>
                        {otherExits.map((exit) => (
                            <button
                                aria-label={exit.label}
                                disabled={!isMoveAvailable(exit)}
                                key={exit.exit_id}
                                onClick={() => onMove(exit.exit_id)}
                                type="button"
                            >
                                {specialLabels[exit.command] || exit.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            </>}
        </section>
    );
};
