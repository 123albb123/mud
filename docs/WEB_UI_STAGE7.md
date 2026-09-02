# Web UI 阶段 7.0.1：PWA 单人部署收尾

状态：Stage 7.0.1 实现完成；自动测试、构建、内网 Runtime、Telnet、地图回归与三视口验收完成。

日期：2026-09-02

基线：`37bf4fc74dbf12601f096c0384e002635c21a5d1`（`feat: add installable pwa client`）

## 1. 阶段结论

本阶段只修正 Stage 7 在真实单人部署中的边界：同源 WebSocket 地址、HTTP 普通 Web 模式、Lucky HTTPS/WSS 模式、移动通知路径、Service Worker fallback 和源码 content hash。

不新增玩法，不修改 LPC、FluffOS TLS、Lucky 或 `mudcore`，也不进入 Stage 7.1。

## 2. 实际部署方式

### 内网

```text
手机 / 电脑
  ↓
http://<内网IP>:8888/app/index.html
  ↓
ws://<内网IP>:8888
  ↓
FluffOS 8888
```

内网直接使用 IP，不要求 HTTPS，也不要求完整 PWA 能力。HTTP 页面仍正常打开 Web Client、建立 WebSocket、登录、游戏、地图、行囊、武学、任务和消息；设置页把它显示为“普通 Web 模式”，不显示虚假的安装、PWA 更新或通知入口。

### 外网 Lucky HTTPS

```text
手机 / 电脑
  ↓
https://<Lucky域名>/app/index.html
  ↓
wss://<Lucky域名>
  ↓
Lucky
  ↓
http://<内网IP>:8888
  ↓
FluffOS 8888
```

Lucky 是正式 HTTPS/WSS 入口，要求 HTTPS 域名、后端 `http://<内网IP>:8888`、开启 WebSocket 反代，并让静态页面与 WebSocket 使用同一个域名。项目不管理 Lucky，不新增 Caddy、Nginx、Docker 网关、FluffOS TLS、自签证书或其他反代程序。

## 3. 同源 WebSocket 地址

`web-client/src/stores/useMudClient.ts` 中的 `defaultMudUrl()` 使用当前页面的 `window.location.protocol` 和 `window.location.host`：

```ts
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
return `${protocol}//${window.location.host}`;
```

因此：

| 页面 | 默认 WebSocket |
| --- | --- |
| `http://192.168.1.20:8888/app/index.html` | `ws://192.168.1.20:8888` |
| `https://mud.example.test/app/index.html` | `wss://mud.example.test` |
| `https://mud.example.test:8443/app/index.html` | `wss://mud.example.test:8443` |

代码不写死生产域名、真实内网 IP 或 `:8888`。`location.host` 会自然保留页面实际端口；设置页仍允许手工修改地址。

## 4. URL 合法性与 Mixed Content

`isSafeMudUrl()` 继续拒绝用户名、密码、query 和 hash。新增 `isMudUrlCompatibleWithPage()`：

- HTTP 页面允许合法 `ws://` 与 `wss://`；
- HTTPS 页面只允许 `wss://`；
- HTTPS 页面输入 `ws://` 时显示“HTTPS 页面需要使用 wss:// WebSocket 地址。”并阻止连接；
- HTTP 页面输入合法 `ws://` 时不报错、不阻止游戏。

这样既遵守浏览器 Mixed Content 防护，也保留内网 IP 的正常游戏路径。

## 5. Secure Context 能力边界

`web-client/src/pwa/pwa.ts` 暴露并使用：

- `secureContext`：来自 `window.isSecureContext`；
- `serviceWorkerAvailable`：生产环境中 secure context 且浏览器提供 Service Worker；
- `notificationAvailable`：secure context 且浏览器提供 Notification API。

HTTP 内网模式下：

- 游戏连接照常允许；
- Service Worker 不注册；
- 安装能力不伪造；
- 通知开启按钮隐藏；
- “应用”区显示“普通 Web 模式”及“通过 HTTPS 地址访问可使用安装、离线更新和系统通知。”；
- 不显示红色安全警告、不阻止连接、不反复弹窗。

Lucky HTTPS 模式下才启用 Service Worker、App Shell cache、更新检查、安装能力和系统通知。

## 6. PWA 与安装

Manifest 源文件为 `web-client/public/manifest.json`，产物为 `/app/manifest.json`。由于 FluffOS 静态 MIME 表对 `.json` 的支持可靠，使用 `.json` 文件名而不是依赖 `.webmanifest`。

关键字段：`name: 炎黄群侠传`、`short_name: 炎黄`、`start_url: /app/index.html`、`scope: /app/`、`display: standalone`，`display_override` 以 `standalone` 优先并允许平台选择 `fullscreen`，不锁定 `orientation`。

图标是项目自制的深墨、暖金、青色印章“炎”字图形，提供 192×192、512×512、maskable 512×512 和 Apple Touch Icon。HTML 保留 `viewport-fit=cover`、Apple mobile meta、`theme-color` 与 `apple-touch-icon`。

Android 只有收到 `beforeinstallprompt` 后才显示“安装应用”，且只在用户点击时调用 `prompt()`。iOS 仅在 secure context、Safari、非 standalone 时提示“Safari → 分享 → 添加到主屏幕”；内网 HTTP 不强调 PWA 安装。

## 7. Service Worker

