# Web UI Stage 8：Terminal 2.0

## 1. 阶段目标

Stage 8 不增加游戏玩法，也不从 Terminal 文本推导 HP、房间、NPC、出口、行囊、任务、战斗、聊天或地图状态。Terminal 只负责显示服务器原版文字和服务器已经发送的 ANSI 视觉格式；人物、房间、行囊、武学、战斗、任务、聊天和地图继续只来自结构化 GMCP。

本阶段目标是让主文字终端适合长期游戏：保留原文、正确呈现 ANSI、限制历史内存和 DOM、批量刷新、在底部时自动跟随、查看历史时不抢滚动、支持原生选择复制、改进命令历史和中文 IME，并让手机输入、重连和 NAWS 行为可预期。

## 2. 现有实现审计（实现前）

审计范围：

- `web-client/src/features/terminal/Terminal.tsx`
- `web-client/src/features/terminal/CommandBar.tsx`
- `web-client/src/protocol/ansi/AnsiParser.ts`
- `web-client/src/protocol/telnet/TelnetParser.ts`
- `web-client/src/protocol/websocket/MudConnection.ts`
- `web-client/src/stores/useMudClient.ts`
- Terminal、CommandBar、ANSI、Telnet、PWA、GMCP、地图、聊天和 App 测试

结论：

1. 数据管线是 WebSocket → TelnetParser → UTF-8 `TextDecoder`（stream 模式）→ AnsiParser → React `AnsiSegment[]`。未发现从 Terminal 文本解析游戏状态的逻辑。
2. ANSI 原先支持 SGR reset、bold、22、39、30–37 和 90–97 前景色；不支持 dim、italic、underline、inverse、背景色、256 色和 truecolor。CSI 未知序列会被忽略，但需要继续保证不泄漏控制码。
3. Terminal 是一个 `role="log"` 的单一滚动容器，文本用 `white-space: pre-wrap` 渲染；每个 ANSI segment 最多对应一个 React `span`，相邻同样式 segment 只在单次 parser push 内合并。
4. `useMudClient` 原先每次收到文本就 `setSegments`，并以 `slice(-5000)` 按 segment 数截断，既没有行容量定义，也没有跨 chunk 的 React flush batching。
5. Terminal 原先只记录 `following`，接近底部阈值为 36px；不在底部时不会拉回，但没有新内容数量/提示状态，选择文本时也没有额外保护。
6. CommandBar 原先保留组件内最多 100 条历史，相邻重复命令去重；上/下方向键已存在，但到达历史末尾不会回到草稿；没有 compositionstart/compositionend 与 `isComposing` 防护。
7. `serverSensitive` 来自 Telnet ECHO 协商，password input 已存在；密码没有进入 CommandBar 历史或 localStorage/debug，但 draft 和 history 状态随组件生命周期存在内存中。
8. `useMudClient` 原先在 connecting/reconnecting 时清空 Terminal 和全部 GMCP 状态，在 closed 时也清空 Terminal；短暂网络抖动会导致整屏消失。
9. NAWS 原先固定按 `window.innerWidth / 9`、`window.innerHeight / 18` 估算，没有使用实际 Terminal 容器尺寸，也没有 ResizeObserver/debounce。
10. 当前 CSS 已使用 `100dvh` fallback 和 safe-area inset；移动端 Terminal 字号被覆盖为 14px，CommandBar 与底部导航需要继续验证 iOS/Android 键盘场景。
11. React 默认文本节点渲染，未使用 `dangerouslySetInnerHTML`；XSS 基线测试已经覆盖 `<script>` 和 HTML 标签作为文字显示。

基线验证：在实现前 `npm test -- --run` 为 22 个测试文件、91 个测试通过；`npm run build` 通过，并生成 `/www/app` 生产资源。

## 3. xterm.js 决策

继续使用现有 React DOM + ANSI segments + TelnetParser，不引入 xterm.js。

