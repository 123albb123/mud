# 飞牛 FNOS Docker 稳定部署

本文是本项目 Stage 9 的正式部署说明，目标环境为飞牛 FNOS 上的 Docker。它不管理已有的 Lucky，也不提供 Windows 原生、Linux 原生或 systemd 部署方案。

## 1. 拓扑与边界

```text
浏览器 / Telnet 客户端
          │
          ▼
飞牛 Docker: yanhuang-mud
  5566  GBK Telnet
  6666  UTF-8 Telnet
  8888  HTTP + WebSocket
          │
          └── 现有 Lucky（仅外网）
                HTTPS / WSS → <NAS-IP>:8888
```

内网现代客户端地址是：

```text
http://<NAS-IP>:8888/app/index.html
```

外网继续使用用户已有的 Lucky HTTPS 域名。Lucky 只需把后端指向 `<NAS-IP>:8888`，打开 WebSocket 转发，并保证 `/app/index.html` 与同域 WebSocket 可访问。本文不会写入真实域名、NAS 地址、证书或 Lucky 配置。

容器本身只提供 HTTP/WebSocket，不配置 FluffOS TLS。默认只把 8888 提供给 Lucky；如果确实使用传统 Telnet，再按需开放 5566/6666，公网不建议暴露这两个端口。

## 2. 版本与镜像

仓库中的 `Dockerfile` 使用 multi-stage build：

- build stage：`debian:12-slim`，安装 C/C++、CMake、Ninja、Bison/Flex 及 FluffOS 所需开发库。
- runtime stage：`debian:12-slim`，只保留 FluffOS driver、炎黄 mudlib、`www/app`、运行库、`curl`、`gosu` 和必要的时区/外部命令支持。
- runtime 不包含 GCC、G++、CMake、Git、FluffOS 源码构建缓存或 Node.js。

FluffOS 来源固定为 `https://gitee.com/fluffos/fluffos.git` 的提交：

```text
de945701234d348e3dd3e7aee59bf9e06e58539b
```

这是当前稳定运行驱动对应的 FluffOS 提交（驱动版本字符串为 `20260820-dd2a3a14-de945701`）。构建参数保持当前项目需要的能力：UTF-8、Telnet、WebSocket、GMCP、SQLite、crypto、external、FFI、PCRE、压缩和 jemalloc；SQLite 是默认数据库后端，`MARCH_NATIVE=OFF` 用于避免把构建机特有指令带入普通 amd64 NAS。driver 产物取 FluffOS 文档确认的 `build/src/driver`。

构建时不会 clone 最新 master，因此后续 FluffOS 上游变化不会静默改变生产镜像。Docker 基础镜像使用 Debian 12，而不是漂移的 `latest` 标签。

## 3. 取得源码与首次启动

建议在飞牛 Docker Compose 项目中使用本仓库，并递归初始化 `mudcore`：

```bash
git clone --recurse-submodules https://github.com/123albb123/mud.git
cd mud
git submodule update --init --recursive
docker compose build --pull
docker compose up -d
docker compose ps
```

`docker-compose.yml` 已包含三个端口映射、健康检查、自动重启和数据挂载。默认不需要修改 Compose，数据根目录默认为 `./runtime`。

若飞牛要把数据放到指定存储盘，在 Compose 文件同目录创建本地 `.env`，只写一行：

```dotenv
YANHUANG_DATA_ROOT=/path/to/yanhuang-runtime
```

这不是游戏的 `data/.env`。根目录 `.env` 只保存宿主机路径，已在 `.gitignore` 中忽略；不应在其中放密码。

容器第一次启动时，`docker/entrypoint.sh` 会幂等地：

1. 创建 `data`、`log`、`backup` 以及 FluffOS 需要的运行子目录。
2. 仅当 `data/.env` 不存在时，复制镜像内的 `data/.env.example`。
3. 仅当目标不存在时，复制仓库中的初始 `data/e2c_dict.o` 和 `data/emoted.o`。
4. 不覆盖已有 `.env`、账号、角色或其他 `.o`/SQLite 数据。
5. 将可写运行目录交给非 root 的 `mud` 用户，然后以前台方式 `exec` driver。

模板中的数据库值是示例值。若不使用可选数据库/外部服务，应按实际环境检查并修改 `data/.env`，不要把真实密码提交到 Git 或写入镜像。

## 4. Compose 运行参数

服务定义在仓库根目录的 `docker-compose.yml`：

| 项目 | 最终值 |
| --- | --- |
| service | `yanhuang-mud` |
| container name | `yanhuang-mud` |
| restart | `unless-stopped` |
| network | 默认 bridge，使用普通 `ports` 映射 |
| privileged | 未启用 |
| Docker socket | 未挂载 |
| 端口 | `5566:5566`、`6666:6666`、`8888:8888` |
| 时区 | `Asia/Shanghai` |
| stop signal | `SIGHUP`（FluffOS 原生 orderly shutdown） |
| stop grace period | 30 秒 |

