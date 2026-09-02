# Web UI 阶段 7：PWA / 手机安装 / App 模式 / 更新管理 / 基础通知

状态：Stage 7 实现完成；自动测试、构建、8888、多视口与 Telnet 验收已完成。

日期：2026-09-02

基线：`fd36891a89406c85eeb63af7336eacb45562337f`（`feat: add session explored room map`）

## 1. 阶段目标

Stage 7 只把现代 Web Client 做成标准 Web PWA：浏览器打开、可选安装到主屏幕、standalone 模式运行、适配刘海与 Home Indicator、缓存客户端程序文件、感知新版本，并在页面仍运行且用户主动授权时提供基础私聊通知。

本阶段不开发新游戏玩法。Stage 6.1 的探索图、`Room.Map`、`Room.Map.Transition`、`Web.Room.Move`、WebSocket/Telnet 协议和 `mudcore` 保持冻结。

## 2. 开始前审计

- 源代码位于 `web-client/`，Vite `base` 为 `/app/`，production `outDir` 为 `www/app/`。
- `web-client/index.html` 是 Vite 源入口，`www/app/index.html` 是生产入口，`www/index.html` 继续是 legacy 客户端。
- `config.ini` 的 `websocket http dir` 为 `www`，`external_port_3` 为 `websocket 8888`；因此 `/app/index.html`、`/app/assets/*` 等静态文件由 8888 直接服务。
- 当前没有 manifest、Service Worker 或正式 PWA 图标；当前连接断开/重连会清空实时快照与会话探索图。
- `www/app/` 中的 hashed JS/CSS 是构建生成物；源代码和构建产物均纳入本阶段检查，运行时 cache 不进入仓库。

FluffOS 当前静态处理器不保证 `/app/` 自动补 `index.html`，验收和文档使用明确的 `/app/index.html` 地址。

## 3. PWA 架构

PWA 只覆盖 `/app/`：

```text
浏览器
  ├─ /app/index.html
  ├─ /app/manifest.json
  ├─ /app/service-worker.js  (scope: /app/)
  └─ /app/assets/* + /app/icons/*
        │
        └─ WebSocket ws(s)://<host>:8888  →  FluffOS
```

Service Worker 负责客户端 App Shell，不负责游戏会话。浏览器普通模式、standalone 模式和桌面模式共用 React 应用；内部页面继续由现有 React state 切换，不引入 URL router，也不打开 Safari 新窗口。

## 4. Manifest 与图标

源文件为 `web-client/public/manifest.json`，构建后位于 `/app/manifest.json`。FluffOS 8888 静态服务器按 `.json` 提供 `application/json`，因此使用这个等价的 manifest 文件名以保证实际访问成功。关键字段：

- `name`: `炎黄群侠传`
- `short_name`: `炎黄`
- `start_url`: `/app/index.html`
- `display`: `standalone`
- `display_override`: `standalone` 优先，允许平台选择 `fullscreen`，但不锁死真正 fullscreen
- 不锁定 `orientation`，横屏地图和聊天保持可用。

图标使用项目自制的深墨、暖金、印章感“炎”字图形，不引用网络图片：至少提供 192×192、512×512，以及 `purpose: maskable` 的 512×512 图标；同一套图形提供 Apple Touch Icon。

## 5. iOS 与主题色

HTML 同时声明：

- `apple-mobile-web-app-capable=yes`
- `apple-mobile-web-app-status-bar-style=black-translucent`
- `apple-mobile-web-app-title=炎黄`
- `apple-touch-icon`
- `theme-color=#15110d`

深色背景和主题色保持 Stage 5.2 的墨色/暖金/青色视觉，避免 standalone 顶部出现白色状态栏或明显跳色。真实 iPhone 主屏幕安装仍需最终用户设备确认；没有真实设备时不声称已经完成真机验收。

## 6. 安全区与 viewport

页面继续以 `100dvh` 为现代优先值，并保留 `100vh` fallback；不使用高频 `resize` 重建 React 页面。`viewport-fit=cover` 配合以下区域的安全区 padding：

- header：顶部、横屏左右安全区；
- connection strip 与页面内容：横屏左右安全区；
- CommandBar 所在的可滚动主内容：不被底部系统 UI 遮挡；
- bottom dock：底部 Home Indicator 与横屏左右安全区。

