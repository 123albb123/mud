# Web UI 阶段 6：真实房间地图基础

状态：Stage 6.0.1 实现完成，测试与真实运行验收完成。

本阶段只建立“当前真实房间 + 服务器实际可见的邻接出口”的地图基础，不建立全世界地图、假路线或客户端寻路系统。所有地图数据必须来自当前 LPC 环境对象、真实 `exits`/区域坐标和原版移动规则。

## 1. 实现前审计

本阶段开始编码前已阅读并核对以下内容：

- `AGENTS.md`：仓库目录、LPC 风格、FluffOS 调试和验收方式、`mudcore` 不修改约束。
- `docs/WEB_UI_STAGE5_2.md`：5.2 的视觉基线、现有 GMCP 状态、冻结范围和旧地图占位行为。
- `docs/LPC_Language_FluffOS.md`：本项目采用的 LPC/FluffOS 类型、`find_object`、`function_exists`、`catch`、mapping 和 JSON 规则。
- `feature/user_gmcp.c`：当前 `Room.Info`、GMCP 会话 ID、快照 revision/sequence、支持声明、结构化动作校验和重连清理。
- `feature/move.c`：普通 `move` 成功后的 `Room.Info`/实体/状态同步钩子。
- `cmds/std/go.c`：普通房间和区域房间的实际移动入口。
- `inherit/room/room.c`、`mudcore/inherit/area/area.c`、`mudcore/inherit/area/map.c`：房间、虚拟房间和区域坐标模型。
- `web-client/src/protocol/gmcp/gmcp.ts`、`web-client/src/stores/useMudClient.ts`、`web-client/src/features/room/RoomPanel.tsx`、`web-client/src/app/App.tsx` 及其测试：现有 Web GMCP 解码、状态 store、出口按钮、地图占位和帮助文案。

### 1.1 现有移动链路

普通房间的 `cmds/std/go.c` 先读取当前环境的 `exits`，再调用 `env->valid_leave(me, dir)`。通过后才按真实出口值处理 `object`、LPC 路径字符串或区域 mapping，并调用原版 `me->move(obj)`/`area_move`。因此地图动作不能直接接受浏览器传来的方向、目标路径或方法名；它只能引用服务器此前为当前快照签发的出口 token，服务器再调用原版命令。

区域房间不一定有普通 `exits` mapping。`mudcore/inherit/area/map.c` 的 `query_exits(x, y)` 根据真实区域边界和 `is_move` 返回邻接方向，`moveObject` 负责守卫、区域出口和坐标变更；`cmds/std/go.c::do_area_move` 负责战斗阻挡、消息、进入坐标的 `init` 和跟随逻辑。普通 `feature/move.c` 的 GMCP 钩子不会覆盖区域内坐标移动，所以阶段 6 必须在区域移动成功路径补发房间/地图同步。

### 1.2 真实房间样本

审计过的样本及其对地图的影响如下：

| 样本 | 真实结构 | 地图处理 |
| --- | --- | --- |
| `d/zhongzhou/shizhongxin.c` | 普通静态房间，四个 `__DIR__` 字符串出口 | 只在目标对象已存在时附带邻居名称和 opaque `room_id`；不为地图批量加载目标 |
| `d/zhongzhou/yangzhoudu.c` | 普通静态渡口出口，并有真实房间物件 | 出口照实展示，移动仍交给原版 `go` |
| `d/city/daxiao.c` | 单静态出口 + 房间自定义 `gamble` 动作 | 非移动动作不进入地图协议 |
| `b/yubifeng/damen.c`、`b/yubifeng/changlang.c` | `in`/`out` 进出结构，室内外混合 | `进入`/`出去` 使用服务器签发的出口 token |
| `b/yitian/was_dayuan.c`、`b/yitian/was_damen.c` | `valid_leave` 会根据 NPC/剧情条件拒绝移动 | 不预判条件；地图只标记真实出口，点击后仍由原版规则决定成功或失败 |
| `u/mudren/mogong.c`、`clone/misc/void.c` | `up`/`down` 垂直出口 | 使用 `上`/`下` 标签，不假设二维位置 |
| `u/mudren/maze/9,9,9.c`、`u/mudren/maze.c` | 虚拟/坐标房间，出口动态生成或随机删除 | 只读当前对象/当前坐标；动态、未加载或不能安全解析的出口标为未知 |
| `d/lingxiao/wave.c` | 运行时增加 `enter`，数秒后关闭，并有条件阻挡 | 标记为特殊/动态通路，不把它当稳定静态边 |
| `d/gumu/xiaohebian.c`、`d/gumu/shandong.c` | 室内外区域名、`in`/`out` 和特殊 `westdown` | 服务器 label 映射；不把特殊命令猜成普通方向 |
| `u/mudren/workroom.c` | 虚拟坐标房间，坐标处另接 `up/down` 普通房间 | 当前虚拟对象可作为真实节点；邻居仍不主动加载 |
| `world/area/world.c` + `mudcore/inherit/area/*` | 大区域网格，坐标数据和区域出口在 area mapping 中 | 仅当前坐标及其真实邻格；禁止全区域扫描和全世界预加载 |

