import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChatPanel } from '../features/chat/ChatPanel';
import { CombatPanel } from '../features/combat/CombatPanel';
import { EquipmentPanel } from '../features/equipment/EquipmentPanel';
import { InventoryPanel } from '../features/inventory/InventoryPanel';
import { QuestPanel } from '../features/quests/QuestPanel';
import { RoomEntities } from '../features/room/RoomEntities';
import { RoomPanel } from '../features/room/RoomPanel';
import { SkillsPanel } from '../features/skills/SkillsPanel';
import { CommandBar } from '../features/terminal/CommandBar';
import { Terminal } from '../features/terminal/Terminal';
import type { AnsiSegment } from '../protocol/ansi/AnsiParser';
import type {
    CombatAction,
    CombatStateSnapshot,
    CharacterSkill,
    CharacterStatus,
    CharacterVitals,
    ChatCapabilities,
    ChatMessage,
    ChatTarget,
    EquipmentSlot,
    InventoryItem,
    QuestListSnapshot,
    RoomEntity,
    RoomInfo,
} from '../protocol/gmcp/gmcp';
import { defaultMudUrl, useMudClient } from '../stores/useMudClient';

type ViewKey = 'jianghu' | 'inventory' | 'equipment' | 'skills' | 'quests' | 'chat' | 'map' | 'help';
type IconName =
    | 'home' | 'map' | 'help' | 'bag' | 'armor' | 'book' | 'quest' | 'message'
    | 'user' | 'sword' | 'target' | 'mountain' | 'compass' | 'settings' | 'clock' | 'spark' | 'arrow';

const stateLabels = {
    connecting: '连接中',
    connected: '已连接',
    reconnecting: '重连中',
    closed: '未连接',
    error: '连接错误',
} as const;

const iconPaths: Record<IconName, string> = {
    home: 'M3 10.6 12 3l9 7.6M5.5 9.2V21h13V9.2M9 21v-6.4h6V21',
    map: 'M4 5.5 9.2 3l5.6 2.5L20 3v15.5l-5.2 2.5-5.6-2.5L4 21V5.5ZM9.2 3v15.5M14.8 5.5V21',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.4v.1M9.9 9a2.3 2.3 0 1 1 3.7 1.8c-.9.7-1.6 1.1-1.6 2.4',
    bag: 'M6.3 8.2h11.4l1.2 12H5.1l1.2-12ZM8.4 8.2V6.8a3.6 3.6 0 0 1 7.2 0v1.4M8.2 11.8h7.6',
    armor: 'M8.2 4 12 6.2 15.8 4l3.1 3v5.4l-2.3 1.3V21H7.4v-7.3l-2.3-1.3V7l3.1-3ZM8.2 4l.7 7.4h6.2l.7-7.4M8.9 11.4 7.4 21M15.1 11.4l2.3 9.6',
    book: 'M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5V4.5ZM5 4.5v17M9 6h6M9 9h6M9 12h4',
    quest: 'M6 3.5h12v16l-6-3.2-6 3.2v-16ZM8.5 7h7M8.5 10.5h7M8.5 14h4M19 7.5a3 3 0 0 1 3 3v1.5',
    message: 'M3.5 5.5h17v11h-9.2L6 20.5v-4H3.5v-11ZM7 9.5h10M7 13h6',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0M18 5.5h3M19.5 4v3',
    sword: 'm5 19 4-4m2.2-2.2L20.5 3.5M15 4l5 5M6.2 15.2 3.5 12.5 7 9l3 3-3.5 3.5M4 20h5',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-2.7a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z',
    mountain: 'm2.5 19 5.4-8.7 3.1 4.3 3.9-6.2 6.6 10.6M5.3 19h14.4M13.8 8.5l1.1-1.8 1.1 1.8',
    compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.4-12.4-1.7 4.1-4.1 1.7 1.7-4.1 4.1-1.7Z',
    settings: 'M12 15.1a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm7-3.1 2-1.2-1.8-3.1-2.2.9a7.7 7.7 0 0 0-1.7-1L15 5.4h-3.6l-.3 2.2a7.7 7.7 0 0 0-1.7 1l-2.2-.9-1.8 3.1 2 1.2a7.7 7.7 0 0 0 0 2.1l-2 1.2 1.8 3.1 2.2-.9a7.7 7.7 0 0 0 1.7 1l.3 2.2H15l.3-2.2a7.7 7.7 0 0 0 1.7-1l2.2.9 1.8-3.1-2-1.2a7.7 7.7 0 0 0 0-2.1Z',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3.4 2.2M4 4l2.1 2.1M20 4l-2.1 2.1',
    spark: 'm12 2 1.3 6.7L20 10l-6.7 1.3L12 18l-1.3-6.7L4 10l6.7-1.3L12 2ZM19 16l.5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z',
    arrow: 'M5 12h13M13 6l6 6-6 6',
};

