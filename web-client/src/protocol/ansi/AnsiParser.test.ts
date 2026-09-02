import { describe, expect, it } from 'vitest';
import { AnsiParser } from './AnsiParser';

describe('AnsiParser', () => {
    it('preserves UTF-8 Chinese and line breaks', () => {
        expect(new AnsiParser().push('你来到扬州。\n')[0].text).toBe('你来到扬州。\n');
    });

    it('supports bold, foreground colors and reset', () => {
        const segments = new AnsiParser().push('\u001b[1;31m危险\u001b[0m平安');
        expect(segments).toEqual([
            { text: '危险', bold: true, foreground: 'red' },
            { text: '平安', bold: false, foreground: undefined },
        ]);
    });

    it('supports dim, italic, underline, inverse and background colors', () => {
        const segments = new AnsiParser().push('\u001b[2;3;4;7;91;104m格式\u001b[22;23;24;27;39;49m普通');
        expect(segments).toEqual([
            {
                text: '格式',
                bold: false,
                dim: true,
                italic: true,
                underline: true,
                inverse: true,
                foreground: 'bright-red',
                background: 'bright-blue',
            },
            { text: '普通', bold: false, foreground: undefined },
        ]);
    });

    it('supports 256-color and truecolor SGR values', () => {
        const segments = new AnsiParser().push(
            '\u001b[38;5;196m256\u001b[48;5;25m背景\u001b[38;2;18;52;86m真色',
        );
        expect(segments).toEqual([
            { text: '256', bold: false, foreground: '#ff0000' },
            { text: '背景', bold: false, foreground: '#ff0000', background: '#005faf' },
            { text: '真色', bold: false, foreground: '#123456', background: '#005faf' },
        ]);
    });

    it('keeps an ANSI sequence split across chunks', () => {
        const parser = new AnsiParser();
        expect(parser.push('前文\u001b[3')).toEqual([{ text: '前文', bold: false, foreground: undefined }]);
        expect(parser.push('2m绿字')).toEqual([{ text: '绿字', bold: false, foreground: 'green' }]);
    });

    it('filters unsupported CSI and string controls without displaying escape bytes', () => {
        const parser = new AnsiParser();
        expect(parser.push('前\u001b[?25l后\u001b]0;title\u0007尾')).toEqual([
            { text: '前后尾', bold: false, foreground: undefined },
        ]);
        expect(parser.push('A\u001b]0;')).toEqual([{ text: 'A', bold: false, foreground: undefined }]);
        expect(parser.push('title\u001b\\B')).toEqual([{ text: 'B', bold: false, foreground: undefined }]);
    });

    it('keeps HTML and scripts as plain text', () => {
        const text = '<script>alert(1)</script><b>玩家</b>';
        expect(new AnsiParser().push(text)).toEqual([{ text, bold: false, foreground: undefined }]);
    });
});
