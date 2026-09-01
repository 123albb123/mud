import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChatPanel } from '../features/chat/ChatPanel';
import { CombatPanel } from '../features/combat/CombatPanel';
import { EquipmentPanel } from '../features/equipment/EquipmentPanel';
import { InventoryPanel } from '../features/inventory/InventoryPanel';
import { MapView } from '../features/map/MapView';
import { QuestPanel } from '../features/quests/QuestPanel';
import { RoomEntities } from '../features/room/RoomEntities';
import { RoomPanel } from '../features/room/RoomPanel';
import { SkillsPanel } from '../features/skills/SkillsPanel';
import { CommandBar } from '../features/terminal/CommandBar';
import { Terminal } from '../features/terminal/Terminal';
import type { CharacterStatus, CharacterVitals } from '../protocol/gmcp/gmcp';
import { defaultMudUrl, useMudClient } from '../stores/useMudClient';

type ViewKey = 'jianghu' | 'inventory' | 'equipment' | 'skills' | 'quests' | 'chat' | 'map' | 'help';
type InventoryTab = 'inventory' | 'equipment';
type IconName =
    | 'home' | 'map' | 'help' | 'bag' | 'armor' | 'book' | 'quest' | 'message'
    | 'user' | 'sword' | 'mountain' | 'compass' | 'settings' | 'spark' | 'arrow';

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
    mountain: 'm2.5 19 5.4-8.7 3.1 4.3 3.9-6.2 6.6 10.6M5.3 19h14.4M13.8 8.5l1.1-1.8 1.1 1.8',
    compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.4-12.4-1.7 4.1-4.1 1.7 1.7-4.1 4.1-1.7Z',
    settings: 'M12 15.1a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm7-3.1 2-1.2-1.8-3.1-2.2.9a7.7 7.7 0 0 0-1.7-1L15 5.4h-3.6l-.3 2.2a7.7 7.7 0 0 0-1.7 1l-2.2-.9-1.8 3.1 2 1.2a7.7 7.7 0 0 0 0 2.1l-2 1.2 1.8 3.1 2.2-.9a7.7 7.7 0 0 0 1.7 1l.3 2.2H15l.3-2.2a7.7 7.7 0 0 0 1.7-1l2.2.9 1.8-3.1-2-1.2a7.7 7.7 0 0 0 0-2.1Z',
    spark: 'm12 2 1.3 6.7L20 10l-6.7 1.3L12 18l-1.3-6.7L4 10l6.7-1.3L12 2ZM19 16l.5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z',
    arrow: 'M5 12h13M13 6l6 6-6 6',
};

const Icon = ({ name, size = 22 }: { name: IconName; size?: number }) => (
    <svg aria-hidden="true" className="icon" height={size} viewBox="0 0 24 24" width={size}>
        <path d={iconPaths[name]} />
    </svg>
);

const formatNumber = (value: number | undefined): string =>
    value === undefined ? '--' : value.toLocaleString('zh-CN');

const navItems: Array<{ view: ViewKey; label: string; icon: IconName }> = [
    { view: 'jianghu', label: '江湖', icon: 'mountain' },
    { view: 'inventory', label: '行囊', icon: 'bag' },
    { view: 'skills', label: '武学', icon: 'book' },
    { view: 'quests', label: '任务', icon: 'quest' },
    { view: 'chat', label: '消息', icon: 'message' },
];

const ResourceMeter = ({ label, current, maximum, tone }: { label: string; current: number | undefined; maximum: number | undefined; tone: string }) => {
    const hasValues = current !== undefined && maximum !== undefined;
    const percent = hasValues && maximum > 0 ? Math.max(0, Math.min(100, (current / maximum) * 100)) : 0;
    return <div className="resource-meter"><div className="resource-meter-label"><span>{label}</span><span>{hasValues ? current + ' / ' + maximum : '--'}</span></div><div className="resource-track"><span className={'resource-fill ' + tone} style={{ width: String(percent) + '%' }} /></div></div>;
};

