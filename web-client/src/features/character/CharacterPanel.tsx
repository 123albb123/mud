import type { CharacterVitals } from '../../protocol/gmcp/gmcp';

interface CharacterPanelProps {
    vitals: CharacterVitals | null;
}

const resources = [
    { label: '气血', current: 'hp', maximum: 'max_hp', tone: 'red' },
    { label: '精', current: 'jing', maximum: 'max_jing', tone: 'blue' },
    { label: '精力', current: 'jingli', maximum: 'max_jingli', tone: 'jade' },
    { label: '内力', current: 'neili', maximum: 'max_neili', tone: 'gold' },
] as const;

export const CharacterPanel = ({ vitals }: CharacterPanelProps) => (
    <section className="panel character-panel" aria-labelledby="character-title">
        <div className="panel-heading">
            <span className="seal">人</span>
            <h2 id="character-title">人物状态</h2>
        </div>
        <div className="resource-list">
            {resources.map(({ label, current, maximum, tone }) => {
                const currentValue = vitals?.[current];
                const maximumValue = vitals?.[maximum];
                const hasValues = currentValue !== undefined && maximumValue !== undefined;
                const percent = hasValues && maximumValue > 0
                    ? Math.max(0, Math.min(100, (currentValue / maximumValue) * 100))
                    : 0;
                return (
                    <div className="resource" key={current}>
                        <div className="resource-label">
                            <span>{label}</span>
                            <span>{hasValues ? `${currentValue} / ${maximumValue}` : '--'}</span>
                        </div>
                        <div className="resource-track" aria-label={`${label} ${hasValues ? `${currentValue} / ${maximumValue}` : '无数据'}`}>
                            <span className={`resource-fill ${tone}`} style={{ width: `${percent}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    </section>
);
