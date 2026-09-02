import { useEffect, useRef, useState } from 'react';

export const COMMAND_HISTORY_LIMIT = 100;

interface CommandBarProps {
    connected: boolean;
    history?: string[];
    onHistoryChange?: (history: string[]) => void;
    onSend: (command: string) => void;
    onValueChange?: (value: string) => void;
    serverSensitive: boolean;
    value?: string;
}

export const CommandBar = ({
    connected,
    history,
    onHistoryChange,
    onSend,
    onValueChange,
    serverSensitive,
    value,
}: CommandBarProps) => {
    const [internalValue, setInternalValue] = useState('');
    const [internalHistory, setInternalHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [draft, setDraft] = useState('');
    const [manualSensitive, setManualSensitive] = useState(false);
    const composingRef = useRef(false);
    const previousSensitiveRef = useRef<boolean | null>(null);
    const sensitive = serverSensitive || manualSensitive;
    const currentValue = value ?? internalValue;
    const currentHistory = history ?? internalHistory;

    const updateValue = (next: string) => {
        if (onValueChange) {
            onValueChange(next);
        } else {
            setInternalValue(next);
        }
    };

    const updateHistory = (next: string[]) => {
        if (onHistoryChange) {
            onHistoryChange(next);
        } else {
            setInternalHistory(next);
        }
    };

    useEffect(() => {
        setHistoryIndex(-1);
        setDraft('');
        if (previousSensitiveRef.current !== null && previousSensitiveRef.current !== sensitive) {
            // Do not reveal text that was entered before the input became
            // sensitive (or after the user turns the manual privacy toggle off).
            updateValue('');
        }
        previousSensitiveRef.current = sensitive;
    }, [sensitive]);

    const submit = () => {
        if (!connected || composingRef.current) {
            return;
        }
        const submitted = currentValue;
        onSend(submitted);
        if (!sensitive && submitted.trim()) {
            const nextHistory = currentHistory.at(-1) === submitted
                ? currentHistory
                : [...currentHistory.slice(-(COMMAND_HISTORY_LIMIT - 1)), submitted];
            updateHistory(nextHistory);
        }
        updateValue('');
        setHistoryIndex(-1);
        setDraft('');
    };

    const navigateHistory = (direction: -1 | 1) => {
        if (sensitive || composingRef.current || currentHistory.length === 0) {
            return;
        }
        if (historyIndex === -1) {
            if (direction === 1) {
                return;
            }
            setDraft(currentValue);
            setHistoryIndex(currentHistory.length - 1);
            updateValue(currentHistory.at(-1) ?? '');
            return;
        }

        if (direction === -1) {
            const next = Math.max(0, historyIndex - 1);
            setHistoryIndex(next);
            updateValue(currentHistory[next]);
            return;
        }

        const next = historyIndex + 1;
        if (next >= currentHistory.length) {
            setHistoryIndex(-1);
            updateValue(draft);
        } else {
            setHistoryIndex(next);
            updateValue(currentHistory[next]);
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
                autoCapitalize="none"
                autoComplete={sensitive ? 'new-password' : 'off'}
                data-sensitive={sensitive}
                disabled={!connected}
                enterKeyHint="send"
                inputMode="text"
                onChange={(event) => updateValue(event.target.value)}
                onCompositionEnd={() => {
                    composingRef.current = false;
                }}
                onCompositionStart={() => {
                    composingRef.current = true;
                }}
                onKeyDown={(event) => {
                    const composing = composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229;
                    if (event.key === 'Enter') {
                        if (composing) {
                            return;
                        }
                        event.preventDefault();
                        submit();
                    } else if (event.key === 'ArrowUp') {
                        if (composing) {
                            return;
                        }
                        event.preventDefault();
                        navigateHistory(-1);
                    } else if (event.key === 'ArrowDown') {
                        if (composing) {
                            return;
                        }
                        event.preventDefault();
                        navigateHistory(1);
                    }
                }}
                placeholder={sensitive ? '输入内容已隐藏' : '输入炎黄命令…'}
                spellCheck={false}
                type={sensitive ? 'password' : 'text'}
                value={currentValue}
            />
            <button className="send-command" disabled={!connected} onClick={submit} type="button">发送</button>
        </footer>
    );
};
