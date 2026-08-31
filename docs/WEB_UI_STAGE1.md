# 炎黄现代 Web 客户端阶段 1

## 1. 阶段结论

阶段 1 已建立独立的 React + TypeScript + Vite Web 客户端，并保持原有 LPC 玩法、文字输出、命令语法、传统 Telnet 端口和 `www/index.html` 不变。新客户端使用 FluffOS WebSocket 的 `telnet` 子协议，在浏览器内完成有状态 Telnet 协议处理，以现有 GMCP 数据驱动人物状态和房间方向界面。

本阶段只实现基础客户端。背包、装备、技能、战斗、任务、聊天、AI NPC、地图、寻路、商店和 PWA 均未进入实现范围。

## 2. 运行基线与实际验证

本次使用官方 Windows 预编译 FluffOS `v2026.0801.0`，启动命令为：

```powershell
driver.exe config.ini -d
```

启动后实际确认监听：

| 端口 | 协议与编码 | 结果 |
| --- | --- | --- |
| 5566 | Telnet / GBK | 登录既有角色并执行命令通过 |
| 6666 | Telnet / UTF-8 | 登录既有角色并执行命令通过 |
| 8888 | WebSocket + HTTP 静态文件 | `telnet` 子协议、GMCP 和静态页面通过 |

真实运行验证包括：

- 在修复前重新注册角色，人物对象加载时报 `/feature/user_gmcp.c:112 Undefined function hash`，确认阶段 0 的阻断可复现。
- 修复后重新启动同一版本驱动，完成新账号注册、性别选择、人物创建和出生流程，真正进入 `/clone/user/user` 人物对象。
- 通过真实连接执行 `look`、`hp`、`score`、`i`、`skills` 和移动命令，收到原版炎黄文字结果。
- WebSocket 端完成 `WILL GMCP` → `DO GMCP` 协商，并实际收到 `Core.Hello`、`Char.Vitals` 和 `Room.Info`。
- 注册过程从阎罗殿进入客店后继续移动；每次服务端房间变化都产生新的 `Room.Info`，房间名、出口和临时 `room_id` 随服务端状态更新。
- 5566 和 6666 都用无 GMCP 的普通 TCP/Telnet 流重新登录同一测试角色，收到客店、状态、经验和技能等真实输出。
- 测试账号、存档、本地环境配置和运行日志在提交前删除，不进入 Git。

这些验证说明修复不只是让驱动完成预载，而是能让人物对象实际加载并继续游戏。

## 3. `hash()` 阻断的解决方案

原 `Room.Info.Get` 使用：

```lpc
hash("md5", base_name(ob))
```

官方预编译驱动没有可选 crypto efun，导致包含该 feature 的人物对象编译失败。`hash()` 只用于浏览器侧房间标识，不参与地图、移动或玩法，因此本阶段采用最小替代方案：

- 在 `feature/user_gmcp.c` 内维护人物对象生命周期内的房间 ID 映射。
- 内部仍以房间对象文件名作为映射键，但只向客户端发送 `r-<随机会话前缀>-<序号>`。
- 同一人物对象和同一游戏过程中再次进入同一房间会得到相同 ID。
- ID 不依赖 crypto efun，也不向浏览器泄露 LPC 文件路径。
- 新增标准字段 `room_id`；暂时让旧字段 `hash` 返回同一个不透明 ID，兼容可能已经读取该字段的客户端。
- 不修改 `mudcore`，不修改房间文件、移动规则或任何游戏数值。

该 ID 不是永久世界地图 ID。驱动重启或人物对象重建后可以变化，符合阶段 1 “当前连接或当前游戏过程中稳定”的范围。永久地图标识需要在后续地图阶段单独设计迁移和上游兼容策略。

## 4. 新 Web 客户端结构

正式源代码位于 `web-client/`，构建产物输出到 `www/app/`：

