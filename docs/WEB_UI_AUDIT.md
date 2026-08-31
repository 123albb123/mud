# 炎黄现代 Web UI 技术审计

> 审计日期：2026-08-31
> 仓库：`https://github.com/123albb123/mud`
> 分支与提交：`master` / `216fcaa7e280851a024a5a1136bb5bf70a77c09f`
> `mudcore`：`1fdbcaef3ad4972dc10761faa5f836c6f53e5ed9`
> 审计约束：本阶段只做静态审计和运行验证，不开发正式 UI，不改变现有功能或玩法。

## 1 项目现状

炎黄是一个以 LPC 编写、由 FluffOS 驱动的 UTF-8 中文 MUD。游戏仍以“文本命令输入 + ANSI 文本输出”为主模型，同时在 FluffOS 层开启了 WebSocket、GMCP、MSSP 和 MSP。仓库自带单文件 Web 客户端 `www/index.html`，能连接 WebSocket、显示 ANSI 文本、发送命令，并包含一套未完整接通的 Telnet/GMCP 解析代码。

当前代码有三个需要区分的数据层级：

1. **浏览器已经能收到的结构化数据**：服务端只实现了 `Core.Hello`、可选的 `Client.GUI` / `Client.Map`、`Char.Vitals` 和 `Room.Info`。其中当前浏览器对它们大多只写入控制台，并没有形成真实状态 UI。
2. **LPC 内部已经结构化、但只以文本暴露给客户端的数据**：人物属性、房间对象、NPC、背包、装备、技能、战斗状态、两套任务数据、频道信息等绝大多数属于此类。
3. **真正缺少统一数据模型的数据**：稳定实体 ID、动作能力列表、传统房间的统一坐标、战斗事件流、技能招式元数据、AI 对话关联 ID 等。这些不能靠解析现有文本可靠补齐。

仓库 `master` 与审计时的 `oiuv/mud` 上游 `master` 均指向 `216fcaa7e280851a024a5a1136bb5bf70a77c09f`，当前没有历史分叉压力；后续应尽量把 Web UI 和协议扩展放在边界清楚的新目录/新模块中，继续维持这一优势。

### 实际验证摘要

| 验证项 | 结果 | 说明 |
| --- | --- | --- |
| 克隆及 submodule | 通过 | `mudcore` 已递归初始化到上述提交 |
| FluffOS 启动 | 部分通过 | 使用官方 Windows 预编译版 `v2026.0801.0`，预载完成并监听 5566、6666、8888 |
| WebSocket HTTP 静态页 | 通过 | `GET http://127.0.0.1:8888/` 返回 200、`text/html` 和仓库内页面 |
| WebSocket `ascii` | 通过 | 能收到约 1.9 KiB 的 UTF-8/ANSI 欢迎及登录提示，不带 Telnet 协商 |
| WebSocket `telnet` / `binary` | 通过 | 能收到 Telnet 协商及欢迎文本；两种子协议的初始协商一致 |
| 注册提示链路 | 部分通过 | 实际完成英文 ID、确认、中文姓名、双密码和性别输入 |
| 进入人物对象 | 阻断 | 加载 `feature/user_gmcp.c` 时 `hash()` efun 未定义，人物对象创建失败 |
| `look` / `hp` / 背包等游戏内命令 | 未完成 | 受上述人物对象编译失败阻断，不能把登录对象的“指令错误”视为命令测试 |
| 实际 GMCP 业务包 | 未完成 | 协商字节已验证，但人物对象没有创建，无法验证 `Core.Hello`、Vitals、Room 的实际包体 |
| AI 服务 | 未启动 | 缺少实际角色配置和外部模型配置；本阶段完成静态链路审计 |

运行阻断的精确位置是 `feature/user_gmcp.c` 的 `hash("md5", base_name(ob))`。项目自己的 LPC 指南已说明 `hash` 依赖 `__PACKAGE_CRYPTO__`，但这里没有编译期保护；本次官方预编译驱动的宏表不含该功能包。这个结果说明项目必须先固定可复现的 FluffOS 提交、CMake 功能包和构建产物，或为可选 efun 提供兼容实现，才能开展可信的端到端 Web UI 测试。它不证明所有 FluffOS 构建都会失败，但证明当前仓库未声明足够严格的运行时基线。

## 2 项目目录结构

| 目录/文件 | 职责 | 与 Web UI 的关系 |
| --- | --- | --- |
| `adm/` | master、登录和全局 daemon | 登录、频道、任务、AI、地图等协议数据源 |
| `cmds/` | 玩家、技能、管理和测试命令 | 当前用户操作入口，也是文本输出行为基线 |
| `clone/` | 用户、NPC、物品等可克隆对象 | 人物、NPC、背包和装备实体来源 |
| `d/`、`b/` | 大量传统区域、房间、NPC、剧情 | 地图、房间对象和特殊移动的主要内容来源 |
| `world/` | 较新的 world/area 内容 | 含区域坐标/地图能力，但不能代表全部传统区域 |
| `feature/` | 人物能力 mixin | 属性、移动、战斗、技能、装备、消息和 GMCP 核心接点 |
| `inherit/`、`std/` | 通用房间、物品、武器、护甲等基类 | 适合读取公共字段，不宜把所有内容强制改造成一种子类 |
| `include/` | 宏和协议常量 | 可定义新增 GMCP 包名/版本，但应避免污染广泛依赖的头文件 |
| `mudcore/` | Git submodule，共享新框架 | 应保持只读式消费，项目差异优先在父仓库覆盖实现 |
| `ai_service/` | 可选 Python UDP/LLM 服务 | AI NPC 生成与长期记忆后端，不是浏览器直接调用的服务 |
| `www/index.html` | 当前单文件 WebSocket 客户端 | 现有 Web 入口和兼容基线 |
| `config.ini` | 完整运行配置 | 5566/6666 Telnet、8888 WebSocket、GMCP/MSSP/MSP |
| `config.cfg` | Windows 精简配置 | 6666 Telnet、8000 WebSocket；与 README/完整配置端口不一致 |
| `build*.sh`、`run.*` | 驱动构建/启动脚本 | 当前未锁定驱动提交和完整功能包，是可复现性风险 |

