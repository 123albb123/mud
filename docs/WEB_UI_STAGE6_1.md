# Web UI 阶段 6.1：真实已探索地图 / 会话探索图

状态：Stage 6.1 实现完成；探索图只存在于当前连接会话，不进入存档、数据库或浏览器持久存储。

## 1. Stage 6.1 目标

Stage 6/6.0.1 已冻结的 `Room.Map`、`Web.Room.Move`、opaque `room_id`/`exit_id`、当前出口 overlay、Area 支持和原版移动逻辑继续保留。本阶段新增“玩家实际走过哪里，地图就逐步记录哪里”：节点来自真实 `Room.Info`/`Room.Map`，路线只来自服务器确认的真实移动事件。

## 2. 为什么不能比较 Room.Map 前后直接猜边

上一帧在 A、下一帧在 B，并不能证明 A 与 B 有普通出口。NPC/脚本传送、死亡回城、剧情移动、随机移动和管理员移动都会改变 `environment`。因此客户端不比较快照猜边，也不从 Terminal 文本解析房间关系。

## 3. Room.Map.Transition 协议

服务端新增单向事件 `Room.Map.Transition`，当前 payload 为：

```json
{
  "version": 1,
  "sequence": 12,
  "from_room_id": "r-session-001",
  "to_room_id": "r-session-002",
  "command": "north",
  "label": "北",
  "kind": "move",
  "area": true
}
```

`area` 仅在 Area 移动时附带。payload 不包含 LPC 路径、文件名、对象 ID、函数名或 daemon 路径。`Server.Hello` 与前端 `Core.Supports.Set` 都声明 `Room.Map.Transition 1`；没有 `Web.Room.Transition`。

## 4. Transition 什么时候产生

`cmds/std/go.c` 在执行原版 Area/普通房间移动前记录旧 opaque 房间 ID，原版 `valid_leave`、`area_move`、`me->move` 和消息逻辑完成后，才调用 `gmcp_map_transition`。服务端再次确认当前环境、旧 ID 属于本 GMCP session、ID 已变化，并对普通房间校验实际出口目标；确认成功才递增独立 sequence 并发送事件。原版移动逻辑没有被重写。

## 5. 为什么传送不产生普通 edge

普通房间只有“声明的出口目标”与移动后的真实对象一致时才允许生成 edge。`valid_leave` 直接把玩家送到其他房间、脚本 `move()`、死亡或启动出生等非普通 go 改变环境时，不匹配普通出口，因此不会产生 A→Z 的假道路。随后到达房间的 `Room.Info`/`Room.Map` 仍会把 Z 标记为 visited；如果没有 Transition，就没有普通连线。安全传送路径未在本轮额外找到，客户端自动测试覆盖该规则。

## 6. Terminal 移动如何记录

玩家在原版命令栏输入 `north`、`south`、`east`、`west`、`go north`、`up`、`down`、`in`、`out` 等命令时，仍走原版命令处理。成功改变真实房间后由 `go.c` 统一发送 Transition；失败、条件不满足或仍停留原房间时不发送。Terminal 仍是原版文字输出的权威来源。

## 7. Web.Room.Move 如何记录

地图按钮仍只提交当前快照签发的 opaque `exit_id`。服务端动作处理器重新校验 session、当前房间、revision、出口记录和真实命令，再复用原版 `go`。成功后与 Terminal 共用同一个 `gmcp_map_transition`，因此两种入口写入同一张 graph；点击本身不会 optimistic 移动指针。

## 8. Area 如何记录

Area 使用同一个实际 Area 对象加当前坐标生成 session opaque `room_id`，不同坐标就是不同节点。`do_area_move` 成功返回后，旧坐标 ID 与新坐标 ID 变化即可生成 `area: true` 的 Transition；失败或越界不生成。客户端以 opaque ID 识别节点，不依赖公开 x/y 建立身份。

## 9. explored graph 数据模型

`web-client/src/features/map/exploredMap.ts` 定义 `ExploredMapGraph`：

- `nodes[room_id]`：名称、区域、首次/最近到访时间和 `visit_count`。
- `edges[edge_id]`：`from_room_id`、`to_room_id`、command、label、首次时间和 traversals。
- `visited_order`、`current_room_id`、`last_transition_sequence`。
- `pending_transitions`：等待两端 Room.Info/Room.Map 元数据到达的事件。

节点键永远是 opaque `room_id`，不是房间名称。

## 10. visited 与 unexplored 的区别

收到真实当前 `Room.Info` 或 `Room.Map` 就把当前房间加入 visited；重复轮询同一房间不会重复创建节点。当前 `Room.Map.exits` 只是实时 overlay：已解析但尚未到达的目标可显示为空心节点，未解析/条件出口显示“尚未探索”。它们都不会提前写入 explored edge。

## 11. 单向 edge

Transition A→B 只建立 A→B。客户端不根据方向或 `query_reverse` 自动创建 B→A；只有以后真实走出 B→A 才建立反向 edge。重复通过相同的 `from + command + to` 更新同一条 edge 的 `traversals`，不会复制路线。

