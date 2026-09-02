import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
    ansiColorToCss,
    isNamedAnsiColor,
    type AnsiSegment,
} from '../../protocol/ansi/AnsiParser';
import { countTerminalLineBreaks } from './terminalHistory';
import { measureTerminalElement, type TerminalSize } from './terminalLayout';

export type TerminalFontSize = 'small' | 'standard' | 'large';

export interface TerminalProps {
    connected?: boolean;
    onTerminalSize?: (size: TerminalSize) => void;
    segments: AnsiSegment[];
    terminalFontSize?: TerminalFontSize;
}

export const TERMINAL_SCROLL_THRESHOLD = 64;

const containsSelection = (element: HTMLElement): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return false;
    }
    const contains = (node: Node | null): boolean => node !== null && (node === element || element.contains(node));
    return contains(selection.anchorNode) || contains(selection.focusNode);
};

const segmentStyle = (segment: AnsiSegment): CSSProperties | undefined => {
    const foreground = ansiColorToCss(segment.foreground);
    const background = ansiColorToCss(segment.background);
    const style: CSSProperties = {};
    if (segment.inverse) {
        style.color = background ?? '#0d1010';
        style.backgroundColor = foreground ?? '#d3c8b8';
    } else {
        if (foreground) {
            style.color = foreground;
        }
        if (background) {
            style.backgroundColor = background;
        }
    }
    return Object.keys(style).length > 0 ? style : undefined;
};

const segmentClassName = (segment: AnsiSegment): string => [
    segment.bold ? 'ansi-bold' : '',
    segment.dim ? 'ansi-dim' : '',
    segment.italic ? 'ansi-italic' : '',
    segment.underline ? 'ansi-underline' : '',
    segment.inverse ? 'ansi-inverse' : '',
    isNamedAnsiColor(segment.foreground) ? `ansi-${segment.foreground}` : '',
    isNamedAnsiColor(segment.background) ? `ansi-bg-${segment.background}` : '',
].filter(Boolean).join(' ');

export const Terminal = ({
    connected = true,
    onTerminalSize,
    segments,
    terminalFontSize = 'standard',
}: TerminalProps) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [following, setFollowing] = useState(true);
    const [newOutputCount, setNewOutputCount] = useState(0);
    const followingRef = useRef(true);
    const previousSegmentsRef = useRef<AnsiSegment[] | null>(null);
    const previousLineBreaksRef = useRef(0);
    const lastTerminalSizeRef = useRef<TerminalSize | null>(null);
    const resizeHandleRef = useRef<number | null>(null);

    const setFollowingState = useCallback((next: boolean) => {
        followingRef.current = next;
        setFollowing(next);
    }, []);

    const scrollToBottom = useCallback(() => {
        const terminal = terminalRef.current;
        if (terminal) {
            terminal.scrollTop = terminal.scrollHeight;
        }
        setFollowingState(true);
        setNewOutputCount(0);
    }, [setFollowingState]);

    const reportTerminalSize = useCallback(() => {
        const terminal = terminalRef.current;
        if (!terminal || !onTerminalSize) {
            return;
        }
        const next = measureTerminalElement(terminal);
        const previous = lastTerminalSizeRef.current;
        if (previous && previous.cols === next.cols && previous.rows === next.rows) {
            return;
        }
        lastTerminalSizeRef.current = next;
        onTerminalSize(next);
    }, [onTerminalSize]);

    const scheduleTerminalSizeReport = useCallback(() => {
        if (!onTerminalSize || resizeHandleRef.current !== null) {
            return;
        }
        const report = () => {
            resizeHandleRef.current = null;
            reportTerminalSize();
        };
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            resizeHandleRef.current = window.requestAnimationFrame(report);
        } else if (typeof window !== 'undefined') {
            resizeHandleRef.current = window.setTimeout(report, 0);
        }
    }, [onTerminalSize, reportTerminalSize]);

    useLayoutEffect(() => {
        if (!onTerminalSize) {
            return undefined;
        }
        reportTerminalSize();
        const terminal = terminalRef.current;
        if (!terminal) {
            return undefined;
        }
        const observer = typeof ResizeObserver === 'undefined'
            ? undefined
            : new ResizeObserver(scheduleTerminalSizeReport);
        observer?.observe(terminal);
        window.addEventListener('resize', scheduleTerminalSizeReport, { passive: true });
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', scheduleTerminalSizeReport);
            if (resizeHandleRef.current !== null) {
                window.cancelAnimationFrame?.(resizeHandleRef.current);
                window.clearTimeout(resizeHandleRef.current);
                resizeHandleRef.current = null;
            }
        };
    }, [onTerminalSize, reportTerminalSize, scheduleTerminalSizeReport, terminalFontSize]);

    useLayoutEffect(() => {
        if (followingRef.current) {
            scrollToBottom();
        }
    }, [scrollToBottom, terminalFontSize]);

    useEffect(() => {
        const previous = previousSegmentsRef.current;
        const previousLineBreaks = previousLineBreaksRef.current;
        const currentLineBreaks = countTerminalLineBreaks(segments);
        previousSegmentsRef.current = segments;
        previousLineBreaksRef.current = currentLineBreaks;
        if (previous === null) {
            if (segments.length > 0) {
                scrollToBottom();
            }
            return;
        }
        if (previous === segments) {
            return;
        }

        const terminal = terminalRef.current;
        const selected = terminal ? containsSelection(terminal) : false;
        if (followingRef.current && !selected) {
            scrollToBottom();
            return;
        }

        const addedLines = Math.max(1, currentLineBreaks - previousLineBreaks);
        setFollowingState(false);
        setNewOutputCount((current) => Math.min(9999, current + addedLines));
    }, [scrollToBottom, segments, setFollowingState]);

    const handleScroll = () => {
        const terminal = terminalRef.current;
        if (!terminal) {
            return;
        }
        const distance = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight;
        const nextFollowing = distance <= TERMINAL_SCROLL_THRESHOLD;
        setFollowingState(nextFollowing);
        if (nextFollowing) {
            setNewOutputCount(0);
        }
    };

    const indicatorText = newOutputCount > 0
        ? `↓ ${newOutputCount} 条新内容 · 回到底部`
        : '回到底部';

    return (
        <section className="terminal-wrap" aria-label="炎黄文字终端">
            <div
                aria-atomic="false"
                aria-live="off"
                className="terminal"
                data-following={following}
                data-new-output-count={newOutputCount}
                onScroll={handleScroll}
                ref={terminalRef}
                role="log"
            >
                {segments.length === 0 ? <p className="terminal-empty-state">{connected ? '等待服务器文字输出。' : '连接江湖后显示原版文字。'}</p> : segments.map((segment, index) => (
                    <span
                        className={segmentClassName(segment)}
                        key={index}
                        style={segmentStyle(segment)}
                    >
                        {segment.text}
                    </span>
                ))}
            </div>
            {(!following || newOutputCount > 0) && (
                <button
                    aria-label="回到底部"
                    className="to-bottom"
                    onClick={scrollToBottom}
                    type="button"
                >
                    {indicatorText}
                </button>
            )}
        </section>
    );
};
