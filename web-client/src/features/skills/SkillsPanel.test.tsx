import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillsPanel } from './SkillsPanel';

const status = {
    version: 1, snapshot: true as const, revision: 1, sequence: 1,
    busy: false, fighting: false, can_act: true, ghost: false, unconscious: false,
    anger: 0, food: 50, water: 50, exp: 1, potential: 0,
    weapon: null, enabled: [], prepared: [],
};

describe('SkillsPanel', () => {
    it('groups real server categories and sends constrained enable/prepare requests', () => {
        const onAction = vi.fn();
        render(
            <SkillsPanel
                disabled={false}
                onAction={onAction}
                skills={[
                    {
                        skill_id: 'sword', name: '基本剑法', level: 100, progress: 20, type: 'martial',
                        is_basic: true, enabled_for: [], prepared_for: [], enable_slots: [],
                    },
                    {
                        skill_id: 'taiji-sword', name: '太极剑法', level: 90, progress: 80, type: 'martial',
                        is_basic: false, enabled_for: [], prepared_for: [], enable_slots: ['sword'],
                    },
                ]}
                status={status}
            />,
        );
        expect(screen.getByText('基础技能')).toBeInTheDocument();
        expect(screen.getByText('特殊武功')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '启用' }));
        expect(onAction).toHaveBeenCalledWith('taiji-sword', 'enable', 'sword');
        fireEvent.click(screen.getByRole('button', { name: '准备' }));
        expect(onAction).toHaveBeenCalledWith('taiji-sword', 'prepare');
    });
});
