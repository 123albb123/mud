import type { AnsiSegment } from '../../protocol/ansi/AnsiParser';

export const TERMINAL_HISTORY_LINES = 10_000;
export const TERMINAL_HISTORY_MAX_CHARS = 16 * 1024 * 1024;

const sameStyle = (left: AnsiSegment, right: AnsiSegment): boolean =>
    left.bold === right.bold &&
    Boolean(left.dim) === Boolean(right.dim) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    Boolean(left.inverse) === Boolean(right.inverse) &&
    left.foreground === right.foreground &&
    left.background === right.background;

export const lineBreakEnd = (text: string, start = 0): number => {
    for (let index = start; index < text.length; index++) {
        if (text[index] === '\n') {
            return index + 1;
        }
        if (text[index] === '\r') {
            return text[index + 1] === '\n' ? index + 2 : index + 1;
        }
    }
    return -1;
};

const countLineBreaks = (segments: AnsiSegment[]): number => {
    let lineBreaks = 0;
    for (const segment of segments) {
        let cursor = 0;
        while (cursor < segment.text.length) {
            const end = lineBreakEnd(segment.text, cursor);
            if (end < 0) {
                break;
            }
            lineBreaks++;
            cursor = end;
        }
    }
    return lineBreaks;
};

export const countTerminalLines = (segments: AnsiSegment[]): number => {
    const lineBreaks = countLineBreaks(segments);
    const lastText = segments.at(-1)?.text ?? '';
    const endsWithLineBreak = lastText.endsWith('\n') || lastText.endsWith('\r');
    return Math.max(1, lineBreaks + (endsWithLineBreak ? 0 : 1));
};

export const countTerminalLineBreaks = (segments: AnsiSegment[]): number =>
    countLineBreaks(segments);

export const terminalTextLength = (segments: AnsiSegment[]): number =>
    segments.reduce((total, segment) => total + segment.text.length, 0);

const trimOldestLines = (segments: AnsiSegment[], linesToDrop: number): AnsiSegment[] => {
    if (linesToDrop <= 0) {
        return segments;
    }

    const result: AnsiSegment[] = [];
    let remaining = linesToDrop;
    let started = false;

    for (const segment of segments) {
        if (remaining <= 0) {
            result.push(segment);
            continue;
        }

        let cursor = 0;
        while (cursor < segment.text.length && remaining > 0) {
            const end = lineBreakEnd(segment.text, cursor);
            if (end < 0) {
                cursor = segment.text.length;
                break;
            }
            cursor = end;
            remaining--;
        }

        if (remaining <= 0 && cursor < segment.text.length) {
            result.push({ ...segment, text: segment.text.slice(cursor) });
            started = true;
        } else if (remaining <= 0) {
            started = true;
        }
    }

    if (!started && remaining > 0) {
        return [];
    }
    return result;
};

const trimCharacters = (segments: AnsiSegment[], maximumCharacters: number): AnsiSegment[] => {
    const length = terminalTextLength(segments);
    if (length <= maximumCharacters) {
        return segments;
    }

    let remaining = length - maximumCharacters;
    const result: AnsiSegment[] = [];
    for (const segment of segments) {
        if (remaining >= segment.text.length) {
            remaining -= segment.text.length;
            continue;
        }
        if (remaining > 0) {
            result.push({ ...segment, text: segment.text.slice(remaining) });
            remaining = 0;
        } else {
            result.push(segment);
        }
    }
    return result;
};

export const appendAnsiSegments = (
    history: AnsiSegment[],
    incoming: AnsiSegment[],
    maximumLines = TERMINAL_HISTORY_LINES,
    maximumCharacters = TERMINAL_HISTORY_MAX_CHARS,
): AnsiSegment[] => {
    if (incoming.length === 0) {
        return history;
    }

    const result = history.slice();
    for (const segment of incoming) {
        if (!segment.text) {
            continue;
        }
        const previous = result.at(-1);
        if (previous && sameStyle(previous, segment)) {
            result[result.length - 1] = { ...previous, text: previous.text + segment.text };
        } else {
            result.push(segment);
        }
    }

    const lineCount = countTerminalLines(result);
    const lineTrimmed = trimOldestLines(result, Math.max(0, lineCount - maximumLines));
    return trimCharacters(lineTrimmed, maximumCharacters);
};
