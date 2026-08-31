# 阶段 2.1：GMCP 协议与背包/装备同步加固

## 结论

阶段 2.1 将 GMCP Core 的双向语义拆开，并将背包/装备操作改为基于不透明 `item_id` 的有限动作请求。浏览器不再接收或执行服务器拼出的物品命令字符串；服务端不会接受 LPC 路径、对象引用、任意命令或任意方法名。

本阶段不进入阶段 3，不修改 `mudcore`，原有文字命令仍是游戏规则的权威入口。

## GMCP Core 流程

服务端在 Telnet GMCP 协商成功后发送 `Server.Hello`，而不是 `Core.Hello`：

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

客户端在 GMCP 协商成功后主动发送：

```json
{
  "client": "Yanhuang Web",
  "version": "0.2.1"
}
```

包名为 `Core.Hello`，只表达客户端身份。服务端仅记录允许的 `client` 和 `version` 字段，不将其用作欢迎包。`Server.Hello` 是炎黄的服务端身份与能力包；未知客户端可以安全忽略它。

完整初始化顺序为：

```text
GMCP enabled
  -> Client Core.Hello
  -> Client Core.Supports.Set
  -> Client Char.Vitals.Get / Room.Info.Get / Inventory.Get / Equipment.Get
```

`Core.Supports.Set` 本身只更新订阅记录，不发送 Inventory 或 Equipment。因此一次正常初始化中，每个物品包仅由自己的 `.Get` 发送一次。

## Supports 格式与兼容

新 Web 客户端使用标准 GMCP 字符串数组：

```json
[
  "Char.Vitals 1",
  "Room.Info 1",
  "Char.Inventory 1",
  "Char.Equipment 1"
]
```

服务端也暂时接受阶段 2 的旧 mapping 格式（顶层 mapping，或 `{ "packages": { ... } }`）。它只是兼容入口，后续客户端和测试应使用数组格式，旧格式可在兼容窗口结束后删除。

## Inventory / Equipment 快照与 revision

`Char.Inventory.Get` 只调用 `gmcp_refresh_inventory(1)`；`Char.Equipment.Get` 只调用 `gmcp_refresh_equipment(1)`。`gmcp_refresh_items(1)` 仅用于明确需要两份当前快照的场景，例如安全拒绝一个失效的 Web 物品操作。

每个包独立计算、排序并指纹化自己的内容。规则如下：

- 内容变化：对应 revision 加一，并发送新快照。
- 自动刷新但内容相同：不发送，revision 不变。
- 明确 `.Get` 或失效动作后的状态响应：允许重新发送当前快照，但 revision 不变。

这让 `revision` 只代表新的状态快照，不再代表请求次数或重复初始化。

## Web Item Action

Inventory 与 Equipment 的 `actions` 只包含 action ID，例如：

```json
{ "id": "wield" }
```

前端发出的唯一物品动作包为 `Web.Item.Action`：

```json
{
  "item_id": "i-7f3a10b2-0006",
  "action": "wield"
}
```

允许的 action 为 `look`、`drop`、`eat`、`drink`、`wield`、`unwield`、`wear`、`remove`。客户端只从选中条目的 action ID 构造请求，并拒绝换行、未知 action 和不符合 `i-<session>-<sequence>` 形状的 item ID。

服务端每次处理动作都会：

1. 只在当前人物 `all_inventory(this_object())` 中查找该 session 的 `item_id`；
2. 再验证对象仍直接属于当前人物；
3. 用当前对象状态重新生成 actions，并检查 allowlist；
4. 调用原有命令实现的等价安全入口，如 `do_wield`、`do_wear`、`do_remove`、`do_drop`、`do_eat` 与 `do_drink`；
5. 在失败、过期或异常时输出正常文字提示，并返回当前快照而不增加 revision。

浏览器传来的额外 `command`、路径或对象字段会被忽略，且不会有任何通用 `command()` 或 `call_other()` 调用。这样两件同名、同 `command_id` 的物品仍可按各自 `item_id` 精确查看、装备、卸下或丢弃。

## item_id 生命周期

`gmcp_item_ids` 仍为人物对象的 `nosave` mapping，内部以对象实例名关联不透明 ID。每次构造 Inventory 或 Equipment 快照都会以当前人物直接携带物建立有效集合，并删除已不在人物身上的 mapping 项；装备物仍属于直接携带物，因此不会被误删。

人物对象销毁、角色切换或断线后重建时，`nosave` mapping 会自然释放。人物对象因 netdead 保留时 ID 可以保持；客户端必须把它视为连接作用域的临时值，不能持久化或猜测。

## 刷新去重接口

内容开发者在成功移动、销毁、创建或交易物品后应调用：

- `gmcp_inventory_changed()`：只有背包内容变化；
- `gmcp_equipment_changed()`：只有装备状态变化；
- `gmcp_items_changed()`：两者都变化。

这些接口使用同一个下一 tick 队列。同一个成功命令同时经过 `command_hook` 与标准 `get` / `drop` 特殊钩子时，最多只安排一次必要的快照构造。`gmcp_item_command()` 仅保留给现有 command hook 的动词分类；内容代码不应再调用它。

当前分类为：`get`、`drop`、`give`、`put`、`eat`、`drink`、`buy`、`sell` 只刷新背包；`wield`、`unwield`、`wear`、`remove` 同时刷新背包和装备。

## 兼容性与范围

- 5566、6666 以及所有无 GMCP 的传统客户端不会进入 GMCP 刷新分支，继续使用原文本命令。
- `www/index.html` 保持 legacy 客户端定位；现代客户端更新为 `Web.Item.Action`。
- 阶段 2 的旧 `Core.Supports.Set` object 仍可协商；新的 actions schema 不再包含 `actions.command`。
- 仅同步人物直接携带物及已装备物；容器内部、仓库、交易窗口与物品详情仍使用文本系统。

## 自动测试与实际验证

前端自动测试覆盖客户端 `Core.Hello`、标准 Supports 字符串数组、四个初始化 `.Get` 请求、`Web.Item.Action` 的 allowlist、LPC 路径/换行拒绝、同名 item ID、Inventory/Equipment 面板精确传参，以及原有 Telnet、ANSI、Vitals 和 Room 回归。

本次本机执行 `npm test -- --run`，结果为 9 个测试文件、28 项测试通过。仓库和 PATH 中均没有 FluffOS `driver.exe`，本机也没有 5566、6666、8888 监听且缺少可用的 C/C++ 工具链，故无法在本机启动 `config.ini` 或完成同名物品与重连的端到端验证。具备 driver 的环境应按上述初始化顺序，专门验证第二把同名物品的 `look`、`wield`/`drop`，并复测重连和三端口 Telnet。

## 已知限制

1. `item_id` 仅在人物对象生命周期内稳定，不能用作永久物品主键。
2. 物品动作复用当前标准命令逻辑；未来新增物品规则应先提供对应的安全命令入口，再加入 allowlist。
3. 无 driver 环境无法替代真实 FluffOS 编译与网络回归；发布前必须在项目支持的 driver 上完成端到端检查。