生产环境在 `/app/` scope 下注册 `/app/service-worker.js`；不会扩展到 `/`，因此不影响 `www/index.html` legacy client。

cache 名称为 `yanhuang-web-v<package version>-<source content hash>`。预缓存只包含：

- `/app/index.html`；
- `/app/manifest.json`；
- hashed JS/CSS；
- icons 与其他静态 UI 资源。

不会缓存 WebSocket、GMCP、人物状态、房间状态、地图 graph、聊天、任务、行囊、战斗、Terminal、登录、账号或密码。

请求策略为静态资源 cache-first、缺失后 network；只有 `request.mode === 'navigate'` 或 `request.destination === 'document'` 的 `/app/` 导航在网络失败时 fallback 到 `/app/index.html`。JS、CSS、image、font 和 manifest 缺失且网络失败时返回正常网络错误，不返回 HTML，避免 MIME 错误。

通知点击处理在 Service Worker 中完成：先 `notification.close()`，再查找 `/app/` 窗口并 focus；没有现存 App 窗口时打开 `/app/index.html`。不自动登录、不自动 reply、不自动执行命令。

## 8. 通知

通知默认关闭，只有设置页按钮触发 `Notification.requestPermission()`；HTTP 或 permission denied 时不显示开启按钮、不重复请求。

只有后台/未 focus 的 incoming `Chat.Message` 且 `kind` 为 `tell` 或 `reply` 才通知。channel、say、HP、战斗、GMCP 和系统日志不通知；正文只显示简短正文或“收到新消息”，不包含账号、密码、player/entity ID 或 GMCP 数据。

主路径是 `ServiceWorkerRegistration.showNotification(title, options)`；当存在可用的 `registration.showNotification()` 时不会调用 `new Notification()`。没有可用 Service Worker 通知方法时才使用桌面 `new Notification()` fallback，并捕获异常。这里不是 Web Push：不使用 Push API、VAPID、PushSubscription、FCM 或 APNs；PWA 完全关闭或 iOS 冻结页面后不保证送达。

## 9. 源码 content hash

`web-client/scripts/source-hash.mjs` 在构建前对稳定排序的源文件计算 SHA-256，取前 8 位。输入包含 `package.json`、`index.html`、`src/`、`public/`、`vite.config.ts`、`scripts/build.mjs` 和 hash helper；不包含 `www/app` build output。

因此相同源码得到相同 hash，源码改变就改变 hash，不受 commit 顺序、Git dirty 状态或 build output 反向影响。客户端版本与 cache 使用同一个 hash，例如 `0.1.0 · <contenthash>` 与 `yanhuang-web-v0.1.0-<contenthash>`。

## 10. 自动测试

最终 `npm test -- --run`：**22 个测试文件、90 个测试全部通过**。覆盖内容包括：

- HTTP/HTTPS/WSS URL 矩阵与自定义 HTTPS 端口；
- `location.host` 默认地址；
- secure context 能力与 HTTP 设置页行为；
- standalone、iOS Safari、Android 安装事件；
- Service Worker scope、导航 fallback、静态资源失败、缓存命中；
- `showNotification` 优先级、桌面 fallback、权限和通知规则；
- `notificationclick` focus/openWindow；
- content hash 输入稳定性与不包含 `www/app`。

## 11. 运行时与构建验收

最终 `npm run build`（TypeScript 检查 + Vite production build）通过。最终产物包含 `www/app/index.html`、manifest、Service Worker、四个图标和 hashed JS/CSS；本次 source content hash 与客户端版本/cache 为 `66368cb0`，Service Worker cache 为 `yanhuang-web-v0.1.0-66368cb0`。

8888 静态检查确认入口、manifest、Service Worker 和图标可访问；入口、manifest、Service Worker、192/512/maskable/Apple 图标均返回 200。真实 8888 WebSocket 完成 login、look、north、south、quit；GMCP smoke 收到 `Room.Map`、`Room.Map.Transition`、`Room.Info`、`Room.Entities`、`Char.Inventory`、`Quest.List`、`Chat.Capabilities` 等包，地图页面无 fallback。

三视口检查：

- 390×844：body/document 宽度均为 390，shell 高度 844，移动底栏 5 项，设置页普通 Web 模式布局正常；
- 844×390：body/document 宽度均为 844，shell 高度 390，无横向溢出，命令栏可滚动至底栏上方；
- 1440×900：body/document 宽度均为 1440，shell 高度 900，设置、帮助、地图与更新提示 smoke 通过。

5566 GBK 与 6666 UTF-8 均完成 login、look、north、south、quit。当前自动化浏览器未提供强制 offline 切换，离线规则通过 SW VM 测试验证；没有真实 iPhone/Android 设备，真机安装与系统权限仍是平台限制。浏览器测试没有输入或保存账号密码。

## 12. Git 与冻结结论

本阶段没有修改 `config.ini` TLS、Lucky、FluffOS、LPC 或 `mudcore`，没有加入 Caddy/Nginx，也没有提交 save、log、node_modules、cache、浏览器 profile、证书、私钥、`.env`、真实域名、真实公网地址或凭据。

临时测试账号、login/user save、含测试记录的运行日志已在验收后删除。最终提交为 `37bf4fc74dbf12601f096c0384e002635c21a5d1`，已推送 `origin/master`。Stage 7.0.1 到此冻结，不进入 Stage 7.1。
