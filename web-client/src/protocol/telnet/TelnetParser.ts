import { Telnet, telnetCommandName, telnetOptionName } from './constants';

type ParserState = 'data' | 'iac' | 'negotiation' | 'sub-option' | 'sub-data' | 'sub-iac';

export interface TelnetParserOptions {
    send: (bytes: Uint8Array) => void;
    onText: (bytes: Uint8Array) => void;
    onGMCP: (bytes: Uint8Array) => void;
    onGMCPEnabled?: () => void;
    onEcho: (serverEcho: boolean) => void;
    onDebug?: (message: string) => void;
    terminalType?: string;
}

const clampDimension = (value: number): number => Math.max(1, Math.min(65535, Math.round(value)));

export class TelnetParser {
    private state: ParserState = 'data';
    private negotiationCommand = 0;
    private subOption = 0;
    private subBuffer: number[] = [];
    private gmcpEnabled = false;
    private nawsEnabled = false;
    private width = 80;
    private height = 24;
    private readonly terminalType: string;

    constructor(private readonly options: TelnetParserOptions) {
        this.terminalType = options.terminalType ?? 'YH-WEB';
    }

    reset(): void {
        this.state = 'data';
        this.negotiationCommand = 0;
        this.subOption = 0;
        this.subBuffer = [];
        this.gmcpEnabled = false;
        this.nawsEnabled = false;
        this.options.onEcho(false);
    }

    push(chunk: Uint8Array): void {
        const text: number[] = [];

        for (const byte of chunk) {
            switch (this.state) {
                case 'data':
                    if (byte === Telnet.IAC) {
                        this.state = 'iac';
                    } else {
                        text.push(byte);
                    }
                    break;
                case 'iac':
                    this.handleIAC(byte, text);
                    break;
                case 'negotiation':
                    this.handleNegotiation(this.negotiationCommand, byte);
                    this.state = 'data';
                    break;
                case 'sub-option':
                    this.subOption = byte;
                    this.subBuffer = [];
                    this.state = 'sub-data';
                    break;
                case 'sub-data':
                    if (byte === Telnet.IAC) {
                        this.state = 'sub-iac';
                    } else {
                        this.subBuffer.push(byte);
                    }
                    break;
                case 'sub-iac':
                    if (byte === Telnet.IAC) {
                        this.subBuffer.push(Telnet.IAC);
                        this.state = 'sub-data';
                    } else if (byte === Telnet.SE) {
                        this.handleSubnegotiation(this.subOption, new Uint8Array(this.subBuffer));
                        this.state = 'data';
                    } else {
                        this.subBuffer.push(Telnet.IAC, byte);
                        this.state = 'sub-data';
                    }
                    break;
            }
        }

        if (text.length > 0) {
            this.options.onText(new Uint8Array(text));
        }
    }

    encodeText(text: string): Uint8Array {
        return this.escapeIAC(new TextEncoder().encode(text));
    }

    sendGMCP(packageName: string, payload?: unknown): boolean {
        if (!this.gmcpEnabled) {
            return false;
        }

        const message = payload === undefined
            ? packageName
            : `${packageName} ${JSON.stringify(payload)}`;
        this.sendSubnegotiation(Telnet.GMCP, new TextEncoder().encode(message));
        this.debug(`GMCP SEND ${packageName}`);
        return true;
    }

    setWindowSize(width: number, height: number): void {
        this.width = clampDimension(width);
        this.height = clampDimension(height);
        if (this.nawsEnabled) {
            this.sendWindowSize();
        }
    }

    private handleIAC(command: number, text: number[]): void {
        if (command === Telnet.IAC) {
            text.push(Telnet.IAC);
            this.state = 'data';
        } else if (command === Telnet.WILL || command === Telnet.WONT ||
                   command === Telnet.DO || command === Telnet.DONT) {
            this.negotiationCommand = command;
            this.state = 'negotiation';
        } else if (command === Telnet.SB) {
            this.state = 'sub-option';
        } else {
            this.debug(`TELNET ${telnetCommandName(command)}`);
            this.state = 'data';
        }
    }

