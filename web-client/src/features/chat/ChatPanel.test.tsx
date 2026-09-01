import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatCapabilities, ChatMessage, RoomEntity } from '../../protocol/gmcp/gmcp';
import { ChatPanel } from './ChatPanel';

const capabilities: ChatCapabilities = {
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    channels: [{ id: 'chat', name: '闲聊', can_send: true }],
    can_say: true,
    can_tell: true,
    can_reply: true,
    max_text: 2048,
};

const entities: RoomEntity[] = [{
    entity_id: 'e-session-1',
    type: 'player',
    name: '另一位侠客',
    actions: [],
}];

const messages: ChatMessage[] = [{
    version: 1,
    message_id: 'm-session-1',
    timestamp: 1,
    kind: 'channel',
    direction: 'in',
    sender: { name: '另一位侠客', id: 'other' },
    channel: 'chat',
    text: '江湖见。',
}];

describe('ChatPanel', () => {
    it('renders incoming messages and sends a bounded structured channel request', () => {
        const onSend = vi.fn();
        render(<ChatPanel capabilities={capabilities} connected entities={entities} messages={messages} onSend={onSend} />);
        expect(screen.getByText('江湖见。')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('聊天内容'), { target: { value: '你好' } });
        fireEvent.click(screen.getByRole('button', { name: '发送' }));
        expect(onSend).toHaveBeenCalledWith('channel', '你好', { channel: 'chat' });
    });

    it('uses an opaque room entity ID for tell targets', () => {
        const onSend = vi.fn();
        render(<ChatPanel capabilities={capabilities} connected entities={entities} messages={[]} onSend={onSend} />);
        fireEvent.click(screen.getByRole('tab', { name: '私聊' }));
        fireEvent.change(screen.getByLabelText('聊天内容'), { target: { value: '在吗' } });
        fireEvent.click(screen.getByRole('button', { name: '发送' }));
        expect(onSend).toHaveBeenCalledWith('tell', '在吗', { targetEntityId: 'e-session-1' });
    });
});
