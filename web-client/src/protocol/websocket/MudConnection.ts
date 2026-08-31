export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error';

export interface MudConnectionOptions {
    onState: (state: ConnectionState, detail?: string) => void;
    onData: (data: Uint8Array) => void;
    onDebug?: (message: string) => void;
    maxReconnectAttempts?: number;
    reconnectBaseDelayMs?: number;
    reconnectMaxDelayMs?: number;
}

export class MudConnection {
    private socket?: WebSocket;
    private url = '';
    private protocols: string[] = ['telnet'];
    private reconnectTimer?: number;
    private reconnectAttempt = 0;
    private manuallyClosed = true;
    private generation = 0;

    constructor(private readonly options: MudConnectionOptions) {}

    connect(url: string, protocols: string[] = ['telnet']): void {
        this.manuallyClosed = true;
        this.clearReconnectTimer();
        this.generation++;
        this.socket?.close(1000, 'new connection');

        this.url = url;
        this.protocols = protocols;
        this.reconnectAttempt = 0;
        this.manuallyClosed = false;
        this.open(false, this.generation);
    }

    disconnect(): void {
        this.manuallyClosed = true;
        this.clearReconnectTimer();
        this.generation++;
        const socket = this.socket;
        this.socket = undefined;
        if (socket && socket.readyState < WebSocket.CLOSING) {
            socket.close(1000, 'user disconnect');
        }
        this.options.onState('closed', '用户已断开');
        this.debug('WebSocket manual disconnect');
    }

    sendBytes(bytes: Uint8Array): boolean {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        this.socket.send(Uint8Array.from(bytes).buffer);
        return true;
    }

    private open(reconnecting: boolean, generation: number): void {
        this.options.onState(reconnecting ? 'reconnecting' : 'connecting');
        this.debug(`WebSocket ${reconnecting ? 'reconnecting' : 'connecting'} ${this.url}`);

        let socket: WebSocket;
        try {
            socket = new WebSocket(this.url, this.protocols);
        } catch (error) {
            this.options.onState('error', error instanceof Error ? error.message : '无法创建 WebSocket');
            this.scheduleReconnect(generation);
            return;
        }

        socket.binaryType = 'arraybuffer';
        this.socket = socket;

        socket.onopen = () => {
            if (generation !== this.generation) {
                socket.close();
                return;
            }
            this.reconnectAttempt = 0;
            this.options.onState('connected');
            this.debug(`WebSocket connected (${socket.protocol || 'no subprotocol'})`);
        };

        socket.onmessage = (event: MessageEvent<unknown>) => {
            if (generation !== this.generation) {
                return;
            }
            if (event.data instanceof ArrayBuffer) {
                this.options.onData(new Uint8Array(event.data));
            } else if (typeof event.data === 'string') {
                this.options.onData(new TextEncoder().encode(event.data));
            } else if (event.data instanceof Blob) {
                void event.data.arrayBuffer().then((buffer) => {
                    if (generation === this.generation) {
                        this.options.onData(new Uint8Array(buffer));
                    }
                });
            }
        };

        socket.onerror = () => {
            if (generation === this.generation) {
                this.options.onState('error', 'WebSocket 连接错误');
                this.debug('WebSocket error');
            }
        };

        socket.onclose = (event) => {
            if (generation !== this.generation) {
                return;
            }
            this.socket = undefined;
            this.debug(`WebSocket closed (${event.code})`);
            if (this.manuallyClosed) {
                this.options.onState('closed', '用户已断开');
                return;
            }
            this.scheduleReconnect(generation);
        };
    }

    private scheduleReconnect(generation: number): void {
        if (this.manuallyClosed || generation !== this.generation) {
            return;
        }
        const maximum = this.options.maxReconnectAttempts ?? 4;
        if (this.reconnectAttempt >= maximum) {
            this.options.onState('closed', '重连次数已用完');
            return;
        }

        const base = this.options.reconnectBaseDelayMs ?? 1000;
        const cap = this.options.reconnectMaxDelayMs ?? 8000;
        const delay = Math.min(cap, base * 2 ** this.reconnectAttempt);
        this.reconnectAttempt++;
        this.options.onState('reconnecting', `${delay / 1000} 秒后重试 ${this.reconnectAttempt}/${maximum}`);
        this.debug(`WebSocket reconnect scheduled in ${delay}ms`);
        this.reconnectTimer = window.setTimeout(() => this.open(true, generation), delay);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer !== undefined) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    private debug(message: string): void {
        this.options.onDebug?.(message);
    }
}
