import { useEffect, useState } from 'react';
import type { CharacterSkill, CharacterStatus } from '../../protocol/gmcp/gmcp';

interface SkillsPanelProps {
    disabled: boolean;
    onAction: (skillId: string, action: 'enable' | 'prepare', slot?: string) => void;
    skills: CharacterSkill[];
    status: CharacterStatus | null;
}

interface SkillListProps {
    disabled: boolean;
    onAction: SkillsPanelProps['onAction'];
    selections: Record<string, string>;
    setSelection: (skillId: string, slot: string) => void;
    skills: CharacterSkill[];
}

const SkillList = ({ disabled, onAction, selections, setSelection, skills }: SkillListProps) => (
    <div className="skills-list">
        {skills.length === 0 ? <p className="empty-entity-state">暂无此类技能。</p> : skills.map((skill) => {
            const selectedSlot = selections[skill.skill_id] ?? skill.enable_slots[0] ?? '';
            return (
                <article className="skill-card" key={skill.skill_id}>
                    <div>
                        <strong>{skill.name}</strong>
                        <span>{skill.skill_id} · {skill.type}</span>
                    </div>
                    <p>等级 {skill.level} · 熟练 {skill.progress}%</p>
                    {(skill.enabled_for.length > 0 || skill.prepared_for.length > 0) && (
                        <small>
                            {skill.enabled_for.length > 0 && `已启用：${skill.enabled_for.join('、')}`}
                            {skill.enabled_for.length > 0 && skill.prepared_for.length > 0 && ' · '}
                            {skill.prepared_for.length > 0 && `已准备：${skill.prepared_for.join('、')}`}
                        </small>
                    )}
                    {skill.enable_slots.length > 0 && (
                        <div className="skill-actions">
                            <select
                                aria-label={`${skill.name} 启用用途`}
                                onChange={(event) => setSelection(skill.skill_id, event.target.value)}
                                value={selectedSlot}
                            >
                                {skill.enable_slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                            </select>
                            <button
                                disabled={disabled || !selectedSlot}
                                onClick={() => onAction(skill.skill_id, 'enable', selectedSlot)}
                                type="button"
                            >启用</button>
                        </div>
                    )}
                    {skill.prepare_slots.length > 0 && (
                        <button
                            className="prepare-action"
                            disabled={disabled}
                            onClick={() => onAction(skill.skill_id, 'prepare')}
                            type="button"
                        >准备</button>
                    )}
                </article>
            );
        })}
    </div>
);

export const SkillsPanel = ({ disabled, onAction, skills, status }: SkillsPanelProps) => {
    const [selections, setSelections] = useState<Record<string, string>>({});
    const basicSkills = skills.filter((skill) => skill.is_basic);
    const specialSkills = skills.filter((skill) => !skill.is_basic);

    useEffect(() => {
        setSelections((current) => {
            const next: Record<string, string> = {};
            skills.forEach((skill) => {
                const currentValue = current[skill.skill_id];
                if (currentValue && skill.enable_slots.includes(currentValue)) {
                    next[skill.skill_id] = currentValue;
                }
            });
            return next;
        });
    }, [skills]);

    const setSelection = (skillId: string, slot: string) => {
        setSelections((current) => ({ ...current, [skillId]: slot }));
    };

    return (
        <section className="skills-panel" aria-labelledby="skills-title">
            <div className="skills-summary">
                <p id="skills-title">当前启用：{status?.enabled.map((item) => `${item.slot}·${item.name}`).join('、') || '无'}</p>
                <p>当前准备：{status?.prepared.map((item) => `${item.slot}·${item.name}`).join('、') || '无'}</p>
            </div>
            <h3>基础技能</h3>
            <SkillList disabled={disabled} onAction={onAction} selections={selections} setSelection={setSelection} skills={basicSkills} />
            <h3>特殊武功</h3>
            <SkillList disabled={disabled} onAction={onAction} selections={selections} setSelection={setSelection} skills={specialSkills} />
        </section>
    );
};