const Icon = ({ name, size = 22 }: { name: IconName; size?: number }) => (
    <svg aria-hidden="true" className="icon" height={size} viewBox="0 0 24 24" width={size}>
        <path d={iconPaths[name]} />
    </svg>
);

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

const previewRoom: RoomInfo = {
    name: '悦来客栈',
    area: '扬州 · 扬州城',
    exits: ['northwest', 'north', 'northeast', 'west', 'east', 'southwest', 'south', 'southeast', 'enter'],
    room_id: 'preview-inn',
};

const previewVitals: CharacterVitals = {
    hp: 763,
    max_hp: 1024,
    jing: 412,
    max_jing: 640,
    jingli: 623,
    max_jingli: 800,
    neili: 538,
    max_neili: 800,
};

const previewStatus: CharacterStatus = {
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
    food: 86,
    water: 72,
    exp: 35,
    potential: 1250,
    weapon: { name: '青锋长剑', skill_type: 'sword', skill_id: 'sword', skill_name: '基本剑法' },
    enabled: [{ slot: '剑法', skill_id: 'sword', name: '基本剑法' }],
    prepared: [{ slot: '剑法', skill_id: 'taiji-sword', name: '太极剑法' }],
};

const previewCombat: CombatStateSnapshot = {
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    in_combat: false,
    busy: false,
    can_act: true,
    targets: [{ entity_id: 'preview-zhang', name: '张三', relation: 'fight', health: 'injured' }],
    primary_target: 'preview-zhang',
};

const previewCombatActions: CombatAction[] = [
    { action_id: 'fight', label: '切磋', kind: 'fight', requires_target: true, target_mode: 'required', target_types: ['npc', 'player'] },
    { action_id: 'kill', label: '攻击', kind: 'kill', requires_target: true, target_mode: 'required', target_types: ['npc', 'player'] },
    { action_id: 'perform', label: '施展招式', kind: 'perform', requires_target: true, target_mode: 'required', target_types: ['npc', 'player'] },
    { action_id: 'exert', label: '运用内功', kind: 'exert', requires_target: false, target_mode: 'none' },
];

const previewSegments: AnsiSegment[] = [
    { text: '10:21:14   你来到了这里。\n', bold: false, foreground: 'green' },
    { text: '10:21:15   店小二笑着说道：这位客官里面请，我座位坐吧。\n', bold: false },
    { text: '10:21:18   客栈老板说道：客官要住店还是用餐？\n', bold: false },
    { text: '10:21:22   你查看了四周。\n', bold: false, foreground: 'cyan' },
    { text: '10:21:28   张三向你发起攻击！\n', bold: true, foreground: 'red' },
    { text: '10:21:31   你躲开了张三的攻击。\n', bold: false, foreground: 'cyan' },
    { text: '10:21:33   你对张三造成了 152 点伤害。\n', bold: false, foreground: 'red' },
    { text: '10:21:37   张三身受重伤，逃跑了！\n', bold: false, foreground: 'red' },
    { text: '10:21:40   你感到收获颇丰。\n', bold: false, foreground: 'green' },
];