代码内容规模大且异构。Web UI 不能只针对 `world/area` 新框架设计；必须兼容 `d/`、`b/` 中传统房间的 mapping、动态出口、临时对象和大量 `add_action` 自定义动作。

## 3 当前 Web 客户端架构

`www/index.html` 是约 1,493 行、54 KiB 的无构建单页文件，HTML、CSS 和 JavaScript 全部内联。其运行链路为：连接表单 → 原生 `WebSocket` → 可选 Telnet 字节解析 → ANSI 转 HTML → 命令输入框。

已有能力：

- `ws://` / `wss://`、地址、端口和子协议选择；默认指向 `wss://mud.ren:8888`，默认子协议为 `ascii`。
- 字符串、`Blob`、`ArrayBuffer` 接收和 UTF-8 编解码。
- 基础 ANSI SGR 颜色、终端滚动、最多保留 1,000 个消息节点。
- 30 秒发送一次空字符串的应用层“心跳”。
- 最多三次自动重连，2/4/6 秒线性退避。
- Telnet、GMCP、MSP 的类和事件接口雏形。

主要问题：

- 文件中有两套 Telnet 实现。较完整的 `TelnetOverWebSocket` 从未实例化；实际运行的是 `AdvancedMUDClient` 内另一套解析器，形成明显的死代码和行为分叉。
- 当前真正使用的 GMCP 处理只 `console.log`，状态栏和房间 DOM 更新仍是注释示例。
- `appendMessage()` 把 ANSI 转换结果直接赋给 `innerHTML`，没有先转义服务端文本。房间、频道、玩家输入回显或 AI 回复都可能成为 HTML/XSS 注入源。
- ANSI 只覆盖部分前景色和粗体，不完整支持背景色、256 色、真彩色、下划线等；光标 CSI 被直接去除。
- 密码阶段仍是普通文本输入框。即使 Telnet ECHO 协商成功，浏览器输入框也不会自动切成密码模式。
- 重连会清空终端；关闭回调与主动清理共用同一路径，状态机较脆弱，也没有恢复会话的明确 UI。
- 没有类型、模块边界、自动测试、状态管理、PWA manifest 或 service worker。

结论：现有页面适合作为协议样机和 legacy fallback，不适合作为多面板现代客户端继续堆叠功能。

## 4 WebSocket

`config.ini` 将 `www/` 作为 WebSocket HTTP 根目录并监听 8888。浏览器构造 URL 时附加时间戳查询参数，并以选中的 `ascii`、`telnet`、`binary`、`http` 或空值作为子协议。

实际验证结果：

- `ascii`：服务端直接发送 UTF-8/ANSI 游戏文本，不发送 Telnet 协商。这适合纯终端，但不可能获得 GMCP。
- `telnet` 与 `binary`：首包均为 `DO TTYPE`、`DO NAWS`、`DO NEW-ENVIRON`、`WILL GMCP`、`WILL MSSP`、`WILL CHARSET`、`WILL MSP`，随后发送欢迎文本。
- 浏览器发送普通命令时使用 WebSocket 文本帧并追加换行；Telnet 子协商使用二进制帧。FluffOS 可接收这种组合，但协议层应统一成可测试的字节流。

当前心跳只是空应用消息，不是 WebSocket Ping/Pong，也没有“发出后必须在 N 秒内收到数据”的超时判定。推荐由浏览器使用可见状态、最近收包时间和指数退避管理重连；不要让空命令进入游戏命令链。WSS 部署还需明确反向代理超时、Origin 策略、证书和每 IP 连接限制。

## 5 Telnet 协议

### 服务端

完整配置开启 GMCP、MSSP、MSP，关闭/未开启 MXP、MSDP、ZMP。传统端口约定为 5566（GBK）和 6666（UTF-8），WebSocket 为 8888；`adm/single/master.c` 对 5566 调用 `set_encoding("GBK")`，其他连接默认 UTF-8。该行为必须保留。

### 当前浏览器

实际解析器接受 `IAC`、`WILL/WONT/DO/DONT` 和 `SB/SE`，回应 TTYPE、NAWS、ECHO、SGA、GMCP 和 MSP。但有以下协议错误或缺口：

