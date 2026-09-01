# Web UI 阶段 5.1：任务/聊天验收与私聊语义修复

本阶段在 `master` 上直接完成，未创建分支，也未修改 `mudcore` 子模块。目标是把阶段 1—5 的 Web UI 置于真实 FluffOS 驱动、真实玩家会话和真实游戏命令下验收；本阶段不新增 Quest/Chat 产品设计。

## 1. jam_talk 原问题

`cmds/std/tell.c` 原先在 `notice_user()` 返回后立即向收件人发送 `gmcp_chat_private_message()`。当收件人开启 `jam_talk` 时，原版只把第二个及后续不同来源的消息放进 `tell_list`，文字要等 `skip` 才显示，但 GMCP Chat.Message 已提前到达 Web 客户端，造成“界面先收到、游戏文字后收到”的语义泄漏。

## 2. 最终修复位置

- `cmds/std/tell.c`：把 Web 结构化事件所需的纯文本元数据随队列项保存，并只在原版实际 `tell_object()` 的位置发送收件人事件。
- `cmds/std/reply.c`：复用相同的 `notice_user()` 可选参数，移除提前通知收件人的路径。
- `cmds/usr/skip.c`：普通 `skip` 和 `skip all` 在原版文字出队后补发排队私聊事件。
- `feature/user_gmcp.c`：新增 `gmcp_chat_private_delivered()`、`Chat.Targets` 目录和 Web tell 的安全解析；同时清理任务文本 ANSI，并从真实背包补齐活动收集任务的当前数量。

## 3. 排队与送达语义

发送者仍在原命令成功后立即收到自己的 `direction: "out"` 事件。收件人只有在原版私聊文字实际送达时才收到 `direction: "in"`：正常 tell/reply 立即送达；jam_talk 队列中的消息等 `skip` 或 `skip all` 后送达；原版“当前队首正是同一交谈对象”的立即送达分支保持不变。队列只保存名称、账号 ID、原文字和 kind，不保存对象、对象路径或 Web 会话。

## 4. 发送者/收件人 Chat.Message 时序

实时验收使用 `codexa/赵小明`、`codexb/李小乙`、`codexc/王小三`。`codexb` 开启 `set jam_talk abs` 后，`codexa` 的第一条私聊立即到达；`codexc` 的第二个来源私聊在 `codexb` 执行 `skip` 前没有结构化事件，执行后只出现一次。队列回复也在送达后到达原发送者。普通 tell、reply 的 sender/receiver 事件各只出现一次。

## 5. Chat.Targets schema

服务端发布 `Chat.Targets` 快照，版本为 1：

```json
{
  "version": 1,
  "snapshot": 1,
  "revision": 1,
  "sequence": 1,
  "players": [
    {"player_id": "p-<session>-0001", "name": "李小乙", "id": "codexb"}
  ]
}
```

`players` 只包含当前可见、在线、可交互、存活的普通玩家，最多 300 项；`id` 是经过长度和路径字符过滤的公开账号标识，可省略。对象、文件名、驱动路径、连接地址和内部 object 均不出现在协议中。

## 6. player_id 生命周期

`player_id` 是会话范围的不透明标识，服务端内部才把它映射到当前对象。收到 `Core.Hello` 时清空旧映射；断线、重连、对象离线或目录重建后，旧 ID 不会复用。Web tell 会重新从当前在线目录解析 ID，格式错误、过期、离线和不可见目标统一安全拒绝。

抓包观察到同一角色两次登录的 `q-*`/`p-*` 会话前缀不同；同一会话中重复 `Quest.List.Get`/`Chat.Targets.Get` 的 `revision` 和 `sequence` 保持不变。

## 7. 跨房间 Web tell

在 8888 Web 客户端中，`codexa` 位于客店、`codexb` 位于北大街；聊天私聊对象搜索 `codexb` 后选择“李小乙 · codexb”，发送私聊。服务端通过 `Chat.Targets` 的 `player_id` 解析在线玩家，再调用原 `/cmds/std/tell`，收件人在不同房间收到一次结构化私聊和原版文字。旧的附近实体 ID 仍只作为兼容输入，Web UI 使用新的玩家目录。

## 8. 原有 tell 权限复用

Web tell 没有复制权限规则：目标解析完成后仍调用 `/cmds/std/tell`，因此继续复用 `no_tell`、`can_tell`、`net_dead`、living、jam_talk、`tell_list`、`skip`、`reply` 以及原有跨 Mud 行为。实测 `set no_tell all` 拒绝私聊，`set can_tell codexa` 后白名单私聊成功，随后恢复环境设置。

## 9. quest2 真实 E2E

`codexa/赵小明` 通过正常游戏路径完成完整 quest2 链：