const previewEntities: RoomEntity[] = [
    { entity_id: 'preview-shopkeeper', type: 'npc', name: '店小二', title: '客栈伙计', actions: [{ id: 'look', label: '查看' }, { id: 'talk', label: '交谈' }, { id: 'give', label: '给予' }] },
    { entity_id: 'preview-innkeeper', type: 'npc', name: '客栈老板', title: '悦来客栈', actions: [{ id: 'look', label: '查看' }, { id: 'talk', label: '交谈' }] },
    { entity_id: 'preview-zhang', type: 'player', name: '张三', title: '江湖游侠', actions: [{ id: 'look', label: '查看' }, { id: 'fight', label: '切磋' }, { id: 'kill', label: '攻击' }] },
    { entity_id: 'preview-sword', type: 'item', name: '长剑', actions: [{ id: 'look', label: '查看' }, { id: 'get', label: '拾取' }] },
    { entity_id: 'preview-wine', type: 'item', name: '酒壶', actions: [{ id: 'look', label: '查看' }, { id: 'get', label: '拾取' }] },
    { entity_id: 'preview-coin', type: 'item', name: '碎银', title: '12 两', actions: [{ id: 'look', label: '查看' }, { id: 'get', label: '拾取' }] },
];

const previewInventory: InventoryItem[] = [
    { item_id: 'preview-sword', name: '青锋长剑', command_id: 'sword', amount: 1, unit: '把', weight: 3, category: 'weapon', equipped: true, actions: [{ id: 'look', label: '查看' }, { id: 'unwield', label: '卸下' }] },
    { item_id: 'preview-wine', name: '女儿红', command_id: 'wine', amount: 2, unit: '坛', weight: 1, category: 'liquid', equipped: false, actions: [{ id: 'look', label: '查看' }, { id: 'drink', label: '喝' }] },
    { item_id: 'preview-book', name: '扬州游记', command_id: 'travel-notes', amount: 1, unit: '本', weight: 1, category: 'book', equipped: false, actions: [{ id: 'look', label: '查看' }, { id: 'use', label: '阅读' }] },
    { item_id: 'preview-money', name: '碎银', command_id: 'silver', amount: 12, unit: '两', weight: 0, category: 'money', equipped: false, actions: [{ id: 'look', label: '查看' }] },
];

const previewEquipment: EquipmentSlot[] = [
    { slot: 'weapon', item_id: 'preview-sword', name: '青锋长剑', command_id: 'sword', type: 'weapon', actions: [{ id: 'look', label: '查看' }, { id: 'unwield', label: '卸下' }] },
    { slot: 'head', item_id: '', name: '', command_id: '', type: 'armor', actions: [] },
    { slot: 'cloth', item_id: 'preview-cloth', name: '青衫', command_id: 'cloth', type: 'armor', actions: [{ id: 'look', label: '查看' }, { id: 'remove', label: '脱下' }] },
    { slot: 'boots', item_id: '', name: '', command_id: '', type: 'armor', actions: [] },
];

const previewSkills: CharacterSkill[] = [
    { skill_id: 'sword', name: '基本剑法', level: 100, progress: 20, type: 'martial', is_basic: true, enabled_for: ['剑法'], prepared_for: [], prepare_slots: [], enable_slots: [] },
    { skill_id: 'force', name: '基本内功', level: 86, progress: 42, type: 'force', is_basic: true, enabled_for: ['内功'], prepared_for: [], prepare_slots: [], enable_slots: [] },
    { skill_id: 'taiji-sword', name: '太极剑法', level: 90, progress: 80, type: 'martial', is_basic: false, enabled_for: [], prepared_for: ['剑法'], prepare_slots: ['sword'], enable_slots: ['sword'] },
];

