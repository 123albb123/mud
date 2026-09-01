import { useCallback, useEffect, useRef, useState } from 'react';
import { AnsiParser, type AnsiSegment } from '../protocol/ansi/AnsiParser';
import {
    GMCP_CLIENT_HELLO,
    GMCP_INITIAL_GETS,
    GMCP_SUPPORTS,
    parseGMCP,
    toRoomEntitiesSnapshot,
    toWebEntityActionRequest,
    toWebEntityGiveRequest,
    toWebItemActionRequest,
    toWebSkillActionRequest,
    toWebCombatActionRequest,
    toCharacterVitals,
    toCharacterStatus,
    toCombatActionsSnapshot,
    toCombatStateSnapshot,
    toEquipmentSnapshot,
    toInventorySnapshot,
    toRoomInfo,
    toSkillsSnapshot,
    toQuestListSnapshot,
    toChatCapabilitiesSnapshot,
    toChatTargetsSnapshot,
    toChatMessage,
    toWebChatSendRequest,
    type CharacterStatus,
    type ChatKind,
    type ChatMessage,
    type ChatCapabilities,
    type ChatTarget,
    type CombatTargetMode,
    type CharacterSkill,
    type CombatAction,
    type CombatStateSnapshot,
    type CharacterVitals,
    type EquipmentSlot,
    type InventoryItem,
    type RoomEntity,
    type RoomInfo,
    type QuestListSnapshot,
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
    const [status, setStatus] = useState<CharacterStatus | null>(null);
    const [combat, setCombat] = useState<CombatStateSnapshot | null>(null);
    const [skills, setSkills] = useState<CharacterSkill[]>([]);
    const [combatActions, setCombatActions] = useState<CombatAction[]>([]);
    const [room, setRoom] = useState<RoomInfo | null>(null);
    const [entities, setEntities] = useState<RoomEntity[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [equipment, setEquipment] = useState<EquipmentSlot[]>([]);
    const [equipmentSlotOrder, setEquipmentSlotOrder] = useState<string[]>([]);
    const [quests, setQuests] = useState<QuestListSnapshot | null>(null);
    const [chatCapabilities, setChatCapabilities] = useState<ChatCapabilities | null>(null);
    const [chatTargets, setChatTargets] = useState<ChatTarget[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [serverSensitive, setServerSensitive] = useState(false);
    const [debugEntries, setDebugEntries] = useState<ProtocolDebugEntry[]>([]);
    const connectionRef = useRef<MudConnection | null>(null);
    const parserRef = useRef<TelnetParser | null>(null);
    const decoderRef = useRef(new TextDecoder('utf-8'));
    const ansiRef = useRef(new AnsiParser());
    const debugSequence = useRef(0);
    const inventoryRevisionRef = useRef(-1);
    const equipmentRevisionRef = useRef(-1);
    const entitiesRevisionRef = useRef(-1);
    const vitalsRevisionRef = useRef(-1);
    const statusRevisionRef = useRef(-1);
    const combatRevisionRef = useRef(-1);
    const skillsRevisionRef = useRef(-1);
    const combatActionsRevisionRef = useRef(-1);
    const questsRevisionRef = useRef(-1);
    const chatCapabilitiesRevisionRef = useRef(-1);
    const chatTargetsRevisionRef = useRef(-1);
    const chatMessageIdsRef = useRef(new Set<string>());
    const gmcpStateRequestedRef = useRef(false);

    const requestGMCPState = useCallback(() => {
        const parser = parserRef.current;
        if (!parser || gmcpStateRequestedRef.current) {
            return;
        }
        gmcpStateRequestedRef.current = true;
        parser.sendGMCP('Core.Hello', GMCP_CLIENT_HELLO);
        parser.sendGMCP('Core.Supports.Set', GMCP_SUPPORTS);
        GMCP_INITIAL_GETS.forEach((packageName) => parser.sendGMCP(packageName));
    }, []);

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

        if (message.packageName === 'Server.Hello' || message.packageName === 'Core.Hello') {
            requestGMCPState();
        } else if (message.packageName === 'Char.Vitals') {
            const nextVitals = toCharacterVitals(message.payload);
            if (nextVitals && (nextVitals.revision === undefined || nextVitals.revision >= vitalsRevisionRef.current)) {
                if (nextVitals.revision !== undefined) {
                    vitalsRevisionRef.current = nextVitals.revision;
                }
                setVitals(nextVitals);
            }
        } else if (message.packageName === 'Char.Status') {
            const nextStatus = toCharacterStatus(message.payload);
            if (nextStatus && nextStatus.revision >= statusRevisionRef.current) {
                statusRevisionRef.current = nextStatus.revision;
                setStatus(nextStatus);
            }
        } else if (message.packageName === 'Combat.State') {
            const nextCombat = toCombatStateSnapshot(message.payload);
            if (nextCombat && nextCombat.revision >= combatRevisionRef.current) {
                combatRevisionRef.current = nextCombat.revision;
                setCombat(nextCombat);
            }
        } else if (message.packageName === 'Char.Skills') {
            const nextSkills = toSkillsSnapshot(message.payload);
            if (nextSkills && nextSkills.revision >= skillsRevisionRef.current) {
                skillsRevisionRef.current = nextSkills.revision;
                setSkills(nextSkills.skills);
            }
        } else if (message.packageName === 'Combat.Actions') {
            const nextActions = toCombatActionsSnapshot(message.payload);
            if (nextActions && nextActions.revision >= combatActionsRevisionRef.current) {
                combatActionsRevisionRef.current = nextActions.revision;
                setCombatActions(nextActions.actions);
            }
        } else if (message.packageName === 'Room.Info') {
            const nextRoom = toRoomInfo(message.payload);
            if (nextRoom) {
                setRoom(nextRoom);
            }
        } else if (message.packageName === 'Room.Entities') {
            const nextEntities = toRoomEntitiesSnapshot(message.payload);
            if (nextEntities && nextEntities.revision >= entitiesRevisionRef.current) {
                entitiesRevisionRef.current = nextEntities.revision;
                setEntities(nextEntities.entities);
            }
        } else if (message.packageName === 'Char.Inventory') {
            const nextInventory = toInventorySnapshot(message.payload);
            if (nextInventory && nextInventory.revision >= inventoryRevisionRef.current) {
                inventoryRevisionRef.current = nextInventory.revision;
                setInventory(nextInventory.items);
            }
        } else if (message.packageName === 'Char.Equipment') {
            const nextEquipment = toEquipmentSnapshot(message.payload);
            if (nextEquipment && nextEquipment.revision >= equipmentRevisionRef.current) {
                equipmentRevisionRef.current = nextEquipment.revision;
                setEquipment(nextEquipment.slots);
                setEquipmentSlotOrder(nextEquipment.slot_order);
            }
        } else if (message.packageName === 'Quest.List') {
            const nextQuests = toQuestListSnapshot(message.payload);
            if (nextQuests && nextQuests.revision >= questsRevisionRef.current) {
                questsRevisionRef.current = nextQuests.revision;
                setQuests(nextQuests);
            }
        } else if (message.packageName === 'Chat.Capabilities') {
            const nextCapabilities = toChatCapabilitiesSnapshot(message.payload);
            if (nextCapabilities && nextCapabilities.revision >= chatCapabilitiesRevisionRef.current) {
                chatCapabilitiesRevisionRef.current = nextCapabilities.revision;
                setChatCapabilities(nextCapabilities);
            }
        } else if (message.packageName === 'Chat.Targets') {
            const nextTargets = toChatTargetsSnapshot(message.payload);
            if (nextTargets && nextTargets.revision >= chatTargetsRevisionRef.current) {
                chatTargetsRevisionRef.current = nextTargets.revision;
                setChatTargets(nextTargets.players);
            }
        } else if (message.packageName === 'Chat.Message') {
            const nextMessage = toChatMessage(message.payload);
            if (nextMessage && !chatMessageIdsRef.current.has(nextMessage.message_id)) {
                chatMessageIdsRef.current.add(nextMessage.message_id);
                setChatMessages((current) => [...current, nextMessage].slice(-600));
                if (chatMessageIdsRef.current.size > 1000) {
                    chatMessageIdsRef.current.clear();
                }
            }
        }
    }, [appendDebug, requestGMCPState]);

    useEffect(() => {
        const parser = new TelnetParser({
            send: (bytes) => connectionRef.current?.sendBytes(bytes),
            onText: (bytes) => appendText(decoderRef.current.decode(bytes, { stream: true })),
            onGMCP: handleGMCP,
            // The player object sends Server.Hello after login. Requesting
            // snapshots during Telnet negotiation targets only the temporary
            // login object and can lose the initial player state.
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
                    inventoryRevisionRef.current = -1;
                    equipmentRevisionRef.current = -1;
                    entitiesRevisionRef.current = -1;
                    vitalsRevisionRef.current = -1;
                    statusRevisionRef.current = -1;
                    combatRevisionRef.current = -1;
                    skillsRevisionRef.current = -1;
                    combatActionsRevisionRef.current = -1;
                    questsRevisionRef.current = -1;
                    chatCapabilitiesRevisionRef.current = -1;
                    chatTargetsRevisionRef.current = -1;
                    chatMessageIdsRef.current.clear();
                    gmcpStateRequestedRef.current = false;
                    setVitals(null);
                    setStatus(null);
                    setCombat(null);
                    setSkills([]);
                    setCombatActions([]);
                    setRoom(null);
                    setEntities([]);
                    setInventory([]);
                    setEquipment([]);
                    setEquipmentSlotOrder([]);
                    setQuests(null);
                    setChatCapabilities(null);
                    setChatTargets([]);
                    setChatMessages([]);
                } else if (state === 'closed') {
                    setVitals(null);
                    setStatus(null);
                    setCombat(null);
                    setSkills([]);
                    setCombatActions([]);
                    setRoom(null);
                    setEntities([]);
                    setInventory([]);
                    setEquipment([]);
                    setEquipmentSlotOrder([]);
                    questsRevisionRef.current = -1;
                    chatCapabilitiesRevisionRef.current = -1;
                    chatTargetsRevisionRef.current = -1;
                    chatMessageIdsRef.current.clear();
                    setQuests(null);
                    setChatCapabilities(null);
                    setChatTargets([]);
                    setChatMessages([]);
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
    }, [appendDebug, appendText, handleGMCP, requestGMCPState]);

    const connect = useCallback((url: string) => {
        setVitals(null);
        setStatus(null);
        setCombat(null);
        setSkills([]);
        setCombatActions([]);
        setRoom(null);
        setEntities([]);
        setInventory([]);
        setEquipment([]);
        setEquipmentSlotOrder([]);
        setQuests(null);
        setChatCapabilities(null);
        setChatTargets([]);
        setChatMessages([]);
        inventoryRevisionRef.current = -1;
        equipmentRevisionRef.current = -1;
        entitiesRevisionRef.current = -1;
        vitalsRevisionRef.current = -1;
        statusRevisionRef.current = -1;
        combatRevisionRef.current = -1;
        skillsRevisionRef.current = -1;
        combatActionsRevisionRef.current = -1;
        questsRevisionRef.current = -1;
        chatCapabilitiesRevisionRef.current = -1;
        chatTargetsRevisionRef.current = -1;
        chatMessageIdsRef.current.clear();
        gmcpStateRequestedRef.current = false;
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

    const sendItemAction = useCallback((itemId: string, action: string) => {
        const parser = parserRef.current;
        const request = toWebItemActionRequest(itemId, action);
        if (!parser || !request) {
            return;
        }
        parser.sendGMCP('Web.Item.Action', request);
    }, []);

    const sendEntityAction = useCallback((entityId: string, action: string, text?: string) => {
        const parser = parserRef.current;
        const request = toWebEntityActionRequest(entityId, action, text);
        if (!parser || !request) {
            return;
        }
        parser.sendGMCP('Web.Entity.Action', request);
    }, []);

    const sendEntityGive = useCallback((itemId: string, entityId: string) => {
        const parser = parserRef.current;
        const request = toWebEntityGiveRequest(itemId, entityId);
        if (!parser || !request) {
            return;
        }
        parser.sendGMCP('Web.Entity.Give', request);
    }, []);

    const sendSkillAction = useCallback((skillId: string, action: 'enable' | 'prepare', slot?: string) => {
        const parser = parserRef.current;
        const request = toWebSkillActionRequest(skillId, action, slot);
        if (!parser || !request) {
            return;
        }
        parser.sendGMCP('Web.Skill.Action', request);
    }, []);

    const sendCombatAction = useCallback((
        actionId: string,
        targetEntityId?: string,
        targetMode?: CombatTargetMode,
    ) => {
        const parser = parserRef.current;
        const request = toWebCombatActionRequest(actionId, targetEntityId, targetMode);
        if (!parser || !request) {
            return;
        }
        parser.sendGMCP('Web.Combat.Action', request);
    }, []);

    const sendChat = useCallback((
        kind: ChatKind,
        text: string,
        options?: { channel?: string; targetEntityId?: string; targetPlayerId?: string; emote?: boolean },
    ) => {
        const parser = parserRef.current;
        const request = toWebChatSendRequest(kind, text, options);
        if (!parser || !request) {
            return;
        }
        parser.sendGMCP('Web.Chat.Send', request);
    }, []);

    return {
        connectionState,
        connectionDetail,
        segments,
        vitals,
        status,
        combat,
        skills,
        combatActions,
        room,
        entities,
        inventory,
        equipment,
        equipmentSlotOrder,
        quests,
        chatCapabilities,
        chatTargets,
        chatMessages,
        serverSensitive,
        debugEntries,
        connect,
        disconnect,
        sendCommand,
        sendItemAction,
        sendEntityAction,
        sendEntityGive,
        sendSkillAction,
        sendCombatAction,
        sendChat,
    };
};