const PlayerCard = ({ connected, vitals, status }: { connected: boolean; vitals: CharacterVitals | null; status: CharacterStatus | null }) => {
    const hasState = Boolean(vitals || status);
    return (
        <section className="player-card surface-card" aria-labelledby="player-card-title">
            <div className="player-card-head"><div className="avatar-seal"><Icon name="user" size={28} /></div><div className="player-identity"><h2 id="player-card-title">人物状态</h2></div><span className={'state-chip ' + (connected ? '' : 'muted')}>{connected ? '实时' : '未连接'}</span></div>
            {!hasState ? <div className="panel-empty-state"><Icon name="user" size={22} /><strong>{connected ? '当前没有人物状态' : '尚未连接江湖'}</strong><span>{connected ? '等待服务器发送人物快照' : '连接服务器后显示人物状态'}</span></div> : <>
                {vitals && <div className="resource-grid"><ResourceMeter label="气血" current={vitals.hp} maximum={vitals.max_hp} tone="red" /><ResourceMeter label="精" current={vitals.jing} maximum={vitals.max_jing} tone="blue" /><ResourceMeter label="精力" current={vitals.jingli} maximum={vitals.max_jingli} tone="jade" /><ResourceMeter label="内力" current={vitals.neili} maximum={vitals.max_neili} tone="violet" /></div>}
                {status && <div className="player-facts"><div><span>战斗经验</span><strong>{formatNumber(status.exp)}</strong></div><div><span>潜能</span><strong>{formatNumber(status.potential)}</strong></div></div>}
                {status && <div className="character-state" aria-label="人物实时状态">{status.busy && <span className="state-chip danger">忙乱</span>}{status.fighting && <span className="state-chip">战斗中</span>}{status.ghost && <span className="state-chip danger">鬼魂</span>}{status.unconscious && <span className="state-chip danger">昏迷</span>}{!status.busy && !status.fighting && !status.ghost && !status.unconscious && <span className="state-chip">可行动</span>}{status.weapon && <span className="state-chip weapon-chip">兵器：{status.weapon.name}</span>}</div>}
            </>}
        </section>
    );
};

const PageHeading = ({ title, description, icon, action }: { title: string; description: string; icon: IconName; action?: ReactNode }) => (
    <div className="page-heading"><div className="page-heading-icon"><Icon name={icon} size={26} /></div><div><h1>{title}</h1><p className="page-heading-description">{description}</p></div>{action && <div className="page-heading-action">{action}</div>}</div>
);

const DockNav = ({ activeView, onNavigate, questCount, messageCount }: { activeView: ViewKey; onNavigate: (view: ViewKey) => void; questCount: number; messageCount: number }) => {
    return (
        <nav className="dock-nav" aria-label="江湖主导航"><div className="dock-nav-inner">
            {navItems.map((item) => {
                const badge = item.view === 'quests' ? questCount : item.view === 'chat' ? messageCount : 0;
                return <button aria-current={activeView === item.view ? 'page' : undefined} className={'dock-item ' + (activeView === item.view ? 'active ' : '') + 'dock-' + item.view} key={item.view} onClick={() => onNavigate(item.view)} type="button"><span className="dock-icon"><Icon name={item.icon} size={25} /></span><span>{item.label}</span>{badge > 0 && <span className="nav-badge">{badge}</span>}</button>;
            })}
            <button aria-current={activeView === 'equipment' ? 'page' : undefined} className={'dock-item dock-equipment desktop-equipment ' + (activeView === 'equipment' ? 'active' : '')} onClick={() => onNavigate('equipment')} type="button"><span className="dock-icon"><Icon name="armor" size={25} /></span><span>装备</span></button>
        </div></nav>
    );
};

const HelpView = () => (
    <main className="page-main"><div className="page-surface help-surface">
        <PageHeading description="查看客户端操作与命令说明。" icon="help" title="帮助" />
        <div className="help-grid">
            <article className="help-card"><div className="help-card-icon"><Icon name="arrow" size={21} /></div><div><h2>方向移动</h2><p>点击房间出口或输入原版移动命令 north/south/east/west。</p><div className="command-example">north <span>向北移动</span></div></div></article>
            <article className="help-card"><div className="help-card-icon"><Icon name="sword" size={21} /></div><div><h2>江湖命令</h2><p>在底部命令栏输入原版 MUD 命令，按 Enter 发送。</p><div className="command-example">look <span>查看周围</span></div></div></article>
            <article className="help-card"><div className="help-card-icon"><Icon name="book" size={21} /></div><div><h2>武学与装备</h2><p>在武学页启用、准备招式；在行囊和装备页管理服务器返回的物品。</p><div className="help-tags"><span>启用</span><span>准备</span><span>装备</span></div></div></article>
            <article className="help-card"><div className="help-card-icon"><Icon name="message" size={21} /></div><div><h2>消息往来</h2><p>支持频道、说话、私聊与回复。可用能力由服务器实时同步。</p><div className="help-tags"><span>频道</span><span>私聊</span><span>回复</span></div></div></article>
        </div>
        <div className="help-note"><span className="note-mark">炎</span><p>这是一个面向现代浏览器的炎黄客户端，保留原版命令体验，也把重要状态整理成可读、可操作的界面。</p></div>
    </div></main>
);

