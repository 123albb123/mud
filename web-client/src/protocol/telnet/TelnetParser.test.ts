import { describe, expect, it, vi } from 'vitest';
import { Telnet } from './constants';
import { TelnetParser } from './TelnetParser';

const createParser = () => {
    const sent: Uint8Array[] = [];
    const text: Uint8Array[] = [];
    const gmcp: Uint8Array[] = [];
    const echo = vi.fn();
    const gmcpEnabled = vi.fn();
    const parser = new TelnetParser({
        send: (bytes) => sent.push(bytes),
        onText: (bytes) => text.push(bytes),
        onGMCP: (bytes) => gmcp.push(bytes),
        onGMCPEnabled: gmcpEnabled,
        onEcho: echo,
        terminalType: 'YH-TEST',
    });
    return { parser, sent, text, gmcp, echo, gmcpEnabled };
};

describe('TelnetParser', () => {
    it('answers server WILL GMCP with DO GMCP', () => {
        const { parser, sent, gmcpEnabled } = createParser();
        parser.push(new Uint8Array([Telnet.IAC, Telnet.WILL, Telnet.GMCP]));
        expect([...sent[0]]).toEqual([Telnet.IAC, Telnet.DO, Telnet.GMCP]);
        expect(gmcpEnabled).toHaveBeenCalledTimes(1);
        parser.push(new Uint8Array([Telnet.IAC, Telnet.WILL, Telnet.GMCP]));
        expect(gmcpEnabled).toHaveBeenCalledTimes(1);
    });

    it('keeps negotiation and subnegotiation state across frames', () => {
        const { parser, sent } = createParser();
        parser.push(new Uint8Array([Telnet.IAC, Telnet.DO]));
        parser.push(new Uint8Array([Telnet.TERMINAL_TYPE, Telnet.IAC, Telnet.SB]));
        parser.push(new Uint8Array([Telnet.TERMINAL_TYPE, 1, Telnet.IAC]));
        parser.push(new Uint8Array([Telnet.SE]));

        expect([...sent[0]]).toEqual([Telnet.IAC, Telnet.WILL, Telnet.TERMINAL_TYPE]);
        const terminalResponse = sent[1];
        expect([...terminalResponse.slice(0, 4)]).toEqual([
            Telnet.IAC, Telnet.SB, Telnet.TERMINAL_TYPE, 0,
        ]);
        expect([...terminalResponse.slice(-2)]).toEqual([Telnet.IAC, Telnet.SE]);
    });

    it('handles SB/SE and unescapes IAC IAC in GMCP payloads', () => {
        const { parser, gmcp } = createParser();
        parser.push(new Uint8Array([
            Telnet.IAC, Telnet.SB, Telnet.GMCP,
            65, Telnet.IAC, Telnet.IAC, 66,
            Telnet.IAC, Telnet.SE,
        ]));
        expect([...gmcp[0]]).toEqual([65, Telnet.IAC, 66]);
    });

    it('passes escaped IAC as text and tracks ECHO', () => {
        const { parser, text, echo } = createParser();
        parser.push(new Uint8Array([65, Telnet.IAC]));
        parser.push(new Uint8Array([Telnet.IAC, 66, Telnet.IAC, Telnet.WILL, Telnet.ECHO]));
        parser.push(new Uint8Array([Telnet.IAC, Telnet.WONT, Telnet.ECHO]));

        expect([...text[0], ...text[1]]).toEqual([65, Telnet.IAC, 66]);
        expect(echo).toHaveBeenNthCalledWith(1, true);
        expect(echo).toHaveBeenNthCalledWith(2, false);
    });

    it('UTF-8 encodes non-ASCII application data without inventing Telnet commands', () => {
        const { parser } = createParser();
        expect([...parser.encodeText(`A${String.fromCharCode(255)}B`)]).toEqual([65, 195, 191, 66]);
    });

    it('sends measured NAWS dimensions after negotiation and on resize', () => {
        const { parser, sent } = createParser();
        parser.setWindowSize(1440, 900);
        parser.push(new Uint8Array([Telnet.IAC, Telnet.DO, Telnet.NAWS]));
        expect([...sent[1]]).toEqual([
            Telnet.IAC, Telnet.SB, Telnet.NAWS,
            5, 160, 3, 132,
            Telnet.IAC, Telnet.SE,
        ]);

        parser.setWindowSize(86, 15);
        expect([...sent[2]]).toEqual([
            Telnet.IAC, Telnet.SB, Telnet.NAWS,
            0, 86, 0, 15,
            Telnet.IAC, Telnet.SE,
        ]);
    });
});
