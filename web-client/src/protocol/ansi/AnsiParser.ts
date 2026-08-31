export interface AnsiStyle {
    bold: boolean;
    foreground?: string;
}

export interface AnsiSegment extends AnsiStyle {
    text: string;
}

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

export class AnsiParser {
    private pending = '';
    private bold = false;
    private foreground?: string;

    reset(): void {
        this.pending = '';
        this.bold = false;
        this.foreground = undefined;
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
            if (previous && previous.bold === this.bold && previous.foreground === this.foreground) {
                previous.text += text;
            } else {
                segments.push({ text, bold: this.bold, foreground: this.foreground });
            }
        };

        while (cursor < input.length) {
            if (input.charCodeAt(cursor) !== 0x1b) {
                cursor++;
                continue;
            }

            append(input.slice(textStart, cursor));
            if (cursor + 1 >= input.length || input[cursor + 1] !== '[') {
                if (cursor + 1 >= input.length) {
                    this.pending = input.slice(cursor);
                    return segments;
                }
                cursor++;
                textStart = cursor;
                continue;
            }

            let end = cursor + 2;
            while (end < input.length) {
                const code = input.charCodeAt(end);
                if (code >= 0x40 && code <= 0x7e) {
                    break;
                }
                end++;
            }
            if (end >= input.length) {
                this.pending = input.slice(cursor);
                return segments;
            }

            if (input[end] === 'm') {
                this.applySGR(input.slice(cursor + 2, end));
            }
            cursor = end + 1;
            textStart = cursor;
        }

        append(input.slice(textStart));
        return segments;
    }

    private applySGR(parameters: string): void {
        const codes = parameters === '' ? [0] : parameters.split(';').map(Number);
        for (const code of codes) {
            if (code === 0) {
                this.bold = false;
                this.foreground = undefined;
            } else if (code === 1) {
                this.bold = true;
            } else if (code === 22) {
                this.bold = false;
            } else if (code === 39) {
                this.foreground = undefined;
            } else if (foregroundColors[code]) {
                this.foreground = foregroundColors[code];
            }
        }
    }
}
