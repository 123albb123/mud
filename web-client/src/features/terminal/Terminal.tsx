import { useEffect, useRef, useState } from 'react';
import type { AnsiSegment } from '../../protocol/ansi/AnsiParser';

interface TerminalProps {
    segments: AnsiSegment[];
}

export const Terminal = ({ segments }: TerminalProps) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [following, setFollowing] = useState(true);

    const scrollToBottom = () => {
        const terminal = terminalRef.current;
        if (terminal) {
            terminal.scrollTop = terminal.scrollHeight;
            setFollowing(true);
        }
    };

    useEffect(() => {
        if (following) {
            scrollToBottom();
        }
    }, [segments, following]);

    const handleScroll = () => {
        const terminal = terminalRef.current;
        if (!terminal) {
            return;
        }
        const distance = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight;
        setFollowing(distance < 36);
    };

    return (
        <section className="terminal-wrap" aria-label="炎黄文字终端">
            <div className="terminal" onScroll={handleScroll} ref={terminalRef} role="log" aria-live="polite">
                {segments.map((segment, index) => (
                    <span
                        className={[
                            segment.bold ? 'ansi-bold' : '',
                            segment.foreground ? `ansi-${segment.foreground}` : '',
                        ].filter(Boolean).join(' ')}
                        key={index}
                    >
                        {segment.text}
                    </span>
                ))}
            </div>
            {!following && (
                <button className="to-bottom" onClick={scrollToBottom} type="button">回到底部</button>
            )}
        </section>
    );
};