    private handleNegotiation(command: number, option: number): void {
        this.debug(`TELNET RECV ${telnetCommandName(command)} ${telnetOptionName(option)}`);

        if (command === Telnet.WILL) {
            if (option === Telnet.GMCP || option === Telnet.ECHO ||
                option === Telnet.SUPPRESS_GO_AHEAD) {
                this.sendNegotiation(Telnet.DO, option);
                if (option === Telnet.GMCP) {
                    this.enableGMCP();
                } else if (option === Telnet.ECHO) {
                    this.options.onEcho(true);
                }
            } else {
                this.sendNegotiation(Telnet.DONT, option);
            }
            return;
        }

        if (command === Telnet.WONT) {
            this.sendNegotiation(Telnet.DONT, option);
            if (option === Telnet.GMCP) {
                this.gmcpEnabled = false;
            } else if (option === Telnet.ECHO) {
                this.options.onEcho(false);
            }
            return;
        }

        if (command === Telnet.DO) {
            if (option === Telnet.TERMINAL_TYPE) {
                this.sendNegotiation(Telnet.WILL, option);
            } else if (option === Telnet.NAWS) {
                this.nawsEnabled = true;
                this.sendNegotiation(Telnet.WILL, option);
                this.sendWindowSize();
            } else if (option === Telnet.GMCP) {
                this.enableGMCP();
                this.sendNegotiation(Telnet.WILL, option);
            } else {
                this.sendNegotiation(Telnet.WONT, option);
            }
            return;
        }

        this.sendNegotiation(Telnet.WONT, option);
        if (option === Telnet.NAWS) {
            this.nawsEnabled = false;
        }
    }

    private handleSubnegotiation(option: number, payload: Uint8Array): void {
        this.debug(`TELNET RECV SB ${telnetOptionName(option)} (${payload.length})`);
        if (option === Telnet.GMCP) {
            this.options.onGMCP(payload);
        } else if (option === Telnet.TERMINAL_TYPE && payload[0] === 1) {
            const terminal = new TextEncoder().encode(this.terminalType);
            const response = new Uint8Array(terminal.length + 1);
            response[0] = 0;
            response.set(terminal, 1);
            this.sendSubnegotiation(Telnet.TERMINAL_TYPE, response);
        }
    }

    private enableGMCP(): void {
        if (this.gmcpEnabled) {
            return;
        }
        this.gmcpEnabled = true;
        this.options.onGMCPEnabled?.();
    }

    private sendNegotiation(command: number, option: number): void {
        this.options.send(new Uint8Array([Telnet.IAC, command, option]));
        this.debug(`TELNET SEND ${telnetCommandName(command)} ${telnetOptionName(option)}`);
    }

    private sendSubnegotiation(option: number, payload: Uint8Array): void {
        const escaped = this.escapeIAC(payload);
        const message = new Uint8Array(escaped.length + 5);
        message.set([Telnet.IAC, Telnet.SB, option], 0);
        message.set(escaped, 3);
        message.set([Telnet.IAC, Telnet.SE], escaped.length + 3);
        this.options.send(message);
    }

    private sendWindowSize(): void {
        this.sendSubnegotiation(Telnet.NAWS, new Uint8Array([
            (this.width >> 8) & 0xff,
            this.width & 0xff,
            (this.height >> 8) & 0xff,
            this.height & 0xff,
        ]));
    }

    private escapeIAC(payload: Uint8Array): Uint8Array {
        const result: number[] = [];
        for (const byte of payload) {
            result.push(byte);
            if (byte === Telnet.IAC) {
                result.push(byte);
            }
        }
        return new Uint8Array(result);
    }

    private debug(message: string): void {
        this.options.onDebug?.(message);
    }
}