验收视口为 390×844、844×390、1440×900。特别检查软键盘打开/关闭后的输入框、底栏、地图画布和页面滚动，不引入首屏巨大空白或 body 横向溢出。

## 7. Service Worker scope 与缓存

生产构建生成 `/app/service-worker.js`，注册时明确指定 `{ scope: '/app/' }`。cache 名称包含 package version 与构建短 hash，例如 `yanhuang-web-v0.1.0-<hash>`；activate 时删除同前缀的旧 cache，避免无限堆积。

缓存白名单只包含同源静态 App Shell：

- `/app/index.html`
- `/app/assets/*.js`
- `/app/assets/*.css`
- `/app/icons/*`
- `/app/manifest.json`
- 其他构建产生的静态 UI 资源

不缓存 WebSocket 数据、玩家状态、GMCP、Chat.Message、聊天记录、任务、地图 graph、Terminal 内容、账号、密码、登录命令或任何 save 数据。fetch handler 只处理 `/app/` 下的 GET 静态资源，并显式跳过非 HTTP(s) 与 Service Worker 自身；WebSocket 不经过 Cache API。

## 8. 离线行为

安装后完全断网时，已缓存的 App Shell 尽量打开，但实时连接状态仍以 `MudConnection` 为权威，显示“无法连接江湖”/“连接已断开”。没有服务器快照就不展示旧人物、旧房间、旧任务、旧行囊、旧地图或旧聊天。探索图继续只存在当前连接 session 内存。

`navigator.onLine` 只用于辅助提示；online/offline 事件不主动创建第二条 WebSocket，也不因 visibilitychange 强制断开重连。回到前台时沿用现有连接/重连逻辑。

## 9. 更新流程

首次安装 Service Worker 不提示技术信息，也不自动刷新。检测到新 worker 进入 waiting 后，在页面显示轻量提示“客户端新版本已准备好”，提供“稍后”和“更新”。只有用户点击“更新”才向 waiting worker 发送激活消息，并在 `controllerchange` 后 reload。

设置页的“检查更新”调用 `registration.update()`；无新版本时显示“当前已是最新客户端”。页面不使用浏览器 `alert`，不在战斗、聊天或命令输入期间突然刷新。

## 10. 安装状态

客户端通过 `matchMedia('(display-mode: standalone)')` 和 iOS `navigator.standalone` 检测 standalone。设置页只展示真实能力：

- 已 standalone：`已作为应用运行`；
- 收到 `beforeinstallprompt`：显示“安装应用”，只在用户点击后调用原生 prompt；
- iOS Safari 且非 standalone：显示“Safari → 分享 → 添加到主屏幕”；
- 没有安装事件或平台能力：不显示虚假的安装成功状态。

不在主游戏页面投放大面积安装广告。

## 11. 基础通知

通知默认关闭，只有设置页“开启通知”按钮触发 `Notification.requestPermission()`。`denied` 不反复请求；`granted` 仍需客户端偏好保持开启。可关闭通知，并可选择是否显示私聊正文；这些只是 UI 偏好。

仅当结构化 `Chat.Message` 满足 `kind === tell || kind === reply`、`direction === in`，且 `document.visibilityState !== visible` 或窗口没有 focus 时，才创建基础 `Notification`。公共频道、say、每回合战斗和 HP 变化不通知；前台可见且聚焦时不重复通知。通知正文不读取 Terminal、不解析协议日志、不包含密码或内部 ID。

本阶段不实现 Web Push、VAPID、PushSubscription、FCM、APNs 或服务器 push。页面被系统冻结、PWA 完全关闭后不保证收到通知，文案不作相反承诺。

## 12. 可持久化边界

允许持久化最后使用的 WebSocket 地址、通知开关/内容偏好、字体或纯 UI 设置；不存密码、登录命令、账号凭据或任何游戏数据。room、exploredMap、inventory、quests、chat、combat、character status 仍不写入 localStorage、IndexedDB 或 Cache API。

## 13. 设置页

