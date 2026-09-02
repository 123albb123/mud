import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterStatus, CharacterVitals, ChatMessage, CombatStateSnapshot, QuestListSnapshot, RoomInfo, RoomMapSnapshot } from '../protocol/gmcp/gmcp';
import { createEmptyExploredMapGraph } from '../features/map/exploredMap';
import { useMudClient } from '../stores/useMudClient';
import { App } from './App';

vi.mock('../stores/useMudClient', () => ({
    defaultMudUrl: vi.fn(() => 'ws://test.invalid:8888'),
    useMudClient: vi.fn(),
}));

type ClientState = ReturnType<typeof useMudClient>;

const makeClient = (overrides: Partial<ClientState> = {}): ClientState => ({
    connectionState: 'closed',
    connectionDetail: '',
    segments: [],
    vitals: null,
    status: null,
    combat: null,
    skills: [],
    combatActions: [],
    room: null,
    roomMap: null,
    exploredMap: createEmptyExploredMapGraph(),
    entities: [],
    inventory: [],
    equipment: [],
    equipmentSlotOrder: [],
    quests: null,
    chatCapabilities: null,
    chatTargets: [],
    chatMessages: [],
    serverSensitive: false,
    debugEntries: [],
    connect: vi.fn(),
    disconnect: vi.fn(),
    setTerminalSize: vi.fn(),
    sendCommand: vi.fn(),
    sendRoomMove: vi.fn(),
    sendItemAction: vi.fn(),
    sendEntityAction: vi.fn(),
    sendEntityGive: vi.fn(),
    sendSkillAction: vi.fn(),
    sendCombatAction: vi.fn(),
    sendChat: vi.fn(),
    ...overrides,
});

const statusFixture: CharacterStatus = {
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    busy: false,
    fighting: false,
    can_act: true,
    ghost: false,
    unconscious: false,
    anger: 0,
    food: 0,
    water: 0,
    exp: 500000,
    potential: 1250,
    weapon: null,
    enabled: [],
    prepared: [],
};

const vitalsFixture: CharacterVitals = {
    hp: 100,
    max_hp: 120,
    jing: 30,
    max_jing: 40,
    jingli: 50,
    max_jingli: 60,
    neili: 70,
    max_neili: 80,
};

const combatFixture: CombatStateSnapshot = {
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    in_combat: true,
    busy: false,
    can_act: true,
    targets: [{
        entity_id: 'npc-session-1',
        name: '测试木人',
        relation: 'fight',
        health: 'healthy',
    }],
    primary_target: 'npc-session-1',
};

const roomFixture: RoomInfo = {
    name: '真实房间',
    area: '真实区域',
    exits: [],
    room_id: 'room-session-1',
    hash: 'hash-session-1',
};

const roomMapFixture: RoomMapSnapshot = {
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    current_room_id: 'room-session-1',
    room: { room_id: 'room-session-1', name: '真实房间', area: '真实区域' },
    exits: [{
        exit_id: 'x-session-1',
        command: 'east',
        label: '东',
        kind: 'direction',
        resolved: true,
        dynamic: false,
        destination_room_id: 'room-session-2',
        destination_name: '真实东侧',
    }],
};

const questFixture: QuestListSnapshot = {
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    quests: [{
        quest_id: 'q-session-1',
        system: 'traditional',
        category: 'session',
        title: '真实任务',
        detail: '真实任务数据',
        status: 'active',
        objectives: [],
    }],
    completed: [],
    stats: {},
};

