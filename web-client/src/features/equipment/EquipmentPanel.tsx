import { useEffect, useMemo, useState } from 'react';
import type { EquipmentSlot, GMCPAction } from '../../protocol/gmcp/gmcp';

interface EquipmentPanelProps {
    slots: EquipmentSlot[];
    slotOrder: string[];
    onAction: (action: GMCPAction) => void;
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

const actionLabel = (action: GMCPAction): string => actionLabels[action.id] || action.id;

export const EquipmentPanel = ({ slots, slotOrder, onAction }: EquipmentPanelProps) => {
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.slot, slot])), [slots]);
    const selectedItem = selectedSlot ? slotMap.get(selectedSlot) ?? null : null;

    useEffect(() => {
        if (selectedSlot && !selectedItem) {
            setSelectedSlot(null);
        }
    }, [selectedItem, selectedSlot]);

    return (
        <section className="item-panel equipment-panel" aria-labelledby="equipment-title">
            <div className="item-panel-heading">
                <div>
                    <p className="eyebrow">CHAR · EQUIPMENT</p>
                    <h2 id="equipment-title">装备</h2>
                </div>
                <span className="item-count">{slots.length} 格已用</span>
            </div>
            {slotOrder.length === 0 ? (
                <p className="empty-item-state">尚未收到装备快照。</p>
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
                            <button key={`${action.id}:${action.command}`} onClick={() => onAction(action)} type="button">
                                {actionLabel(action)}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