const previewQuests: QuestListSnapshot = {
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    stats: { traditional_completed: 12, mirror_completed: 3, active_count: 3, completed_count: 12 },
    quests: [
        { quest_id: 'preview-quest-1', system: 'traditional', category: '师门', title: '拜访扬州城', detail: '前往扬州城，与城中的江湖人物打听最近的动静。', status: 'active', level: 48, objectives: [{ kind: 'visit', title: '抵达扬州城', current: 1, required: 1 }, { kind: 'talk', title: '询问一位江湖人士', current: 0, required: 1 }] },
        { quest_id: 'preview-quest-2', system: 'daily', category: '日常', title: '行侠仗义', detail: '帮助需要帮助的人，积累侠义声望。', status: 'active', objectives: [{ kind: 'help', title: '完成任意一次交互', current: 0, required: 1 }] },
        { quest_id: 'preview-quest-3', system: 'mirror', category: '宝镜', title: '镜中残影', detail: '探索宝镜映照出的未知地点。', status: 'available', objectives: [] },
    ],
    completed: [{ quest_id: 'preview-quest-completed', system: 'traditional', category: '师门', title: '初入江湖', detail: '完成你的第一次江湖历练。', status: 'completed', objectives: [] }],
};

const previewCapabilities: ChatCapabilities = {
    version: 1,
    snapshot: true,
    revision: 1,
    sequence: 1,
    channels: [{ id: 'chat', name: '闲聊', can_send: true }, { id: 'family', name: '门派', can_send: true }, { id: 'world', name: '世界', can_send: false }],
    can_say: true,
    can_tell: true,
    can_reply: true,
    max_text: 2048,
};

const previewTargets: ChatTarget[] = [
    { player_id: 'zhang-san', name: '张三', id: 'player' },
    { player_id: 'li-si', name: '李四', id: 'player' },
];

const previewMessages: ChatMessage[] = [
    { version: 1, message_id: 'preview-message-1', timestamp: 1788248474, kind: 'channel', direction: 'in', sender: { name: '小酒馆', id: 'chat' }, channel: 'chat', text: '扬州城今晚有新戏，客官们可别错过了。' },
    { version: 1, message_id: 'preview-message-2', timestamp: 1788248501, kind: 'channel', direction: 'in', sender: { name: '张三', id: 'zhang-san' }, channel: 'chat', text: '有人在城南见过一位佩剑的客人吗？' },
    { version: 1, message_id: 'preview-message-3', timestamp: 1788248532, kind: 'say', direction: 'out', sender: { name: '江湖游侠', id: 'self' }, text: '在下只是路过，借客栈一宿。' },
];

const navItems: Array<{ view: ViewKey; label: string; icon: IconName }> = [
    { view: 'jianghu', label: '江湖', icon: 'mountain' },
    { view: 'inventory', label: '行囊', icon: 'bag' },
    { view: 'equipment', label: '装备', icon: 'armor' },
    { view: 'skills', label: '武学', icon: 'book' },
    { view: 'quests', label: '任务', icon: 'quest' },
    { view: 'chat', label: '消息', icon: 'message' },
];

const ResourceMeter = ({ label, current, maximum, tone }: { label: string; current: number | undefined; maximum: number | undefined; tone: string }) => {
    const hasValues = current !== undefined && maximum !== undefined;
    const percent = hasValues && maximum > 0 ? clamp((current / maximum) * 100) : 0;
    return <div className="resource-meter"><div className="resource-meter-label"><span>{label}</span><span>{hasValues ? current + ' / ' + maximum : '--'}</span></div><div className="resource-track"><span className={'resource-fill ' + tone} style={{ width: String(percent) + '%' }} /></div></div>;
};

