import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoomEntities } from './RoomEntities';

const entities = [
    {
        entity_id: 'e-test-0001',
        type: 'npc' as const,
        name: '北丑',
        title: '武林泰斗',
        actions: [
            { id: 'look' },
            { id: 'ask' },
            { id: 'talk' },
            { id: 'give' },
            { id: 'fight' },
            { id: 'kill' },
        ],
    },
    {
        entity_id: 'e-test-player-0001',
        type: 'player' as const,
        name: '验收',
        actions: [{ id: 'look' }, { id: 'talk' }],
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
    it('shows distinct person chips, titles, and no action count or internal IDs', () => {
        const { container } = render(
            <RoomEntities disabled={false} entities={entities} inventory={inventory} onAction={() => undefined} onGive={() => undefined} />,
        );

        const npcCard = screen.getByRole('button', { name: /北丑/ });
        const playerCard = screen.getByRole('button', { name: /验收/ });
        expect(within(npcCard).getByText('NPC')).toHaveClass('entity-type-chip', 'npc');
        expect(within(playerCard).getByText('玩家')).toHaveClass('entity-type-chip', 'player');
        expect(within(npcCard).getByText('武林泰斗')).toHaveClass('entity-title');
        expect(playerCard.querySelector('.entity-title')).not.toBeInTheDocument();
        expect(container.querySelector('.entity-action-count')).not.toBeInTheDocument();
        expect(screen.queryByText(/^\d+ 动作$/)).not.toBeInTheDocument();
        expect(screen.queryByText('e-test-player-0001')).not.toBeInTheDocument();
    });

    it('keeps all selected entity actions available without the count label', () => {
        render(<RoomEntities disabled={false} entities={entities} inventory={inventory} onAction={() => undefined} onGive={() => undefined} />);

        fireEvent.click(screen.getByRole('button', { name: /北丑/ }));
        expect(screen.getByRole('button', { name: '查看' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '询问' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '交谈' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '给予' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '切磋' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '攻击' })).toBeInTheDocument();
    });

    it('keeps a long name and its chip in the identity row', () => {
        const longName = '白驼山西域武学传人欧阳克';
        render(
            <RoomEntities
                disabled={false}
                entities={[{
                    entity_id: 'e-test-long-name-0001',
                    type: 'npc',
                    name: longName,
                    actions: [{ id: 'look' }],
                }]}
                inventory={[]}
                onAction={() => undefined}
                onGive={() => undefined}
            />,
        );

        const card = screen.getByRole('button', { name: new RegExp(longName) });
        expect(within(card).getByText(longName)).toHaveClass('entity-name');
        expect(within(card).getByText('NPC')).toHaveClass('entity-type-chip', 'npc');
    });

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
