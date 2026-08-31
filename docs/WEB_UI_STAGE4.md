# Web UI 阶段 4：战斗、技能与实时状态

本阶段在阶段 3 的 GMCP/WebSocket 终端上增加实时人物状态、战斗状态、技能列表与受控动作。Web 端只展示服务端快照并提交白名单 ID；战斗公式、门派限制、内力消耗、冷却和 `busy` 仍由炎黄 LPC 原命令决定。

## GMCP 快照

所有新增快照使用 `version: 1`、`snapshot: 1`、`revision`、`sequence`。客户端只接受符合 schema 的 JSON；未知字段会被忽略，缺少必需字段或类型错误的包会被丢弃。

### `Char.Status`

`busy`、`fighting`、`can_act`、`ghost`、`unconscious`、`anger`、`food`、`water`、`exp`、`potential`、`weapon`、`enabled`、`prepared`。`weapon` 只包含可公开的名称、技能种类和技能 ID；启用/准备列表复用玩家自己的技能 ID。它不包含 NPC 或内部 combat mapping。

### `Combat.State`

包含 `in_combat`、`busy`、`can_act`、`primary_target` 和 `targets`。目标记录为 `{ entity_id, name, relation, health }`，其中 `relation` 是 `fight` 或 `kill`，`health` 只使用 `healthy`、`injured`、`badly_injured`、`near_death`、`unconscious`、`unknown`。目标 ID 直接复用 `Room.Entities` 的 `entity_id`；实体离开房间或销毁后下一次快照会清除它。

### `Char.Skills`

从玩家真实 `query_skills()`、`query_learned()`、`query_skill_map()`、`query_skill_prepare()` 生成：

```json
{
  "skill_id": "taiji-quan",
  "name": "太极拳",
  "level": 150,
  "progress": 42,
  "type": "martial",
  "is_basic": false,
  "enabled_for": ["unarmed"],
  "prepared_for": ["unarmed"],
  "enable_slots": ["parry", "unarmed"]
}
```

`skill_id` 是玩家原命令使用的公开 ID；不会发送 LPC 文件路径、继承对象路径或源码模块名。基础技能由 `MASTER_D->query_valid_types()` 识别，不写死门派。

### `Combat.Actions`

动作由根权限 `/adm/daemons/gmcp_actiond` 根据当前已激发技能的真实动作目录发现。守护进程只返回安全的方法名，玩家对象只向客户端发 `action_id`、`label`、`kind`、`requires_target`，不发送目录或路径。当前实现的 ID 形式为：

* `perform:<slot>:<method>`
* `exert:force:<method>`
* `fight`、`kill`

动作快照只覆盖可可靠枚举的招式；原 `perform`/`exert` 入口仍会再次判断技能条件和资源，因此显示动作不等于绕过游戏规则。

## 受控动作

`Web.Skill.Action` 只允许 `enable` 与 `prepare`。服务端验证玩家确实拥有 `skill_id`，对 `enable` 验证固定用途列表并调用 `valid_enable()`；随后仍由原 `/cmds/skill/enable` 或 `/cmds/skill/prepare` 作为最终规则入口。

`Web.Combat.Action` 只接受当前 `Combat.Actions` 快照中的 `action_id`。`fight`/`kill` 必须附带当前房间的 `entity_id`，服务端重新查找实体、可见性、NPC 类型和当前允许动作；`perform`/`exert` 从受控 ID 拆出 slot/method 后调用原命令入口，不接受任意 command、LPC path、method 或客户端目标文本。服务端再次检查 `busy`，按钮禁用只是提示而不是权限边界。

原战斗文字始终继续进入主终端；结构化快照只负责辅助状态和按钮。

## 刷新、节流与生命周期

`gmcp_vitals_changed()`、`gmcp_status_changed()`、`gmcp_combat_changed()`、`gmcp_skills_changed()`、`gmcp_combat_actions_changed()` 通过 pending 标记与下一 call-out 合并同一 tick 的变化，再用 fingerprint 去重。伤害、治疗、昏迷、复活、死亡、`busy` 开始、战斗目标增删、移动和技能变化从公共 feature hook 触发，不在 NPC 或门派技能文件中散落发送。

Vitals/Status/Combat 使用 1 秒低成本兜底刷新；事件触发会立即排队刷新。Skills 没有高频轮询，只在学习、提升、enable、prepare 或映射变化时刷新。Room.Entities 仍保留兜底轮询，但从阶段 3 的 1 秒改为 4 秒；移动、实体变化、get/drop 等事件优先即时刷新。

没有实现 `Combat.Event`：当前战斗系统没有稳定的结构化 source/target/damage 事件来源，因此没有解析战斗文字，也没有向 Web 暴露精确 NPC HP、内力、技能或 AI 状态。

## UI

桌面端在角色区域显示状态芯片、当前目标、`fight`/`kill`、服务端下发的招式与内功动作；技能抽屉按基础技能/特殊武功分组并显示启用/准备状态。所有按钮使用约 44px 触控尺寸。移动端保留终端和命令输入可见，战斗面板可折叠、目标和动作纵向排列，不产生横向溢出。

## 验证记录

* `npm test -- --run`：12 个测试文件、39 个测试通过。
* `npm run build`：TypeScript 检查与 Vite 生产构建通过。
* FluffOS debug driver 在 5566、6666、8888 同时监听；传统登录/移动/`skills`/`look` 路径继续工作。
* 原生 GMCP 客户端登录后收到 `Server.Hello`、`Char.Vitals`、`Char.Status`、`Char.Skills`、`Combat.State`、`Combat.Actions`、`Room.Info`、`Room.Entities`，并确认动作 payload 没有 `slot`/`method` 内部字段或 LPC 路径。
* 临时人物实际拥有 `taiji-quan`、`jiuyang-shengong`；通过 `Web.Skill.Action` 完成 `enable taiji-quan → parry` 与 `prepare taiji-quan`，收到递增的 `Char.Skills` revision；文本 `enable force jiuyang-shengong` 后动作目录实际发现 28 个 `perform/exert` ID。
* 通过房间实体 ID 对普通 NPC 实际执行 `fight`，`Combat.State.in_combat` 变为真；对欧阳克实际执行 `kill`，快照中的目标复用同一 entity ID 且 `relation` 为 `kill`。fight 被 NPC 拒绝时保持原游戏规则，不伪造战斗状态。
* 最近一次驱动回归中，`kill` 进入战斗后连续收到 `Char.Vitals` revision 2–6，确认战斗期间的实时生命快照会更新。
* 单人房间存在多个实体、并持续接收战斗 Vitals 更新时，未变化快照不会因 1 秒兜底刷新增加 revision；`Room.Entities` 的轮询保持为 4 秒，变化仍由事件立即推送。
* C# WebSocket 客户端已完成 8888 的真实握手、登录和 GMCP 包接收（8/8 阶段包）；浏览器端另做了 390×844 移动布局 smoke check。
* 传统端口 5566/6666 的 `fight`、`kill`、`perform`、`exert`、`enable`、`prepare`、`hp`、`skills` 未被 Web 层替换。

## 已知限制与阶段 5 建议

招式能否成功仍取决于原命令的战斗目标、准备状态、内力和等级；第一版动作发现不尝试静态推导所有条件。`Combat.Event`、精确伤害动画、复杂目标选择和多目标策略留待后续。阶段 5 可在保留当前安全边界的前提下增加结构化 action result/request_id、战斗日志时间线、更多明确的服务端事件源和可测试的动作条件说明。