const PlayerCard = ({ vitals, status }: { vitals: CharacterVitals | null; status: CharacterStatus | null }) => {
    const experience = clamp(status?.exp ?? 35);
    return (
        <section className="player-card surface-card" aria-labelledby="player-card-title">
            <div className="player-card-head"><div className="avatar-seal"><Icon name="user" size={28} /></div><div className="player-identity"><p className="eyebrow">人物状态 · CHARACTER</p><h2 id="player-card-title">江湖游侠</h2><div className="player-meta"><span>48 级</span><span className="meta-divider">·</span><span>侠义 {status?.potential ?? 1250}</span></div></div><span className="rank-seal">侠</span></div>
            <div className="experience-block"><div><span>经验</span><strong>{experience}%</strong></div><div className="experience-track"><span style={{ width: String(experience) + '%' }} /></div></div>
            <div className="resource-grid"><ResourceMeter label="气血" current={vitals?.hp} maximum={vitals?.max_hp} tone="red" /><ResourceMeter label="精" current={vitals?.jing} maximum={vitals?.max_jing} tone="blue" /><ResourceMeter label="精力" current={vitals?.jingli} maximum={vitals?.max_jingli} tone="jade" /><ResourceMeter label="内力" current={vitals?.neili} maximum={vitals?.max_neili} tone="violet" /></div>
            <div className="player-card-footer"><span><Icon name="sword" size={16} /> 当前武器</span><strong>{status?.weapon?.name ?? '青锋长剑'}</strong></div>
        </section>
    );
};

const PageHeading = ({ eyebrow, title, description, icon, action }: { eyebrow: string; title: string; description: string; icon: IconName; action?: ReactNode }) => (
    <div className="page-heading"><div className="page-heading-icon"><Icon name={icon} size={26} /></div><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-heading-description">{description}</p></div>{action && <div className="page-heading-action">{action}</div>}</div>
);

const DockNav = ({ activeView, onNavigate, questCount, messageCount }: { activeView: ViewKey; onNavigate: (view: ViewKey) => void; questCount: number; messageCount: number }) => {
    const items = navItems.filter((item) => item.view !== 'equipment');
    return (
        <nav className="dock-nav" aria-label="江湖主导航"><div className="dock-nav-inner">
            {items.map((item) => {
                const badge = item.view === 'quests' ? questCount : item.view === 'chat' ? messageCount : 0;
                return <button aria-current={activeView === item.view ? 'page' : undefined} className={'dock-item ' + (activeView === item.view ? 'active ' : '') + 'dock-' + item.view} key={item.view} onClick={() => onNavigate(item.view)} type="button"><span className="dock-icon"><Icon name={item.icon} size={25} /></span><span>{item.label}</span>{badge > 0 && <span className="nav-badge">{badge}</span>}</button>;
            })}
            <button aria-current={activeView === 'equipment' ? 'page' : undefined} className={'dock-item dock-equipment desktop-equipment ' + (activeView === 'equipment' ? 'active' : '')} onClick={() => onNavigate('equipment')} type="button"><span className="dock-icon"><Icon name="armor" size={25} /></span><span>装备</span></button>
        </div></nav>
    );
};

const MapView = ({ onEnter }: { onEnter: (command?: string) => void }) => (
    <main className="page-main"><div className="page-surface map-surface">
        <PageHeading description="山河万里，皆可留下你的足迹。" eyebrow="WORLD · MAP" icon="map" title="江湖地图" action={<span className="map-status"><span /> 当前所在：扬州</span>} />
        <div className="map-board"><div className="map-grid-lines" /><div className="map-water water-one" /><div className="map-water water-two" /><div className="map-mountain mountain-one"><Icon name="mountain" size={52} /></div><div className="map-mountain mountain-two"><Icon name="mountain" size={38} /></div><span className="map-route route-one" /><span className="map-route route-two" /><span className="map-route route-three" />
            <button className="map-node map-node-current" onClick={() => onEnter()} type="button"><span className="node-dot" /><strong>扬州</strong><small>当前位置</small></button><button className="map-node map-node-north" onClick={() => onEnter('north')} type="button"><span className="node-dot" /><strong>泰山</strong><small>齐鲁名山</small></button><button className="map-node map-node-west" onClick={() => onEnter('west')} type="button"><span className="node-dot" /><strong>金陵</strong><small>秦淮旧梦</small></button><button className="map-node map-node-east" onClick={() => onEnter('east')} type="button"><span className="node-dot" /><strong>苏州</strong><small>水乡烟雨</small></button><button className="map-node map-node-south" onClick={() => onEnter('south')} type="button"><span className="node-dot" /><strong>雁荡山</strong><small>群峰入云</small></button>
            <div className="map-compass"><Icon name="compass" size={42} /><span>北</span></div><div className="map-legend"><span><i className="legend-current" />已探索</span><span><i />未探索</span><span><i className="legend-route" />行路</span></div>
        </div>
        <div className="map-footer-note"><Icon name="spark" size={18} /><span>地图随你的脚步展开，点击地点可返回江湖并尝试行路。</span></div>
    </div></main>
);