```text
web-client/
├── src/
│   ├── protocol/
│   │   ├── websocket/
│   │   ├── telnet/
│   │   ├── gmcp/
│   │   └── ansi/
│   ├── features/
│   │   ├── terminal/
│   │   ├── character/
│   │   └── room/
│   ├── stores/
│   └── app/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

协议状态与 React 页面分离：

- `MudConnection` 管理连接状态、主动断开和有限指数退避重连。
- `TelnetParser` 维护跨 WebSocket frame 的解析状态。
- GMCP 模块解析消息并校验阶段 1 所需数据形状。
- ANSI 模块把有限 SGR 控制码转换为文本片段，React 只创建文本节点。
- `useMudClient` 连接协议事件与 UI 状态，不在页面组件中实现 Telnet 字节机。

## 5. WebSocket 与重连

客户端默认根据当前页面协议连接：

- HTTP 页面：`ws://<当前主机>:8888`
- HTTPS 页面：`wss://<当前主机>:8888`
- 子协议：`telnet`

连接状态包括 `connecting`、`connected`、`reconnecting`、`closed` 和 `error`。非主动断线最多重试 4 次，基础等待为 1 秒，按 1、2、4、8 秒退避；用户主动点击断开后不再重连。客户端不发送旧页面使用的空字符串心跳。

## 6. Telnet 与 GMCP

`TelnetParser` 支持：

- `IAC`、`WILL`、`WONT`、`DO`、`DONT`
- `SB`、`SE` 和 `IAC IAC`
- GMCP（服务端 `WILL GMCP` 时正确回复 `DO GMCP`）
- TTYPE、NAWS 和 ECHO
- negotiation 与 subnegotiation 被拆到多个 WebSocket frame 时继续解析
- 对未知选项进行标准拒绝，不把协议字节混入文字终端

阶段 1 使用现有 GMCP 包：

- `Core.Hello`
- `Char.Vitals` / `Char.Vitals.Get`
- `Room.Info` / `Room.Info.Get`

收到 `Core.Hello` 后客户端主动请求人物资源和当前房间。未知包只显示包名到默认隐藏的 Protocol Debug，不影响连接；错误 JSON 也只记录无敏感数据的错误。

## 7. UI 能力

### 原版文字终端

主要区域持续显示原版炎黄的剧情、命令结果、战斗、NPC 对话、系统消息和聊天文字。支持 Enter 发送、手机发送按钮、最近 100 条非敏感命令历史、上下键浏览、自动滚动，以及用户向上阅读时保持当前位置并显示“回到底部”。

ANSI renderer 支持普通 UTF-8 中文、换行、reset、bold、标准/高亮基础前景色。服务端内容不会写入 `innerHTML`；例如 `<script>alert(1)</script>` 只作为可见文字呈现，不会执行。NPC、玩家、聊天和未来 AI 内容都按不可信输入处理。

### 人物状态

人物面板只使用真实 `Char.Vitals`，显示：

- 气血 `hp / max_hp`
- 精 `jing / max_jing`
- 精力 `jingli / max_jingli`
- 内力 `neili / max_neili`

缺少数据时显示 `--`，不解析 `hp` 命令文字，也不构造假数据。

### 房间与方向

房间面板只使用真实 `Room.Info`，显示房间名、area 和 exits。八个平面方向与上/下自动按出口启用；`enter`、`out`、`climb`、`cross` 或其他字符串进入“其他出口”。点击按钮只发送原始炎黄方向命令，合法性和移动结果仍完全由 LPC 判断。

### 密码与协议调试

服务端通过 Telnet ECHO 协商进入密码阶段时，输入框自动变为 `type="password"`；另提供手动“隐藏输入”作为保守兼容手段。敏感输入：

- 不回显到终端；
- 不进入命令历史；
- 不进入 Protocol Debug；
- 不写 `localStorage` 或 `sessionStorage`；
- 发送后立即清空输入框状态。

Protocol Debug 默认隐藏，只记录 WebSocket 状态、Telnet 协商、GMCP 包名、重连和错误，不记录应用层命令内容。

## 8. 桌面与手机适配

桌面使用状态/房间侧栏、文字主区域和底部命令栏。窄屏改为纵向信息区，保留 `100dvh`、safe-area inset、触摸尺寸和底部输入；桌面、390 × 844 竖屏和 844 × 390 横屏均做了实际浏览器检查，页面宽度没有横向溢出，命令输入与发送按钮位于可视区内。

实际移动端检查发现过一次 CSS Grid 隐式行导致底部命令栏落到视口外的问题；已通过明确指定 header、连接提示、main 和 command bar 的网格行修复。阶段 1 没有加入 PWA、Service Worker 或离线缓存。

