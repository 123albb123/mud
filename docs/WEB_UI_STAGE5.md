# 阶段 5：任务系统与聊天/频道结构化 Web UI

日期：2026-09-01
范围：`master` 分支；不修改 `mudcore`，不改变 Telnet 文字路径、权限、消耗或任务规则。

## 审计结论

炎黄当前不是单一任务系统。Web 端现在只读取玩家自己的真实状态，未把全局任务公告、任务定义文件或 LPC 对象路径当作玩家任务：

| 系统 | 玩家状态来源 | Web 表示 | 备注 |
| --- | --- | --- | --- |
| 师门任务 | `query("quest")` | `system: traditional` | 支持 `kill`、`letter`，保留真实目标、地点、师门和期限字段 |
| 江湖任务 | `toDoList` / `solved`，由 `mudcore/inherit/user_quest.c` 提供 | `system: quest2` | 服务端读取真实 quest2 对象的名称、描述、等级和杀戮/物品进度；不输出路径或奖励 |
| 大宗师任务 | `query("ultra_quest")` | `system: ultra` | 只表示当前 `quest` 叙事状态；失败状态来自真实 `quest/fail` |
| 每日任务 | `festival/YYYY/M` | `system: daily` | 对应原 `quest` 命令显示的扬州武庙二楼祈福 |
| 宝镜任务 | 玩家身上同时具备 `is_task()` 和真实 `task_time` 的物品 | `system: mirror` | 全局宝镜任务榜没有冒充成玩家当前任务；完成次数来自真实 `mirror_count` |

`/adm/daemons/questd` 的全局 `information`、`inherit/misc/quest.c` 的系统任务对象和宝镜全局分布表不是玩家当前任务列表，因此没有下发。任务适配只在父仓库的 `feature/user_gmcp.c` 和 `feature/user_quest.c` 中完成，`mudcore` 保持只读。

聊天审计得到三条真实本地入口：

* `adm/daemons/channeld.c` 的 `do_channel`，当前频道集合直接从现有 `channels` mapping 生成；包括 `chat`、`ic`、`party`、`family` 等频道以及现有的权限/监听频道状态。
* `cmds/std/say.c` 的房间/区域说话。
* `cmds/std/tell.c` 与 `cmds/std/reply.c` 的本地私聊。

结构化消息在这些入口旁路投递，原有格式化文字、频道监听、Telnet 输出和原命令的最终权限检查保持不变。

## GMCP 契约

客户端继续发送标准的 `Core.Hello` 和 `Core.Supports.Set` 字符串数组。阶段 5 新增：

```text
Quest.List 1
Chat.Message 1
Chat.Capabilities 1
```

初始化请求新增：

```text
Quest.List.Get
Chat.Capabilities.Get
```

所有快照都包含 `version`、`snapshot`、`revision`、`sequence`。任务 ID 使用每个 GMCP 会话生成的 opaque `q-...`，聊天消息使用 opaque `m-...`；两者都不暴露 LPC 路径、对象名、方法名或文件名。

### Quest.List

```json
{
  "version": 1,
  "snapshot": 1,
  "revision": 3,
  "sequence": 3,
  "quests": [
    {
      "quest_id": "q-session-0001",
      "system": "quest2",
      "category": "quest2",
      "title": "幻境心魔",
      "detail": "斩杀心魔。",
      "status": "active",
      "level": 100,
      "objectives": [
        { "kind": "kill", "title": "心魔", "current": 3, "required": 20 }
      ]
    }
  ],
  "completed": [],
  "stats": {
    "traditional_completed": 4,
    "mirror_completed": 12,
    "active_count": 1,
    "completed_count": 0
  }
}
```

`detail` 允许有限换行；标题、分类和 objective 文本都有长度上限。奖励文字没有进入结构化快照，避免把 `quest2` 的奖励字符串误当作通用任务规则。

### Chat.Capabilities 与 Chat.Message

能力快照反映当前频道 mapping 和玩家当前可发送权限：

```json
{
  "version": 1,
  "snapshot": 1,
  "revision": 2,
  "sequence": 2,
  "channels": [
    { "id": "chat", "name": "闲聊", "can_send": true },
    { "id": "rultra", "name": "塞外宗师", "can_send": false }
  ],
  "can_say": true,
  "can_tell": true,
  "can_reply": false,
  "max_text": 2048
}
```

消息是事件而不是列表快照：

```json
{
  "version": 1,
  "message_id": "m-session-0001",
  "timestamp": 1770000000,
  "kind": "channel",
  "direction": "in",
  "channel": "chat",
  "sender": { "name": "侠客", "id": "xia" },
  "text": "江湖见。"
}
```

`kind` 为 `channel`、`say`、`tell` 或 `reply`。频道匿名配置（例如谣言）不会把真实玩家 ID 放入 `sender`。消息文本经过 ANSI 清理、控制字符归一化和 2048 字符上限处理。

## 服务端实现

