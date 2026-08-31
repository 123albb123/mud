# Web UI Stage 3：房间实体与交互

## 范围

Stage 3 在既有 `Server.Hello`、`Room.Info`、`Char.Inventory` 和
`Char.Equipment` 快照之上，增加服务端驱动的 `Room.Entities`。实体列表来自
`environment(player)` 的真实 LPC 对象，不从 `look` 文本反解析；前端只展示服务端
已经确认可见的对象。

## GMCP 数据契约

客户端声明：

```text
Core.Supports.Set ["Char.Vitals 1", "Room.Info 1", "Room.Entities 1",
                  "Char.Inventory 1", "Char.Equipment 1"]
Room.Entities.Get
```

服务端发送 `Room.Entities` 快照：

```json
{
  "version": 1,
  "snapshot": 1,
  "revision": 2,
  "sequence": 2,
  "entities": [
    {
      "entity_id": "e-3f874b3f-0001",
      "type": "npc",
      "name": "店小二",
      "title": "客店伙计",
      "actions": [{"id": "look"}, {"id": "ask"}, {"id": "give"}]
    }
  ]
}
```

`type` 当前为 `npc`、`player`、`item`、`corpse` 或兼容用的 `unknown`。客户端会
拒绝路径样式、换行、非法类型、非法动作和重复 `entity_id`；未知字段会被忽略。

`entity_id` 是服务端生成的 opaque ID，格式为 `e-<随机会话>-<序号>`。它只在
协议层传递，绝不包含 LPC 路径；服务端内部仍以对象的 `file_name()` 映射到当前
会话 ID。对象离开当前房间或不再可见时，映射会在下一次快照清理。客户端不能把
实体名称或序号当作授权凭据。

## 动作与安全边界

服务端依据对象类型和实时状态计算 `actions`：

- 所有可见实体：`look`；地面物品/尸体：满足 `no_get`、活体检查后才有 `get`。
- NPC/玩家：按 `can_speak`、`accept_talk` 和生存状态提供 `ask`、`talk`、`give`。
- 非 `no_fight` 房间的活体 NPC：提供 `fight`、`kill`（尸体不会提供 `kill`）。

前端动作通过 `Web.Entity.Action` 发送：

```json
{"entity_id":"e-3f874b3f-0001","action":"ask","text":"掌柜在哪里？"}
```

给予使用独立的 `Web.Entity.Give`，避免把行囊物品 ID 混入文字动作：

```json
{"item_id":"i-3f874b3f-0002","entity_id":"e-3f874b3f-0001"}
```

服务端在执行前重新检查对象仍在同一房间、对当前玩家可见、ID 映射仍然有效，
并再次检查动作白名单和实时动作条件；请求中的文字拒绝换行且限制 200 字符。过期
或伪造 ID 只会安全失败并进行去重后的实体刷新，不会调用任意 LPC 路径或崩溃。
实际执行复用 `look_living`、`look_item`、`do_get`、`do_talk`、`do_ask`、
`do_fight`、`do_kill` 和 `do_give_to`，因此文字命令与 Web 动作保持同一套规则。

## 生命周期与客户端界面

- 玩家移动后立即请求 `Room.Info`，并排队刷新 `Room.Entities`。
- 拾取/丢弃、战斗状态变化和给予物品会触发相应实体/行囊刷新。
- 玩家支持 `Room.Entities` 后，服务端每秒进行一次轻量指纹检查，覆盖 NPC/玩家
  进出、生成和销毁等没有经过玩家移动的生命周期变化。内容未变化时不会发送重复
  快照，`revision` 只在内容变化时递增。
- `web-client` 在“附近人物”和“地面物品”两个分组中显示实体；选择实体后展示
  44px 触控目标的动作按钮。询问/交谈有受限文字输入，给予从当前 `Char.Inventory`
  选择 `item_id`。桌面端显示内嵌详情，窄屏使用带安全区底部间距的 modal sheet；
  本阶段不加入战斗面板或客户端战斗状态机。

## 验证

```text
cd web-client
npm test -- --run
npm run build
```

真实 FluffOS 驱动回归覆盖 5566、6666、8888：登录/重连、Server.Hello 握手、
`Room.Entities` 初始快照、实体精确查看、移动后的房间和实体刷新、快照去重以及
过期动作安全失败。扬州客店可看到周不通、北丑、店小二和留言板；移动到北大街后
实体列表只保留欧阳克，旧实体 ID 不再可用。

## 已知限制与 Stage 4 建议

对象生命周期刷新目前以 1 秒轮询兜底，极短暂的生成/销毁可能在一个轮询周期内才
显示；复杂容器内物品仍需后续独立的容器实体协议。Stage 4 可考虑把服务端动作结果
做成结构化响应、增加可选的区域/距离字段和可取消的战斗/技能 UI，同时继续保持
服务端实时授权和 opaque ID 约束。