炎黄当前主要是普通 UTF-8 文本流和 SGR 颜色；没有发现必须支持的大量 VT cursor movement、复杂 erase 或任意屏幕定位。通过跨 chunk parser、样式合并、按行历史截断和 frame batching 可以解决本阶段的性能与兼容目标。引入 xterm.js 会增加 bundle、移动端终端集成和 React UI 状态同步复杂度，也可能改变文本选择/复制行为；在没有明确收益前不值得承担这些变化。

## 4. Stage 8 实现结论

- ANSI 支持：SGR reset、bold、dim、italic、underline、inverse、30–37、90–97、40–47、100–107、256 色、truecolor；未知 CSI/控制序列安全忽略。
- Terminal 历史：以逻辑换行计数，保留最近 10,000 行；另有针对单条异常超长无换行文本的字符保护。
- DOM/数据 trim：跨 chunk 合并同样式 segment；追加后只删除最旧的完整行，不删除刚追加的内容；React 不使用 `dangerouslySetInnerHTML`。
- Render batching：收到的文本先进入内存 pending buffer，在下一帧合并后更新 React state，不人为引入 500ms/1s 延迟。
- 自动滚动：距底部 64px 内视为跟随；用户查看历史、新输出或存在文本选择时不抢滚动。
- 历史查看：显示新内容提示和“回到底部”；点击后立即滚到底部并恢复跟随。
- Command history：保留最近 100 条非敏感命令，相邻完全相同命令只保留一次；上/下键可回到草稿。
- sensitive：服务端 ECHO 或手动隐私模式都会切换为 password 控件；敏感内容不进历史、调试记录或浏览器存储，敏感模式切换时清空已有草稿。
- IME：compositionstart/compositionend、`isComposing` 和 keyCode 229 均阻止组合输入期间的 Enter/方向键误触发；普通命令草稿与历史由 App 持有，视图切换不会丢失。
- mobile：Terminal 使用可选字号、16px 输入控件、触摸滚动和 safe-area 兼容；390 × 844 竖屏隐藏桌面状态侧栏，844 × 390 横屏压缩场景并保留终端与命令栏在视口内。
- NAWS：依据 Terminal 实测的 client width/height、字体宽度、行高和 padding 估算 cols/rows；只在尺寸变化时发送，尺寸更新交给 ResizeObserver + resize fallback 调度。
- reconnect：显式 `connect()` 才清空新 session 的 Terminal/GMCP；短暂 reconnect/closed 期间保留画面和最后结构化快照，同时重置 Telnet/UTF-8/ANSI parser，避免跨 session 串流。
- runtime：本机 8888 WebSocket 真实连接收到原版欢迎文本并到达登录提示；地图、聊天、返回江湖和终端字号设置通过浏览器 smoke check。未创建测试账号，因此未宣称已完成登录后的 `look/north/south` 游戏路径。

## 5. 测试与回归计划

- ANSI：SGR reset、样式分离、前景/背景、bright、256、truecolor、chunk split、malformed/unsupported control filtering。
- Terminal：XSS、按行历史 trim、1000/5000/10000 行 fixture、自动滚动、历史查看、新内容提示、回到底部、selection 不被抢滚动。
- CommandBar：上/下历史、草稿、相邻去重、敏感输入不入历史、composition 期间 Enter 不发送。
- Telnet/UTF-8/NAWS：IAC/WILL/WONT/DO/DONT、SB/SE、GMCP、ECHO、NAWS 和跨 packet UTF-8。
- PWA、地图、Chat.Message、GMCP 状态以及 5566/6666 Telnet 回归。
- 运行 `npm test -- --run` 和 `npm run build`；生产输出必须更新到 `www/app`。

## 6. 主体实现阶段的实际验证结果

