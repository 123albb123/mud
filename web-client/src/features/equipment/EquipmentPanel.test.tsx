import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EquipmentPanel } from './EquipmentPanel';

describe('EquipmentPanel', () => {
    it('shows occupied and empty server-provided slots', () => {
        const onAction = vi.fn();
        render(
            <EquipmentPanel
                onAction={onAction}
                slotOrder={['weapon', 'head']}
                slots={[{
                    slot: 'weapon',
                    item_id: 'i-sword',
                    name: '长剑',
                    command_id: 'sword',
                    type: 'weapon',
                    actions: [{ id: 'unwield', command: 'unwield sword' }],
                }]}
            />,
        );
        expect(screen.getByText('长剑')).toBeInTheDocument();
        expect(screen.getByText('未装备')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /主手武器/ }));
        fireEvent.click(screen.getByRole('button', { name: '卸下' }));
        expect(onAction).toHaveBeenCalledWith({ id: 'unwield', command: 'unwield sword' });
    });
});