- 服务端实际发送 `WILL GMCP`，活动解析器的 `handleTelnetWill()` 没有 GMCP 分支，因而按默认逻辑回 `DONT GMCP`。与此同时它只在收到 `DO GMCP` 时回 `WILL` 并初始化 GMCP，方向混淆。以当前握手看，默认客户端不会正确接收服务端 GMCP。
- 活动解析器把解析状态定义在单次 WebSocket 消息内部。若 `IAC`、选项或子协商跨 WebSocket frame 分片，状态会丢失。
- 普通 Telnet 命令被假设为三字节，无法正确覆盖 GA/NOP 等两字节命令；子协商中的 `IAC IAC` 转义也不完整。
- 不接受 CHARSET、NEW-ENVIRON、MSSP；MSP 只有启用日志，没有完整播放策略。
- TTYPE 固定返回 `websocket-client`；NAWS 用浏览器窗口像素粗略除以 8/16，而不是终端容器的实际行列。
- ECHO 协商没有驱动输入控件的敏感模式。

### 建议

新客户端应实现一个跨 frame 保持状态的 Telnet 字节状态机，并以捕获的真实协商字节建立单元测试。现代模式默认选择 `telnet` 子协议；`ascii` 保留为纯文本诊断/兼容模式。至少正确实现 TTYPE、NAWS、ECHO、SGA、GMCP，明确拒绝未支持选项，并完整处理 `IAC IAC` 和任意分片。Telnet 层、ANSI 层和 GMCP 层不应耦合到 React 组件。

## 6 GMCP

服务端实现在项目级 `feature/user_gmcp.c`，覆盖/扩展 `mudcore/inherit/user_gmcp.c`。`clone/user/user.c` 继承它，并在用户初始化时调用 `init_gmcp()`；`hp` 命令和成功移动分别触发 Vitals 与 Room 响应。

| GMCP | 服务端 | 客户端 | 完整度 | 可用于 |
| --- | --- | --- | --- | --- |
| `Core.Hello` | GMCP enable 时发送 `{mud_name}` | 未处理 | 服务端已有、端到端未验证 | MUD 身份 |
| `Client.GUI` | 环境变量存在时发送 `{version,url}` | 能解析但只写控制台；客户端又用同名包上报自身信息 | 方向语义冲突 | GUI 资源提示，需先澄清方向 |
| `Client.Map` | 环境变量存在时发送 `{url}` | 未处理 | 服务端可选 | 外部地图入口 |
| `Client.Window` | 未实现 | 仅未使用的旧 GMCP 类会发送 | 死代码 | 不应作为现状依赖，NAWS 已承担尺寸 |
| `Char.Vitals.Get` | 接收纯字符串请求 | 活动客户端不发送 | 服务端请求入口已有 | 主动请求人物状态 |
| `Char.Vitals` | `hp` 后发送 mapping | 解析后只写控制台 | 字段有限、非实时 | 基础资源条 |
| `Room.Info.Get` | 接收纯字符串请求 | 活动客户端不发送 | 服务端请求入口已有 | 主动请求房间摘要 |
| `Room.Info` | 移动后发送 mapping | 解析后只写控制台 | 缺描述和实体 | 房名、方向按钮、区域提示 |

`Char.Vitals` 当前字段为 `hp/max_hp`、`jing/max_jing`、`jingli/max_jingli`、`neili/max_neili`、`food/max_food`、`water/max_water`、`exp` 和可用潜能 `pot`。它缺少有效气/精、加力、怒气、条件、busy、战斗目标等，也没有在受伤/恢复时持续推送。

`Room.Info` 当前字段为去 ANSI 的 `name`、出口键数组 `exits`、粗粒度 `area` 和基于 `base_name(room)` 的 MD5 `hash`。它没有 `long` 描述、出口目标、门状态、房内玩家/NPC/物品、坐标或能力列表。`hash` 既造成了本次可选 crypto efun 编译阻断，又不能区分共享同一 `base_name` 的虚拟/坐标房间，不能作为未来地图的唯一身份设计。

项目没有实现 `Core.Supports.Set/Add/Remove` 或包版本协商。新增包前应先建立版本化能力协商，使旧 Web 客户端和传统 Telnet 客户端能够忽略未知包。

## 7 登录与角色创建

登录由 `adm/daemons/logind.c` 和 `clone/user/login.c` 处理，完全通过顺序文本提示及 `input_to()` 驱动。新角色流程包括：英文 ID → 是否创建 → 中文姓/名 → 管理密码与确认 → 普通密码与确认 → 性别。重复登录、断线重连、管理密码重置等也都是文本分支。

现有 Web 客户端可以靠命令行完成这些流程，不必修改 LPC 才能“可用”；但要做安全、清晰的表单式登录，需要最少的客户端提示状态机，最好再增加只描述登录阶段的结构化协议。注意：

- 密码必须在 DOM 中以 password 控件输入，不能仅依赖 Telnet ECHO。
- 不应把密码保存到 localStorage、日志、重连队列或 Redux devtools。
- 文本提示可能随上游修改，纯正则解析很脆弱；建议新增 `Auth.State`（阶段、字段、约束、是否敏感）但仍接受原命令输入，保持传统客户端不变。
- 断线重连依赖服务端 netdead/同 ID 重连逻辑，不存在浏览器 session token。前端要把“WebSocket 重连”和“人物重登录”作为不同状态展示。

本次实际注册到性别输入后，因人物对象继承的 GMCP 文件编译失败而中止；测试 ID 没有生成存档。

## 8 人物状态

### 已有结构化数据

LPC 内部人物对象已有丰富 mapping/属性：姓名、ID、称号、性别、年龄、生日、门派、师父、先天/后天臂力悟性根骨身法、气血/精/内力/精力、食物/饮水、经验、潜能、正邪、威望、贡献、金钱、伤害、防御、转世等。`feature/attribute.c` 还能从战斗经验计算等级；`feature/condition.c` 保存条件/Buff/Debuff；`feature/attack.c` 保存敌人、杀戮目标、战斗时长和上一个对手。

