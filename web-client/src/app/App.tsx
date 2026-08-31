import { useEffect, useRef, useState } from 'react';
import { CharacterPanel } from '../features/character/CharacterPanel';
import { RoomPanel } from '../features/room/RoomPanel';
import { CommandBar } from '../features/terminal/CommandBar';
import { Terminal } from '../features/terminal/Terminal';
import { defaultMudUrl, useMudClient } from '../stores/useMudClient';

const stateLabels = {
    connecting: '连接中',
    connected: '已连接',
    reconnecting: '重连中',
    closed: '已断开',
    error: '连接错误',
};

export const App = () => {
    const client = useMudClient();
    const [url, setUrl] = useState(defaultMudUrl);
    const [showDebug, setShowDebug] = useState(false);
    const autoConnectStarted = useRef(false);
    const connected = client.connectionState === 'connected';
    const busy = client.connectionState === 'connecting' || client.connectionState === 'reconnecting';

    useEffect(() => {
        if (!autoConnectStarted.current) {
            autoConnectStarted.current = true;
            client.connect(url);
        }
    }, [client.connect, url]);

    return (
        <div className="game-shell">
            <header className="game-header">
                <div className="brand">
                    <span className="brand-mark">炎黄</span>
                    <div>
                        <h1>江湖</h1>
                        <p>现代 Web 客户端 · 基础版</p>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="debug-toggle" onClick={() => setShowDebug((current) => !current)} type="button">
                        协议调试
                    </button>
                    <div className={`connection-state ${client.connectionState}`} title={client.connectionDetail}>
                        <span />
                        {stateLabels[client.connectionState]}
                    </div>
                    {connected || busy ? (
                        <button className="connection-action" onClick={client.disconnect} type="button">断开</button>
                    ) : (
                        <button className="connection-action" onClick={() => client.connect(url)} type="button">连接</button>
                    )}
                </div>
            </header>

            {!connected && (
                <div className="connection-banner">
                    <label htmlFor="server-url">服务器</label>
                    <input
                        id="server-url"
                        onChange={(event) => setUrl(event.target.value)}
                        spellCheck={false}
                        type="url"
                        value={url}
                    />
                    <span>{client.connectionDetail || '默认使用 8888 / telnet 子协议'}</span>
                </div>
            )}

            <main className="game-main">
                <aside className="sidebar">
                    <CharacterPanel vitals={client.vitals} />
                    <RoomPanel room={client.room} disabled={!connected} onMove={client.sendCommand} />
                </aside>
                <Terminal segments={client.segments} />
                {showDebug && (
                    <aside className="debug-panel" aria-label="Protocol Debug">
                        <div className="debug-heading">
                            <strong>Protocol Debug</strong>
                            <button onClick={() => setShowDebug(false)} type="button">关闭</button>
                        </div>
                        <div className="debug-log">
                            {client.debugEntries.map((entry) => (
                                <div key={entry.id}><time>{entry.time}</time> {entry.message}</div>
                            ))}
                        </div>
                    </aside>
                )}
            </main>

            <CommandBar
                connected={connected}
                onSend={client.sendCommand}
                serverSensitive={client.serverSensitive}
            />
        </div>
    );
};
