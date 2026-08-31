import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { InventoryItem, RoomEntity } from '../../protocol/gmcp/gmcp';

interface RoomEntitiesProps {
    entities: RoomEntity[];
    inventory: InventoryItem[];
    disabled: boolean;
    onAction: (entityId: string, action: string, text?: string) => void;
    onGive: (itemId: string, entityId: string) => void;
}

const actionLabels: Record<string, string> = {
    look: '查看',
    get: '拾取',
    talk: '交谈',
    ask: '询问',
    fight: '切磋',
    kill: '攻击',
    give: '给予',
};

const typeLabels: Record<RoomEntity['type'], string> = {
    npc: 'NPC',
    player: '玩家',
    item: '地面物品',
    corpse: '尸体',
    unknown: '实体',
};

const actionLabel = (action: string): string => actionLabels[action] || action;

export const RoomEntities = ({ entities, inventory, disabled, onAction, onGive }: RoomEntitiesProps) => {
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [messageAction, setMessageAction] = useState<'ask' | 'talk' | null>(null);
    const [giveItemId, setGiveItemId] = useState('');
    const [activeGroup, setActiveGroup] = useState<'nearby' | 'ground'>('nearby');
    const selectedEntity = useMemo(
        () => entities.find((entity) => entity.entity_id === selectedEntityId) ?? null,
        [entities, selectedEntityId],
    );
    const nearbyEntities = useMemo(
        () => entities.filter((entity) => entity.type === 'npc' || entity.type === 'player'),
        [entities],
    );
    const groundEntities = useMemo(
        () => entities.filter((entity) => entity.type === 'item' || entity.type === 'corpse'),
        [entities],
    );
    const visibleEntities = activeGroup === 'nearby' ? nearbyEntities : groundEntities;
    const hasMessageAction = selectedEntity?.actions.some((action) => action.id === 'ask' || action.id === 'talk') ?? false;
    const hasGiveAction = selectedEntity?.actions.some((action) => action.id === 'give') ?? false;

    useEffect(() => {
        if (selectedEntityId && !selectedEntity) {
            setSelectedEntityId(null);
            setMessage('');
            setMessageAction(null);
            setGiveItemId('');
        }
    }, [selectedEntity, selectedEntityId]);

    useEffect(() => {
        const firstMessageAction = selectedEntity?.actions.find(
            (action) => action.id === 'ask' || action.id === 'talk',
        )?.id;
        setMessageAction(firstMessageAction === 'ask' || firstMessageAction === 'talk' ? firstMessageAction : null);
        setMessage('');
    }, [selectedEntity]);

    useEffect(() => {
        if (selectedEntity && (selectedEntity.type === 'item' || selectedEntity.type === 'corpse')) {
            setActiveGroup('ground');
        } else if (selectedEntity) {
            setActiveGroup('nearby');
        }
    }, [selectedEntity]);

    const submitMessage = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedEntity || !message.trim()) {
            return;
        }
        if (messageAction) {
            onAction(selectedEntity.entity_id, messageAction, message);
            setMessage('');
        }
    };

    const submitGive = () => {
        if (selectedEntity && giveItemId) {
            onGive(giveItemId, selectedEntity.entity_id);
            setGiveItemId('');
        }
    };

    return (
        <section className="panel entity-panel" aria-labelledby="entity-title">
            <div className="panel-heading">
                <span className="seal">人</span>
                <div>
                    <h2 id="entity-title">附近与地面</h2>
                    <p>{entities.length} 个可见实体</p>
                </div>
            </div>
            <div className="entity-tabs" role="tablist" aria-label="实体分组">
                <button
                    aria-selected={activeGroup === 'nearby'}
                    className={activeGroup === 'nearby' ? 'active' : ''}
                    onClick={() => setActiveGroup('nearby')}
                    role="tab"
                    type="button"
                >
                    附近人物 <span>{nearbyEntities.length}</span>
                </button>
                <button
                    aria-selected={activeGroup === 'ground'}
                    className={activeGroup === 'ground' ? 'active' : ''}
                    onClick={() => setActiveGroup('ground')}
                    role="tab"
                    type="button"
                >
                    地面物品 <span>{groundEntities.length}</span>
                </button>
            </div>
            {visibleEntities.length === 0 ? (
                <p className="empty-entity-state">
                    {activeGroup === 'nearby' ? '附近没有可交互的人物。' : '地面没有可拾取的物品。'}
                </p>
            ) : (
                <div className="entity-list" role="tabpanel">
                    {visibleEntities.map((entity) => (
                        <button
                            aria-pressed={selectedEntityId === entity.entity_id}
                            className={`entity-card ${selectedEntityId === entity.entity_id ? 'selected' : ''}`}
                            key={entity.entity_id}
                            onClick={() => setSelectedEntityId(entity.entity_id)}
                            type="button"
                        >
                            <span className="entity-card-copy">
                                <span className="entity-name">{entity.name}</span>
                                <span className="entity-meta">
                                    <span>{typeLabels[entity.type]}</span>
                                    {entity.title && <span>{entity.title}</span>}
                                </span>
                            </span>
                            <span className="entity-action-count">{entity.actions.length} 动作</span>
                        </button>
                    ))}
                </div>
            )}
            {selectedEntity && (
                <div className="entity-detail entity-sheet" aria-label={`${selectedEntity.name} 可用动作`}>
                    <div className="entity-detail-heading">
                        <div>
                            <p className="eyebrow">{typeLabels[selectedEntity.type]}</p>
                            <strong>{selectedEntity.name}</strong>
                        </div>
                        <button className="entity-close" onClick={() => setSelectedEntityId(null)} type="button">
                            关闭
                        </button>
                    </div>
                    <div className="entity-actions">
                        {selectedEntity.actions.filter((action) => action.id !== 'ask' && action.id !== 'talk' && action.id !== 'give').map((action) => (
                            <button
                                disabled={disabled}
                                key={`${selectedEntity.entity_id}:${action.id}`}
                                onClick={() => onAction(selectedEntity.entity_id, action.id)}
                                type="button"
                            >
                                {actionLabel(action.id)}
                            </button>
                        ))}
                    </div>
                    {hasMessageAction && (
                        <form className="entity-message-form" onSubmit={submitMessage}>
                            <label htmlFor="entity-message">{messageAction === 'ask' ? '询问内容' : '交谈内容'}</label>
                            <div className="entity-message-modes" role="group" aria-label="文字动作">
                                {selectedEntity.actions.filter((action) => action.id === 'ask' || action.id === 'talk').map((action) => (
                                    <button
                                        className={messageAction === action.id ? 'active' : ''}
                                        key={`${selectedEntity.entity_id}:${action.id}`}
                                        onClick={() => setMessageAction(action.id as 'ask' | 'talk')}
                                        type="button"
                                    >
                                        {actionLabel(action.id)}
                                    </button>
                                ))}
                            </div>
                            <div>
                                <input
                                    id="entity-message"
                                    maxLength={200}
                                    onChange={(event) => setMessage(event.target.value)}
                                    placeholder="输入内容"
                                    value={message}
                                />
                                <button disabled={disabled || !message.trim()} type="submit">发送</button>
                            </div>
                        </form>
                    )}
                    {hasGiveAction && (
                        <div className="entity-give-form">
                            <label htmlFor="entity-give-item">给予物品</label>
                            <div>
                                <select
                                    id="entity-give-item"
                                    onChange={(event) => setGiveItemId(event.target.value)}
                                    value={giveItemId}
                                >
                                    <option value="">选择行囊物品</option>
                                    {inventory.map((item) => (
                                        <option key={item.item_id} value={item.item_id}>
                                            {item.name} · {item.amount}{item.unit}
                                        </option>
                                    ))}
                                </select>
                                <button disabled={disabled || !giveItemId} onClick={submitGive} type="button">给予</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};