### 客户端可用性分类

- **A：已有 GMCP**：上述 `Char.Vitals` 的有限资源字段。
- **B：LPC 已结构化但无 GMCP**：身份、称号、门派、基础/有效属性、等级、有效气精、战斗标志、当前敌人、busy、条件、货币和大部分进阶数据。
- **C：尚缺统一表达**：条件的可展示名称/图标/剩余时间语义、稳定目标实体 ID、状态更新序号和权限过滤。

前端不能把 `hp` / `score` 彩色文本解析为长期 API。建议保留 `Char.Vitals` 名称并补字段，新增低频 `Char.Status`/`Char.Profile`，高频 Vitals 使用节流快照或 delta。

## 9 房间与地图

传统房间普遍已有 `short`、`long`、`exits` mapping、`objects`、`item_desc`、`outdoors` 和可选门数据。`look` 会从 `all_inventory(room)` 生成玩家、NPC、物品的文本列表。新 `world/area` 框架有 `x_axis/y_axis` 等坐标和地图能力，但大量 `d/`、`b/` 内容没有坐标。

只靠现有 `Room.Info.exits` 可以立即生成当前房间的方向按钮；不能生成可靠世界地图，因为没有出口目标 ID、坐标、动态出口状态或特殊移动边。代码中的出口不只有东南西北：还包括八向、上下组合、`in/out/enter`、中文键及擂台/洞口等语义。大量房间通过 `add_action` 提供 `enter`、`climb`、`jump`、`move`、`cross`、`swim` 等移动，且 `valid_leave` 可动态阻止离开。

地图建议采用“探索图”而非假设全世界都有笛卡尔坐标：

- 服务端内部以 `base_name + 虚拟坐标/实例判别` 形成 canonical key，对客户端暴露不含源码路径的 opaque `room_id`。
- 出口元素至少为 `{command,label,kind,to_room_id?,state}`；未知目标可在实际走过后补边。
- 对已有 area 坐标可额外发送 `{area,x,y,z}`；传统房间由客户端图布局或人工元数据补充。
- 动态房间/副本必须有实例作用域，不能继续用当前 `MD5(base_name)`。

## 10 NPC 与玩家

房内生物对象内部可读取 name/id/alias/title/short、对象路径、等级、生命属性、是否玩家、是否能说话、态度、任务/AI 属性等。但当前 `look` 只发送渲染文本，没有实体数组。

同名 clone 可共享 LPC `id` 和 `base_name`，文本命令通过 `present()` 及序号语法做隐式消歧。这不足以支撑可靠点击。应由服务端为一次连接/一次房间视图分配不可猜测的临时 `entity_id`，并发送允许的动作列表；客户端不能直接提交 LPC 文件路径或任意对象调用。

在没有 LPC 扩展时，前端可以从 `look` 文本做“候选链接”，发送 `look/ask/fight/kill/give/talk <id>`，但会受 ANSI、昵称、同名对象和内容改版影响，只适合临时增强。正式 NPC/玩家卡片需要结构化 `Room.Entities`。

## 11 移动系统

`cmds/std/go.c` 和 `feature/command.c` 已支持标准方向及“当前房间出口键直接作为命令”。因此现有 `Room.Info.exits` 足以让前端不改 LPC 就提供单步方向按钮，点击后仍发送原命令，不改变玩法。

以下能力需要 LPC/GMCP：

- 出口显示名、目标房间 ID、门/锁/阻塞状态。
- 特殊动作与移动的能力发现。
- 自动寻路的可达性、动态失败和中断事件。
- 副本、虚拟区域和传送的图关系。

不建议阶段 1 自动连续发送多步命令。战斗、busy、机关和动态 `valid_leave` 会让客户端预计算路径失效；应等服务端逐步确认 `Room.Info` revision 后再推进。

## 12 背包

`inventory` 命令从 `all_inventory(player)`、数量、单位、装备/持有状态和负重生成文本。物品内部已有 name/id/alias、short/long、weight、unit、amount、base object、weapon/armor 属性、是否 equipped 等结构化字段。

问题是物品模型异构：有的数量来自相同 short 的多个 clone，有的来自 amount；可用动作由继承、方法、临时状态和房间共同决定，没有统一 capability schema。当前没有背包 GMCP。

建议新增 `Char.Items.List` 全量快照和 `Char.Items.Update` 增量，字段至少包括临时 `item_id`、显示名、命令 ID、数量、单位、重量、分类、装备状态、可用动作。所有动作最终仍映射到既有 `look/get/drop/give/use/eat/drink/wield/wear/remove` 命令并由服务端重新校验。

## 13 装备

装备状态在人物 temp 数据和物品属性中已有结构：主/副武器，以及 `armor/<armor_type>` 槽位；物品以 `wielded` 或 `worn` 标记 equipped。护甲类型覆盖衣、头、颈、外衣、甲、腰、腕、手、指、靴、护符、盾等，命令为 `wield/unwield/wear/remove`。

无需改变装备规则，但要增加 `Char.Equipment.List`/`Update`，统一槽位 ID、物品临时 ID、双手/冲突关系和可操作项。前端不能自行判定“可穿戴”，服务端命令仍是权威校验。

## 14 武功与技能

