# 阶段 4.1：战斗动作完整性与技能能力加固

本阶段在 `WEB_UI_STAGE4.md` 的状态快照和动作白名单上补齐目标语义、原生动作执行和准备能力。Web 端仍然是原生炎黄命令的受控入口；战斗公式、门派限制、内力消耗、冷却、目标关系和 PvP 规则继续由 LPC 原实现决定。本阶段不实现阶段 5 的战斗事件时间线或复杂策略层。

## 动作目标契约

`Combat.Actions` 的动作记录保留 `requires_target`，并增加以下字段：

```json
{
  "action_id": "perform:unarmed:ji",
  "kind": "perform",
  "label": "太极拳·ji",
  "requires_target": false,
  "target_mode": "optional",
  "target_types": ["npc", "player"]
}
```

`target_mode` 的含义是：

| 模式 | Web 请求 | 界面行为 |
| --- | --- | --- |
| `none` | 不允许 `target_entity_id` | 不显示目标选择器 |
| `optional` | 可省略或提交一个实体 ID | 允许“不指定目标”或选定目标 |
| `required` | 必须提交一个实体 ID | 未选目标时禁用按钮 |

服务端对旧快照没有 `target_mode` 的情况按 `requires_target` 兼容；客户端对缺少新字段的记录也采用同样的保守推断。已知的自用 `exert` 方法标记为 `none`，已知要求对象的 `lifeheal`、`shot` 标记为 `required`；`suck` 无目标时沿用原生当前敌人语义，因此保持 `optional`，未知技能动作也保持 `optional`，避免猜测玩法规则。

## 安全执行边界

`Web.Combat.Action` 只接受白名单中的 `action_id` 和可选的 `target_entity_id`。服务端在执行前重新查找当前动作和目标：

* 实体 ID 必须是当前会话生成的 `e-...` 不透明 ID；对象必须仍在玩家当前房间、可见、存活、不是尸体，类型只能是 NPC 或其他玩家，且不能是玩家自己。
* `fight` 和 `kill` 都重新检查实体动作；因此可见玩家也遵循原生 PvP 规则，传统 `fight`/`kill` 行为不变。
* `target_name`、`target`、`command`、`command_id`、LPC 文件/对象路径、方法名等字段会直接拒绝。不存在通过文本名称、重复实体名称或任意命令注入的旁路。
* 所有资源、`busy`、准备、激发、战斗关系和门派检查仍由原 `/cmds/skill/perform`、`/cmds/skill/exert`、`fight`、`kill` 路径执行。失败时优先返回原生 `notify_fail` 文本，而不是伪造成功结果。

`perform`/`exert` 的 Web 入口分别是原命令中的 `do_perform_target` 和 `do_exert_target`。它们只增加已验证对象的传递，最终仍调用 `inherit/skill/skill.c` 的原动作解析器；无目标时保留原生默认目标语义。这样既支持能接收对象参数的招式，也不复制技能文件中的战斗逻辑。

动作快照在 `busy` 开始时排队刷新，并继续使用 pending 标记和 fingerprint 去重；移动、战斗关系或技能映射变化也会触发相应刷新。高频兜底轮询没有扩大。

## 准备能力

`Char.Skills` 新增 `prepare_slots`。服务端从 `/cmds/skill/prepare` 的真实 `valid_types`、当前 `skill_map`、已准备组合和技能的 `valid_combine()` 计算可用槽位，不写死“剑法/内功”等推断：

* 拳脚类基础槽可准备时返回对应槽位（例如太极拳返回 `unarmed`）。
* 当前映射或组合不满足原生 `prepare` 条件时返回空数组（例如普通剑法、内功不显示准备按钮）。
* 已准备槽位会保留在能力结果中；组合达到原生上限或不兼容时不会继续推荐。

前端只在 `prepare_slots` 非空时显示“准备”，动作完成后依靠新的技能快照更新组合状态。旧服务端缺少该字段时客户端按空数组处理，因此不会把所有特殊武功误认为可准备。

## 前端交互

目标选择器使用实体 ID 而不是名称，默认优先 `Combat.State.primary_target`，再选择第一个符合 `target_types` 的 NPC/玩家。可选动作可以清空目标；必选动作必须选择目标；自用动作不渲染选择器。请求编码器只生成：

```json
{"action_id":"kill","target_entity_id":"e-session-0001"}
```

不会把 `target_mode`、内部 slot/method 或任意文本拼进网络请求。

## 验证记录

自动化和构建：

* `npm test -- --run`：12 个测试文件、41 项测试通过。
* `npm run build`：TypeScript 检查和 Vite 生产构建通过。

FluffOS Windows debug driver 实测同时监听 5566、6666、8888。WebSocket `telnet` 客户端完成 GMCP 协商、登录和初始 `.Get` 请求，并收到 `Char.Vitals`、`Char.Status`、`Char.Skills`、`Combat.State`、`Combat.Actions`、`Room.Info`、`Room.Entities`、`Char.Inventory`、`Char.Equipment`：

* `Char.Skills` 的太极拳返回 `prepare_slots: ["unarmed"]`，基础剑法/内功没有伪造准备能力。
* 在允许战斗的房间，使用 `Room.Entities` 的精确 ID 调用 Web `fight`（NPC 拒绝切磋时保留原生拒绝文本）和 `kill`；`kill` 成功后 `Char.Status.fighting` 与 `Combat.State.in_combat` 变为真，目标关系为 `kill`，且目标 ID 不变。
* 对同一目标提交 `perform:unarmed:ji`，原生太极招式文本正常进入终端并产生攻击结果；无目标 `exert:force:dispel` 也走原生路径并成功返回。
* 战斗期间生命快照持续更新，未变化的兜底快照不会无故增加 revision；传统 Telnet 命令和端口路径未被替换。

## 限制与后续

部分旧招式函数只声明 `perform(object me)`，其原生实现会从当前敌人选择对象；Web 仍传递并校验目标 ID，但这类招式遵循原生当前敌人语义。动作发现对未知条件保持 `optional`，不会静态猜测每个技能的资源或战斗前置。结构化伤害事件、动作结果 `request_id`、复杂多目标策略和战斗时间线留待阶段 5。