const HelpView = ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <main className="page-main"><div className="page-surface help-surface">
        <PageHeading description="熟悉你的命令，才能在江湖中走得更远。" eyebrow="GUIDE · HELP" icon="help" title="行走江湖" action={<button className="outline-button" onClick={onOpenSettings} type="button"><Icon name="settings" size={16} /> 连接设置</button>} />
        <div className="help-grid">
            <article className="help-card"><div className="help-card-icon"><Icon name="arrow" size={21} /></div><div><h2>方向移动</h2><p>使用北、南、东、西或键盘方向键，探索当前房间的出口。</p><div className="shortcut-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>快速行走</span></div></div></article>
            <article className="help-card"><div className="help-card-icon"><Icon name="sword" size={21} /></div><div><h2>江湖命令</h2><p>在底部命令栏输入原版 MUD 命令，按 Enter 发送。</p><div className="command-example">look <span>查看周围</span></div></div></article>
            <article className="help-card"><div className="help-card-icon"><Icon name="book" size={21} /></div><div><h2>武学与装备</h2><p>在武学页启用、准备招式；在行囊和装备页管理随身物品。</p><div className="help-tags"><span>启用</span><span>准备</span><span>装备</span></div></div></article>
            <article className="help-card"><div className="help-card-icon"><Icon name="message" size={21} /></div><div><h2>消息往来</h2><p>支持频道、说话、私聊与回复。消息能力由服务器实时同步。</p><div className="help-tags"><span>频道</span><span>私聊</span><span>回复</span></div></div></article>
        </div>
        <div className="help-note"><span className="note-mark">炎</span><p>这是一个面向现代浏览器的炎黄客户端，保留原版命令体验，也把重要状态整理成可读、可操作的界面。</p></div>
    </div></main>
);

const DebugPanel = ({ entries, onClose }: { entries: Array<{ id: number; time: string; message: string }>; onClose: () => void }) => (
    <aside className="debug-panel" aria-label="协议调试"><div className="debug-heading"><div><p className="eyebrow">SYSTEM · DEBUG</p><strong>协议调试</strong></div><button onClick={onClose} type="button">关闭</button></div><div className="debug-log">{entries.length === 0 ? <p>暂无协议事件。</p> : entries.map((entry) => <div key={entry.id}><time>{entry.time}</time><span>{entry.message}</span></div>)}</div></aside>
);

