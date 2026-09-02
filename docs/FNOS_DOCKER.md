# 飞牛 FNOS Docker 稳定部署

本文是炎黄群侠传在飞牛 FNOS 上的 Docker Compose 部署说明。推荐使用 GitHub
Container Registry（GHCR）中的稳定镜像；普通用户不需要下载源码、上传 Dockerfile、
在飞牛本地编译 FluffOS 或执行 Docker build。

## 1. 推荐方式：GHCR 纯镜像 Compose

在飞牛 Docker Compose 中新建项目，把下面完整内容保存为项目目录中的
docker-compose.yml：

~~~yaml
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
~~~

在该 Compose 项目目录执行：

~~~bash
docker compose pull
docker compose up -d
docker compose ps
~~~

也可以在 FNOS Compose 界面中执行同等的拉取和启动操作。Compose 使用现代
Specification，不需要 version: 字段。

镜像地址固定为：

~~~text
ghcr.io/123albb123/yanhuang-mud
~~~

GitHub Actions 在 master push 或手工触发时构建 linux/amd64 镜像，并发布：

- stable：日常部署标签。
- sha-xxxxxxx：对应 Git commit 的短 SHA 标签，用于定位和回滚。

Workflow 只使用 GitHub 自动提供的 GITHUB_TOKEN，不需要创建 GHCR_PAT、Docker Hub
token 或其他自定义 Secret。首次发布的 GHCR package 可能是 Private；为了让 FNOS
无需登录即可拉取，发布后在 GitHub 打开 Packages → yanhuang-mud → Package
settings → Change visibility → Public。只需设置一次，且只处理本项目的
yanhuang-mud package。Public Container Registry package 支持匿名 docker pull。

如果 docker compose pull 返回权限错误，先检查该 package 是否已设为 Public。若明确
选择 Private，才需要在飞牛执行 docker login ghcr.io，Compose 文件中不要写用户名、
密码或 PAT。

## 2. 首次启动与服务入口

启动命令：

~~~bash
docker compose pull
docker compose up -d
docker compose ps
~~~

健康状态变为 healthy 后，入口如下：

| 宿主机入口 | 用途 |
| --- | --- |
| http://<NAS-IP>:48888/app/index.html | 内网现代 Web Client |
| <NAS-IP>:45566 | GBK Telnet |
| <NAS-IP>:46666 | UTF-8 Telnet |
| <NAS-IP>:48888 | HTTP + WebSocket 后端 |

容器内部端口仍然是 5566、6666、8888；高位端口只用于 FNOS 宿主机映射：

~~~text
45566 → 5566（GBK Telnet）
46666 → 6666（UTF-8 Telnet）
48888 → 8888（HTTP + WebSocket）
~~~

## 3. Lucky、HTTPS 与 WebSocket

Lucky 不属于本仓库的 Compose，本阶段不会创建服务、修改 Docker、网络、证书、域名或
Lucky 配置。

现有 Lucky 的 MUD 后端目标保持为：

~~~text
http://<NAS-IP>:48888
~~~

并保持 WebSocket 转发。前端按访问页面协议连接同一主机：

- HTTP 页面使用同源 ws://。
- HTTPS 页面使用同源 wss://。

不要在 Git 中写入真实 NAS IP、Lucky 域名、证书或把外部地址写死为容器端口 8888。

## 4. 数据初始化与持久化

Compose 使用 bind mount，项目目录只需要 docker-compose.yml；启动时 Docker 会创建或
使用：

~~~text
runtime/
├── data/
├── log/
└── backup/
~~~

对应关系：

~~~text
./runtime/data   → /mud/data
./runtime/log    → /mud/log
./runtime/backup → /mud/backup
~~~

首次启动时，镜像 entrypoint 会在 runtime/data/ 中创建 data/.env，并只为缺失的
初始 .o 文件提供 seed。它不会覆盖已有 .env、账号、角色或其他数据。

需要保留的内容包括：