新增“应用”区块，包含安装状态、安装应用（若平台提供）、通知权限/开关、通知内容偏好、客户端版本和检查更新；调试入口保留在设置页。帮助页补充面向普通玩家的“安装到手机”说明，不展示 manifest、Service Worker、Cache Storage 等开发者术语。

客户端版本使用 package version 加短 build hash；开发模式不注册 Service Worker，避免代码更新被开发 cache 干扰。

## 14. 自动测试

新增 `web-client/src/pwa/pwa.test.ts` 与
`web-client/src/pwa/pwa.hook.test.tsx`，覆盖：

- cache name / scope / 静态 precache 生成；
- standalone 与 iOS Safari 平台检测；
- `beforeinstallprompt` 能力和通知权限状态；
- tell/reply + incoming + 非 focus 的通知规则；
- 公共消息、前台消息、权限 default/denied 的不通知规则；
- 只允许客户端偏好持久化，不写入游戏状态。

现有协议、地图、组件测试继续运行。最终命令
`npm test -- --run` 结果为 **19 个测试文件、80 个测试全部通过**。
通知 hook 测试使用受控 `Notification` mock 覆盖 default/granted/denied 与前后台规则；当前自动化环境的系统通知权限为 denied，因此没有伪称完成真实系统通知验收。

## 15. 运行时与构建验收

最终 `npm run build`（TypeScript 检查 + Vite production build）通过，产物包含
`www/app/index.html`、`www/app/manifest.json`、`www/app/service-worker.js`、四个图标和 hashed JS/CSS；Service Worker cache 名称为
`yanhuang-web-v0.1.0-fd36891a`。8888 静态检查确认入口、manifest、Service Worker 和图标均为 200；manifest 为 `application/json`，这是为适配 FluffOS 静态 MIME 表而采用 `.json` 文件名的原因。

8888 WebSocket 使用真实驱动完成 login、look、north、south、quit；同一连接完成 Stage 6.1 GMCP smoke，收到 `Room.Map`、`Room.Info`、`Room.Entities`、`Char.Inventory`、`Quest.List`、`Chat.Capabilities` 等要求的实时包。浏览器页面初始状态也出现真实登录提示并显示“已连接”，没有使用假数据。

三视口结果：

- 390×844：body/document 宽度均为 390，shell 高度为 844，移动底栏保持 5 个入口，设置页可用；
- 844×390：body/document 宽度均为 844，shell 高度为 390，横向无溢出，滚动后命令栏可完整位于底栏上方；
- 1440×900：body/document 宽度均为 1440，shell 高度为 900；帮助页安装说明、地图页、设置页和更新提示均通过 smoke。

更新流程用受控 build hash 验证：检测到 waiting worker 后显示“客户端新版本已准备好”，`稍后` 可关闭提示，`更新` 才激活新 worker 并 reload；恢复最终产物后设置页显示 `当前已是最新客户端`。代码审计确认缓存只处理 `/app/` 同源静态 App Shell，未缓存 WebSocket、游戏状态、Chat.Message、任务、地图 graph、Terminal 或凭据；离线时仅以 Service Worker fallback 提供 App Shell，游戏状态仍由 `MudConnection` 决定。当前浏览器 harness 没有强制 offline 的控制入口，未将此项夸大为真机断网验收。

5566 GBK 与 6666 UTF-8 均使用真实驱动完成 login、look、north、south、quit。临时测试账号及对应 login/user save、含测试凭据的 debug log 已在验收后删除；没有提交运行日志、玩家数据或浏览器凭据。

没有真实 iPhone/Android 设备时，只记录了代码、桌面浏览器与模拟视口结果；浏览器自动化使用 Codex in-app browser，未引入项目 Playwright。系统通知权限在当前 harness 被拒绝，真实 OS 通知保留为平台限制，hook mock 已覆盖规则与防重复请求。

## 16. 已知限制与下一阶段建议

FluffOS 静态文件处理器需要明确 `/app/index.html`；浏览器安装 UI、iOS 主屏幕行为、系统通知权限和软键盘最终表现仍取决于平台。Notification API 不是后台 push，页面冻结或关闭后的消息不保证送达。

下一阶段再考虑 Web Push backend、跨 session 探索图、离线帮助资源扩展或正式账号体系；Stage 7 不进入 Stage 7.1，也不扩展游戏玩法。
