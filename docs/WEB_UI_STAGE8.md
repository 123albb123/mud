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

## 6. 实际验证结果

- `npm test -- --run`：24 个测试文件、113 个测试全部通过。
- `npm run build`：TypeScript 检查通过，Vite 生产构建通过（39 modules transformed）；构建产物已更新到 `www/app/index.html`、`www/app/service-worker.js` 和 `www/app/assets/`。
- Terminal fixture 覆盖 1,000、5,000、10,000 行，以及持续追加 12,000 行后的容量边界；历史上限为 10,000 个逻辑行，异常无换行文本另受 16 MiB 字符上限保护。
- 浏览器视口检查：桌面 1,440 × 900、手机竖屏 390 × 844、手机横屏 844 × 390。三种尺寸均保留文字终端和命令栏；移动端输入/按钮高度分别为 48px 和横屏 44px，未发现页面横向溢出。
- FluffOS 本地运行检查：8888 WebSocket 完成连接、Telnet 协商和原版登录提示；5566（GBK）与 6666（UTF-8）完成 Telnet 协商、收到欢迎文本/英文名登录提示，并发送 `quit` 结束连接。
- 已通过现有组件/协议回归覆盖 PWA 普通 Web 文案、地图导航、Chat.Message/聊天页面、GMCP 状态边界和构建后静态资源引用；没有修改 LPC 服务端逻辑或 `mudcore`。

## 7. 已知限制与冻结结论

本阶段不做完整 VT100 emulator、服务器历史日志、跨 session Terminal 历史、IndexedDB 日志、linkify、宏/alias/trigger/自动战斗，也不改 LPC 游戏逻辑、GMCP schema 或 `mudcore`。中文 IME 的自动化验证使用 composition event；除非在真机上验证，不宣称已经验证真实 iPhone 系统输入法。

Stage 8 完成后停止，不进入 Stage 9。
