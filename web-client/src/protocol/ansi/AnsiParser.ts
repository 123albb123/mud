export interface AnsiStyle {
    bold: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
    inverse?: boolean;
    foreground?: string;
    background?: string;
}

export interface AnsiSegment extends AnsiStyle {
    text: string;
}

export const ANSI_COLOR_VALUES: Readonly<Record<string, string>> = {
    black: '#575149',
    red: '#df5146',
    green: '#78bc5e',
    yellow: '#d7a75d',
    blue: '#6d99dc',
    magenta: '#ad69ce',
    cyan: '#65c2c5',
    white: '#e6dccb',
    'bright-black': '#756d61',
    'bright-red': '#f06b5f',
    'bright-green': '#9bd27b',
    'bright-yellow': '#f0c778',
    'bright-blue': '#8cb4f0',
    'bright-magenta': '#d08bea',
    'bright-cyan': '#8ce1df',
    'bright-white': '#fff6e7',
};

const foregroundColors: Record<number, string> = {
    30: 'black',
    31: 'red',
    32: 'green',
    33: 'yellow',
    34: 'blue',
    35: 'magenta',
    36: 'cyan',
    37: 'white',
    90: 'bright-black',
    91: 'bright-red',
    92: 'bright-green',
    93: 'bright-yellow',
    94: 'bright-blue',
    95: 'bright-magenta',
    96: 'bright-cyan',
    97: 'bright-white',
};

const backgroundColors: Record<number, string> = {
    40: 'black',
    41: 'red',
    42: 'green',
    43: 'yellow',
    44: 'blue',
    45: 'magenta',
    46: 'cyan',
    47: 'white',
    100: 'bright-black',
    101: 'bright-red',
    102: 'bright-green',
    103: 'bright-yellow',
    104: 'bright-blue',
    105: 'bright-magenta',
    106: 'bright-cyan',
    107: 'bright-white',
};

const ANSI_16_COLORS = [
    '#000000', '#800000', '#008000', '#808000',
    '#000080', '#800080', '#008080', '#c0c0c0',
    '#808080', '#ff0000', '#00ff00', '#ffff00',
    '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
];