- `npm test -- --run`：24 个测试文件、113 个测试全部通过。
- `npm run build`：TypeScript 检查通过，Vite 生产构建通过（39 modules transformed）；构建产物已更新到 `www/app/index.html`、`www/app/service-worker.js` 和 `www/app/assets/`。
- Terminal fixture 覆盖 1,000、5,000、10,000 行，以及持续追加 12,000 行后的容量边界；历史上限为 10,000 个逻辑行，异常无换行文本另受 16 MiB 字符上限保护。
- 浏览器视口检查：桌面 1,440 × 900、手机竖屏 390 × 844、手机横屏 844 × 390。三种尺寸均保留文字终端和命令栏；移动端输入/按钮高度分别为 48px 和横屏 44px，未发现页面横向溢出。
- FluffOS 主体阶段运行检查：8888 WebSocket 完成连接、Telnet 协商和原版登录提示；完整真实角色、战斗、长历史、视口和双 Telnet 端口验收见下方 Stage 8.0.1。
- 已通过现有组件/协议回归覆盖 PWA 普通 Web 文案、地图导航、Chat.Message/聊天页面、GMCP 状态边界和构建后静态资源引用；没有修改 LPC 服务端逻辑或 `mudcore`。

## 7. Stage 8.0.1 真实 Runtime 最终验收（2026-09-02）

本节是主体实现之后的最终验收记录。测试运行在本机 FluffOS 实例（8888 WebSocket、5566 GB18030 Telnet、6666 UTF-8 Telnet），不改变玩法、LPC、GMCP schema 或 `mudcore`，也没有引入 xterm.js。

