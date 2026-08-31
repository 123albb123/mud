import { useCallback, useEffect, useRef, useState } from 'react';
import { AnsiParser, type AnsiSegment } from '../protocol/ansi/AnsiParser';
import {
    parseGMCP,
    toCharacterVitals,
    toRoomInfo,
    type CharacterVitals,
    type RoomInfo,
} from '../protocol/gmcp/gmcp';
import { TelnetParser } from '../protocol/telnet/TelnetParser';
import { MudConnection, type ConnectionState } from '../protocol/websocket/MudConnection';

export interface ProtocolDebugEntry {
    id: number;
    time: string;
    message: string;
}

export const defaultMudUrl = (): string => {
    const secure = window.location.protocol === 'https:';
    const host = window.location.hostname || '127.0.0.1';
    return `${secure ? 'wss' : 'ws'}://${host}:8888`;
};

export const useMudClient = () => {
    const [connectionState, setConnectionState] = useState<ConnectionState>('closed');
    const [connectionDetail, setConnectionDetail] = useState('');
    const [segments, setSegments] = useState<AnsiSegment[]>([
        { text: '连接江湖后，炎黄原版文字会显示在这里。\n', bold: false, foreground: 'bright-black' },
    ]);
    const [vitals, setVitals] = useState<CharacterVitals | null>(null);
    const [room, setRoom] = useState<RoomInfo | null>(null);
    const [serverSensitive, setServerSensitive] = useState(false);
    const [debugEntries, setDebugEntries] = useState<ProtocolDebugEntry[]>([]);
    const connectionRef = useRef<MudConnection | null>(null);
    const parserRef = useRef<TelnetParser | null>(null);
    const decoderRef = useRef(new TextDecoder('utf-8'));
    const ansiRef = useRef(new AnsiParser());
    const debugSequence = useRef(0);

    const appendDebug = useCallback((message: string) => {
        setDebugEntries((current) => [...current.slice(-199), {
            id: ++debugSequence.current,
            time: new Date().toLocaleTimeString(),
            message,
        }]);
    }, []);

    const appendText = useCallback((text: string) => {
        if (!text) {
            return;
        }
        const next = ansiRef.current.push(text);
        if (next.length > 0) {
            setSegments((current) => [...current, ...next].slice(-5000));
        }
    }, []);

    const handleGMCP = useCallback((bytes: Uint8Array) => {
        const message = parseGMCP(bytes);
        appendDebug(`GMCP RECV ${message.packageName || '(empty)'}`);
        if (message.error) {
            appendDebug(`GMCP ERROR ${message.packageName || '(empty)'}: ${message.error}`);
            return;
        }

        if (message.packageName === 'Core.Hello') {
            parserRef.current?.sendGMCP('Char.Vitals.Get');
            parserRef.current?.sendGMCP('Room.Info.Get');
        } else if (message.packageName === 'Char.Vitals') {
            const nextVitals = toCharacterVitals(message.payload);
            if (nextVitals) {
                setVitals(nextVitals);
            }
        } else if (message.packageName === 'Room.Info') {
            const nextRoom = toRoomInfo(message.payload);
            if (nextRoom) {
                setRoom(nextRoom);
            }
        }
    }, [appendDebug]);

    useEffect(() => {
        const parser = new TelnetParser({
            send: (bytes) => connectionRef.current?.sendBytes(bytes),
            onText: (bytes) => appendText(decoderRef.current.decode(bytes, { stream: true })),
            onGMCP: handleGMCP,
            onEcho: setServerSensitive,
            onDebug: appendDebug,
            terminalType: 'YH-WEB-STAGE1',
        });
        parserRef.current = parser;

        const connection = new MudConnection({
            onState: (state, detail = '') => {
                setConnectionState(state);
                setConnectionDetail(detail);
                appendDebug(`WebSocket STATE ${state}${detail ? `: ${detail}` : ''}`);
                if (state === 'connecting' || state === 'reconnecting') {
                    parser.reset();
                    decoderRef.current = new TextDecoder('utf-8');
                    ansiRef.current.reset();
                }
            },
            onData: (bytes) => parser.push(bytes),
            onDebug: appendDebug,
            maxReconnectAttempts: 4,
            reconnectBaseDelayMs: 1000,
            reconnectMaxDelayMs: 8000,
        });
        connectionRef.current = connection;

        const updateWindowSize = () => {
            parser.setWindowSize(
                Math.max(40, Math.floor(window.innerWidth / 9)),
                Math.max(12, Math.floor(window.innerHeight / 18)),
            );
        };
        updateWindowSize();
        window.addEventListener('resize', updateWindowSize);

        return () => {
            window.removeEventListener('resize', updateWindowSize);
            connection.disconnect();
            connectionRef.current = null;
            parserRef.current = null;
        };
    }, [appendDebug, appendText, handleGMCP]);

    const connect = useCallback((url: string) => {
        setVitals(null);
        setRoom(null);
        setServerSensitive(false);
        connectionRef.current?.connect(url, ['telnet']);
    }, []);

    const disconnect = useCallback(() => connectionRef.current?.disconnect(), []);

    const sendCommand = useCallback((command: string) => {
        const parser = parserRef.current;
        if (!parser) {
            return;
        }
        connectionRef.current?.sendBytes(parser.encodeText(`${command}\n`));
    }, []);

    return {
        connectionState,
        connectionDetail,
        segments,
        vitals,
        room,
        serverSensitive,
        debugEntries,
        connect,
        disconnect,
        sendCommand,
    };
};
