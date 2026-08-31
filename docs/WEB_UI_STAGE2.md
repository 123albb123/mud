# 阶段 2：背包与装备 Web UI

## 结论

阶段 2 在不改变既有命令、物品对象或传统客户端行为的前提下，为现代 Web 客户端补齐了可版本协商的背包和装备快照。浏览器只显示服务端发出的可用操作，点击后仍发送原有炎黄命令；LPC 不接受网页传入的路径、对象引用或任意方法名。

本阶段不开始阶段 3（技能、战斗、任务或聊天 UI）。`www/index.html` 与 5566/6666 Telnet 使用方式保持不变。

## GMCP 协议

### 能力协商和重新获取

服务端的 `Core.Hello` 现在携带协议与能力版本：

```json
{
  "mud_name": "炎黃群俠傳",
  "protocol": "yanhuang-gmcp",
  "version": 1,
  "supports": {
    "Char.Vitals": 1,
    "Room.Info": 1,
    "Char.Inventory": 1,
    "Char.Equipment": 1
  }
}
```

现代客户端在 GMCP 协商完成、收到 `Core.Hello`、或重连时发送：

```json
{
  "version": 1,
  "packages": {
    "Char.Vitals": 1,
    "Room.Info": 1,
    "Char.Inventory": 1,
    "Char.Equipment": 1
  }
}
```

包名为 `Core.Supports.Set`。服务端记录声明并发送当前物品全量快照；`Char.Inventory.Get` 和 `Char.Equipment.Get` 同样可强制重新获取。未知包仍被忽略，避免影响 Mudlet 等传统 GMCP 客户端。

`Char.Inventory` 与 `Char.Equipment` 都是版本 `1` 的完整快照。`revision` 和 `sequence` 对每个包单调递增（当前两者相同）；前端只接受不早于当前 revision 的结果。FluffOS LPC 的 JSON 真值实际编码为 `0/1`，所以线上的 `snapshot` 和 `equipped` 是 `1/0`；TypeScript 适配层只接受这两种数值或标准布尔值，并统一成布尔值供 UI 使用。

### `Char.Inventory`

```json
{
  "version": 1,
  "snapshot": 1,
  "revision": 8,
  "sequence": 8,
  "items": [
    {
      "item_id": "i-<opaque-session>-0001",
      "name": "长剑",
      "command_id": "long sword",
      "amount": 1,
      "unit": "柄",
      "weight": 1200,
      "category": "weapon",
      "equipped": 0,
      "actions": [
        { "id": "look", "command": "look long sword" },
        { "id": "wield", "command": "wield long sword" }
      ]
    }
  ]
}
```

快照来自当前人物的 `all_inventory(this_object())`，与原 `inventory` 命令的直接携带物范围一致。`amount` 优先取组合物品的 `query_amount()`；分类只取对象已存在的类型能力，当前包括 `weapon`、`armor`、`food`、`liquid`、`container`、`book`、`money`、`charm`、`rune`、`inlaid`、`task` 和 `misc`。

`item_id` 是服务端按人物会话生成的不透明 ID。服务端内部以对象实例名维持映射以保证当前会话稳定，但绝不把 LPC 路径或该映射发送给客户端。同名对象因此能拥有不同的 `item_id`；真实验证中两柄“长剑”分别得到 `i-…-0005` 与 `i-…-0006`。

`command_id` 是原有命令解析器可识别的对象 ID，而不是文件名。动作只会给出原游戏已有命令：查看、丢弃、吃、喝、装备武器、穿戴、卸下武器、脱下。项目没有通用的 `use` 命令，因此协议不会虚构“使用”动作。

> `item_id` 用于数据同步、React key 和同名记录区分；它不会成为新的对象操作接口。两个同名物品的最终命令仍遵从既有文本解析器的选择规则。这刻意保持玩法兼容；若未来要实现逐件精确操作，必须由玩法维护者单独设计可审计的原生命令语法，不能暴露对象引用。

### `Char.Equipment`

```json
{
  "version": 1,
  "snapshot": 1,
  "revision": 22,
  "sequence": 22,
  "slot_order": ["weapon", "secondary_weapon", "head", "neck", "cloth", "armor", "surcoat", "waist", "wrists", "hands", "finger", "boots", "feet", "shield", "charm", "bandage"],
  "slots": [
    {
      "slot": "weapon",
      "item_id": "i-<opaque-session>-0005",
      "name": "长剑",
      "command_id": "long sword",
      "type": "weapon",
      "actions": [{ "id": "unwield", "command": "unwield long sword" }]
    }
  ]
}
```

