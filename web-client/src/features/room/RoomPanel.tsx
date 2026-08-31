import type { RoomInfo } from '../../protocol/gmcp/gmcp';

interface RoomPanelProps {
    room: RoomInfo | null;
    disabled: boolean;
    onMove: (command: string) => void;
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

export const RoomPanel = ({ room, disabled, onMove }: RoomPanelProps) => {
    const exits = new Set(room?.exits ?? []);
    const standard = new Set<string>([
        ...directions.map(([command]) => command).filter(Boolean),
        ...verticalDirections.map(([command]) => command),
    ]);
    const otherExits = (room?.exits ?? []).filter((exit) => !standard.has(exit));

    return (
        <section className="panel room-panel" aria-labelledby="room-title">
            <div className="panel-heading">
                <span className="seal">境</span>
                <div>
                    <h2 id="room-title">{room?.name || '当前房间'}</h2>
                    <p>{room?.area || '尚未收到房间数据'}</p>
                </div>
            </div>
            <div className="direction-grid" aria-label="方向">
                {directions.map(([command, label, position]) => command ? (
                    <button
                        className={`direction ${position}`}
                        disabled={disabled || !exits.has(command)}
                        key={position}
                        onClick={() => onMove(command)}
                        type="button"
                    >
                        {label}
                    </button>
                ) : <span className="direction-current" key={position} aria-hidden="true">{label}</span>)}
            </div>
            <div className="vertical-directions">
                {verticalDirections.map(([command, label]) => (
                    <button
                        disabled={disabled || !exits.has(command)}
                        key={command}
                        onClick={() => onMove(command)}
                        type="button"
                    >
                        {label}
                    </button>
                ))}
            </div>
            {otherExits.length > 0 && (
                <div className="other-exits">
                    <h3>其他出口</h3>
                    <div>
                        {otherExits.map((exit) => (
                            <button disabled={disabled} key={exit} onClick={() => onMove(exit)} type="button">
                                {specialLabels[exit] || exit}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
