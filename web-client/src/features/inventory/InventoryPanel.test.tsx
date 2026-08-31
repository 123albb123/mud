import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryPanel } from './InventoryPanel';

const items = [
    {
        item_id: 'i-test-1',
        name: '金创药',
        command_id: 'jinchuang',
        amount: 5,
        unit: '粒',
        weight: 1,
        category: 'food',
        equipped: false,
        actions: [{ id: 'eat' }, { id: 'drop' }],
    },
    {
        item_id: 'i-test-2',
        name: '金创药',
        command_id: 'jinchuang',
        amount: 1,
        unit: '粒',
        weight: 1,
        category: 'food',
        equipped: false,
        actions: [{ id: 'look' }],
    },
];

describe('InventoryPanel', () => {
    it('renders quantities and sends the selected opaque item ID with action ID', () => {
        const onAction = vi.fn();
        render(<InventoryPanel items={items} onAction={onAction} />);
        expect(screen.getAllByText('金创药')).toHaveLength(2);
        expect(screen.getByText('5粒')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: /金创药/ })[0]);
        fireEvent.click(screen.getByRole('button', { name: '吃' }));
        expect(onAction).toHaveBeenCalledWith('i-test-1', 'eat');
    });

    it('renders an empty snapshot without inventing an item', () => {
        render(<InventoryPanel items={[]} onAction={() => undefined} />);
        expect(screen.getByText('背包为空，或尚未收到服务器快照。')).toBeInTheDocument();
    });
});
