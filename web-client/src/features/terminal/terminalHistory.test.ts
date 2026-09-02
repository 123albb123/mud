import { describe, expect, it } from 'vitest';
import { AnsiParser, type AnsiSegment } from '../../protocol/ansi/AnsiParser';
import { createTerminalFixture } from '../../test/fixtures/terminal';
import {
    appendAnsiSegments,
    countTerminalLines,
    terminalTextLength,
    TERMINAL_HISTORY_LINES,
} from './terminalHistory';

const segment = (text: string, style: Partial<AnsiSegment> = {}): AnsiSegment => ({
    text,
    bold: false,
    foreground: undefined,
    ...style,
});

describe('terminal history', () => {
    it('merges adjacent segments with the same ANSI style across flushes', () => {
        const history = appendAnsiSegments([segment('前')], [segment('后')]);
        expect(history).toEqual([segment('前后')]);
    });

    it('trims only the oldest complete logical lines', () => {
        const history = appendAnsiSegments(
            [],
            [segment('第一行\r\n第二行\n第三行')],
            2,
        );
        expect(history).toEqual([segment('第二行\n第三行')]);
        expect(countTerminalLines(history)).toBe(2);
    });

    it('keeps ANSI style boundaries while trimming history', () => {
        const history = appendAnsiSegments(
            [],
            [segment('旧\n', { foreground: 'red' }), segment('新', { bold: true })],
            1,
        );
        expect(history).toEqual([segment('新', { bold: true })]);
    });

    it.each([1000, 5000, 10000])('retains a %i-line mixed Chinese ANSI fixture without unbounded growth', (lineCount) => {
        const parsed = new AnsiParser().push(createTerminalFixture(lineCount));
        const history = appendAnsiSegments([], parsed);
        expect(countTerminalLines(history)).toBe(lineCount);
        expect(history.length).toBeLessThan(TERMINAL_HISTORY_LINES * 2);
        expect(terminalTextLength(history)).toBeGreaterThan(10000);
        expect(history.map((item) => item.text).join('')).not.toContain('\u001b[');
    });

    it('handles sustained append and trims from the oldest side', () => {
        let history: AnsiSegment[] = [];
        for (let index = 0; index < 12_000; index++) {
            history = appendAnsiSegments(history, [segment(`战斗 ${index}\n`)]);
        }
        expect(countTerminalLines(history)).toBe(TERMINAL_HISTORY_LINES);
        expect(history.map((item) => item.text).join('')).not.toContain('战斗 0');
        expect(history.map((item) => item.text).join('')).toContain('战斗 11999');
    });
});
