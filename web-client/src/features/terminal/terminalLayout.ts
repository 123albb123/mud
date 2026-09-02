export interface TerminalSize {
    cols: number;
    rows: number;
}

export interface TerminalMetrics {
    width: number;
    height: number;
    charWidth: number;
    lineHeight: number;
    horizontalPadding?: number;
    verticalPadding?: number;
}

const clampTerminalDimension = (value: number, minimum: number): number =>
    Math.max(minimum, Math.min(65535, Math.floor(value)));

export const estimateTerminalSize = ({
    width,
    height,
    charWidth,
    lineHeight,
    horizontalPadding = 0,
    verticalPadding = 0,
}: TerminalMetrics): TerminalSize => ({
    cols: clampTerminalDimension((width - horizontalPadding) / Math.max(1, charWidth), 20),
    rows: clampTerminalDimension((height - verticalPadding) / Math.max(1, lineHeight), 5),
});

const parsePixels = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const resolveLineHeight = (value: string, fontSize: number): number => {
    const parsed = parsePixels(value);
    return parsed > 0 ? parsed : fontSize * 1.6;
};

const measureCharacterWidth = (font: string, fontSize: number): number => {
    const fallback = Math.max(1, fontSize * 0.6);
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
        return fallback;
    }
    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            return fallback;
        }
        context.font = font;
        return Math.max(1, context.measureText('0').width);
    } catch {
        return fallback;
    }
};

export const measureTerminalElement = (element: HTMLElement): TerminalSize => {
    const style = window.getComputedStyle(element);
    const fontSize = parsePixels(style.fontSize) || 16;
    const lineHeight = resolveLineHeight(style.lineHeight, fontSize);
    const horizontalPadding = parsePixels(style.paddingLeft) + parsePixels(style.paddingRight);
    const verticalPadding = parsePixels(style.paddingTop) + parsePixels(style.paddingBottom);
    const charWidth = measureCharacterWidth(style.font, fontSize);
    return estimateTerminalSize({
        width: element.clientWidth,
        height: element.clientHeight,
        charWidth,
        lineHeight,
        horizontalPadding,
        verticalPadding,
    });
};