const messageFixture: ChatMessage = {
    version: 1,
    message_id: 'm-session-1',
    timestamp: 1,
    kind: 'say',
    direction: 'in',
    sender: { name: '真实玩家', id: 'p-session-1' },
    text: '真实消息',
};

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'isSecureContext', {
            configurable: true,
            value: false,
        });
    });

    it('keeps disconnected views empty and preserves the six-item mobile navigation', () => {
        const sendCommand = vi.fn();
        vi.mocked(useMudClient).mockReturnValue(makeClient({ sendCommand }));
        render(<App />);

        expect(screen.getAllByText('尚未连接江湖').length).toBeGreaterThan(0);
        expect(screen.getByText('连接江湖后显示原版文字。')).toBeInTheDocument();
        expect(screen.queryByText('江湖游侠')).not.toBeInTheDocument();
        expect(screen.queryByText('48级')).not.toBeInTheDocument();
        expect(screen.queryByText('侠义')).not.toBeInTheDocument();
        expect(screen.queryByText('悦来客栈')).not.toBeInTheDocument();
        expect(screen.queryByText('安全区')).not.toBeInTheDocument();
        expect(screen.queryByText('28ms')).not.toBeInTheDocument();
        expect(document.querySelector('.dock-quests .nav-badge')).toBeNull();
        expect(document.querySelector('.dock-chat .nav-badge')).toBeNull();
        expect(document.querySelector('.dock-map')).toHaveClass('dock-map');
        expect(document.querySelector('.desktop-equipment')).toHaveClass('desktop-equipment');
        expect([...document.querySelectorAll('.dock-nav .dock-item:not(.desktop-equipment)')].map((button) => button.textContent?.trim())).toEqual([
            '江湖', '行囊', '武学', '地图', '任务', '消息',
        ]);

        fireEvent.click(within(screen.getByRole('navigation', { name: '江湖主导航' })).getByRole('button', { name: '地图' }));
        expect(screen.getByText('连接服务器后显示当前房间地图。')).toBeInTheDocument();
        expect(screen.queryByText('真实地图数据尚未接入')).not.toBeInTheDocument();
        expect(sendCommand).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: '北' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '南' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '东' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '西' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^行囊$/ }));
        expect(screen.getByRole('tab', { name: /^行囊$/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('连接江湖后查看行囊')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /^装备$/ }));
        expect(screen.getByRole('tab', { name: /^装备$/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('连接江湖后查看装备')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^行囊$/ })).toHaveAttribute('aria-current', 'page');

        fireEvent.click(screen.getByRole('button', { name: /^任务$/ }));
        expect(screen.getByText('连接江湖后查看任务')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^消息$/ }));
        expect(screen.getByText('连接江湖后查看消息')).toBeInTheDocument();
    });

    it('keeps the six-slot dock presentation hooks for desktop and mobile breakpoints', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient());
        render(<App />);

        const dock = screen.getByRole('navigation', { name: '江湖主导航' });
        expect(dock.querySelector('.dock-map')).toHaveTextContent('地图');
        expect(dock.querySelector('.dock-map')).not.toHaveClass('desktop-equipment');
        expect(dock.querySelector('.desktop-equipment')).toHaveTextContent('装备');
        expect(dock.querySelector('.desktop-equipment')).toHaveClass('dock-equipment');
    });

    it('opens equipment from the desktop dock entry', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient());
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: /^装备$/ }));
        expect(screen.getByRole('heading', { name: '装备', level: 1 })).toBeInTheDocument();
    });

    it('opens the existing help view from settings', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient());
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: '打开应用设置' }));
        expect(screen.getByRole('heading', { name: '帮助', level: 2 })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '查看帮助' }));
        expect(screen.getByRole('heading', { name: '帮助', level: 1 })).toBeInTheDocument();
    });

    it('renders protocol fields without inventing level, alignment, room details, or latency', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient({
            connectionState: 'connected',
            vitals: vitalsFixture,
            status: statusFixture,
            room: roomFixture,
            roomMap: roomMapFixture,
            quests: questFixture,
            chatMessages: [messageFixture],
        }));
        render(<App />);

        expect(screen.getByText('战斗经验')).toBeInTheDocument();
        expect(screen.getByText('500,000')).toBeInTheDocument();
        expect(screen.getByText('潜能')).toBeInTheDocument();
        expect(screen.queryByText('500000%')).not.toBeInTheDocument();
        expect(screen.queryByText('48级')).not.toBeInTheDocument();
        expect(screen.queryByText('侠义')).not.toBeInTheDocument();
        expect(screen.getAllByText('真实房间').length).toBeGreaterThan(0);
        expect(screen.queryByText('安全区')).not.toBeInTheDocument();
        expect(screen.queryByText('28ms')).not.toBeInTheDocument();
        expect(document.querySelector('.dock-quests .nav-badge')).toHaveTextContent('1');
        expect(document.querySelector('.dock-chat .nav-badge')).toHaveTextContent('1');
    });

    it('keeps compact status and combat reachable at narrow layouts with live protocol data', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient({
            connectionState: 'connected',
            vitals: vitalsFixture,
            status: { ...statusFixture, fighting: true },
            combat: combatFixture,
        }));
        render(<App />);

        const compactStatus = screen.getByLabelText('紧凑人物状态');
        expect(within(compactStatus).getByText('100 / 120')).toBeInTheDocument();
        expect(within(compactStatus).getByText('战斗中')).toBeInTheDocument();
        expect(document.querySelector('.mobile-combat .combat-panel')).toBeInTheDocument();
    });

    it('uses the opaque map exit token for map movement', () => {
        const sendRoomMove = vi.fn();
        const sendCommand = vi.fn();
        vi.mocked(useMudClient).mockReturnValue(makeClient({
            connectionState: 'connected',
            room: roomFixture,
            roomMap: roomMapFixture,
            sendCommand,
            sendRoomMove,
        }));
        render(<App />);

        fireEvent.click(within(screen.getByRole('navigation', { name: '全局导航' })).getByRole('button', { name: '地图' }));
        fireEvent.click(screen.getByRole('button', { name: /东真实东侧/ }));
        expect(sendRoomMove).toHaveBeenCalledWith('x-session-1');
        expect(sendCommand).not.toHaveBeenCalled();
    });

    it('keeps page titles singular and removes decorative English eyebrows', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient());
        render(<App />);

        expect([...document.querySelectorAll('.top-nav button')].map((button) => button.textContent?.trim())).toEqual(['江湖', '地图', '帮助']);
        expect(screen.getByRole('heading', { name: '人物状态', level: 2 })).toBeInTheDocument();
        expect(screen.queryByText('人物状态 · CHARACTER')).not.toBeInTheDocument();
        expect(screen.queryByText('CURRENT ROOM · 当前位置')).not.toBeInTheDocument();

        const expectPageTitle = (title: string) => {
            expect(screen.getAllByRole('heading', { level: 1, name: title })).toHaveLength(1);
            expect(screen.queryByRole('heading', { level: 2, name: title })).not.toBeInTheDocument();
        };

        fireEvent.click(screen.getByRole('button', { name: /^行囊$/ }));
        expectPageTitle('行囊');
        expect(screen.queryByText('CHAR · INVENTORY')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /^装备$/ }));
        expectPageTitle('装备');
        expect(screen.queryByText('CHAR · EQUIPMENT')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^武学$/ }));
        expectPageTitle('武学');
        expect(screen.queryByText('MARTIAL · SKILLS')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^任务$/ }));
        expectPageTitle('任务');
        expect(screen.queryByText('任务志')).not.toBeInTheDocument();
        expect(screen.queryByText('JOURNAL · QUESTS')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^消息$/ }));
        expectPageTitle('消息');
        expect(screen.queryByRole('heading', { name: '江湖消息' })).not.toBeInTheDocument();
        expect(screen.queryByText('RIVERS · CHAT')).not.toBeInTheDocument();
        expect(screen.queryByText('CHAT · MESSAGE')).not.toBeInTheDocument();

        fireEvent.click(within(screen.getByRole('navigation', { name: '全局导航' })).getByRole('button', { name: '地图' }));
        expectPageTitle('地图');
        expect(screen.queryByText('WORLD · MAP')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^帮助$/ }));
        expectPageTitle('帮助');
        expect(screen.queryByText('GUIDE · HELP')).not.toBeInTheDocument();
    });

    it('keeps the insecure HTTP deployment in ordinary Web mode without PWA prompts', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient());
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: '打开应用设置' }));
        expect(screen.getByText('普通 Web 模式')).toBeInTheDocument();
        expect(screen.getByText('当前为普通 Web 模式。通过 HTTPS 地址访问可使用安装、离线更新和系统通知。')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '检查更新' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '开启通知' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: '连接' }).length).toBeGreaterThan(0);
    });

    it('keeps an unfinished command draft when switching between views', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient({ connectionState: 'connected' }));
        render(<App />);

        const input = screen.getByLabelText('MUD 命令');
        fireEvent.change(input, { target: { value: 'examine xxx' } });
        fireEvent.click(within(screen.getByRole('navigation', { name: '全局导航' })).getByRole('button', { name: '地图' }));
        fireEvent.click(document.querySelector('.top-nav button') as HTMLElement);

        expect(screen.getByLabelText('MUD 命令')).toHaveValue('examine xxx');
    });

    it('keeps an invalid settings endpoint from being submitted', () => {
        vi.mocked(useMudClient).mockReturnValue(makeClient());
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: '打开应用设置' }));
        const settingsForm = document.querySelector<HTMLElement>('.settings-connection-form');
        if (!settingsForm) {
            throw new Error('settings connection form is missing');
        }
        fireEvent.change(within(settingsForm).getByLabelText('WebSocket 地址'), { target: { value: 'not-a-websocket-url' } });
        expect(within(settingsForm).getByRole('button', { name: '连接' })).toBeDisabled();
    });

    it('counts only new incoming chat messages and clears the count on entry', () => {
        let clientState = makeClient();
        vi.mocked(useMudClient).mockImplementation(() => clientState);
        const { rerender } = render(<App />);
        const dock = () => screen.getByRole('navigation', { name: '江湖主导航' });

        expect(dock().querySelector('.dock-chat .nav-badge')).toBeNull();
        clientState = makeClient({ chatMessages: [{ ...messageFixture, message_id: 'm-incoming-1', direction: 'in' }] });
        rerender(<App />);
        expect(dock().querySelector('.dock-chat .nav-badge')).toHaveTextContent('1');

        fireEvent.click(within(dock()).getByRole('button', { name: /^消息/ }));
        expect(dock().querySelector('.dock-chat .nav-badge')).toBeNull();

        clientState = makeClient({ chatMessages: [{ ...messageFixture, message_id: 'm-outgoing-1', direction: 'out' }] });
        rerender(<App />);
        expect(dock().querySelector('.dock-chat .nav-badge')).toBeNull();
    });

    it('caps the session chat unread badge at 99+', () => {
        const messages = Array.from({ length: 101 }, (_, index) => ({
            ...messageFixture,
            message_id: `m-incoming-${index}`,
            timestamp: index + 1,
            direction: 'in' as const,
        }));
        vi.mocked(useMudClient).mockReturnValue(makeClient({ chatMessages: messages }));
        render(<App />);

        expect(document.querySelector('.dock-chat .nav-badge')).toHaveTextContent('99+');
    });
});
