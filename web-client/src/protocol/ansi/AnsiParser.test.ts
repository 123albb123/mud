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

    it('keeps an ANSI sequence split across chunks', () => {
        const parser = new AnsiParser();
        expect(parser.push('前文\u001b[3')).toEqual([{ text: '前文', bold: false, foreground: undefined }]);
        expect(parser.push('2m绿字')).toEqual([{ text: '绿字', bold: false, foreground: 'green' }]);
    });

    it('keeps HTML and scripts as plain text', () => {
        const text = '<script>alert(1)</script><b>玩家</b>';
        expect(new AnsiParser().push(text)).toEqual([{ text, bold: false, foreground: undefined }]);
    });
});
