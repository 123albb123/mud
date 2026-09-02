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
                        is_basic: true, enabled_for: [], prepared_for: [], prepare_slots: [], enable_slots: [],
                    },
                    {
                        skill_id: 'taiji-sword', name: '太极剑法', level: 90, progress: 80, type: 'martial',
                        is_basic: false, enabled_for: [], prepared_for: [], prepare_slots: ['sword'], enable_slots: ['sword'],
                    },
                ]}
                status={status}
            />,
        );
        expect(screen.getByText('基础技能')).toBeInTheDocument();
        expect(screen.getByText('特殊武功')).toBeInTheDocument();
        expect(screen.getByText('武学 · 100级')).toBeInTheDocument();
        expect(screen.getByText('武学 · 90级')).toBeInTheDocument();
        expect(screen.queryByText('taiji-sword')).not.toBeInTheDocument();
        expect(screen.queryByText('martial')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '启用' }));
        expect(onAction).toHaveBeenCalledWith('taiji-sword', 'enable', 'sword');
        fireEvent.click(screen.getByRole('button', { name: '准备' }));
        expect(onAction).toHaveBeenCalledWith('taiji-sword', 'prepare');
    });

    it('shows prepare only when the server exposes a prepare slot', () => {
        render(
            <SkillsPanel
                disabled={false}
                onAction={() => undefined}
                skills={[
                    {
                        skill_id: 'sword', name: '基本剑法', level: 100, progress: 20, type: 'martial',
                        is_basic: true, enabled_for: [], prepared_for: [], prepare_slots: [], enable_slots: [],
                    },
                    {
                        skill_id: 'force', name: '基本内功', level: 100, progress: 20, type: 'force',
                        is_basic: true, enabled_for: [], prepared_for: [], prepare_slots: [], enable_slots: [],
                    },
                    {
                        skill_id: 'taiji-quan', name: '太极拳', level: 90, progress: 80, type: 'martial',
                         is_basic: false, enabled_for: [], prepared_for: [], prepare_slots: ['unarmed'], enable_slots: ['unarmed'],
                    },
                    {
                        skill_id: 'taiji-sword', name: '太极剑法', level: 90, progress: 80, type: 'martial',
                        is_basic: false, enabled_for: [], prepared_for: [], prepare_slots: [], enable_slots: [],
                    },
                ]}
                status={status}
            />,
        );
        expect(screen.getAllByRole('button', { name: '准备' })).toHaveLength(1);
        expect(screen.getByText('太极拳')).toBeInTheDocument();
        expect(screen.getByText('太极剑法')).toBeInTheDocument();
        expect(screen.getAllByText(/内功 · 100级/)).toHaveLength(1);
        expect(screen.getByRole('option', { name: '拳脚' })).toBeInTheDocument();
        expect(screen.queryByText('force')).not.toBeInTheDocument();
    });
});