## 12. graph layout

`mapLayout.ts` 使用 deterministic 局部布局，不使用世界坐标或写死城市路线。north/south/east/west 和斜向命令使用方向 delta；northup 等保留方向并带层级；up/down 使用 z 投影；enter/out 和其他特殊命令使用稳定的特殊槽位。布局从真实 explored edges 出发，不扫描房间目录。

## 13. collision 处理

不同 room_id 即使理论投影位置相同也不会合并。布局对已占用位置使用确定性的最小间距与 collision offset；同一对节点的多条真实有向边使用 lane 偏移，避免双向箭头和 label 完全重叠。布局调整只改变视觉位置，不改变关系。

## 14. 多连通分量

没有 Transition 的传送到达会产生新的 visited 节点；该节点与旧 graph 保持独立 component。布局为每个连通分量分配稳定的横向间隔，绝不为了视觉连续性自动连接传送前后房间。

## 15. PC 地图

桌面地图采用 React + SVG：当前节点为青色，已到访节点为暖金色，真实 Transition 为实线箭头，当前 Room.Map overlay 为虚线/空心节点。点击已探索节点打开简短房间、区域和到访次数详情；当前真实出口仍在下方列表中，动态出口继续禁用。

## 16. 手机地图

390×844 使用独立的紧凑布局：画布占主要区域，当前出口列表可横向浏览，底部五项导航保留且不产生 body 横向溢出。844×390 横屏使用更紧凑的 header、底栏、toolbar 和 canvas 高度，保证地图主区域与控件可见。

## 17. pan / zoom / 定位当前

画布支持单指/鼠标拖动、滚轮缩放、`缩小地图`/`放大地图`、`定位当前` 和 `适应地图`。zoom 被限制在 0.5～2.0，并对非有限值回退到 1；真实房间变化时自动跟随一次，普通 4 秒 polling 不会持续抢回用户手动查看的位置。

## 18. session 生命周期

graph 放在 `useMudClient` 的 React 状态中，而不是 `MapView` local state，因此页面切换不会丢失。connecting、reconnecting、closed 和新的 connect 都清空 nodes、edges、pending transitions 与 sequence；服务端 session room/exit ID 和 Transition sequence 也在 GMCP reset 时重置。没有 save、数据库或 localStorage 持久化。

## 19. Runtime E2E

真实 FluffOS 调试实例监听 8888，临时普通角色通过 WebSocket 完成登录。最终生产包中，混合 Terminal 与地图按钮实际探索了 17 个真实房间，地图显示 `17 房间 · 32 路线`；路线包含普通 north/south/east/west、up/down、Area 网格移动，以及中央广场的 `in` 进入树洞和 `out` 返回。命令行移动和地图按钮共享同一 graph，回到已到访房间不会增加重复节点；Area 返回已到坐标也复用原 opaque room ID。

## 20. Telnet 回归

使用普通 Telnet 连接分别检查 5566 GBK 与 6666 UTF-8 的登录、`look`、`north`、`south`、`east`/`west` 和 `quit`。两端中文房间文字与原版移动保持正常；不支持新 GMCP 事件的客户端不需要发送或理解 Transition，游戏仍可运行。

## 21. tests

`npm test -- --run` 当前为 17 个测试文件、70 个测试全部通过，覆盖：

- Transition 正常/非法 version、sequence、opaque ID、路径和控制字符。
- pending 与乱序事件、重复 sequence、重复访问、重复边、单向反向边和传送无边。
- 当前节点、已确认边、未探索出口、条件/动态出口、断开空状态、zoom、pan、节点详情和无 optimistic edge。
- 20、100、500 节点有限坐标，以及投影碰撞和 up/down 层级。

## 22. build

`npm run build` 的 TypeScript 检查与 Vite production build 均通过，并更新 `www/app/index.html` 与 `www/app/assets`。轮询仍为 4 秒，没有增加历史 graph polling。正式代码未引入 Leaflet、Mapbox、Google Maps 或重量级 graph engine。

## 23. 性能结果

前端测试实际构造并布局 20、100、500 节点，所有节点和 bounds 坐标均为有限值；布局使用 `useMemo`、稳定 room ID key 和简单 SVG transform，鼠标移动只更新 viewport pan，不重建 graph 数据。500 节点作为本地性能回归样本通过，生产 session 仍只累积玩家真实走过的有限节点。

## 24. 已知限制

本阶段不扫描世界、不持久化地图、不做跨 session room identity、不做自动寻路或地点搜索。特殊脚本移动只能可靠地记录“到达节点”，不能在没有服务器 Transition 时推断来源边；超密集的大型 graph 仍可能需要用户使用适应地图/拖动查看。未专门寻找破坏性或高风险传送场景，传送无普通边由服务端守卫和客户端自动测试保证。

## 25. 下一阶段建议

后续阶段再决定是否设计经过用户确认的持久探索记录、跨 session 身份模型或更强的地图布局。本阶段明确不提前实现 save/localStorage 世界地图、全世界扫描、自动寻路、最短路径、一键移动、任务/NPC 导航或地点搜索。
