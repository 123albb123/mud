import { useEffect, useMemo, useRef, useState } from 'react';
import type {
    CombatAction,
    CombatTargetMode,
    CombatTargetType,
    CombatStateSnapshot,
    CharacterStatus,
    RoomEntity,
} from '../../protocol/gmcp/gmcp';

interface CombatPanelProps {
    actions: CombatAction[];
    combat: CombatStateSnapshot | null;
    connected?: boolean;
    disabled: boolean;
    entities: RoomEntity[];
    onAction: (actionId: string, targetEntityId?: string, targetMode?: CombatTargetMode) => void;
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

export const CombatPanel = ({ actions, combat, connected = true, disabled, entities, onAction, status }: CombatPanelProps) => {
    const targetMode = (action: CombatAction): CombatTargetMode => action.target_mode
        ?? (action.requires_target ? 'required' : 'optional');
    const allowsEntity = (action: CombatAction, type: RoomEntity['type']): type is CombatTargetType => {
        if (type !== 'npc' && type !== 'player') {
            return false;
        }
        const targetTypes = action.target_types ?? [];
        return targetTypes.length === 0 || targetTypes.includes(type);
    };
    const targetActions = actions.filter((action) => targetMode(action) !== 'none');
    const targetEntities = useMemo(
        () => entities.filter((entity) => targetActions.some((action) => allowsEntity(action, entity.type))),
        [entities, targetActions],
    );
    const primaryTarget = combat?.targets.find((target) => target.entity_id === combat.primary_target)
        ?? combat?.targets[0];
    const [targetId, setTargetId] = useState('');
    const targetTouched = useRef(false);
    const actionDisabled = disabled || status?.can_act === false || combat?.can_act === false;

    useEffect(() => {
        const preferred = targetEntities.some((entity) => entity.entity_id === primaryTarget?.entity_id)
            ? primaryTarget?.entity_id ?? ''
            : targetEntities[0]?.entity_id ?? '';
        setTargetId((current) => {
            if (targetTouched.current && current === '') {
                return current;
            }
            if (targetEntities.some((entity) => entity.entity_id === current)) {
                return current;
            }
            return preferred;
        });
    }, [targetEntities, primaryTarget?.entity_id]);

    const techniqueActions = actions.filter((action) => targetMode(action) === 'none');

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
                    <span>{connected ? '当前没有战斗目标。' : '连接江湖后显示战斗目标。'}</span>
                )}
            </div>
            {targetActions.length > 0 && (
                <div className="combat-target-actions">
                    <label htmlFor="combat-target">目标</label>
                    <select
                        id="combat-target"
                        onChange={(event) => {
                            targetTouched.current = true;
                            setTargetId(event.target.value);
                        }}
                        value={targetId}
                    >
                        <option value="">不指定目标（可选）</option>
                        {targetEntities.map((entity) => (
                            <option key={entity.entity_id} value={entity.entity_id}>{entity.name}</option>
                        ))}
                    </select>
                    <div className="combat-action-grid">
                        {targetActions.map((action) => {
                            const mode = targetMode(action);
                            return (
                            <button
                                disabled={actionDisabled || mode === 'required' && !targetId}
                                key={action.action_id}
                                onClick={() => onAction(action.action_id, targetId || undefined, mode)}
                                type="button"
                            >
                                {action.label}
                            </button>
                            );
                        })}
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
                <p className="empty-entity-state">{connected ? '当前没有可由服务端确认的战斗动作。' : '连接江湖后显示战斗信息。'}</p>
            )}
        </section>
    );
};