Dockerfile 和 Compose 的 healthcheck 都只检查：

```text
curl -fsS --max-time 5 http://127.0.0.1:8888/app/index.html
```

健康含义是现代 Web 页面可响应，不要求 5566 上已有登录用户。WebSocket、Telnet 协商和 GMCP 仍需按运行回归单独验证。

driver 是容器前台主进程，不使用 `nohup`、后台 `&`、`screen` 或 `tmux`。该 FluffOS 版本用 SIGHUP 进入原生 orderly shutdown 路径；entrypoint 最后通过 `exec gosu mud ...` 启动 driver，使 Docker 的停止信号能够直接到达 driver。

## 5. 真实持久化数据审计

FluffOS 配置的 `mudlib directory` 是 `.`，所以配置中的 `/data`、`/log` 和 `/backup` 对应容器内 `/mud/data`、`/mud/log` 和 `/mud/backup`。项目没有独立的 `save/` 目录；不要因为目录名称猜测存档位置。

代码审计确认的持久化数据如下：

| 容器路径 | 内容 | 是否必须保留 |
| --- | --- | --- |
| `/mud/data/login/<首字符>/<id>.o` | 登录/账号数据，包括密码哈希等账号状态 | 必须 |
| `/mud/data/user/<首字符>/<id>.o` | 玩家角色 save；任务进度、门派/帮派等角色状态随角色对象保存 | 必须 |
| `/mud/data/board/` | 留言板/公告板数据 | 必须（若使用） |
| `/mud/data/item/` | 玩家物品、仓库/戒指等动态对象 | 必须（若使用） |
| `/mud/data/npc/`、`pet/` | 动态 NPC、宠物/召唤兽数据 | 必须（若使用） |
| `/mud/data/room/` | 玩家房屋、私有/建造房间数据 | 必须（若使用） |
| `/mud/data/shop/` | 店铺动态存档 | 必须（若使用） |
| `/mud/data/cchess/` | 象棋残局/棋盘存档 | 必须（若使用） |
| `/mud/data/*.o` | `dbased`、`familyd`、`named`、`newsd`、`netmail`、`pinfo`、`securityd`、`versiond` 等 daemon 状态；`emoted` 等动态数据也可能在此 | 必须 |
| `/mud/data/db.sqlite` | 仅当 `.env` 开启 `CACHE_DATA` 时使用的 SQLite 缓存 | 按实际配置保留 |
| `/mud/data/.env` | 用户配置和可选服务凭据 | 必须，按权限保护 |
| `/mud/log/` | debug、error、static、channel、user 等游戏日志 | 建议保留；排错时必须 |
| `/mud/backup/` | 容器内游戏 backupd 或本地备份脚本生成的备份 | 按备份策略保留 |

因此 Compose 只挂载三个独立宿主机目录：

```text
<YANHUANG_DATA_ROOT>/data   → /mud/data
<YANHUANG_DATA_ROOT>/log    → /mud/log
<YANHUANG_DATA_ROOT>/backup → /mud/backup
```

`www/app/`、LPC 源码、`mudcore` 和 `config.ini` 属于镜像代码，不挂载为空目录；否则会遮住新镜像的程序。`/mud/dump` 和 `/mud/temp` 只用于临时/崩溃辅助数据，不是角色存档，默认不作为长期备份目标。不要挂载 `/mud` 整体。

## 6. 停止、启动和日志

常用操作：

```bash
docker compose ps
docker compose logs --tail=200 yanhuang-mud
docker compose logs -f yanhuang-mud
docker compose stop
docker compose start
docker compose restart
```

正常停止优先使用 `docker compose stop`，等待 driver 保存并退出；不要把 `kill -9` 当作正常停止方式。`docker compose down` 会移除容器和默认网络，但不会删除上述 bind mount 的宿主机数据。不要使用 `docker compose down -v`，也不要执行 `docker volume rm`、`docker volume prune` 或 `docker system prune -a`。

## 7. 备份

最稳妥的单人 MUD 备份流程是：

```bash
docker compose stop
bash docker/backup.sh /path/to/yanhuang-runtime
docker compose start
```

如果使用 Compose 默认目录：

```bash
docker compose stop
bash docker/backup.sh ./runtime
docker compose start
```

脚本需要一个包含 `data/` 和 `log/` 的持久化根目录，可选第二个参数指定归档目录：

```bash
bash docker/backup.sh /path/to/yanhuang-runtime /path/to/backup-archives
```

默认归档写入 `<root>/backup/yanhuang-YYYY-MM-DD_HH-mm-ss.tar.gz`，只打包 `data/` 和 `log/`，不把旧归档递归塞进新归档，也不备份容器层、镜像、Node modules 或 FluffOS build cache。脚本使用 `umask 077` 和临时文件完成归档，归档内包含 `data/.env`，应限制宿主机访问权限。备份前停止容器是为了避免 save 文件在复制过程中不一致；本文不宣称热备份 100% 一致。

备份验收不能只看压缩包存在，应列出内容：