1. `ask butong about quest` 接受「第一份工作」；在铁匠铺通过正常工作命令累计 20 次，期间按原游戏精力和客店休息规则等待。
2. 通过正常工作赚钱并在钱庄存款超过 20 两，接受并完成「我是有钱人」。
3. 接受「民以食为天」；正常取钱后到醉仙楼 `buy baozi`，回到客店执行 `give baozi to butong`，任务从活动态变为完成态。

最终 `Quest.List` 包含 3 条 completed quest2 记录；物品目标为 `current: 1, required: 1`，并在重连后保持。任务 ID 是会话内 ID，任务完成状态和进度来自玩家真实存档，不使用 `setToDo`、`setSolved` 或规则改写。

## 10. 公共频道 E2E

两名真实角色在 Web 聊天的“闲聊”频道发送消息，双方均收到一次 `Chat.Message`，原版频道文字也出现一次。对未满 30 岁角色发送 `rumor`，服务端返回原有拒绝语义（“三十岁以后”），没有广播结构化消息。匿名/静态频道能力仍由服务端能力快照和协议测试覆盖，未伪造匿名身份。

## 11. jam_talk E2E

`codexb` 开启 `jam_talk abs` 后验证即时消息、不同发送者排队、`skip` 出队、`skip all` 出队和队列中的 reply。排队消息在 skip 前不出现在收件人 Chat.Message 列表，出队后恰好一条；普通 tell/reply 不重复。测试结束后恢复 `jam_talk none`。

## 12. 浏览器 E2E

使用真实 WebSocket 地址 `http://127.0.0.1:8888/app/index.html` 通过应用内浏览器登录三名角色，检查人物、房间、实体、背包、装备、技能、战斗、任务和聊天面板。私聊对象目录能够按姓名、账号 ID、`player_id` 搜索；断开目标后目录最终消失，重新登录后获得新的 `player_id`。

输入 `<script>alert(1)</script>` 后，聊天消息以 React 文本显示；聊天区域内没有 script 节点。聊天消息增长时 feed 保持底部跟随，手动滚动后可按现有行为停留；最新消息、对象搜索和空目录状态均在真实页面检查。

## 13. PC/mobile viewport

应用内浏览器实际检查了以下视口并截取了验收图，结束前恢复默认视口：

- `390 × 844`：移动竖屏，聊天面板、对象搜索和发送区可见。
- `844 × 390`：移动横屏，横向空间下聊天面板与终端仍可操作。
- `1440 × 900`：桌面端，终端、侧栏和任务抽屉布局可用；任务抽屉显示三条 quest2 完成记录。

## 14. 自动化测试

`web-client` 的 Vitest 回归结果：14 个测试文件、50 个测试全部通过。覆盖 GMCP `Chat.Targets` 解析、玩家 ID 去重/非法值过滤、Web tell 请求约束、聊天搜索/空目录、HTML 作为文本和聊天 feed 自动跟随。

## 15. 构建

- `npm test -- --run`：通过。
- `npm run build`：通过，生成 `www/app/index.html` 和对应生产 JS/CSS 资源。
- `cmake --build fluffos/build --parallel 1 --verbose`：在既有 `fluffos/src/compiler/internal/compiler.cc` C++ 编译阶段退出，编译器没有输出诊断；该失败与本阶段 LPC/Web UI 改动无关。使用现有 FluffOS 驱动进行 LPC 加载和运行态验收，启动时无 LPC 编译错误。

## 16. Telnet

双角色脚本分别连接 5566（GBK）和 6666（UTF-8），验证 `look`、`quest2`、`say`、`tell`、`reply`，两端 marker 全部命中；第二角色的 `jam_talk` 设置在测试后恢复。8888 WebSocket 握手、GMCP negotiation 和实时登录也已通过。

## 17. 已知限制

- Chat.Targets 采用 10 秒低频轮询加即时请求，在线/离线变化不是硬实时，过期 ID 始终在服务端安全拒绝。
- 本阶段没有为真实玩家强行制造匿名身份；匿名频道仍由静态协议/能力解析覆盖。
- Web 跨房间私聊使用本 Mud 的在线玩家目录；跨 Mud 私聊继续遵循原 interMud 逻辑。
- FluffOS 原生 C++ 增量构建仍受 `compiler.cc` 无诊断退出影响，需要后续单独修复构建环境或编译器问题。

## 18. 阶段 6 建议

阶段 6 可考虑把 Chat.Targets 目录改为事件驱动并增加更新时间/过期提示；为 Quest.List 增加更细粒度的活动进度 fixture 和驱动级回归脚本；补充匿名频道的真实账号测试矩阵；以及单独定位 FluffOS C++ 编译器无诊断退出。阶段 5.1 不实施这些扩展。