1. **Runtime 启动**：使用真实 `bin/driver.exe config.ini -d` 启动，三个监听端口均可用；退出前停止 driver，未留下运行中的测试服务。
2. **一次性角色**：按授权自动创建本地测试账号 `stageqa` 和角色“验收”，完成登录路径后清理账号存档与测试日志；没有提交凭据或玩家数据。
3. **8888 登录**：浏览器通过 `ws://127.0.0.1:8888` 完成 Telnet/GMCP 协商，真实角色进入游戏世界，人物状态、房间和实体快照出现。
4. **`look`**：返回原版“客店”房间描述、出口和实体文字，Terminal 保留中文原文。
5. **`score`**：返回“验收(stageqa)”人物状态、出生信息和属性。
6. **`hp`**：返回精气、气血、内力、食物、饮水和潜能等原版状态；页面人物状态同步显示 100/100。
7. **`skills`**：真实返回“目前并没有学会任何技能”，没有依赖客户端推导。
8. **`inventory`**：真实返回武林外传、天蓝长袍、皮靴；页面行囊状态保持可用。
9. **Room.Info**：登录和移动后页面标题、区域和出口随服务器房间快照更新；未从 Terminal 文本猜房间。
10. **Room.Map**：地图页显示本次连接实际探索的节点，首轮探索后为 5 房间、6 条路线；地图页再确认一次移动后为 5 房间、7 条路线。
11. **Room.Map.Transition**：地图说明和实线路线只在服务器确认移动后出现；地图页移动一次后路线由 6 增至 7，未把失败/猜测当成路线。
12. **Room.Entities**：客店显示 4 个实体，中央广场/南大街显示服务器返回的 NPC 列表；实体卡片与 Terminal 原文一致。
13. **连续移动**：真实访问客店、客店茶房、棋苑、两个棋室、北大街、中央广场、南大街等多个房间，完成超过 5 次成功移动。
14. **房间面板 `Web.Room.Move`**：点击客店/茶房/棋苑的方向按钮完成南、东、北、西等移动，并观察到真实房间标题与出口变化。
15. **地图面板 `Web.Room.Move`**：在地图页点击“北 棋室”“南 棋苑”“西 客店茶房”“北 客店”等真实出口，页面保持地图视图且服务器确认位置变化。
16. **普通 NPC 动作**：检查店小二、周不通、欧阳克、剑客等实体动作；查看、询问、切磋/攻击均由服务器动作入口提供，没有拼装假动作。
17. **低风险短战斗**：在中央广场对普通“剑客”选择“切磋”，没有使用高风险攻击；服务器实际输出一轮受击后按原版提示逃跑，未死亡，产生真实战斗刷屏。
18. **战斗状态**：战斗侧栏曾显示目标选择和“切磋/攻击”，战斗结束后回到“尚未交战”，人物气血变化与服务器文字一致。
19. **真实上滚**：Terminal 实测 `scrollHeight=7235`、`clientHeight=495`，上滚后 `data-following=false`，历史内容仍可读。
20. **上滚期间继续输出**：NPC/天气/战斗相关新文字继续到达，页面显示“↓ 3 条新内容 · 回到底部”，没有把用户强行拉回底部。
21. **回到底部**：点击真实“回到底部”按钮后 `data-following=true`、新内容计数归零，`scrollTop` 回到接近最大值。
22. **选择/复制**：Terminal CSS 的 `user-select` 为 `text`；浏览器原生 `Ctrl+A → Ctrl+C` 成功写入剪贴板，返回 6,940 字符且包含 Terminal 原文，未发现选择导致的滚动抢夺。
23. **真实 Terminal 5,000 行**：临时浏览器压力页挂载生产 `Terminal`，直接渲染 fixture 5,000 行约 326.1ms，DOM 为 5,000 行、4,001 个 span、275,889 字符。
24. **真实 Terminal 10,000 行**：直接渲染 10,000 行约 426.6ms，DOM 为 10,000 行、8,001 个 span、552,889 字符；页面未冻结。
25. **12,000 行裁剪与 key**：通过真实 `useMudClient` 追加到 12,000 行后，Terminal 实际保留 10,000 行、13,334 个 span、155,334 字符；现有 `key={index}` 在该压力下未出现实际性能问题，因此保留。
26. **高频 append/batching**：临时页使用真实 `useMudClient` 与真实 `Terminal`，以 WebSocket-compatible 高频数据源追加 2,000/5,000 行，分别约 128.8/418.7ms；生产路径的 requestAnimationFrame batching 正常工作。
27. **命令历史、草稿与中文输入**：真实页面验证 `ArrowUp` 取最近命令、`ArrowDown` 回到“examine xxx”草稿；输入框可保留“查看”等中文草稿；composition 期间的 Enter/方向键保护由现有 IME 测试覆盖。
28. **敏感输入**：手动隐私开关将输入框切为 `type=password`、placeholder 为“输入内容已隐藏”；截图显示为圆点，切回普通模式后敏感草稿长度为 0，未进入历史/调试/存储。
29. **字号、NAWS 与视口**：设置页三档实际生效为 14/16/18px；1440×900、390×844、844×390 均无横向溢出，Terminal/命令栏/底部导航可见；服务器收到约 84×17、31×11、78×5 的 NAWS 更新。
30. **重连、地图/聊天/PWA、双 Telnet 与收尾**：显式“重新连接”后 Terminal 只剩新登录提示、地图重置为 1 房间/0 路线；消息页和 PWA 设置页回归通过；同一角色在 5566 GB18030 与 6666 UTF-8 均完成 `look → south → north → quit`（6666 首次命中服务端 11 秒冷却，等待后复测通过）；随后精确删除测试存档、`log/usage`、本次 `log/debug.log` 和临时压力文件，最终测试/构建通过并推送。

压力页和 Telnet 脚本均为本次验收的临时文件，已删除；生产 `www/app` 未包含 `createTerminalFixture` 或 Stage 8.0.1 测试页引用。没有为性能测试扩大历史上限，也没有修改 `key={index}`、LPC、GMCP 或 `mudcore`。

## 8. 已知限制与冻结结论

本阶段不做完整 VT100 emulator、服务器历史日志、跨 session Terminal 历史、IndexedDB 日志、linkify、宏/alias/trigger/自动战斗，也不改 LPC 游戏逻辑、GMCP schema 或 `mudcore`。中文 IME 的自动化验证使用 composition event；除非在真机上验证，不宣称已经验证真实 iPhone 系统输入法。

