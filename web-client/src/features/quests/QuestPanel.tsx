import { useState } from 'react';
import type { QuestListSnapshot, QuestRecord } from '../../protocol/gmcp/gmcp';

interface QuestPanelProps {
    connected?: boolean;
    embedded?: boolean;
    snapshot: QuestListSnapshot | null;
}

const statusLabels: Record<QuestRecord['status'], string> = {
    active: '进行中',
    available: '可领取',
    completed: '已完成',
    failed: '已失败',
};

const systemLabels: Record<QuestRecord['system'], string> = {
    traditional: '师门',
    quest2: '江湖',
    ultra: '大宗师',
    mirror: '宝镜',
    daily: '每日',
};

const deadlineLabel = (deadline: number | undefined): string | null => {
    if (deadline === undefined || !Number.isFinite(deadline)) {
        return null;
    }
    return `期限：${new Date(deadline * 1000).toLocaleString()}`;
};

const QuestCard = ({ record }: { record: QuestRecord }) => {
    const [expanded, setExpanded] = useState(false);
    const deadline = deadlineLabel(record.deadline);

    return (
        <article className={`quest-card quest-${record.status}`}>
            <button
                aria-expanded={expanded}
                className="quest-card-heading"
                onClick={() => setExpanded((current) => !current)}
                type="button"
            >
                <span className="quest-card-title">
                    <strong>{record.title}</strong>
                    <small>{systemLabels[record.system]} · {record.category}</small>
                </span>
                <span className="quest-card-status">{statusLabels[record.status]}</span>
            </button>
            {expanded && (
                <div className="quest-card-detail">
                    <p>{record.detail}</p>
                    {record.level !== undefined && <small>等级：{record.level}</small>}
                    {deadline && <small>{deadline}</small>}
                    {record.objectives.length > 0 && (
                        <ul>
                            {record.objectives.map((objective, index) => (
                                <li key={`${record.quest_id}:${objective.kind}:${index}`}>
                                    <span>{objective.title}</span>
                                    {objective.current !== undefined && objective.required !== undefined
                                        ? <em>{objective.current}/{objective.required}</em>
                                        : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </article>
    );
};

const QuestGroup = ({ title, records }: { title: string; records: QuestRecord[] }) => (
    <section className="quest-group" aria-label={title}>
        <div className="quest-group-heading">
            <h3>{title}</h3>
            <span>{records.length}</span>
        </div>
        {records.length === 0
            ? <p className="quest-empty-group">暂无记录</p>
            : records.map((record) => <QuestCard key={record.quest_id} record={record} />)}
    </section>
);

export const QuestPanel = ({ connected = true, embedded = false, snapshot }: QuestPanelProps) => {
    if (!snapshot) {
        return (
            <section aria-label={embedded ? '任务内容' : undefined} aria-labelledby={embedded ? undefined : 'quest-title'} className="feature-panel quest-panel">
                {!embedded && <div className="feature-panel-heading">
                    <div>
                        <h2 id="quest-title">任务</h2>
                    </div>
                </div>}
                <p className="feature-empty-state">{connected ? '当前没有任务' : '连接江湖后查看任务'}</p>
            </section>
        );
    }

    return (
        <section aria-label={embedded ? '任务内容' : undefined} aria-labelledby={embedded ? undefined : 'quest-title'} className="feature-panel quest-panel">
            {!embedded && <div className="feature-panel-heading">
                <div>
                    <h2 id="quest-title">任务</h2>
                </div>
                <span className="feature-count">{snapshot.quests.length} 项当前</span>
            </div>}
            <div className="quest-stats">
                {snapshot.stats.traditional_completed !== undefined && (
                    <span>师门完成 {snapshot.stats.traditional_completed}</span>
                )}
                {snapshot.stats.mirror_completed !== undefined && (
                    <span>宝镜完成 {snapshot.stats.mirror_completed}</span>
                )}
            </div>
            <QuestGroup records={snapshot.quests} title="当前任务" />
            <QuestGroup records={snapshot.completed} title="完成记录" />
        </section>
    );
};
