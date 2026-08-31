import { useEffect, useMemo, useState } from 'react';
import type { GMCPAction, InventoryItem } from '../../protocol/gmcp/gmcp';

interface InventoryPanelProps {
    items: InventoryItem[];
    onAction: (itemId: string, action: string) => void;
}

const categoryLabels: Record<string, string> = {
    weapon: '武器',
    armor: '防具',
    food: '食物',
    liquid: '饮具',
    container: '容器',
    book: '书物',
    money: '货币',
    charm: '护身符',
    rune: '符文',
    inlaid: '镶嵌物',
    task: '任务物品',
    misc: '杂物',
};

const actionLabels: Record<string, string> = {
    look: '查看',
    use: '使用',
    eat: '吃',
    drink: '喝',
    wield: '装备',
    unwield: '卸下',
    wear: '穿戴',
    remove: '脱下',
    drop: '丢弃',
};

const actionLabel = (action: GMCPAction): string => action.label || actionLabels[action.id] || action.id;

export const InventoryPanel = ({ items, onAction }: InventoryPanelProps) => {
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const selectedItem = useMemo(
        () => items.find((item) => item.item_id === selectedItemId) ?? null,
        [items, selectedItemId],
    );

    useEffect(() => {
        if (selectedItemId && !selectedItem) {
            setSelectedItemId(null);
        }
    }, [selectedItem, selectedItemId]);

    return (
        <section className="item-panel inventory-panel" aria-labelledby="inventory-title">
            <div className="item-panel-heading">
                <div>
                    <p className="eyebrow">CHAR · INVENTORY</p>
                    <h2 id="inventory-title">行囊</h2>
                </div>
                <span className="item-count">{items.length} 件</span>
            </div>
            {items.length === 0 ? (
                <p className="empty-item-state">背包为空，或尚未收到服务器快照。</p>
            ) : (
                <div className="item-list">
                    {items.map((item) => (
                        <div className={`item-row ${selectedItemId === item.item_id ? 'selected' : ''}`} key={item.item_id}>
                            <button
                                aria-pressed={selectedItemId === item.item_id}
                                className="item-select"
                                onClick={() => setSelectedItemId(item.item_id)}
                                type="button"
                            >
                                <span className="item-name">{item.name || '未命名物品'}</span>
                                <span className="item-meta">
                                    <span>{item.amount}{item.unit || ''}</span>
                                    <span>{categoryLabels[item.category] || item.category}</span>
                                    {item.equipped && <span className="equipped-badge">已装备</span>}
                                </span>
                            </button>
                            <span className="item-weight">重 {item.weight}</span>
                        </div>
                    ))}
                </div>
            )}
            {selectedItem && (
                <div className="item-actions" aria-label={`${selectedItem.name} 可用动作`}>
                    <p>{selectedItem.name}</p>
                    <div>
                        {selectedItem.actions.map((action) => (
                            <button
                                key={`${selectedItem.item_id}:${action.id}`}
                                onClick={() => onAction(selectedItem.item_id, action.id)}
                                type="button"
                            >
                                {actionLabel(action)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
