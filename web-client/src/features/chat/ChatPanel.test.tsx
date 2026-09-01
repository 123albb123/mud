import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatCapabilities, ChatMessage, ChatTarget } from '../../protocol/gmcp/gmcp';
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

const targets: ChatTarget[] = [{
    player_id: 'p-session-1',
    name: '另一位侠客',
    id: 'other',
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
        render(<ChatPanel capabilities={capabilities} connected targets={targets} messages={messages} onSend={onSend} />);
        expect(screen.getByText('江湖见。')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('聊天内容'), { target: { value: '你好' } });
        fireEvent.click(screen.getByRole('button', { name: '发送' }));
        expect(onSend).toHaveBeenCalledWith('channel', '你好', { channel: 'chat' });
    });

    it('searches and uses an opaque player ID for cross-room tell targets', () => {
        const onSend = vi.fn();
        render(<ChatPanel capabilities={capabilities} connected targets={targets} messages={[]} onSend={onSend} />);
        fireEvent.click(screen.getByRole('tab', { name: '私聊' }));
        fireEvent.change(screen.getByLabelText('搜索私聊对象'), { target: { value: 'other' } });
        fireEvent.change(screen.getByLabelText('聊天内容'), { target: { value: '在吗' } });
        fireEvent.click(screen.getByRole('button', { name: '发送' }));
        expect(onSend).toHaveBeenCalledWith('tell', '在吗', { targetPlayerId: 'p-session-1' });
    });

    it('disables private send and exposes an empty state without targets', () => {
        const onSend = vi.fn();
        render(<ChatPanel capabilities={capabilities} connected targets={[]} messages={[]} onSend={onSend} />);
        fireEvent.click(screen.getByRole('tab', { name: '私聊' }));
        expect(screen.getByRole('option', { name: '当前没有在线玩家' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
    });

    it('follows the chat feed tail when a new message arrives', () => {
        const onSend = vi.fn();
        const { rerender } = render(
            <ChatPanel capabilities={capabilities} connected targets={targets} messages={[]} onSend={onSend} />,
        );
        const feed = document.querySelector<HTMLDivElement>('.chat-feed');
        if (!feed) {
            throw new Error('chat feed is missing');
        }
        Object.defineProperty(feed, 'scrollHeight', { configurable: true, value: 800 });
        Object.defineProperty(feed, 'clientHeight', { configurable: true, value: 240 });
        rerender(
            <ChatPanel capabilities={capabilities} connected targets={targets} messages={messages} onSend={onSend} />,
        );
        expect(feed.scrollTop).toBe(800);
    });
});