## 9. 安装、开发、构建与访问

先初始化仓库和子模块：

```powershell
git submodule update --init --recursive
```

安装与测试：

```powershell
cd web-client
npm install
npm test
npm run build
```

开发服务器：

```powershell
npm run dev
```

生产构建写入 `www/app/`，随后从仓库根目录启动 FluffOS：

```powershell
driver.exe config.ini -d
```

访问地址：

- Legacy 客户端：`http://127.0.0.1:8888/`
- 新客户端：`http://127.0.0.1:8888/app/index.html`

当前 FluffOS 静态文件处理器不会为 `/app/` 自动补 `index.html`，直接访问 `/app/` 返回 404；这不是 Vite dev server 依赖，明确文件地址由 FluffOS 直接返回构建结果。后续若要公开简洁 `/app/`，应由部署层添加目录索引或重写规则，不应为此改变游戏协议。

本次构建环境为 Node.js `v24.16.0`、npm `11.13.0`。依赖版本已锁定在 `package-lock.json`，`node_modules/` 与 coverage 不提交。

## 10. 自动测试

测试覆盖：

- Telnet WILL/DO、GMCP negotiation、SB/SE、IAC IAC、ECHO 和跨 frame 状态；
- GMCP 正常 JSON、空 payload、错误 JSON和未知 package；
- ANSI 中文、色彩、reset、HTML 字符串与 script 注入；
- `Char.Vitals` fixture 的资源显示；
- `Room.Info` fixture 的房间和方向显示；
- 终端没有创建服务端 script DOM；
- ECHO 密码阶段使用 password input。

交付前执行结果：20 个测试全部通过，TypeScript 检查及 Vite production build 通过。构建产物可由 8888 的 FluffOS 静态服务直接读取。

## 11. 兼容性与改动边界

- `www/index.html` 原文件保留且未修改，继续作为 legacy 客户端。
- 5566 GBK 与 6666 UTF-8 的传统文字客户端继续工作，无 GMCP 也能登录和执行命令。
- 所有原文字输出和命令输入继续存在；GMCP 是协商成功后的附加结构化通道。
- 未修改 `mudcore` submodule，也未改房间、NPC、任务、战斗、技能、物品或数值逻辑。
- 项目专用改动集中在父仓库的 `feature/user_gmcp.c` 和新目录，降低未来同步 `oiuv/mud` 时的冲突范围。

## 12. 当前限制与风险

1. `room_id` 是人物对象生命周期内的临时 ID，不可用于永久地图数据库。
2. 当前只有人物资源和房间具备阶段 1 UI；其他系统仍通过原文字终端使用。
3. FluffOS 官方预编译包和项目运行配置仍未由仓库锁定成完全可复现的驱动构建；阶段 1 只是移除了 Web UI 对可选 crypto 的依赖。
4. `/app/` 没有目录索引，必须访问 `/app/index.html`，或由正式部署反向代理添加重写。
5. 本次在 Windows、窄屏/横屏浏览器视口中验证；真实 iOS Safari 与 Android Chrome 设备仍应在发布前做设备矩阵回归，特别关注软键盘 resize 行为。
6. ECHO 协商是现有登录流程的安全信号；若未来某个自定义登录流程不协商 ECHO，玩家需要手动启用“隐藏输入”。

## 13. 阶段 2 建议

阶段 2 最值得优先做的是定义带版本和完整快照语义的背包/装备 GMCP schema，并让服务端在登录、拾取、丢弃、穿戴和卸下时推送增量或刷新事件。推荐顺序：

1. 先为 `Char.Inventory` 与 `Char.Equipment` 写 LPC schema、权限边界和 fixture；
2. 建立统一的 GMCP 版本、错误和刷新约定，避免每个 UI 模块自行猜测文本；
3. 再做背包和装备 UI，同时保留原 `i`、`wear`、`remove` 等命令；
4. 补真实 Android Chrome 和 iPhone Safari 设备测试；
5. 在进入地图阶段前单独设计永久房间 ID，不能把阶段 1 临时 ID 当作世界主键。

技能、战斗、任务、聊天和 AI NPC 应在上述协议约定稳定后分阶段增加，不在阶段 1 继续扩展。