```bash
tar -tzf /path/to/yanhuang-runtime/backup/yanhuang-YYYY-MM-DD_HH-mm-ss.tar.gz | head
```

应能看到 `data/login/`、`data/user/` 以及本实例实际产生的其他数据和 `log/`。

## 8. 恢复

恢复会覆盖现有运行数据，因此不提供自动 `restore --force`。安全流程如下：

1. `docker compose down`，确认容器已停止。
2. 先用 `docker/backup.sh` 备份当前 `<YANHUANG_DATA_ROOT>`。
3. 将当前 `data/`、`log/` 改名为带时间的 `data.before-restore-*`、`log.before-restore-*`，不要直接删除。
4. 在同一个持久化根目录解压历史归档：`tar -xzf <archive> -C <YANHUANG_DATA_ROOT>`。
5. 确认 `data/.env`、`data/login/`、`data/user/` 存在，并让 Docker 运行用户可读写。
6. `docker compose up -d`，等待 healthcheck 变为 `healthy`。
7. 使用归档中的测试角色或已知角色登录，执行 `look`、`score` 并确认角色状态。

恢复验收应使用临时 Docker 数据根目录，不要删除或覆盖主环境的真实 save。不要把 `docker volume rm` 或递归删除命令当作恢复步骤。

## 9. 安全更新与回滚

更新镜像不会覆盖宿主机的 `data/`、`log/` 和 `backup/`。推荐流程：

```bash
docker compose stop
bash docker/backup.sh /path/to/yanhuang-runtime
git status --short
git pull --ff-only
git submodule update --init --recursive
docker compose build --pull
docker compose up -d --force-recreate
docker compose ps
docker compose logs --tail=200 yanhuang-mud
```

如果 `git status` 显示本地修改，先人工判断，不要用 `git reset --hard`、`git clean -fd` 或其他会覆盖用户修改的命令。`git pull --ff-only` 在无法安全快进时会停止并要求人工处理。

回滚时先停止并备份当前数据，再把代码切换到已知稳定的 Git 提交/标签，重新执行 `docker compose build --pull` 与 `docker compose up -d --force-recreate`。角色存档应使用同版本或确认兼容的代码恢复；不要为了回滚删除宿主机数据。

## 10. 健康检查与验收

容器内/宿主机可先做低成本检查：

```bash
docker compose ps
curl -f http://127.0.0.1:8888/app/index.html
```

完整 Stage 9 验收还应在 Docker 端口映射上实际确认：

- 8888 HTTP 页面、WebSocket 连接、Telnet negotiation 和 GMCP。
- 通过 Web Client 登录测试角色，执行 `look`、`score`、`hp`、`inventory`、移动、NPC 点击、地图移动和 `say`。
- 5566 使用 GBK 登录、`look`、移动、`quit`。
- 6666 使用 UTF-8 登录、`look`、移动、`quit`。
- `docker compose restart`、`down`/`up`、镜像 rebuild/recreate 后同一角色仍可登录。
- 从备份恢复到临时数据根目录后，同一角色仍可登录。
- `cd web-client && npm test -- --run && npm run build` 在开发环境通过；测试不进入 runtime 镜像。

浏览器回归继续覆盖现有 PWA、Terminal、NPC、Map、Chat 以及 390×844、844×390、1440×900 视口。内网 HTTP 不是完整 secure-context PWA；完整 PWA 入口使用现有 Lucky HTTPS 域名。没有实际验证的 iOS IME、外网 Lucky 域名或 FNOS 特定 UI 不在本文中虚构为已验证。

## 11. 常见问题

### 容器反复 unhealthy

先看 `docker compose logs --tail=200 yanhuang-mud`，再确认 8888 没有被宿主机其他服务占用、`www/app/index.html` 在镜像内存在，以及容器内 `/mud/log` 没有权限错误。healthcheck 只检查 8888 页面，不依赖 Telnet 用户。

### 角色登录失败或存档消失

确认 Compose 仍使用同一个 `YANHUANG_DATA_ROOT`，并检查宿主机的 `data/login/` 和 `data/user/`，不要在更新时换成新的空目录。entrypoint 只在缺少 `.env` 或初始 seed 文件时复制，正常启动不会覆盖数据。

### `data/.env` 没有生成

检查宿主机 data 目录是否可写，以及 `.env` 是否被错误地创建成目录。entrypoint 发现非普通文件会停止并在容器日志中说明，不会覆盖它。

### Lucky 外网打不开

先在内网确认 `http://<NAS-IP>:8888/app/index.html` 与 `ws://<NAS-IP>:8888`，再检查现有 Lucky 的 HTTPS 证书、后端地址和 WebSocket 转发。Lucky 不属于本仓库 Compose，本阶段不会修改它。

### 想更新前端

只在开发环境进入 `web-client/` 运行测试和构建；确认新的 `www/app/` 产物已纳入 Git 后，再构建镜像。不要在容器启动或 entrypoint 中执行 `npm install`、`npm run build` 或 FluffOS 编译。
