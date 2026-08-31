import { useState } from 'react';

interface CommandBarProps {
    connected: boolean;
    serverSensitive: boolean;
    onSend: (command: string) => void;
}

export const CommandBar = ({ connected, serverSensitive, onSend }: CommandBarProps) => {
    const [value, setValue] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [draft, setDraft] = useState('');
    const [manualSensitive, setManualSensitive] = useState(false);
    const sensitive = serverSensitive || manualSensitive;

    const submit = () => {
        if (!connected) {
            return;
        }
        onSend(value);
        if (!sensitive && value.trim()) {
            setHistory((current) => current.at(-1) === value ? current : [...current.slice(-99), value]);
        }
        setValue('');
        setHistoryIndex(-1);
        setDraft('');
    };

    const navigateHistory = (direction: -1 | 1) => {
        if (sensitive || history.length === 0) {
            return;
        }
        if (historyIndex === -1) {
            if (direction === 1) {
                return;
            }
            setDraft(value);
            setHistoryIndex(history.length - 1);
            setValue(history.at(-1) ?? '');
            return;
        }
        const next = historyIndex + direction;
        if (next < 0) {
            setHistoryIndex(-1);
            setValue(draft);
        } else if (next >= history.length) {
            setHistoryIndex(history.length - 1);
            setValue(history.at(-1) ?? '');
        } else {
            setHistoryIndex(next);
            setValue(history[next]);
        }
    };

    return (
        <footer className="command-bar">
            <button
                aria-pressed={manualSensitive}
                className={`privacy-toggle ${sensitive ? 'active' : ''}`}
                onClick={() => setManualSensitive((current) => !current)}
                title="手动隐藏当前输入；服务器密码协商时会自动启用"
                type="button"
            >
                {sensitive ? '已隐藏' : '隐藏输入'}
            </button>
            <input
                aria-label={sensitive ? '密码或敏感输入' : 'MUD 命令'}
                autoComplete="off"
                disabled={!connected}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        submit();
                    } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        navigateHistory(-1);
                    } else if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        navigateHistory(1);
                    }
                }}
                placeholder={sensitive ? '输入内容已隐藏' : '输入炎黄命令…'}
                spellCheck={false}
                type={sensitive ? 'password' : 'text'}
                value={value}
            />
            <button className="send-command" disabled={!connected} onClick={submit} type="button">发送</button>
        </footer>
    );
};