`feature/skill.c` 已有 `skills`、学习进度、`skill_map`（enable）、prepare 等 mapping；`skills` 命令计算等级和升级百分比。基本技能、特殊技能、准备技能、`perform` 和 `exert` 都已有命令体系。

基本技能列表很容易结构化；难点是绝招/内功功能分散在各技能 action 文件中，消耗、前置条件、目标类型和冷却并无统一声明，许多约束只在执行函数中判断。因此：

- `Char.Skills.List` 可直接由现有 mapping 生成。
- `Char.Skills.Actions` 第一版只应列服务端明确枚举并授权的动作。
- 不要通过扫描客户端脚本推断绝招，也不要让客户端绕过 `perform/exert` 的原有检查。
- 若要显示精确消耗/冷却，需要给技能动作补充只读元数据接口，属于 LPC 工作。

## 15 战斗系统

LPC 内部已有敌人数组、killer ID、上一个对手、战斗时间、busy、气/精伤害与创伤等结构化状态；战斗 daemon 和技能代码通过 `message_vision` 输出丰富叙事。浏览器现在只能看到文本，`Char.Vitals` 也只在执行 `hp` 时发送，不是伤害驱动的实时数据。

战斗 UI 必须增加 LPC/GMCP，建议：

- `Combat.State`：是否战斗、自己状态、目标 `entity_id`、目标可见资源百分比、busy 和 revision。
- `Combat.Event`：开始、结束、目标切换、伤害/治疗、昏迷/死亡等有限结构事件；叙事文本继续原样输出，不要求全部语义化。
- 人物 Vitals 在关键变化后节流推送，避免每个伤害函数产生消息风暴。
- `Combat.Actions` 只列当前允许显示的命令模板；实际执行仍走 `fight/kill/hit/perform/exert`。

阶段 1 不应通过解析战斗文本制作血条，因为颜色、随机描述、武功文案和语言都会破坏解析。

## 16 任务系统

项目并存两套任务：

1. 传统师门/日常系统在玩家 `quest` mapping 中保存类型、目标、师父、地点和时限，`quest` 命令负责文本展示。
2. `mudcore` quest2 在玩家 `toDoList` mapping 中保存任务文件与 kill/item 进度，另有 solved 列表；任务对象提供名称、详情、等级、前后置条件、发布/奖励者、目标和奖励接口。

第二套已具有很好的内部结构，第一套也有可读 mapping，但二者没有统一 GMCP。建议 `Quest.List` 以统一 DTO 暴露 `quest_id/system/title/detail/status/objectives/remaining/rewards?`，由适配器分别读取两套系统；不修改原任务逻辑。奖励的隐藏信息不应提前下发，任务文件路径也不应暴露。

## 17 聊天系统

`adm/daemons/channeld.c` 有结构化频道注册与权限过滤，包含系统、巫师、调试、聊天、跨服、交易、喊话、谣言、唱歌、帮派、门派等。`feature/message.c` 在接收端仍保留 `channel:<verb>` 这类消息类别；say/tell/team talk 也有独立命令路径。最终都被格式化为文本发送。

增加 `Comm.Channel.Text` 或项目命名的 `Chat.Message` 较容易，字段可含频道、方向/类型、允许公开的发送者 ID 与显示名、纯文本/ANSI 内容、时间和 message ID。必须沿用现有可见性过滤；`rumor` 等匿名频道绝不能因结构化数据泄露真实发送者。传统文本同时保留，Web 客户端按 message ID/能力协商避免双重显示。

## 18 AI NPC

AI 链路为：玩家 `talk` → NPC `accept_talk()` → `adm/daemons/ai_client_d.c` → UDP `127.0.0.1:9999` → `ai_service` → 外部 OpenAI-compatible 模型 → UDP 回包 → `tell_object()` 文本。

已有能力：

- 请求 JSON 含 npc/player ID、玩家名、消息和时间/地点/天气/门派等上下文。
- Python 服务提供角色配置、SQLite 对话记录和 JSON 长期记忆。
- AI 是 NPC 的 opt-in 能力，可与普通脚本 NPC 共存；仓库有示例/个人目录 NPC。

缺口与风险：

- 实际 `npc_roles.json` 被忽略且本地不存在，只有 example；外部模型配置也不是仓库可运行默认值。
- LPC UDP 请求没有可靠 request ID、超时/重试/取消和鉴权，接收缓冲固定；回包按 living ID/玩家 ID 查找，重复 NPC ID 和并发对话有错配风险。
- 回复直接成为文本，浏览器无法知道“谁在说、是否等待、是否完成、有哪些选择”。
- AI 内容必须视为不可信输入，当前 `innerHTML` 渲染漏洞会放大风险。

RPG 对话框需要新增 `NPC.Dialogue.State/Message`（或同义包），至少含 `request_id`、NPC 临时实体 ID、显示名、玩家消息、回复、状态、可选动作和错误；同时继续输出传统文本。浏览器绝不能直接访问 AI 服务或持有模型密钥。

## 19 ANSI / 文本系统

ANSI 文本是现有玩法、氛围、帮助和大量内容的权威兼容输出，不能因结构化 UI 被删除。推荐采用“结构化状态 + 原始叙事终端并存”。

当前前端最优先的安全修复是：先 HTML escape 所有文本，再把受支持的 ANSI token 转成受控 DOM/span；不要拼接未净化的 `innerHTML`。可选成熟 ANSI parser，但需限制 URL、OSC、CSS 和控制序列。日志缓冲应使用虚拟化或批量文本块，避免 1,000 个节点仍造成高频战斗卡顿。