* `feature/user_gmcp.c` 负责只读任务适配、quest2 进度映射、快照 fingerprint/revision、opaque ID 会话、`Quest.List.Get` 和任务轮询。
* 任务状态变化优先通过 `feature/user_quest.c` 的现有 setter 包装触发，传统任务、ultra 和宝镜由 4 秒低频指纹轮询兜底；相同 fingerprint 不重复发送。
* `adm/daemons/channeld.c` 增加只读 `query_web_channel` / `query_web_capabilities`，权限判断复用当前频道的注册、年龄、巫师、帮派、门派、同盟和只听限制，不消耗精气、不改变调频。
* `channeld`、`say`、`tell`、`reply` 在原文字投递后旁路调用 `gmcp_chat_*`。旁路失败被 `catch` 隔离，不会阻断 Telnet 文字。
* `Web.Chat.Send` 只接受固定类型。`say`、`reply` 走原命令；`tell` 只接受当前房间实体快照中的 opaque 玩家实体 ID；频道只接受当前频道 ID，并再次交给 `channeld` 原权限和消耗逻辑。
* Web 会话初始化、`Core.Hello` 和 reconnect 会清理房间、物品、实体、任务、聊天 ID、revision、fingerprint、pending callout 和轮询状态，避免旧会话消息或 ID 穿透。

## Web 客户端实现

`web-client/src/protocol/gmcp/gmcp.ts` 增加完整任务/聊天类型、发送编码器和运行时校验：

* 快照头、revision、sequence 和时间戳必须是有限非负数。
* Quest/Chat 的 ID、频道、状态、方向和 kind 使用白名单；未知字段被忽略，非法记录被丢弃。
* 任务详情、目标、actor、频道名和聊天文本都有独立上限；聊天文本拒绝 CR/LF。
* 重复任务 ID、频道 ID和消息 ID会被去重；Malformed payload 不会抛出异常。

`useMudClient` 维护独立的任务快照、频道能力和约 600 条聊天 ring buffer，并在 reconnect/closed 时清空。`features/quests/QuestPanel.tsx` 和 `features/chat/ChatPanel.tsx` 是独立 feature：任务面板只读展开详情和进度，聊天面板按能力显示频道、说话、私聊、回复和当前在线玩家实体选择。Terminal 继续保留原始命令输入能力。

CSS 继续使用现有 desktop/mobile 断点，新增面板在 390×844、844×390 的空间内使用 drawer、内部滚动和安全区 padding，不改变主终端的 overflow 策略。

## 自动化验证

在本阶段代码完成后执行：

```text
cd web-client
npm test -- --run       # 14 个测试文件、48 项测试通过
npm run build           # tsc --noEmit 与 Vite 生产构建通过
```

新增测试覆盖真实任务快照的字段过滤、非法路径/控制数据、聊天事件与频道能力校验、发送请求白名单，以及任务/聊天面板的展开、空状态、频道发送和 opaque 私聊目标。

## 运行验证

本次在 Windows MSYS2 环境按 `build_msys2.sh` 的 CMake 参数手动补齐 PATH 后，成功构建并启动 FluffOS debug driver（`20260820-dd2a3a14-de945701`）。`config.ini` 的三个监听端口均可用：

* 5566：TCP 连接和传统欢迎文字通过。
* 6666：TCP 连接通过；临时测试角色进入 `/clone/user/user` 后收到 `Server.Hello`、`Quest.List`、`Chat.Capabilities`、`Chat.Message`、`Room.Info`、`Char.Vitals` 等真实 GMCP 包，并执行了 `look`、`quest`、`say`、`quit`。
* 8888：TCP 连接和 WebSocket 握手通过。

临时角色存档已从 `data/login/c/` 与 `data/user/c/` 清理，运行时日志保持为本地忽略文件。随后用两名临时角色完成了第二次 6666 登录：双方均收到 `say`、以 `Room.Entities` 中 opaque `e-...` 定向的 `tell`，以及 `reply`；`direction` 和目标 actor 均正确。quest2 领取/击杀/完成生命周期、真正的浏览器登录和截图自动化仍未在本次环境执行。静态 CSS 已覆盖 desktop、390×844 portrait 和 844×390 landscape 的 drawer、内部滚动、安全区和底部输入布局，后续具备浏览器环境时应按这些视口复测：

1. WebSocket 登录两个角色，确认两端均收到 `Quest.List` 与 `Chat.Capabilities`。
2. 对一个 quest2 任务执行领取、击杀/取物进度、完成和重连，检查 active/completed、revision 单调性和会话 ID 更换。
3. 两角色分别验证 `say`、`chat`、`tell`、`reply`；再验证未调频频道、匿名谣言、无权限频道和原生拒绝文本。
4. 检查 Terminal 文字与结构化 `Chat.Message` 同时存在，确认 CR/LF、任意命令、路径和 LPC 方法不会进入 `Web.Chat.Send`。
5. 在 PC、390×844 portrait、844×390 landscape 检查任务详情、聊天滚动和底部输入框不发生横向溢出。

当前实现没有新增任务规则、奖励、频道或聊天对象，也没有修改 `mudcore`。