const toHex = (red: number, green: number, blue: number): string =>
    `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;

const xterm256Color = (index: number): string | undefined => {
    if (!Number.isInteger(index) || index < 0 || index > 255) {
        return undefined;
    }
    if (index < ANSI_16_COLORS.length) {
        return ANSI_16_COLORS[index];
    }
    if (index >= 232) {
        const gray = 8 + (index - 232) * 10;
        return toHex(gray, gray, gray);
    }

    const cubeIndex = index - 16;
    const red = Math.floor(cubeIndex / 36);
    const green = Math.floor((cubeIndex % 36) / 6);
    const blue = cubeIndex % 6;
    const levels = [0, 95, 135, 175, 215, 255];
    return toHex(levels[red], levels[green], levels[blue]);
};

const trueColor = (red: number, green: number, blue: number): string | undefined => {
    const values = [red, green, blue];
    if (!values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) {
        return undefined;
    }
    return toHex(red, green, blue);
};

export const ansiColorToCss = (color: string | undefined): string | undefined => {
    if (!color) {
        return undefined;
    }
    return ANSI_COLOR_VALUES[color] ?? (color.startsWith('#') ? color : undefined);
};

export const isNamedAnsiColor = (color: string | undefined): boolean =>
    color !== undefined && Object.prototype.hasOwnProperty.call(ANSI_COLOR_VALUES, color);

const findStringControlEnd = (input: string, start: number): number | undefined => {
    for (let index = start; index < input.length; index++) {
        if (input.charCodeAt(index) === 0x07) {
            return index + 1;
        }
        if (input.charCodeAt(index) === 0x1b) {
            if (index + 1 >= input.length) {
                return undefined;
            }
            if (input[index + 1] === '\\') {
                return index + 2;
            }
        }
    }
    return undefined;
};

export class AnsiParser {
    private pending = '';
    private bold = false;
    private dim = false;
    private italic = false;
    private underline = false;
    private inverse = false;
    private foreground?: string;
    private background?: string;

    reset(): void {
        this.pending = '';
        this.bold = false;
        this.dim = false;
        this.italic = false;
        this.underline = false;
        this.inverse = false;
        this.foreground = undefined;
        this.background = undefined;
    }

    push(chunk: string): AnsiSegment[] {
        const input = this.pending + chunk;
        const segments: AnsiSegment[] = [];
        let textStart = 0;
        let cursor = 0;
        this.pending = '';

        const append = (text: string): void => {
            if (!text) {
                return;
            }
            const previous = segments.at(-1);
            if (previous && this.hasSameStyle(previous)) {
                previous.text += text;
            } else {
                segments.push(this.createSegment(text));
            }
        };

        while (cursor < input.length) {
            const escapeIndex = input.indexOf('\u001b', cursor);
            if (escapeIndex < 0) {
                append(input.slice(textStart));
                return segments;
            }

            append(input.slice(textStart, escapeIndex));
            if (escapeIndex + 1 >= input.length) {
                this.pending = input.slice(escapeIndex);
                return segments;
            }

            const marker = input[escapeIndex + 1];
            if (marker === '[') {
                let end = escapeIndex + 2;
                while (end < input.length) {
                    const code = input.charCodeAt(end);
                    if (code >= 0x40 && code <= 0x7e) {
                        break;
                    }
                    end++;
                }
                if (end >= input.length) {
                    this.pending = input.slice(escapeIndex);
                    return segments;
                }
                if (input[end] === 'm') {
                    this.applySGR(input.slice(escapeIndex + 2, end));
                }
                cursor = end + 1;
                textStart = cursor;
                continue;
            }

            if (marker === ']' || marker === 'P' || marker === '^' || marker === '_') {
                const end = findStringControlEnd(input, escapeIndex + 2);
                if (end === undefined) {
                    this.pending = input.slice(escapeIndex);
                    return segments;
                }
                cursor = end;
                textStart = cursor;
                continue;
            }

            // Unsupported two-byte ESC controls are intentionally discarded.
            // Printable application text after an ESC is not trusted as markup.
            cursor = escapeIndex + 2;
            textStart = cursor;
        }

        append(input.slice(textStart));
        return segments;
    }

    private createSegment(text: string): AnsiSegment {
        const segment: AnsiSegment = {
            text,
            bold: this.bold,
            foreground: this.foreground,
        };
        if (this.dim) {
            segment.dim = true;
        }
        if (this.italic) {
            segment.italic = true;
        }
        if (this.underline) {
            segment.underline = true;
        }
        if (this.inverse) {
            segment.inverse = true;
        }
        if (this.background !== undefined) {
            segment.background = this.background;
        }
        return segment;
    }

    private hasSameStyle(segment: AnsiSegment): boolean {
        return segment.bold === this.bold &&
            Boolean(segment.dim) === this.dim &&
            Boolean(segment.italic) === this.italic &&
            Boolean(segment.underline) === this.underline &&
            Boolean(segment.inverse) === this.inverse &&
            segment.foreground === this.foreground &&
            segment.background === this.background;
    }

    private applySGR(parameters: string): void {
        const codes = parameters === ''
            ? [0]
            : parameters.split(/[;:]/).map((value) => Number.parseInt(value, 10));

        for (let index = 0; index < codes.length; index++) {
            const code = codes[index];
            if (!Number.isInteger(code)) {
                continue;
            }
            if (code === 0) {
                this.bold = false;
                this.dim = false;
                this.italic = false;
                this.underline = false;
                this.inverse = false;
                this.foreground = undefined;
                this.background = undefined;
            } else if (code === 1) {
                this.bold = true;
            } else if (code === 2) {
                this.dim = true;
            } else if (code === 3) {
                this.italic = true;
            } else if (code === 4 || code === 21) {
                this.underline = true;
            } else if (code === 7) {
                this.inverse = true;
            } else if (code === 22) {
                this.bold = false;
                this.dim = false;
            } else if (code === 23) {
                this.italic = false;
            } else if (code === 24) {
                this.underline = false;
            } else if (code === 27) {
                this.inverse = false;
            } else if (code === 39) {
                this.foreground = undefined;
            } else if (code === 49) {
                this.background = undefined;
            } else if (foregroundColors[code]) {
                this.foreground = foregroundColors[code];
            } else if (backgroundColors[code]) {
                this.background = backgroundColors[code];
            } else if (code === 38 || code === 48) {
                const extended = this.readExtendedColor(codes, index + 1);
                if (extended) {
                    if (code === 38) {
                        this.foreground = extended.color;
                    } else {
                        this.background = extended.color;
                    }
                    index += extended.consumed;
                }
            }
        }
    }

    private readExtendedColor(codes: number[], start: number): { color: string; consumed: number } | undefined {
        const mode = codes[start];
        if (mode === 5) {
            const color = xterm256Color(codes[start + 1]);
            return color === undefined ? undefined : { color, consumed: 2 };
        }
        if (mode === 2) {
            const color = trueColor(codes[start + 1], codes[start + 2], codes[start + 3]);
            return color === undefined ? undefined : { color, consumed: 4 };
        }
        return undefined;
    }
}