这些样本说明：`exits` 的值可能是对象、字符串、区域 mapping、函数或其他运行时值；即使目标静态存在，`valid_leave` 仍可能受门、NPC、剧情或战斗状态影响。地图层不能把“拓扑上可解析”误报为“一定可以通过”。

## 2. 阶段 6 协议边界

新增 `Room.Map` v1 快照和 `Web.Room.Move` 动作。

`Room.Map` 只返回当前节点和当前环境真实出口，包含以下类型的字段：

- 快照头：`version: 1`、`snapshot: 1`、非负 `revision`、非负 `sequence`。
- 当前节点：opaque `room_id`、经过 ANSI/控制字符清理和长度限制的 `name`/`area`，区域坐标仅在确属真实区域坐标时使用。
- 出口：服务器生成的 opaque `exit_id`、服务器 label、展示用原始命令文本（仅用于识别/显示，不作为客户端动作参数）、`resolved`、`dynamic`，以及可选的 opaque `destination_room_id` 和安全目标名称。

方向 label 固定为：北、南、东、西、东北、西北、东南、西南、上、下、进入、出去。其他出口只显示服务器清理后的真实命令或“特殊通路”，不把 LPC 文件名、clone id、函数名、daemon 路径或目标 mapping 传到浏览器。

静态出口目标只有在对象已经存在、且不需要为地图主动 `load_object` 时才解析；未加载目标显示为“尚未探索”，但只要出口不是动态通路，仍可使用当前快照 token 请求原版移动规则。函数、异常 mapping、随机/临时/动态出口显示为“未知出口/特殊通路”，`dynamic: true` 或 `resolved: false`。地图协议不调用 `valid_leave` 来探测通路，不触发房间 `reset`、NPC clone 或其他副作用。

`Web.Room.Move` 只允许形如服务器签发的 `exit_id`。服务端同时校验：当前登录对象、当前环境、当前 opaque 房间 ID、当前 map revision、出口 token 所属快照和 token 对应的真实出口仍然一致；任一检查失败即拒绝。通过校验后才执行原版移动命令，浏览器不能提交任意方向、LPC 路径、对象文件名或 LPC 方法名。

房间、动态出口或当前区域坐标变化时生成新的 map revision 和出口 token，旧 token 立即失效。地图点击不做 optimistic UI：只有收到服务器新的 `Room.Info`/`Room.Map` 才改变当前节点；失败移动保留原地图并把原版失败文字留在终端。

## 3. 加载和安全限制

- 服务端每次只读取当前环境、当前区域坐标和有限数量的真实出口；不扫描 `d/`、`b/`、`world/`，不建立持久全世界 graph。
- 单个快照的出口数、命令 label、房间名称和 JSON 总体大小均设上限；恶意/畸形 GMCP JSON、缺字段、错误类型、超长 token 和旧 revision 在客户端及服务端都拒绝或丢弃。
- ID 采用会话内 opaque token。已有 `Room.Info.room_id` 继续保留；新 `exit_id` 只在服务端 mapping 中有意义，重连会清空所有 room/exit 映射。
- 浏览器只根据 `exit_id` 调用 `Web.Room.Move`；原版命令栏仍可以发送用户主动输入的普通 MUD 命令，地图按钮不复用该通道。
- 客户端 `Room.Map` 解析器只接纳 v1 合法快照、合法 opaque ID、有限出口数量和无控制字符显示文本；未知字段忽略，非法记录过滤，非法快照不改变已有状态。

## 4. 前端 UI 边界

地图视图放在 `features/map`，采用 React + CSS/SVG 小型局部布局，不引入大型地图引擎。中心节点表示当前真实房间，邻接节点按服务器方向 label 放置；`up/down` 和其他特殊出口使用独立出口列表，不假造二维坐标。未解析和条件出口保留“尚未探索”/“可能受条件影响”提示并允许点击，动态/特殊通路保持禁用，避免把未知状态伪装成已知稳定路线。

PC、窄屏和横屏移动端都必须可用：地图面板允许缩放内容而不溢出，按钮保持可点击；断开、重连或快照清空时清除本地 session graph。已访问节点如在浏览器内短暂保留，只属于当前连接会话，不写入持久世界数据。