槽位来自 `feature/equip.c` 与 `include/armor.h` 的真实状态：主/副手来自 `query_temp("weapon")` 与 `query_temp("secondary_weapon")`，防具来自 `armor_type`。`feet` 与 `bandage` 保留给仓库已有的旧对象。服务端只发送实际占用槽；客户端按 `slot_order` 渲染，因此未占用位置明确显示“未装备”。

## 自动刷新与兼容性

- 成功执行 `get`、`drop`、`give`、`put`、`eat`、`drink`、`wield`、`unwield`、`wear`、`remove`、`buy` 或 `sell` 后，服务端下一驱动 tick 重新生成快照。延后一个 tick 能正确处理被销毁、拆分或移动的对象。
- `get.c` 与 `drop.c` 的成功移动点也调用该刷新入口。这覆盖客店/茶房 NPC 用 `add_action("drop")` 接管命令、再转调标准命令的传统实现；指纹比较确保同一状态不会重复推送。
- 只在对应数据改变时发送该包的完整快照。例如捡取食物只更新 Inventory；穿脱和装备武器同时更新 Inventory 与 Equipment。
- netdead 重连在 `exec()` 完成后重新发送 `Core.Hello` 和物品完整快照。React 状态在 `connecting`、`reconnecting`、`closed` 以及手动连接前清空；Telnet GMCP 协商成功也主动重新请求状态，避免角色切换或重连时显示旧物品。
- 无 GMCP 的 5566/6666 客户端不会进入 `has_gmcp()` 分支，继续使用原文字输出和原命令。GMCP 客户端也可继续只请求旧有的 Vitals/Room 包。

## Web 客户端

- `InventoryPanel` 显示名称、数量/单位、分类、重量和“已装备”标记；选择一条记录后只显示该记录服务端授予的动作。
- `EquipmentPanel` 使用服务器的槽位顺序，展示真实装备与空槽；选中已装备物后只提供原有卸下/脱下/查看命令。
- 桌面端在左侧人物区提供“行囊”“装备”入口，在主区右侧以可关闭抽屉显示；移动端抽屉覆盖主区，底部命令栏保持可见。
- 协议适配器严格验证版本、快照头、数值和动作换行符；未知字段忽略，畸形记录过滤，未知 GMCP 包不影响终端。

## 安全边界

- 快照仅遍历当前人物直接携带物与该人物自己的装备临时状态。
- `item_id` 不透明、会话作用域，不暴露路径、内部变量、对象引用或管理数据。
- UI 不构造 LPC 调用；`actions.command` 仍经前端换行检查后作为单条传统命令发送。
- LPC 按现有物品能力决定动作，原命令自身仍负责权限、房间规则、重量、装备限制、物品销毁和失败文本。

## 验证记录

在 Windows 上使用官方 FluffOS `v2026.0801.0` 运行 `config.ini`，三个监听端口均实际可用：5566、6666、8888。

| 项目 | 结果 |
| --- | --- |
| 真实 Telnet + GMCP 协商 | 收到 `Core.Hello`、`Char.Vitals`、`Room.Info`、`Char.Inventory`、`Char.Equipment` |
| 初始/空装备表达 | 初始衣物显示 `boots` 与 `cloth`；未占用槽由 Web UI 显示“未装备” |
| 同名物品 | 兵器库两柄“长剑”获得不同不透明 `item_id` |
| 自动同步 | 实测拿取、NPC 接管的掉落、再次拿取、吃掉花生、穿/脱初始防具、`wield`/`unwield` 长剑；对应 revision 与完整快照递增 |
| 重连 | netdead 重连后重新收到 `Core.Hello` 和 Inventory/Equipment 全量快照 |
| 前端单元测试 | `npm test`：9 files、26 tests 通过，含同名 ID、空快照、未知字段、畸形记录、物品/装备动作 UI |
| 生产构建 | `npm run build` 通过，产物写入 `www/app/` |
| 浏览器视觉检查 | 桌面端行囊抽屉可开关；390×844 移动视口无横向溢出，抽屉位于主区内，底部命令栏完整可用 |

测试使用本地临时人物和临时配置，提交前会停止驱动并清理其保存文件与日志，不纳入仓库。

## 已知范围与阶段 3 前置建议

1. 仅同步直接携带物；容器内部、仓库、交易窗口及物品详细属性仍保持文本命令，需独立定义权限和容量语义后再扩展。
2. 没有引入“网页专用执行命令”，故不会绕过原文字解析；同名物品的精确单件动作是未来协议设计议题。
3. 当前刷新覆盖背包/装备相关标准命令和标准 get/drop 被 NPC 转调的路径；自定义玩法若直接移动物品，应在成功后调用 `gmcp_item_command()` 或刷新入口。
4. 阶段 3 可基于同一版本/快照约定评估技能、状态效果、战斗目标与任务数据，但不应把文本输出当成结构化协议来源。