export const App = () => {
    const client = useMudClient();
    const [url, setUrl] = useState(defaultMudUrl);
    const [activeView, setActiveView] = useState<ViewKey>('jianghu');
    const [showDebug, setShowDebug] = useState(false);
    const autoConnectStarted = useRef(false);
    const connected = client.connectionState === 'connected';
    const busy = client.connectionState === 'connecting' || client.connectionState === 'reconnecting';
    const previewMode = !connected;

    useEffect(() => {
        if (!autoConnectStarted.current) {
            autoConnectStarted.current = true;
            client.connect(url);
        }
    }, [client.connect, url]);

    const shownRoom = client.room ?? (previewMode ? previewRoom : null);
    const shownVitals = client.vitals ?? (previewMode ? previewVitals : null);
    const shownStatus = client.status ?? (previewMode ? previewStatus : null);
    const shownCombat = client.combat ?? (previewMode ? previewCombat : null);
    const shownCombatActions = client.combatActions.length > 0 || !previewMode ? client.combatActions : previewCombatActions;
    const shownEntities = client.entities.length > 0 || !previewMode ? client.entities : previewEntities;
    const shownInventory = client.inventory.length > 0 || !previewMode ? client.inventory : previewInventory;
    const shownEquipment = client.equipment.length > 0 || !previewMode ? client.equipment : previewEquipment;
    const shownSlotOrder = client.equipmentSlotOrder.length > 0 || !previewMode ? client.equipmentSlotOrder : ['weapon', 'head', 'cloth', 'boots'];
    const shownSkills = client.skills.length > 0 || !previewMode ? client.skills : previewSkills;
    const shownQuests = client.quests ?? (previewMode ? previewQuests : null);
    const shownCapabilities = client.chatCapabilities ?? (previewMode ? previewCapabilities : null);
    const shownTargets = client.chatTargets.length > 0 || !previewMode ? client.chatTargets : previewTargets;
    const shownMessages = client.chatMessages.length > 0 || !previewMode ? client.chatMessages : previewMessages;
    const shownSegments = client.segments.length > 1 || !previewMode ? client.segments : previewSegments;
    const questCount = shownQuests?.quests.length ?? 0;
    const messageCount = shownMessages.length;

    const openView = (view: ViewKey) => {
        setActiveView(view);
        setShowDebug(false);
    };

    const returnToJianghu = (command?: string) => {
        if (command && connected) {
            client.sendCommand(command);
        }
        openView('jianghu');
    };

    const page = useMemo(() => {
        if (activeView === 'map') return <MapView onEnter={returnToJianghu} />;
        if (activeView === 'help') return <HelpView onOpenSettings={() => setShowDebug(true)} />;
        if (activeView === 'inventory') return <main className="page-main"><div className="page-surface"><PageHeading description="收纳一路所得，随时查看可用物品。" eyebrow="CHAR · INVENTORY" icon="bag" title="行囊" action={<span className="count-label">{shownInventory.length} 件物品</span>} /><InventoryPanel items={shownInventory} onAction={client.sendItemAction} /></div></main>;
        if (activeView === 'equipment') return <main className="page-main"><div className="page-surface"><PageHeading description="整理你的兵器与护具，保持最佳状态。" eyebrow="CHAR · EQUIPMENT" icon="armor" title="装备" action={<span className="count-label">{shownEquipment.filter((slot) => Boolean(slot.item_id)).length} 格已用</span>} /><EquipmentPanel onAction={client.sendItemAction} slotOrder={shownSlotOrder} slots={shownEquipment} /></div></main>;
        if (activeView === 'skills') return <main className="page-main"><div className="page-surface"><PageHeading description="参悟招式，调整当前启用与准备的武学。" eyebrow="MARTIAL · SKILLS" icon="book" title="武学" action={<span className="count-label">{shownSkills.length} 门武学</span>} /><SkillsPanel disabled={!connected || shownStatus?.can_act === false} onAction={client.sendSkillAction} skills={shownSkills} status={shownStatus} /></div></main>;
        if (activeView === 'quests') return <main className="page-main"><div className="page-surface"><PageHeading description="记下每一段因缘，也别错过江湖的召唤。" eyebrow="JOURNAL · QUESTS" icon="quest" title="任务志" action={<span className="count-label">{questCount} 项当前</span>} /><QuestPanel snapshot={shownQuests} /></div></main>;
        return <main className="page-main"><div className="page-surface chat-page-surface"><PageHeading description="听见江湖，也让你的声音被人听见。" eyebrow="RIVERS · CHAT" icon="message" title="江湖消息" action={<span className="count-label">{messageCount} 条消息</span>} /><ChatPanel capabilities={shownCapabilities} connected={connected} messages={shownMessages} onSend={client.sendChat} targets={shownTargets} /></div></main>;
    }, [activeView, client, connected, messageCount, questCount, returnToJianghu, shownCapabilities, shownEquipment, shownInventory, shownMessages, shownQuests, shownSkills, shownSlotOrder, shownStatus, shownTargets]);

    return (
        <div className={'game-shell ' + (activeView === 'jianghu' ? 'is-game-view' : 'is-page-view')}>
            <header className="game-header">
                <button className="brand" onClick={() => openView('jianghu')} type="button"><span className="brand-mark">炎黄</span><span className="brand-seal">江湖</span></button>
                <nav className="top-nav" aria-label="全局导航"><button className={activeView === 'jianghu' ? 'active' : ''} onClick={() => openView('jianghu')} type="button"><Icon name="home" size={17} />游戏</button><button className={activeView === 'map' ? 'active' : ''} onClick={() => openView('map')} type="button"><Icon name="map" size={17} />地图</button><button className={activeView === 'help' ? 'active' : ''} onClick={() => openView('help')} type="button"><Icon name="help" size={17} />帮助</button></nav>
                <div className="header-actions"><div className={'connection-state ' + client.connectionState} title={client.connectionDetail || stateLabels[client.connectionState]}><span /><strong>{stateLabels[client.connectionState]}</strong><em>{connected ? '炎黄十三二区 · 28ms' : '等待服务器'}</em></div><button aria-label="打开协议调试" className="settings-button" onClick={() => setShowDebug((current) => !current)} title="连接与协议设置" type="button"><Icon name="settings" size={21} /></button></div>
            </header>

            {!connected && <section className="connection-strip" aria-label="连接设置"><div className="connection-strip-copy"><span className="strip-led" /><span>{busy ? '正在寻找江湖入口…' : '尚未连接到江湖服务器'}</span><small>{client.connectionDetail || '可修改 WebSocket 地址后重新连接'}</small></div><div className="connection-strip-form"><label htmlFor="server-url">服务器</label><input id="server-url" onChange={(event) => setUrl(event.target.value)} spellCheck={false} type="url" value={url} /><button onClick={() => client.connect(url)} type="button">{busy ? '重连' : '连接'}</button></div></section>}

            {activeView === 'jianghu' ? <main className="game-main">
                <aside className="left-rail"><PlayerCard status={shownStatus} vitals={shownVitals} /><CombatPanel actions={shownCombatActions} combat={shownCombat} disabled={!connected} entities={shownEntities} onAction={client.sendCombatAction} status={shownStatus} /><div className="rail-tip"><Icon name="spark" size={17} /><span>所有状态会随服务器快照实时更新</span></div></aside>
                <section className="center-stage"><div className="scene-panel surface-card"><div className="scene-topline"><span><Icon name="mountain" size={16} />{shownRoom?.area || '扬州 · 江湖'}</span><span className="scene-status"><i />{previewMode ? '界面预览' : '实时同步'}</span></div><div className="scene-title-row"><div><p className="eyebrow">CURRENT ROOM · 当前位置</p><h1>{shownRoom?.name || '江湖之中'}</h1></div><span className="safe-tag">安全区</span></div><p className="scene-description">这是一间典雅的客栈大厅。厅内灯笼高挂，木桌木椅整齐排列，空气中飘来淡淡的酒香。柜台在北边，掌柜正笑容满面地招呼客人。</p><Terminal segments={shownSegments} /><CommandBar connected={connected} onSend={client.sendCommand} serverSensitive={client.serverSensitive} /></div></section>
                <aside className="right-rail"><RoomPanel disabled={!connected} onMove={client.sendCommand} room={shownRoom} /><RoomEntities disabled={!connected} entities={shownEntities} inventory={shownInventory} onAction={client.sendEntityAction} onGive={client.sendEntityGive} /></aside>
                <section className="mobile-combat"><CombatPanel actions={shownCombatActions} combat={shownCombat} disabled={!connected} entities={shownEntities} onAction={client.sendCombatAction} status={shownStatus} /></section>
            </main> : page}

            <DockNav activeView={activeView} messageCount={messageCount} onNavigate={openView} questCount={questCount} />
            {showDebug && <DebugPanel entries={client.debugEntries} onClose={() => setShowDebug(false)} />}
        </div>
    );
};
