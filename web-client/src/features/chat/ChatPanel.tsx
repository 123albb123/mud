import { useEffect, useMemo, useRef, useState } from 'react';
import type {
    ChatCapabilities,
    ChatKind,
    ChatMessage,
    RoomEntity,
} from '../../protocol/gmcp/gmcp';

interface ChatPanelProps {
    capabilities: ChatCapabilities | null;
    connected: boolean;
    entities: RoomEntity[];
    messages: ChatMessage[];
    onSend: (
        kind: ChatKind,
        text: string,
        options?: { channel?: string; targetEntityId?: string; emote?: boolean },
    ) => void;
}

const kindLabels: Record<ChatKind, string> = {
    channel: '频道',
    say: '说话',
    tell: '私聊',
    reply: '回复',
};

const channelName = (capabilities: ChatCapabilities | null, channelId: string): string =>
    capabilities?.channels.find((channel) => channel.id === channelId)?.name ?? channelId;

export const ChatPanel = ({ capabilities, connected, entities, messages, onSend }: ChatPanelProps) => {
    const writableChannels = useMemo(
        () => (capabilities?.channels ?? []).filter((channel) => channel.can_send),
        [capabilities],
    );
    const players = useMemo(() => entities.filter((entity) => entity.type === 'player'), [entities]);
    const [kind, setKind] = useState<ChatKind>('channel');
    const [channel, setChannel] = useState('chat');
    const [targetEntityId, setTargetEntityId] = useState('');
    const [text, setText] = useState('');
    const feedRef = useRef<HTMLDivElement>(null);
    const followTailRef = useRef(true);

    useEffect(() => {
        const feed = feedRef.current;
        if (feed && followTailRef.current) {
            feed.scrollTop = feed.scrollHeight;
        }
    }, [messages.length]);

    useEffect(() => {
        if (!writableChannels.some((entry) => entry.id === channel)) {
            setChannel(writableChannels[0]?.id ?? 'chat');
        }
    }, [channel, writableChannels]);

    useEffect(() => {
        if (!players.some((player) => player.entity_id === targetEntityId)) {
            setTargetEntityId(players[0]?.entity_id ?? '');
        }
    }, [players, targetEntityId]);

    const canSend = connected && (
        kind === 'channel'
            ? writableChannels.some((entry) => entry.id === channel)
            : kind === 'say'
                ? capabilities?.can_say === true
                : kind === 'tell'
                    ? capabilities?.can_tell === true && targetEntityId !== ''
                    : capabilities?.can_reply === true
    );

    const submit = () => {
        if (!canSend || text.length === 0) {
            return;
        }
        onSend(kind, text, kind === 'channel'
            ? { channel }
            : kind === 'tell'
                ? { targetEntityId }
                : undefined);
        setText('');
    };

    return (
        <section className="feature-panel chat-panel" aria-labelledby="chat-title">
            <div className="feature-panel-heading">
                <div>
                    <p className="eyebrow">CHAT · MESSAGE</p>
                    <h2 id="chat-title">江湖消息</h2>
                </div>
                <span className="feature-count">{messages.length} 条</span>
            </div>
            <div
                aria-live="polite"
                className="chat-feed"
                onScroll={(event) => {
                    const feed = event.currentTarget;
                    followTailRef.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 32;
                }}
                ref={feedRef}
            >
                {messages.length === 0
                    ? <p className="feature-empty-state">尚未收到结构化聊天消息。</p>
                    : messages.slice(-300).map((message) => (
                        <article className={`chat-message ${message.direction}`} key={message.message_id}>
                            <div className="chat-message-meta">
                                <strong>{message.sender.name}</strong>
                                <span>
                                    {message.kind === 'channel' && message.channel
                                        ? channelName(capabilities, message.channel)
                                        : kindLabels[message.kind]}
                                    {' · '}{new Date(message.timestamp * 1000).toLocaleTimeString()}
                                </span>
                            </div>
                            <p>{message.text}</p>
                            {message.recipient && <small>对象：{message.recipient.name}</small>}
                        </article>
                    ))}
            </div>
            <div className="chat-composer">
                <div className="chat-kind-tabs" role="tablist" aria-label="消息类型">
                    {(Object.keys(kindLabels) as ChatKind[]).map((entry) => (
                        <button
                            aria-selected={kind === entry}
                            className={kind === entry ? 'active' : ''}
                            disabled={entry === 'channel' && writableChannels.length === 0}
                            key={entry}
                            onClick={() => setKind(entry)}
                            role="tab"
                            type="button"
                        >
                            {kindLabels[entry]}
                        </button>
                    ))}
                </div>
                {kind === 'channel' && (
                    <label className="chat-field">
                        <span>频道</span>
                        <select
                            aria-label="聊天频道"
                            disabled={!connected || writableChannels.length === 0}
                            onChange={(event) => setChannel(event.target.value)}
                            value={channel}
                        >
                            {writableChannels.map((entry) => (
                                <option key={entry.id} value={entry.id}>{entry.name}</option>
                            ))}
                        </select>
                    </label>
                )}
                {kind === 'tell' && (
                    <label className="chat-field">
                        <span>对象</span>
                        <select
                            aria-label="私聊对象"
                            disabled={!connected || players.length === 0}
                            onChange={(event) => setTargetEntityId(event.target.value)}
                            value={targetEntityId}
                        >
                            {players.length === 0 && <option value="">附近没有在线玩家</option>}
                            {players.map((player) => (
                                <option key={player.entity_id} value={player.entity_id}>{player.name}</option>
                            ))}
                        </select>
                    </label>
                )}
                <div className="chat-input-row">
                    <input
                        aria-label="聊天内容"
                        disabled={!connected}
                        maxLength={capabilities?.max_text ?? 2048}
                        onChange={(event) => setText(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                                event.preventDefault();
                                submit();
                            }
                        }}
                        placeholder="输入消息，Ctrl/⌘ + Enter 发送"
                        spellCheck={false}
                        value={text}
                    />
                    <button disabled={!canSend || text.length === 0} onClick={submit} type="button">发送</button>
                </div>
            </div>
        </section>
    );
};
