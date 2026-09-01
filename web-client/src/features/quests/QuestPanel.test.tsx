import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuestPanel } from './QuestPanel';

const snapshot = {
    version: 1,
    snapshot: true as const,
    revision: 2,
    sequence: 2,
    quests: [{
        quest_id: 'q-session-1',
        system: 'quest2' as const,
        category: 'quest2',
        title: '幻境心魔',
        detail: '斩杀心魔。',
        status: 'active' as const,
        objectives: [{ kind: 'kill', title: '心魔', current: 3, required: 20 }],
    }],
    completed: [],
    stats: { traditional_completed: 4 },
};

describe('QuestPanel', () => {
    it('renders current tasks and expands structured objectives', () => {
        render(<QuestPanel snapshot={snapshot} />);
        expect(screen.getByText('幻境心魔')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /幻境心魔/ }));
        expect(screen.getByText('3/20')).toBeInTheDocument();
    });

    it('does not invent tasks when the snapshot is unavailable', () => {
        render(<QuestPanel snapshot={null} />);
        expect(screen.getByText('当前没有任务')).toBeInTheDocument();
    });

    it('explains that a disconnected client has no task snapshot', () => {
        render(<QuestPanel connected={false} snapshot={null} />);
        expect(screen.getByText('连接江湖后查看任务')).toBeInTheDocument();
    });
});
