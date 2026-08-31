import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoomEntities } from './RoomEntities';

const entities = [
    {
        entity_id: 'e-test-0001',
        type: 'npc' as const,
        name: '北丑',
        title: '武林泰斗',
        actions: [{ id: 'look' }, { id: 'ask' }, { id: 'talk' }, { id: 'give' }],
    },
    {
        entity_id: 'e-test-0002',
        type: 'item' as const,
        name: '长剑',
        actions: [{ id: 'look' }, { id: 'get' }],
    },
    {
        entity_id: 'e-test-0003',
        type: 'item' as const,
        name: '长剑',
        actions: [{ id: 'look' }, { id: 'get' }],
    },
];

const inventory = [{
    item_id: 'i-test-0001',
    name: '金创药',
    command_id: 'jinchuang',
    amount: 1,
    unit: '粒',
    weight: 1,
    category: 'food',
    equipped: false,
    actions: [{ id: 'look' }],
}];

describe('RoomEntities', () => {
    it('groups nearby and ground entities while preserving opaque IDs', () => {
        const onAction = vi.fn();
        render(<RoomEntities disabled={false} entities={entities} inventory={inventory} onAction={onAction} onGive={() => undefined} />);

        expect(screen.getByText('附近人物')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /北丑/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /长剑/ })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /地面物品/ }));
        expect(screen.getAllByRole('button', { name: /长剑/ })).toHaveLength(2);
        fireEvent.click(screen.getAllByRole('button', { name: /长剑/ })[1]);
        fireEvent.click(screen.getByRole('button', { name: '拾取' }));
        expect(onAction).toHaveBeenCalledWith('e-test-0003', 'get');
    });

    it('sends ask text and a separate give payload for the selected NPC', () => {
        const onAction = vi.fn();
        const onGive = vi.fn();
        render(<RoomEntities disabled={false} entities={entities} inventory={inventory} onAction={onAction} onGive={onGive} />);

        fireEvent.click(screen.getByRole('button', { name: /北丑/ }));
        fireEvent.click(screen.getByRole('button', { name: '询问' }));
        fireEvent.change(screen.getByLabelText('询问内容'), { target: { value: '掌柜在哪里？' } });
        fireEvent.click(screen.getByRole('button', { name: '发送' }));
        expect(onAction).toHaveBeenCalledWith('e-test-0001', 'ask', '掌柜在哪里？');

        fireEvent.change(screen.getByLabelText('给予物品'), { target: { value: 'i-test-0001' } });
        fireEvent.click(screen.getByRole('button', { name: '给予' }));
        expect(onGive).toHaveBeenCalledWith('i-test-0001', 'e-test-0001');
    });

    it('shows an explicit empty state for a group with no entities', () => {
        render(<RoomEntities disabled={true} entities={[]} inventory={[]} onAction={() => undefined} onGive={() => undefined} />);
        expect(screen.getByText('附近没有可交互的人物。')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /地面物品/ }));
        expect(screen.getByText('地面没有可拾取的物品。')).toBeInTheDocument();
    });
});
