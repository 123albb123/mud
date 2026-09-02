import { useEffect, useMemo, useState } from 'react';
import type { EquipmentSlot, GMCPAction } from '../../protocol/gmcp/gmcp';

interface EquipmentPanelProps {
    connected?: boolean;
    embedded?: boolean;
    slots: EquipmentSlot[];
    slotOrder: string[];
    onAction: (itemId: string, action: string) => void;
}

const slotLabels: Record<string, string> = {
    weapon: '主手武器',
    secondary_weapon: '副手武器',
    head: '头部',
    neck: '颈部',
    cloth: '衣服',
    armor: '护甲',
    surcoat: '外衣',
    waist: '腰部',
    wrists: '护腕',
    hands: '手部',
    finger: '手指',
    boots: '靴子',
    feet: '足部',
    shield: '盾牌',
    charm: '护符',
    bandage: '绷带',
};

const actionLabels: Record<string, string> = {
    look: '查看',
    unwield: '卸下',
    remove: '脱下',
};

const actionLabel = (action: GMCPAction): string => action.label || actionLabels[action.id] || action.id;

export const EquipmentPanel = ({ connected = true, embedded = false, slots, slotOrder, onAction }: EquipmentPanelProps) => {
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.slot, slot])), [slots]);
    const occupiedSlotCount = slots.filter((slot) => Boolean(slot.item_id)).length;
    const selectedItem = selectedSlot ? slotMap.get(selectedSlot) ?? null : null;

    useEffect(() => {
        if (selectedSlot && !selectedItem) {
            setSelectedSlot(null);
        }
    }, [selectedItem, selectedSlot]);

    return (
        <section aria-label={embedded ? '装备内容' : undefined} aria-labelledby={embedded ? undefined : 'equipment-title'} className="item-panel equipment-panel">
            {!embedded && <div className="item-panel-heading">
                <div>
                    <h2 id="equipment-title">装备</h2>
                </div>
                <span className="item-count">{connected ? occupiedSlotCount + ' 格已用' : '未连接'}</span>
            </div>}
            {slotOrder.length === 0 ? (
                <p className="empty-item-state">{connected ? '暂无装备数据' : '连接江湖后查看装备'}</p>
            ) : (
                <div className="equipment-grid">
                    {slotOrder.map((slotName) => {
                        const item = slotMap.get(slotName);
                        return (
                            <button
                                aria-pressed={selectedSlot === slotName}
                                className={`equipment-slot ${selectedSlot === slotName ? 'selected' : ''} ${item ? 'occupied' : ''}`}
                                key={slotName}
                                onClick={() => setSelectedSlot(slotName)}
                                type="button"
                            >
                                <span className="slot-label">{slotLabels[slotName] || slotName}</span>
                                <span className="slot-item">{item?.name || '未装备'}</span>
                            </button>
                        );
                    })}
                </div>
            )}
            {selectedItem && (
                <div className="item-actions" aria-label={`${selectedItem.name} 可用动作`}>
                    <p>{selectedItem.name}</p>
                    <div>
                        {selectedItem.actions.map((action) => (
                            <button
                                disabled={!connected}
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