应提供：ANSI 开关、字体大小、行距、自动滚动锁定、复制纯文本、无障碍颜色和减少动画选项。结构化包中的展示文本也必须经过同一不可信输入处理。

## 20 手机 / PWA

当前页面只有一个 `max-width: 768px` 媒体查询和 `100vh`，没有安全区、横竖屏、软键盘、触控目标、离线壳、安装清单或 service worker。输入框容易被虚拟键盘遮挡，战斗快捷键也不适合拇指操作。

React 重构应优先使用 `100dvh`、`env(safe-area-inset-*)`、可折叠面板、至少 44px 触控目标、输入历史和底部快捷栏。PWA 可在后期缓存静态壳与字体，但不能缓存密码、私聊、人物快照或 AI 记忆；离线状态只能浏览本地帮助/壳，不能伪装成仍在线。

## 21 可直接按钮化命令

| 功能 | 可发送的现有命令 | 只改前端即可 | 正式体验仍需 LPC/GMCP |
| --- | --- | --- | --- |
| 单步移动 | 当前 `Room.Info.exits` 中的方向/出口键 | 是 | 出口名称、目标、门状态、特殊动作 |
| 常用信息 | `look`、`hp`、`score`、`i`、`skills`、`quest` | 是，作为快捷命令 | 面板数据必须结构化 |
| 频道 | `chat`、`rumor`、`shout` 等既有命令 | 是，固定输入模板 | 消息分流、未读、发送者实体 |
| NPC 基本动作 | `look/ask/fight/kill/talk <id>` | 条件式；需先从文本或人工提供 ID | 实体消歧、capability、对话状态 |
| 物品基本动作 | `get/drop/give/use/eat/drink/wield/wear/remove` | 条件式；固定宏可用 | 物品 ID、数量、槽位、允许动作 |
| 技能动作 | `enable/prepare/perform/exert` | 已知命令可做宏 | 可用招式、目标、消耗、冷却 |
| 战斗 | `fight/kill/hit/perform/exert` | 固定宏可用 | 当前目标、可用动作、实时状态 |

原则是“按钮最终发送现有命令”，不在客户端复制游戏规则。凡按钮依赖“当前有哪些对象/动作/目标”，正式版本都需要服务端结构化能力发现。

## 22 当前缺少结构化数据

| 功能 | 当前情况 | 是否需要 LPC | 建议协议 |
| --- | --- | --- | --- |
| 人物 | 有有限 `Char.Vitals`；大部分只在 `hp/score` 文本 | 是（扩展/推送） | `Char.Vitals`、`Char.Status`、`Char.Profile` |
| 房间 | 有 name/exits/area/hash，无描述/实体/目标 | 是（扩展） | `Room.Info`、`Room.Entities`、`Room.Exits` |
| NPC/玩家 | LPC 对象结构化，客户端只有 look 文本 | 是 | `Room.Entities`、`Entity.Update`、`Entity.Actions` |
| 背包 | 内部 `all_inventory`，客户端只有文本 | 是 | `Char.Items.List/Update` |
| 装备 | 内部槽位/temp/equipped，客户端只有文本 | 是 | `Char.Equipment.List/Update` |
| 技能 | 内部 mapping，招式元数据分散 | 是 | `Char.Skills.List/Actions` |
| 战斗 | 内部 enemy/busy/damage，客户端只有叙事 | 是，且需事件钩子 | `Combat.State/Event/Actions` |
| 任务 | 两套内部结构，客户端只有文本 | 是，需适配统一 DTO | `Quest.List/Update` |
| 聊天 | 服务端有频道类别和权限，客户端只有文本 | 是 | `Comm.Channel.Text` 或 `Chat.Message` |
| AI 对话 | UDP JSON 到服务端，最终仅 tell_object 文本 | 是 | `NPC.Dialogue.State/Message` |
| 地图 | 新 area 部分有坐标，传统房间普遍没有 | 是（至少 ID/边） | `Room.Info` + `Map.Node/Edge` |
| 登录 | 顺序文本提示 | 可先纯前端；稳健表单需要 | `Auth.State`（可选） |

“需要 LPC”表示需要增加只读序列化或状态推送，不表示要改变玩法。文本输出应继续存在。

## 23 建议新增 GMCP

### 协议原则

1. 先实现 `Core.Supports.Set/Add/Remove` 和每包版本；未知包可安全忽略。
2. 快照包带 `revision`，增量包带 `base_revision`/`sequence`；登录、重连、换房后可请求完整快照。
3. 所有实体 ID 都是服务端生成、作用域明确的 opaque ID；不暴露 LPC 路径，不接受任意方法名。
4. JSON 字段采用稳定英文 snake_case，数值不夹 ANSI；展示文本可另带 `text`，并仍视为不可信。
5. 客户端操作继续发送现有文本命令。若以后增加 Client→Server GMCP action，也必须 allowlist 并走同一权限/规则校验。
6. 高频 Vitals/Combat 使用节流和合并；背包/技能/任务优先快照 + 小增量，避免每次 heartbeat 全量广播。

### 建议包集

