import { describe, expect, it } from 'vitest';
import { estimateTerminalSize } from './terminalLayout';

describe('terminal layout sizing', () => {
    it('uses the measured terminal viewport instead of the browser window', () => {
        expect(estimateTerminalSize({
            width: 700,
            height: 400,
            charWidth: 8,
            lineHeight: 24,
            horizontalPadding: 8,
            verticalPadding: 20,
        })).toEqual({ cols: 86, rows: 15 });
    });

    it('keeps NAWS dimensions within safe protocol bounds', () => {
        expect(estimateTerminalSize({ width: 0, height: 0, charWidth: 0, lineHeight: 0 })).toEqual({ cols: 20, rows: 5 });
        expect(estimateTerminalSize({ width: 1_000_000, height: 1_000_000, charWidth: 1, lineHeight: 1 })).toEqual({ cols: 65535, rows: 65535 });
    });
});