const DebugPanel = ({ entries, onClose }: { entries: Array<{ id: number; time: string; message: string }>; onClose: () => void }) => (
    <aside className="debug-panel" aria-label="协议调试"><div className="debug-heading"><div><strong>协议调试</strong></div><button onClick={onClose} type="button">关闭</button></div><div className="debug-log">{entries.length === 0 ? <p>暂无协议事件。</p> : entries.map((entry) => <div key={entry.id}><time>{entry.time}</time><span>{entry.message}</span></div>)}</div></aside>
);

export const App = () => {
    const client = useMudClient();
    const [url, setUrl] = useState(defaultMudUrl);
    const [activeView, setActiveView] = useState<ViewKey>('jianghu');
    const [inventoryTab, setInventoryTab] = useState<InventoryTab>('inventory');
    const [showDebug, setShowDebug] = useState(false);
    const autoConnectStarted = useRef(false);
    const connected = client.connectionState === 'connected';
    const busy = client.connectionState === 'connecting' || client.connectionState === 'reconnecting';

    useEffect(() => {
        if (!autoConnectStarted.current) {
            autoConnectStarted.current = true;
            client.connect(url);
        }
    }, [client.connect, url]);

    const navigate = (view: ViewKey) => {
        if (view === 'inventory') {
            setInventoryTab('inventory');
        }
        setActiveView(view);
        setShowDebug(false);
    };

    let page: ReactNode;
    if (activeView === 'map') {
        page = <MapView connected={connected} exploredMap={client.exploredMap} onMove={client.sendRoomMove} snapshot={client.roomMap} />;
    } else if (activeView === 'help') {
        page = <HelpView />;
    } else if (activeView === 'inventory') {
        page = <main className="page-main"><div className="page-surface"><PageHeading description="查看物品与装备。" icon="bag" title={inventoryTab === 'inventory' ? '行囊' : '装备'} action={<span className="count-label">{inventoryTab === 'inventory' ? client.inventory.length + ' 件物品' : client.equipment.filter((slot) => Boolean(slot.item_id)).length + ' 格已用'}</span>} /><div className="mobile-secondary-tabs" role="tablist" aria-label="行囊与装备"><button aria-selected={inventoryTab === 'inventory'} className={inventoryTab === 'inventory' ? 'active' : ''} onClick={() => setInventoryTab('inventory')} role="tab" type="button">行囊</button><button aria-selected={inventoryTab === 'equipment'} className={inventoryTab === 'equipment' ? 'active' : ''} onClick={() => setInventoryTab('equipment')} role="tab" type="button">装备</button></div>{inventoryTab === 'inventory' ? <InventoryPanel connected={connected} embedded items={client.inventory} onAction={client.sendItemAction} /> : <EquipmentPanel connected={connected} embedded onAction={client.sendItemAction} slotOrder={client.equipmentSlotOrder} slots={client.equipment} />}</div></main>;
    } else if (activeView === 'equipment') {
        page = <main className="page-main"><div className="page-surface"><PageHeading description="查看已装备物品。" icon="armor" title="装备" action={<span className="count-label">{client.equipment.filter((slot) => Boolean(slot.item_id)).length} 格已用</span>} /><EquipmentPanel connected={connected} embedded onAction={client.sendItemAction} slotOrder={client.equipmentSlotOrder} slots={client.equipment} /></div></main>;
    } else if (activeView === 'skills') {
        page = <main className="page-main"><div className="page-surface"><PageHeading description="管理当前启用与准备的武学。" icon="book" title="武学" action={<span className="count-label">{client.skills.length} 门武学</span>} /><SkillsPanel connected={connected} disabled={!connected || client.status?.can_act === false} onAction={client.sendSkillAction} skills={client.skills} status={client.status} /></div></main>;
    } else if (activeView === 'quests') {
        page = <main className="page-main"><div className="page-surface"><PageHeading description="查看任务状态与进度。" icon="quest" title="任务" action={<span className="count-label">{client.quests?.quests.length ?? 0} 项当前</span>} /><QuestPanel connected={connected} embedded snapshot={client.quests} /></div></main>;
    } else {
        page = <main className="page-main"><div className="page-surface chat-page-surface"><PageHeading description="查看消息并参与交流。" icon="message" title="消息" action={<span className="count-label">{client.chatMessages.length} 条消息</span>} /><ChatPanel capabilities={client.chatCapabilities} connected={connected} embedded messages={client.chatMessages} onSend={client.sendChat} targets={client.chatTargets} /></div></main>;
    }

    const roomTitle = client.room?.name || (connected ? '当前房间' : '尚未连接江湖');
    const roomArea = client.room?.area || (connected ? '当前区域未知' : '连接江湖后显示房间');

    return (
        <div className={'game-shell ' + (activeView === 'jianghu' ? 'is-game-view' : 'is-page-view')}>
            <header className="game-header">
                <button className="brand" onClick={() => navigate('jianghu')} type="button"><span className="brand-mark">炎黄</span><span className="brand-seal">江湖</span></button>
                <nav className="top-nav" aria-label="全局导航"><button className={activeView === 'jianghu' ? 'active' : ''} onClick={() => navigate('jianghu')} type="button"><Icon name="home" size={17} />江湖</button><button className={activeView === 'map' ? 'active' : ''} onClick={() => navigate('map')} type="button"><Icon name="map" size={17} />地图</button><button className={activeView === 'help' ? 'active' : ''} onClick={() => navigate('help')} type="button"><Icon name="help" size={17} />帮助</button></nav>
                <div className="header-actions"><div className={'connection-state ' + client.connectionState} title={client.connectionDetail || stateLabels[client.connectionState]}><span /><strong>{stateLabels[client.connectionState]}</strong>{client.connectionDetail && <em>{client.connectionDetail}</em>}</div><button aria-label="打开协议调试" className="settings-button" onClick={() => setShowDebug((current) => !current)} title="协议调试" type="button"><Icon name="settings" size={21} /></button></div>
            </header>

            {!connected && <section className="connection-strip" aria-label="连接设置"><div className="connection-strip-copy"><span className="strip-led" /><span>{busy ? '正在寻找江湖入口…' : '尚未连接到江湖服务器'}</span><small>{client.connectionDetail || '可修改 WebSocket 地址后重新连接'}</small></div><div className="connection-strip-form"><label htmlFor="server-url">服务器</label><input id="server-url" onChange={(event) => setUrl(event.target.value)} spellCheck={false} type="url" value={url} /><button onClick={() => client.connect(url)} type="button">{busy ? '重连' : '连接'}</button></div></section>}

            {activeView === 'jianghu' ? <main className="game-main">
                <aside className="left-rail"><PlayerCard connected={connected} status={client.status} vitals={client.vitals} /><CombatPanel actions={client.combatActions} combat={client.combat} connected={connected} disabled={!connected} entities={client.entities} onAction={client.sendCombatAction} status={client.status} /><div className="rail-tip"><Icon name="spark" size={17} /><span>所有状态会随服务器快照实时更新</span></div></aside>
                <section className="center-stage"><div className="scene-panel surface-card"><div className="scene-topline"><span><Icon name="mountain" size={16} />{roomArea}</span><span className="scene-status"><i />{connected ? '实时同步' : '等待连接'}</span></div><div className="scene-title-row"><h1>{roomTitle}</h1></div>{!client.room && <div className="scene-empty-state"><Icon name="mountain" size={20} /><span>{connected ? '当前没有房间信息' : '连接江湖后显示房间、出口与周围人物'}</span></div>}<Terminal connected={connected} segments={client.segments} /><CommandBar connected={connected} onSend={client.sendCommand} serverSensitive={client.serverSensitive} /></div></section>
                <aside className="right-rail"><RoomPanel connected={connected} disabled={!connected} onMove={client.sendRoomMove} room={client.room} roomMap={client.roomMap} /><RoomEntities connected={connected} disabled={!connected} entities={client.entities} inventory={client.inventory} onAction={client.sendEntityAction} onGive={client.sendEntityGive} /></aside>
                <section className="mobile-combat"><CombatPanel actions={client.combatActions} combat={client.combat} connected={connected} disabled={!connected} entities={client.entities} onAction={client.sendCombatAction} status={client.status} /></section>
            </main> : page}

            <DockNav activeView={activeView} messageCount={client.chatMessages.length} onNavigate={navigate} questCount={client.quests?.quests.length ?? 0} />
            {showDebug && <DebugPanel entries={client.debugEntries} onClose={() => setShowDebug(false)} />}
        </div>
    );
};