| 优先级 | 包 | 内容 |
| --- | --- | --- |
| P0 | `Core.Hello` + `Core.Supports.*` | 服务身份、协议版本、能力协商 |
| P0 | 扩展 `Char.Vitals` | 当前/有效/最大资源、busy/fighting、revision |
| P0 | 扩展 `Room.Info` | opaque room_id、描述、区域、可选坐标、revision |
| P0 | `Room.Entities` / `Room.Exits` | 玩家/NPC/物品、稳定临时 ID、出口目标与状态 |
| P1 | `Char.Status` / `Char.Profile` | 身份、门派、属性、条件和低频统计 |
| P1 | `Char.Items.*` / `Char.Equipment.*` | 背包、数量、装备槽、能力 |
| P1 | `Char.Skills.*` | 技能、映射、准备、经授权动作元数据 |
| P1 | `Combat.*` | 状态、有限事件、服务端授权动作 |
| P2 | `Quest.*` | 两套任务的统一快照和进度增量 |
| P2 | `Comm.Channel.Text` | 频道/私聊分类且不破坏匿名性 |
| P2 | `NPC.Dialogue.*` | AI/脚本对话的请求关联与状态 |
| P3 | `Map.Node/Edge` | 探索图持久化、区域元数据 |

服务端实现宜集中在父仓库新 daemon/serializer 中，例如 `WEBUI_D`，让 `feature/user_gmcp.c` 只负责协商和路由。人物移动、消息、背包变化、战斗变化处只保留小而明确的通知钩子。不要修改 `mudcore` 来实现项目专用协议。

## 24 前端重构建议

建议选择 **React + TypeScript + Vite，并在新 `web-client/` 目录开发**，不继续把正式功能追加到 `www/index.html`。

理由不是“终端必须使用 React”，而是目标客户端会同时维护连接、Telnet、GMCP、房间、人物、背包、装备、技能、战斗、任务、聊天和移动端面板，已经属于长生命周期、多状态源应用。TypeScript 能固化协议 DTO，Vite 提供简单构建和测试边界，React 适合组合这些视图。

实施方式：

- 第一阶段保留当前 `www/index.html` 作为 legacy 页面/回退入口，不在审计阶段替换它。
- `web-client` 构建产物最终输出到 `www/`（或先输出 `www/app/` 并通过独立入口灰度），源代码和生成物边界明确。
- 协议内核写成 framework-agnostic TypeScript，不依赖 React，便于以捕获字节和 GMCP fixture 做测试。
- 不建议为了“零 LPC”长期解析 `hp/look/inventory` 文本；这只可作为阶段 1 的临时终端展示。

## 25 推荐目录结构

```text
web-client/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── app/                 # 路由、布局、错误边界
│   ├── protocol/
│   │   ├── websocket/       # 连接、心跳、重连
│   │   ├── telnet/          # 跨 frame 状态机
│   │   ├── gmcp/            # codec、版本、DTO
│   │   └── ansi/            # 安全 tokenizer/renderer
│   ├── stores/              # 连接和游戏快照
│   ├── features/
│   │   ├── auth/
│   │   ├── terminal/
│   │   ├── character/
│   │   ├── room/
│   │   ├── inventory/
│   │   ├── skills/
│   │   ├── combat/
│   │   ├── quests/
│   │   ├── chat/
│   │   └── dialogue/
│   └── test/fixtures/       # 真实握手、ANSI、GMCP 样本
└── public/

adm/daemons/webui_d.c        # 建议：DTO、ID、权限和快照协调
feature/user_gmcp.c          # 保留为 GMCP 接入/路由层
include/webui_gmcp.h         # 建议：稳定包名和版本
docs/                        # 协议 schema 与迁移说明
www/                         # Vite 发布产物及 legacy 回退
```

具体 LPC 文件名可在阶段 1 设计评审后确定；重点是新增集中模块，不把序列化散落复制到数百个房间/NPC。

## 26 推荐开发阶段

### 阶段 1：可复现基础与最小纵切

1. 固定 FluffOS commit、构建参数和 crypto/DB/协议功能包；在 Windows/Linux 至少有一个可重复的启动检查。先解决/保护 `hash()` 阻断。
2. 建立 `web-client` 的 React + TypeScript + Vite 工程，但只做连接、登录输入、安全 ANSI 终端、协议日志和响应式壳。
3. 用本次捕获的真实协商建立 Telnet 分片测试，修正 `WILL GMCP` 方向；默认现代模式使用 `telnet` 子协议。
4. 接入现有 `Core.Hello`、`Char.Vitals`、`Room.Info`，完成“人物资源 + 房间名 + 方向按钮 + 原始终端”的最小纵切。
5. 只做必要的 P0 LPC：可靠首包/请求、Vitals 关键变化节流、可复现 room_id；不做背包、战斗大面板。

### 阶段 2：核心角色与场景数据

增加 Room.Entities/Exits、人物状态、背包、装备、技能 DTO；完成桌面/手机基本布局和实体点击能力。所有动作仍发旧命令。

### 阶段 3：实时玩法

增加 Combat、Quest、Chat 和 AI Dialogue；做高频合并、匿名/权限测试、并发对话关联和断线快照恢复。

### 阶段 4：地图、PWA 与发布加固

实现探索图、区域坐标适配、PWA 静态壳、可访问性、性能、安全策略、灰度切换和 legacy 回退。此时再决定是否让新入口取代现有 `www/index.html`。

## 27 兼容上游 oiuv/mud 策略

