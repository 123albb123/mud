import { useEffect, useMemo, useState } from 'react';
import type {
    CombatAction,
    CombatStateSnapshot,
    CharacterStatus,
    RoomEntity,
} from '../../protocol/gmcp/gmcp';

interface CombatPanelProps {
    actions: CombatAction[];
    combat: CombatStateSnapshot | null;
    disabled: boolean;
    entities: RoomEntity[];
    onAction: (actionId: string, targetEntityId?: string) => void;
    status: CharacterStatus | null;
}

const healthLabels: Record<string, string> = {
    healthy: '气血充盈',
    injured: '受伤',
    badly_injured: '伤势严重',
    near_death: '奄奄一息',
    unconscious: '昏迷不醒',
    unknown: '状态不明',
};

export const CombatPanel = ({ actions, combat, disabled, entities, onAction, status }: CombatPanelProps) => {
    const nearbyNpcs = useMemo(
        () => entities.filter((entity) => entity.type === 'npc'),
        [entities],
    );
    const primaryTarget = combat?.targets.find((target) => target.entity_id === combat.primary_target)
        ?? combat?.targets[0];
    const [targetId, setTargetId] = useState('');
    const actionDisabled = disabled || status?.can_act === false || combat?.can_act === false;

    useEffect(() => {
        const preferred = primaryTarget?.entity_id ?? nearbyNpcs[0]?.entity_id ?? '';
        if (!nearbyNpcs.some((entity) => entity.entity_id === targetId)) {
            setTargetId(preferred);
        }
    }, [nearbyNpcs, primaryTarget?.entity_id, targetId]);

    const targetActions = actions.filter((action) => action.requires_target);
    const techniqueActions = actions.filter((action) => !action.requires_target);

    return (
        <section className="panel combat-panel" aria-labelledby="combat-title">
            <div className="panel-heading">
                <span className="seal">战</span>
                <div>
                    <h2 id="combat-title">战斗</h2>
                    <p>{combat?.in_combat ? '战斗进行中' : '尚未交战'}</p>
                </div>
                {(status?.busy || combat?.busy) && <span className="state-chip danger">忙乱</span>}
            </div>
            <div className="combat-target" aria-live="polite">
                {primaryTarget ? (
                    <>
                        <strong>{primaryTarget.name}</strong>
                        <span>{primaryTarget.relation === 'kill' ? '生死相搏' : '切磋'} · {healthLabels[primaryTarget.health]}</span>
                    </>
                ) : (
                    <span>当前没有战斗目标。</span>
                )}
            </div>
            {targetActions.length > 0 && (
                <div className="combat-target-actions">
                    <label htmlFor="combat-target">目标</label>
                    <select
                        id="combat-target"
                        onChange={(event) => setTargetId(event.target.value)}
                        value={targetId}
                    >
                        <option value="">选择附近 NPC</option>
                        {nearbyNpcs.map((entity) => (
                            <option key={entity.entity_id} value={entity.entity_id}>{entity.name}</option>
                        ))}
                    </select>
                    <div className="combat-action-grid">
                        {targetActions.map((action) => (
                            <button
                                disabled={actionDisabled || !targetId}
                                key={action.action_id}
                                onClick={() => onAction(action.action_id, targetId)}
                                type="button"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {techniqueActions.length > 0 && (
                <div className="combat-techniques">
                    <p className="eyebrow">可发现招式</p>
                    <div className="combat-action-grid">
                        {techniqueActions.map((action) => (
                            <button
                                disabled={actionDisabled}
                                key={action.action_id}
                                onClick={() => onAction(action.action_id)}
                                type="button"
                            >
                                <span>{action.kind === 'exert' ? '内功' : '招式'}</span>
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {actions.length === 0 && (
                <p className="empty-entity-state">当前没有可由服务端确认的战斗动作。</p>
            )}
        </section>
    );
};