Stage 8 完成后停止，不进入 Stage 9。

## Stage 8.0.2 实体 UI 收尾（2026-09-02）

本阶段只收尾“附近人物”实体卡片的身份辨识，不改变 Terminal、PWA、战斗协议或游戏玩法。

1. **保留 NPC / 玩家标签**：附近人物可能同时包含服务器 NPC 与真实玩家；真实第二角色同房间时显示为 `验收 [玩家]`，因此两类身份都必须保留。
2. **删除动作数量**：动作数量不能帮助玩家做决定，选中实体后已直接显示服务器确认的动作按钮；因此彻底移除 `X 动作` 文本，但保留 `entity.actions` 和所有动作渲染。
3. **最终姓名层级**：卡片和详情姓名均为 `19px`、`font-weight: 600`、`line-height: 1.25`，使用既有 `var(--font-title)`；选中卡片使用 `var(--gold-bright)`。
4. **NPC chip**：独立 `.entity-type-chip.npc`，10px/600，`2px 6px` 内边距、999px 圆角、暖金边框与低透明棕金底色，不与姓名拼接。
5. **玩家 chip**：独立 `.entity-type-chip.player`，10px/600，同样紧凑圆角结构，使用 `var(--teal)`、teal 边框和低透明 teal 底色，与 NPC 明显区分。
6. **title 层级**：`entity.title` 显示在姓名下方，12px、弱化色、单行 ellipsis；没有 title 时不渲染空占位。详情区域同步使用同一层级。
7. **英文后缀排查结果**：本轮真实 8888 检查发现 Terminal 原版会显示正式命令别名，例如 `欧阳克(ouyang ke)`、`剑客(jian ke)`、`江湖豪客(jianghu haoke)`、`戚长发(qi changfa)`、`小混混(xiao hunhun)`、`流氓头(liumang tou)`、`流氓(liumang)`、`周不通(zhou butong)`、`北丑(bei chou)`。同一时段 `Room.Entities` payload 的 `name` 分别为纯中文 `欧阳克`、`剑客`、`江湖豪客`、`戚长发`、`小混混`、`流氓头`、`流氓`、`周不通`、`北丑`，Web UI 也只显示纯中文名；本轮未复现除 NPC 标签以外的英文后缀。没有使用正则裁剪。
8. **LPC / GMCP**：未修改 LPC，未修改 `Room.Entities 1` schema，未新增字段，也未修改 `entity_id` 生成、定位或动作请求逻辑；`entity_id` 和 command id 均不显示在普通 UI。
9. **Runtime NPC 列表**：真实走查了牛头、地藏王、周不通、北丑、店小二、戚长发、剑客、江湖豪客、小混混、流氓头、流氓、欧阳克，以及动态出现的秦旨；带称号和无称号卡片均已检查。
10. **三视口结果**：`390×844` 实体 sheet 可纵向滚动，姓名/标签/称号/动作按钮无横向溢出；`844×390` 恢复可滚动的实体栏，姓名和 chip 保持完整且仍可到达，内容区 `scrollWidth=844`；`1440×900` 右侧栏宽度 320px，19px 姓名与 chip 排布自然，页面 `scrollWidth=1440`。三种尺寸均未发现横向溢出。
11. **测试与构建**：`npm test -- --run` 通过 24 个测试文件、116 个测试；`npm run build` 通过 TypeScript 检查与 Vite 生产构建，`www/app` 已更新 hashed JS/CSS。新增 `RoomEntities` 覆盖 NPC/玩家 chip 区分、title/无 title、无 `X 动作`、动作按钮保留、opaque `entity_id` 和长姓名 DOM。
12. **Git**：本阶段变更使用提交主题 `fix: polish room entity identity display` 整理，最终 commit SHA 以本次 master 提交记录和验收汇报为准；测试账号、存档、日志和临时验收资源不纳入提交。