- 审计基线与上游当前同 SHA；尽早添加只读 `upstream` remote 并定期 fetch/merge（本阶段未修改 remote 配置）。
- `mudcore` 继续固定 commit，不在 submodule 内做项目专用修改；需要扩展时用父仓库继承/覆盖。
- 前端源代码放新 `web-client/`，减少与上游单文件 `www/index.html` 的冲突；生成产物变更独立提交。
- GMCP 序列化集中在新 daemon/feature，玩法文件只增加最小通知钩子；避免逐房间、逐 NPC 修改。
- GMCP 是附加旁路：`has_gmcp()`/能力版本守卫，绝不删除文本输出或改变命令返回。
- 每个协议包有 schema fixture 和兼容测试；上游合并后先跑启动、登录、移动、战斗和 Telnet smoke test。
- 提交按“驱动基线”“协议包”“前端消费”“生成产物”拆分，便于 cherry-pick、回滚和解决上游冲突。

## 28 风险点

| 风险 | 严重度 | 影响与缓解 |
| --- | --- | --- |
| FluffOS 未锁版本/功能包，`hash()` 已实际阻断人物加载 | 高 | 阶段 1 首要门槛；锁 commit/CMake，检查可选 efun |
| 当前浏览器拒绝服务端 `WILL GMCP` | 高 | 用真实握手 fixture 重写状态机 |
| ANSI 文本未经转义写入 `innerHTML` | 高 | 安全 tokenizer + CSP；AI/玩家内容一律不可信 |
| 结构化包可能绕过玩法权限或泄露隐藏信息 | 高 | serializer allowlist、服务端权限过滤、动作仍走命令校验 |
| 双重文本+GMCP 导致重复聊天/事件 | 中 | 能力协商、message ID、按包选择渲染策略 |
| 同名 clone、虚拟房间 ID 冲突 | 高 | 服务端 opaque 实例 ID；不用 `base_name` hash 单独标识 |
| 高频战斗/状态包造成消息风暴 | 中 | 节流、合并、revision、按需订阅 |
| 两套任务和异构物品/技能难统一 | 中 | 适配器 DTO，不重写原系统；渐进覆盖 |
| 文本提示变化破坏表单登录 | 中 | 先保留原终端，后加可选 `Auth.State` |
| WebSocket 暴露公网后的 Origin、限流、WSS | 高 | 反代策略、TLS、连接/命令速率限制、安全日志 |
| PWA 缓存敏感/过期游戏数据 | 中 | 只缓存静态壳，清晰离线状态，禁存凭据/私聊 |
| 上游合并冲突 | 中 | 新目录、集中 hook、小提交、禁止修改 submodule |
| AI 并发错配、提示注入和隐私 | 高 | request ID、超时、授权上下文、输出净化、服务端代理 |

## 29 最终结论

1. **哪些功能已经有结构化数据？** LPC 内部几乎所有核心玩法都有结构化对象/mapping；真正已通过 GMCP 暴露的只有 Core、可选 GUI/Map、有限人物 Vitals 和有限 Room Info。
2. **哪些功能可以只修改 Web 前端？** 安全 ANSI 终端、连接/重连 UI、移动方向按钮、命令快捷键、输入历史、布局、手机适配，以及消费现有 Vitals/Room 包；但现有 GMCP 协商必须先修正。
3. **哪些功能必须增加 LPC/GMCP？** 可靠人物面板、房间实体、NPC/玩家点击、背包、装备、技能动作、实时战斗、任务、分流聊天、AI 对话框和可探索地图。
4. **是否适合 React + TypeScript + Vite？** 适合。推荐新建 `web-client/`，协议内核与 React 解耦，构建到 `www/`，现有页面作为 legacy fallback。
5. **如何兼容传统 Telnet？** 所有文本和命令语法原样保留；GMCP 仅在协商成功时附加发送，未知包可忽略；继续保留 5566 GBK 和 6666 UTF-8。
6. **当前 GMCP 是否足够？** 不足。字段和触发频率只够做样机，而且当前 Web 客户端对服务端 `WILL GMCP` 的处理错误。
7. **能否通过解析文本避免 LPC 修改？** 可做短期快捷按钮和 legacy 终端，不能作为人物、实体、战斗、任务等正式数据源。
8. **地图是否已有充分数据？** 现有出口键只够当前房间方向按钮；传统区域缺稳定目标边/坐标，虚拟房间也不能靠 `MD5(base_name)` 唯一区分。
9. **AI NPC 能否直接做 RPG 对话框？** 生成链和记忆后端已有雏形，但回复只有文本且并发关联不足；需新增服务端对话状态 GMCP，浏览器不得直连模型。
10. **最大的当前技术风险是什么？** 首先是 FluffOS 构建不可复现并已出现 `hash()` 实际编译阻断，其次是 GMCP 协商错误和 `innerHTML` XSS 风险。
11. **推荐的阶段 1 是什么？** 先固定可运行驱动基线，再建立 React/TS/Vite 协议与安全终端骨架，以现有 Vitals/Room 做人物资源、房间和方向按钮的最小纵切；不提前开发背包、战斗、任务等完整 UI。

总体判断：项目非常适合采用“保留文本 MUD 为权威交互、以 GMCP 叠加结构化状态”的现代化路线。它不需要重写玩法，也不应把浏览器变成第二套规则引擎。先解决驱动基线、协议状态机和安全渲染，再逐域增加只读 DTO 与小型事件钩子，可以在兼容传统 Telnet 和持续同步上游的前提下稳步推进。