| 宿主机目录/文件 | 内容 |
| --- | --- |
| runtime/data/login/ | 账号和密码哈希等登录状态 |
| runtime/data/user/ | 玩家角色存档、任务和门派状态 |
| runtime/data/board/、item/、npc/、pet/、room/、shop/、cchess/ | 按实际使用产生的动态游戏数据 |
| runtime/data/*.o、runtime/data/db.sqlite | daemon 状态或启用 SQLite 缓存 |
| runtime/data/.env | 实例配置和可选服务凭据 |
| runtime/log/ | 游戏日志和排错信息 |
| runtime/backup/ | 本地备份归档 |

不要把整个 runtime/ 删除后再启动，也不要把宿主机目录挂载到 /mud；后者会遮住
镜像内的 www/app、LPC 源码、config.ini 和 driver。不要改用 named volume，
bind mount 更方便查看、备份和迁移。

## 5. 备份、更新与迁移

纯镜像用户最简单且稳妥的备份方式是停止容器后直接复制整个 runtime/：

~~~bash
docker compose stop
# 在 FNOS 文件管理器中复制整个 runtime/ 到带日期的备份目录
# 或在 shell 中执行类似：cp -a runtime runtime.backup-YYYYMMDD
docker compose start
~~~

不要为了备份进入容器，也不要把容器 writable layer 当作存档。仓库中的
docker/backup.sh 仍保留给取得源码的开发者；纯 Compose 用户直接备份宿主机
runtime/ 即可。

安全更新建议：

~~~bash
docker compose stop
# 先复制整个 runtime/，确认备份可读
docker compose start
docker compose pull
docker compose up -d
docker compose ps
~~~

等待 healthy 后再登录检查。更新不会覆盖 bind mount 中的角色存档。不要执行
docker system prune、docker volume prune 或删除 runtime/。

迁移到另一台 NAS 时复制：

1. docker-compose.yml。
2. 整个 runtime/ 目录。

然后在新 NAS 的 Compose 项目目录执行：

~~~bash
docker compose pull
docker compose up -d
docker compose ps
~~~

## 6. 回滚到指定镜像

每次 master 发布都会额外生成 SHA 标签。例如某次构建对应 ba68797 时，镜像为：

~~~text
ghcr.io/123albb123/yanhuang-mud:sha-ba68797
~~~

回滚步骤：

1. 先停止并备份当前 runtime/。
2. 将 Compose 中的 image 临时改为目标 sha-xxxxxxx 标签。
3. 执行 docker compose pull 和 docker compose up -d。
4. 等待 healthy，登录确认角色与 Web 页面正常。

回滚只替换镜像，不删除持久化数据。确认新版本修复后，可把 image 改回
ghcr.io/123albb123/yanhuang-mud:stable，再次执行 pull 和 up -d。

## 7. 健康检查与运行验证

Compose healthcheck 检查容器内的：

~~~text
curl -fsS --max-time 5 http://127.0.0.1:8888/app/index.html
~~~

宿主机检查：

~~~bash
docker compose ps
curl -f http://127.0.0.1:48888/app/index.html
~~~

验收时还应确认：

- 容器实际使用的是 ghcr.io/123albb123/yanhuang-mud:stable，而不是本地同名镜像：
  用 docker inspect 查看实际 Image。
- WebSocket 在宿主机 48888 上完成 Upgrade，返回 101。
- 45566 可以进行 GBK Telnet 欢迎/协议 smoke，46666 可以进行 UTF-8 Telnet 欢迎/协议 smoke。
- 真实连接后的 GMCP negotiation 正常。
- 容器 recreate 后，runtime/data/ 中同一角色仍然存在。

没有 FNOS 实机、真实 Lucky 外网域名或 iPhone 条件时，不把这些环境的结果写成已验证。

## 8. 镜像与源码构建边界

生产镜像继续使用 Dockerfile 的 multi-stage build：

- build stage 从官方 FluffOS GitHub 仓库固定 checkout 提交 de945701234d348e3dd3e7aee59bf9e06e58539b。
- runtime 包含 driver、完整 mudlib、config.ini、已提交的 www/app、运行库、curl、
  python3 等实际依赖。
- runtime 不包含 GCC、G++、CMake、Git、Node.js、npm、FluffOS 编译源码或 build cache。
- .dockerignore 排除 runtime/、日志、备份、save、.env 和本地测试数据；不会把用户
  运行数据推到 GHCR。

如需从源码构建，使用明确命名的开发者备用文件，不要修改普通用户使用的根
docker-compose.yml：

~~~bash
git clone --recurse-submodules https://github.com/123albb123/mud.git
cd mud
git submodule update --init --recursive
docker compose -f docker-compose.build.yml build --pull
docker compose -f docker-compose.build.yml up -d
~~~

该方式需要完整仓库、mudcore 子模块和本地 Docker build 能力。FNOS 日常部署应始终
使用 GHCR Compose 的 pull、up -d 流程。

## 9. 项目边界

本次 GHCR 收口不修改 Web UI、游戏功能、GMCP、Terminal、Map、Chat、Combat、Inventory、
Skills、Quest、LPC 或 mudcore，也不修改 Lucky。镜像直接使用仓库当前已提交的
www/app，不会因为发布镜像重新生成前端资源。
