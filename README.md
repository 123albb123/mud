# 炎黄群侠传MUD
[![zread](https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff)](https://zread.ai/oiuv/mud)

![mud](mud.png "mud")


炎黄MUD utf-8 版，推荐使用 FluffOS UTF8版驱动。

 - 游戏驱动下载：https://bbs.mud.ren/threads/4
 - 线上游戏体验：https://mud.ren:8888/

## LIB说明

本游戏为侠客行类文字MUD游戏，底层为炎黄2003，LIB代码有大量借鉴国内优秀的LIB，开源在此方便对MUD游戏感兴趣的玩家。

![help](help.png "help")

## 推荐部署：飞牛 FNOS / Docker Compose / GHCR

普通用户不需要下载源码、上传 Dockerfile、执行本地构建或编译 FluffOS。在飞牛
Docker Compose 中新建项目，把下面完整内容粘贴为 `docker-compose.yml`：

```yaml
services:
  yanhuang-mud:
    image: ghcr.io/123albb123/yanhuang-mud:stable
    container_name: yanhuang-mud
    restart: unless-stopped
    environment:
      TZ: Asia/Shanghai
    ports:
      - "45566:5566"
      - "46666:6666"
      - "48888:8888"
    volumes:
      - "./runtime/data:/mud/data"
      - "./runtime/log:/mud/log"
      - "./runtime/backup:/mud/backup"
    healthcheck:
      test:
        - CMD-SHELL
        - >-
          curl -fsS --max-time 5
          http://127.0.0.1:8888/app/index.html > /dev/null || exit 1
      interval: 30s
      timeout: 10s
      start_period: 20s
      retries: 5
    stop_signal: SIGHUP
    stop_grace_period: 30s
```

在 Compose 项目目录执行：

```bash
docker compose pull
docker compose up -d
docker compose ps
```

镜像由 GitHub Actions 发布到 [GHCR](https://github.com/123albb123/mud/pkgs/container/yanhuang-mud)，
正式标签为 `stable`，每次 master 构建还会发布 `sha-xxxxxxx` 标签。首次发布后，若
GitHub package 尚未设为 Public，请在 GitHub 的 **Packages → yanhuang-mud → Package
settings → Change visibility** 设置一次；Public package 才能让飞牛匿名 `docker pull`。

### 服务入口

| 入口 | 用途 |
| --- | --- |
| `http://<NAS-IP>:48888/app/index.html` | 内网现代 Web Client |
| `<NAS-IP>:45566` | GBK Telnet |
| `<NAS-IP>:46666` | UTF-8 Telnet |
| `<NAS-IP>:48888` | HTTP + WebSocket 后端 |

Lucky 继续负责已有 HTTPS/WSS 外网入口，不属于本仓库 Compose。现有 Lucky 的 MUD
后端目标保持为 `http://<NAS-IP>:48888`，并开启 WebSocket 转发。前端会按访问页面的
协议使用同主机 `ws://` 或 `wss://`，不需要把外部地址写死为 8888。

### 更新、备份与回滚

先停止容器，在飞牛文件管理器或命令行备份整个 `runtime/` 目录，然后启动并拉取新镜像：

```bash
docker compose stop
# 复制整个 runtime/ 到带日期的备份目录
docker compose start
docker compose pull
docker compose up -d
docker compose ps
```

更新只需要 `pull` 和 `up -d`，不需要 `git pull` 或 `docker compose build`。如需回滚，
把 Compose 中的 image 临时改为某次发布的 `ghcr.io/123albb123/yanhuang-mud:sha-xxxxxxx`，
再执行 `docker compose pull` 和 `docker compose up -d`；不要删除持久化数据。

迁移到另一台 NAS 时复制 `docker-compose.yml` 和整个 `runtime/`，随后执行同样的
`docker compose pull`、`docker compose up -d` 即可。首次启动会从镜像内的
`data/.env.example` 初始化 `runtime/data/.env`，不会覆盖已有账号、角色或其他存档。

### 开发者备用：从源码构建

仓库仍保留源码构建方式，但普通 FNOS 用户不需要使用它。开发者先初始化
`mudcore` 子模块，再使用专用的 `docker-compose.build.yml`：

```bash
git clone --recurse-submodules https://github.com/123albb123/mud.git
cd mud
docker compose -f docker-compose.build.yml build --pull
docker compose -f docker-compose.build.yml up -d
```

详细的持久化、备份、恢复、健康检查和 Lucky 边界说明见
[docs/FNOS_DOCKER.md](docs/FNOS_DOCKER.md)。生产 Web 构建产物已提交在 `www/app/`，
运行镜像不需要 Node.js。

> 推荐使用[mudlet](https://github.com/Mudlet/Mudlet)客户端连接传统 Telnet，推荐使用UTF-8编码进行游戏。

## 原项目说明

本游戏为侠客行类文字MUD游戏，底层为炎黄2003，LIB代码有大量借鉴国内优秀的LIB，开源在此方便对MUD游戏感兴趣的玩家。

注册ID为 `mudren` 的帐号为游戏管理员(admin)。

求助答疑请访问：https://bbs.mud.ren/nodes/6
