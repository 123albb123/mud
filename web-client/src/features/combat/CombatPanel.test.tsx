import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CombatPanel } from './CombatPanel';

const status = {
    version: 1, snapshot: true as const, revision: 1, sequence: 1,
    busy: false, fighting: true, can_act: true, ghost: false, unconscious: false,
    anger: 0, food: 50, water: 50, exp: 1, potential: 0,
    weapon: null, enabled: [], prepared: [],
};

describe('CombatPanel', () => {
    it('supports required and optional targets, including same-name entities', () => {
        const onAction = vi.fn();
        render(
            <CombatPanel
                actions={[
                    {
                        action_id: 'fight', label: '切磋', kind: 'fight', requires_target: true,
                        target_mode: 'required', target_types: ['npc', 'player'],
                    },
                    {
                        action_id: 'perform:sword:chan', label: '太极剑·缠', kind: 'perform', requires_target: false,
                        target_mode: 'optional', target_types: ['npc', 'player'],
                    },
                ]}
                combat={{
                    version: 1, snapshot: true, revision: 1, sequence: 1,
                    in_combat: true, busy: false, can_act: true,
                    primary_target: 'e-test-0002',
                    targets: [{ entity_id: 'e-test-0002', name: '欧阳克', relation: 'kill', health: 'injured' }],
                }}
                disabled={false}
                entities={[
                    { entity_id: 'e-test-0001', type: 'npc', name: '欧阳克', actions: [] },
                    { entity_id: 'e-test-0002', type: 'npc', name: '欧阳克', actions: [] },
                ]}
                onAction={onAction}
                status={status}
            />,
        );

        expect(screen.getAllByText('欧阳克')).toHaveLength(3);
        expect(screen.getByText(/生死相搏/)).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: '目标' })).toHaveValue('e-test-0002');
        fireEvent.click(screen.getByRole('button', { name: '切磋' }));
        expect(onAction).toHaveBeenCalledWith('fight', 'e-test-0002', 'required');
        fireEvent.click(screen.getByRole('button', { name: /太极剑·缠/ }));
        expect(onAction).toHaveBeenCalledWith('perform:sword:chan', 'e-test-0002', 'optional');
        fireEvent.change(screen.getByRole('combobox', { name: '目标' }), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: /太极剑·缠/ }));
        expect(onAction).toHaveBeenCalledWith('perform:sword:chan', undefined, 'optional');
    });

    it('does not render a target selector for self-only actions', () => {
        const onAction = vi.fn();
        render(
            <CombatPanel
                actions={[{
                    action_id: 'exert:force:recover', label: '恢复', kind: 'exert', requires_target: false,
                    target_mode: 'none', target_types: [],
                }]}
                combat={null}
                disabled={false}
                entities={[{ entity_id: 'e-test-0001', type: 'npc', name: '敌人', actions: [] }]}
                onAction={onAction}
                status={status}
            />,
        );
        expect(screen.queryByRole('combobox', { name: '目标' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /恢复/ }));
        expect(onAction).toHaveBeenCalledWith('exert:force:recover');
    });

    it('makes combat controls unavailable while busy', () => {
        render(
            <CombatPanel
                actions={[{
                    action_id: 'exert:force:recover', label: '恢复', kind: 'exert', requires_target: false,
                    target_mode: 'none', target_types: [],
                }]}
                combat={null}
                disabled={false}
                entities={[]}
                onAction={() => undefined}
                status={{ ...status, busy: true, can_act: false }}
            />,
        );
        expect(screen.getByRole('button', { name: /恢复/ })).toBeDisabled();
        expect(screen.getByText('忙乱')).toBeInTheDocument();
    });
});