现有 RoomPanel 的结构化出口按钮改用 `exit_id`；命令栏继续保留原版命令输入。帮助页将旧的 WASD 文案改为“点击房间出口或输入原版移动命令 north/south/east/west”，不新增全局 WASD 监听。

## 5. 验收与测试矩阵

### 协议/服务端

- 正常 `Room.Map` v1 快照、空出口、重复名称和中文/特殊出口。
- 透明验证浏览器拿不到 LPC 路径、对象文件名、clone id、函数名或 daemon 路径。
- 非法/超长/换行/路径型 `exit_id`、缺失字段、错误 revision/sequence、重复/超限出口均被拒绝或过滤。
- 当前房间有效 token 可以进入原版 `go`；伪造方向、伪造目标、旧房间 token、旧 revision token、动态/失效 token 均拒绝。
- 普通房间移动、区域坐标移动、传送/死亡等已有移动同步点后，`Room.Info` 与 `Room.Map` 一致；失败移动不改变当前节点。

### 前端

- 当前节点、真实相邻方向、`up/down`、`in/out` 和特殊/动态出口显示正确。
- 地图按钮只发送合法 `Web.Room.Move` opaque payload；不把方向字符串或命令栏 payload 当地图动作发送。
- 未连接和断开状态不显示旧地图，重连后清空 session 图；旧快照不覆盖新 revision。
- 点击出口后在收到服务端快照前不乐观移动；失败时当前节点仍在原处。
- 390×844、844×390、1440×900 三种视口下布局无明显溢出，已有 5.2 深色水墨/金色/青色视觉基线保持。

### 运行时/Telnet

- 使用真实 FluffOS 调试运行时，在普通静态房间、至少一个 `in/out` 或 `up/down` 房间、一个动态/条件出口样本中实际验证 5–10 个房间的探索。
- WebSocket/GMCP 可看到 `Room.Info`、`Room.Map`、Terminal 原版文字和实体同步；Telnet `5566`（GBK）与 `6666`（UTF-8）的 `look`、`north`、`south` 等原版命令行为不变。
- 测试账户、测试存档、调试日志仅使用临时数据，验收后清理，不修改真实存档，不修改 `mudcore`。

### 5.1 本轮实际结果

- `npm test -- --run`：16 个测试文件、64 个测试全部通过；`npm run build` 通过并更新 `www/app` 构建产物。
- `Web.Room.Move` 只接受当前会话签发的 opaque `exit_id`，服务端重校验当前对象、房间 ID、revision、出口存在性和 Area 当前坐标；通过后由处理器直接调用 `/cmds/std/go` 的 `main(me, direction)`。为兼容依赖 `this_player()` 的遗留 `valid_leave`，`go.c` 仅在该直接入口缺少 command-giver context 时通过 `command()` 建立原版上下文，不调用 `process_input()`，也没有 Area 专用的 `go ` 分支。
- 真实 WebSocket 条件出口验收：客店 `up` 标记 `conditional: true`、`dynamic: false`，点击后保留原房间并收到店小二原版拒绝文字；解剑岩未解析静态 `westup` 可点击，成功移动到松林小路。
- 真实动态出口验收：南岩宫 `down` 出现时 revision 为 28、消失时为 29；消失后旧 token 返回 `地图出口已经失效`。消失后的 5 秒无变化窗口中 map 次数与 revision 均未变化，确认无重复推送。
- 真实 Area 验收：`Room.Info` 与 `Room.Map` 始终使用同一 `room_id`、名称和 8 个当前坐标出口；连续两次 `Web.Room.Move` 网格移动成功，revision 从 31 更新到 32、33。
- 真实 FluffOS 调试实例同时监听 5566、6666、8888。Telnet 5566（GBK）和 6666（UTF-8）均完成登录并执行 `look`、`north`、`south`、`quit`，中文房间文本正常。
- 应用内浏览器复核 390×844、844×390、1440×900：页面主体正常挂载，`document`/`body` 横向滚动宽度均等于视口宽度，无横向溢出。未解析/条件出口的组件测试确认可点击，动态出口仍禁用，地图动作只发送 `exit_id`。
- 一次性角色、测试存档、调试脚本和本轮日志在交付前清理；未修改 `mudcore`，不包含 Stage 6.1 的世界扫描、持久图或自动寻路。

## 6. 阶段 6.1 明确不做

本阶段不做世界地图扫描、持久化 visited graph、自动寻路、客户端推断出口、浏览器执行 LPC 路径/方法、替换原版 `go`/`valid_leave`、门/剧情/随机出口的客户端预判、区域全量可视化，也不扩展 Stage 5.2 已冻结的非地图功能。
