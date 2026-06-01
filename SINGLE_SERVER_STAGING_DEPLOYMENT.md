# PsyPic 单服务器 Staging 部署手册

本文档用于把 PsyPic RC1 部署到一台自托管 VPS 上，并在同一台服务器内运行：

- PsyPic Next.js 应用
- PostgreSQL
- Redis
- MinIO S3-compatible 对象存储
- Caddy HTTPS 反向代理

这套方案适合 staging / RC 验收，也可短期承载小规模生产。长期生产不建议把数据库、对象存储和应用全部放在同一台机器上，至少要有异地备份。

## 1. 推荐购买配置

### Staging 最低可用

- CPU：2 vCPU
- 内存：4 GB
- 磁盘：80 GB SSD
- 系统：Ubuntu 24.04 LTS
- 必须配置 swap：6 GB

### Staging 推荐

- CPU：4 vCPU
- 内存：8 GB
- 磁盘：160 GB SSD
- 系统：Ubuntu 24.04 LTS

### 单机生产最低

- CPU：4 vCPU
- 内存：8 GB
- 磁盘：160 GB SSD
- 系统：Ubuntu 24.04 LTS

### 单机生产更稳

- CPU：8 vCPU
- 内存：16 GB
- 磁盘：320 GB SSD
- 系统：Ubuntu 24.04 LTS

如果只买一台服务器做 RC/staging，建议直接买 `4 vCPU / 8 GB / 160 GB`。`2 vCPU / 4 GB / 80 GB` 能跑，但 Next.js build、Docker build、数据库和 MinIO 同机时会比较紧。

## 2. 域名规划

只需要买 1 个主域名，例如：

```text
psypic.com
```

用子域名区分服务：

```text
staging.psypic.com       PsyPic staging 应用
minio-staging.psypic.com MinIO 管理后台，可选，仅 staging 使用
app.psypic.com           未来 production 应用，可选
```

DNS 记录：

```text
A staging       <服务器公网 IP>
A minio-staging <服务器公网 IP>
```

Cloudflare 建议：

- SSL/TLS：Full strict
- Always Use HTTPS：开启
- 不要把 Postgres、Redis、MinIO API 端口暴露到公网

## 3. 单机部署架构

```text
Browser
  -> Cloudflare DNS
  -> Caddy :443
  -> PsyPic app :3000
  -> PostgreSQL :5432, Docker 内网
  -> Redis :6379, Docker 内网
  -> MinIO :9000, Docker 内网
```

公网只开放：

```text
22/tcp  SSH
80/tcp  HTTP, Caddy 申请证书使用
443/tcp HTTPS
```

## 4. 初始化服务器

以 root 登录：

```bash
ssh root@YOUR_SERVER_IP
```

如果你已经把仓库上传到服务器，也可以直接使用内置 bootstrap 脚本安装 Docker、Caddy、UFW、fail2ban，并按需创建 swap：

```bash
bash scripts/bootstrap-single-server.sh
```

裸服务器第一次操作时，通常仍建议按下面的命令手动创建 `deploy` 用户和 SSH key，然后再用 `deploy` 用户拉取仓库。

更新系统并安装基础组件：

```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban unattended-upgrades ca-certificates gnupg nano
```

创建部署用户：

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

开启防火墙：

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

开启自动安全更新：

```bash
dpkg-reconfigure --priority=low unattended-upgrades
```

如果服务器是 `2 vCPU / 4 GB`，添加 swap：

```bash
fallocate -l 6G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

之后退出 root，使用 deploy 登录：

```bash
ssh deploy@YOUR_SERVER_IP
```

## 5. 安装 Docker

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

重新登录，让 docker group 生效：

```bash
exit
ssh deploy@YOUR_SERVER_IP
docker version
docker compose version
```

## 6. 安装 Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' |
  sudo tee /etc/apt/sources.list.d/caddy-stable.list

sudo apt update
sudo apt install -y caddy
```

检查：

```bash
sudo systemctl status caddy
```

## 7. 拉取 PsyPic 代码

```bash
sudo mkdir -p /opt/psypic
sudo chown -R deploy:deploy /opt/psypic

cd /opt/psypic
git clone https://github.com/xuehua123/psyPic.git app
cd app
git checkout main
git pull --ff-only
git log -1 --oneline
```

当前 RC1 提交应为：

```text
4bcaeb9 chore: seal rc1 acceptance package
```

## 8. 创建生产环境变量

生成密码和密钥：

```bash
openssl rand -hex 32
openssl rand -base64 48
```

创建 env 文件：

```bash
nano /opt/psypic/app/.env.production
```

模板：

```env
NODE_ENV=production
APP_URL=https://staging.psypic.com

POSTGRES_USER=psypic
POSTGRES_PASSWORD=replace-with-postgres-password
POSTGRES_DB=psypic_staging
DATABASE_URL=postgresql://psypic:replace-with-postgres-password@postgres:5432/psypic_staging

REDIS_PASSWORD=replace-with-redis-password
REDIS_URL=redis://:replace-with-redis-password@redis:6379

SESSION_SECRET=replace-with-high-entropy-session-secret
KEY_ENCRYPTION_SECRET=replace-with-different-high-entropy-key-secret

SUB2API_DEFAULT_BASE_URL=https://your-sub2api-base/v1
SUB2API_TIMEOUT_MS=300000

MAX_IMAGE_UPLOAD_MB=20
PSYPIC_MAX_IMAGE_N=4
PSYPIC_MAX_UPLOAD_MB=20
PSYPIC_MAX_SIZE_TIER=2K
PSYPIC_ALLOW_MODERATION_LOW=false
PSYPIC_COMMUNITY_ENABLED=true
PSYPIC_PUBLIC_PUBLISH_ENABLED=true
PSYPIC_STREAM_ENABLED=true
PSYPIC_MAX_ACTIVE_IMAGE_TASKS_PER_USER=1

PSYPIC_RUNTIME_SETTINGS_STORE=database
PSYPIC_AUDIT_LOG_STORE=database
PSYPIC_AUTH_STORE=database
PSYPIC_IMAGE_TASK_STORE=database
PSYPIC_JOB_RUNTIME_EVENT_STORE=database
PSYPIC_COMMUNITY_STORE=database
PSYPIC_WORKBENCH_PROJECTS_STORE=database
PSYPIC_BOARD_DOCUMENTS_STORE=indexeddb
PSYPIC_SEARCH_INDEX_ENABLED=false

MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=replace-with-minio-root-password

ASSET_STORAGE_DRIVER=minio
ASSET_STORAGE_ENDPOINT=http://minio:9000
ASSET_STORAGE_REGION=auto
ASSET_STORAGE_BUCKET=psypic-staging
ASSET_STORAGE_PREFIX=staging/
ASSET_STORAGE_ACCESS_KEY_ID=psypic-app
ASSET_STORAGE_SECRET_ACCESS_KEY=replace-with-minio-app-user-password
ASSET_STORAGE_FORCE_PATH_STYLE=true

TEMP_ASSET_TTL_HOURS=72
```

要求：

- `SESSION_SECRET` 和 `KEY_ENCRYPTION_SECRET` 必须不同。
- 所有 `replace-with-*` 必须替换。
- `.env.production` 不能提交到 git。
- `DATABASE_URL` 中的密码必须和 `POSTGRES_PASSWORD` 一致。
- `REDIS_URL` 中的密码必须和 `REDIS_PASSWORD` 一致。

## 9. 内置部署文件

当前仓库已经内置单机部署所需文件，服务器上不需要手工创建：

```text
Dockerfile
.dockerignore
docker-compose.single-server.yml
.env.single-server.example
deploy/Caddyfile.single-server.example
deploy/minio-init.sh
scripts/bootstrap-single-server.sh
scripts/deploy-single-server.sh
scripts/backup-single-server.sh
scripts/health-single-server.sh
```

服务器上拉取代码后，先复制环境变量模板：

```bash
cd /opt/psypic/app
cp .env.single-server.example .env.production
nano .env.production
```

确认脚本可执行：

```bash
chmod +x scripts/*-single-server.sh
```

## 10. 一键部署

确认 `.env.production` 已经替换全部 `replace-with-*` 后执行：

```bash
cd /opt/psypic/app
bash scripts/deploy-single-server.sh
```

脚本会依次执行：

1. 拉取 `origin/main` 最新代码。
2. 校验 `docker-compose.single-server.yml`。
3. 启动 Postgres、Redis、MinIO。
4. 初始化 MinIO bucket 和 PsyPic 专用 app user。
5. 构建 PsyPic Docker image。
6. 执行 `pnpm prisma migrate deploy`。
7. 执行 `pnpm prisma migrate status`。
8. 启动 app。
9. 轮询 `http://127.0.0.1:3000/api/health`。

如果 migration 失败：

1. 不要强行启动 app。
2. 查看日志。
3. 不要执行 `migrate reset`。
4. 先备份数据库 volume，再处理 migration 问题。

## 11. 手动部署命令

如果需要逐步执行，可以使用：

```bash
cd /opt/psypic/app

docker compose --env-file .env.production -f docker-compose.single-server.yml up -d postgres redis minio
docker compose --env-file .env.production -f docker-compose.single-server.yml run --rm minio-init
docker compose --env-file .env.production -f docker-compose.single-server.yml build app
docker compose --env-file .env.production -f docker-compose.single-server.yml run --rm app pnpm prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.single-server.yml run --rm app pnpm prisma migrate status
docker compose --env-file .env.production -f docker-compose.single-server.yml up -d app
```

查看日志：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml logs -f app
```

本机健康检查：

```bash
curl -s http://127.0.0.1:3000/api/health
```

## 12. 配置 Caddy

复制内置模板：

```bash
sudo cp /opt/psypic/app/deploy/Caddyfile.single-server.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

把 `staging.example.com` 和 `minio-staging.example.com` 替换成你的真实域名。如果不想暴露 MinIO 管理后台，删除 `minio-staging.example.com` 这一段。

应用配置：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
```

公网检查：

```bash
curl -s https://staging.psypic.com/api/health
```

## 13. /api/health 验收标准

期望：

```text
ok = true
checks.db.status = configured
checks.redis.status = configured
checks.credentials.status = configured
checks.credentials.session_signing = configured
checks.credentials.key_encryption = configured
checks.credentials.distinct_keys = configured
checks.auth_session.store = database
checks.auth_session.status = configured
checks.workbench.store = database
checks.workbench.status = configured
checks.storage.driver = minio
checks.storage.status = configured
```

不能出现：

```text
credentials.status = fail
credentials.session_signing = missing
credentials.key_encryption = missing
credentials.* = placeholder
credentials.distinct_keys = missing
auth_session.store = memory
workbench.api_mode = fallback_503，除非这是明确回退演练
storage.driver = local
storage.status = fail
```

注意：当前 `/api/health` 对 `DATABASE_URL` 和 `REDIS_URL` 主要检查是否配置，不等于深度连通性测试。真正连通性由 migration、登录、写任务、素材库、社区发布来验证。

## 14. RC1 业务 smoke 验收

浏览器访问：

```text
https://staging.psypic.com
```

按顺序验证：

1. 注册 staging 测试用户。
2. 登录。
3. 设置页配置测试 Sub2API Key。
4. 文生图生成 1 张小图。
5. 确认结果进入素材库。
6. 图生图生成 1 张。
7. 多参考图生成 1 张。
8. 遮罩局部编辑生成 1 张。
9. Board 添加素材。
10. Board 导出 reference。
11. Composer 使用 Board reference 图生图。
12. 素材发布社区。
13. 社区详情页点击生成同款。
14. 管理台举报 / 下架 / 恢复 / 精选。
15. 刷新页面，确认素材库、社区、工作台仍可读取。

重启 app 后再检查恢复：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml restart app
```

然后重新打开：

```text
https://staging.psypic.com
```

确认：

- 登录状态合理。
- 素材库可读。
- 社区作品可读。
- Workbench project/session/version node 可恢复。
- 之前的生成结果仍能打开。

## 15. 命令行 smoke

在本地开发机或服务器上执行：

```bash
APP_URL="https://staging.psypic.com" pnpm load:smoke
```

默认 load smoke 只压 `/api/health` 和社区公开流，不触发真实生图。

如果要压生成链路，必须先确认：

- Sub2API 测试账号额度。
- 单次图片成本。
- 是否设置成本上限。
- 是否使用 staging 专用用户和 staging 专用 bucket。

## 16. 更新发布流程

```bash
cd /opt/psypic/app
bash scripts/deploy-single-server.sh
curl -s https://staging.psypic.com/api/health
```

查看日志：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml logs --tail=200 app
```

## 17. 应用回滚流程

查看最近提交：

```bash
cd /opt/psypic/app
git log --oneline -10
```

回滚到旧提交：

```bash
git checkout <old-good-commit>
bash scripts/deploy-single-server.sh
curl -s https://staging.psypic.com/api/health
```

原则：

- 应用可以回滚。
- 数据库不要随便回滚。
- 不要在真实数据上执行 `prisma migrate reset`。
- migration 失败时保留数据库数据，先回滚应用镜像。

## 18. 备份 Postgres 和 MinIO

创建备份目录：

```bash
sudo mkdir -p /opt/psypic/backups
sudo chown -R deploy:deploy /opt/psypic/backups
```

仓库已内置备份脚本，会同时备份 PostgreSQL 和 MinIO：

```bash
cd /opt/psypic/app
bash scripts/backup-single-server.sh
```

恢复前必须先停 app：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml stop app
```

恢复示例：

```bash
gunzip -c /opt/psypic/backups/psypic-db-YYYY-MM-DD-HHMM.sql.gz |
  docker compose --env-file .env.production -f docker-compose.single-server.yml exec -T postgres \
  psql -U psypic psypic_staging
```

生产恢复前要先做一次当前库备份，避免二次伤害。

## 19. MinIO 备份说明

`scripts/backup-single-server.sh` 已包含 MinIO mirror。备份目录里会生成 `minio-YYYY-MM-DD-HHMMSS/`。

重要：单机本地备份仍在同一台服务器上。至少每天下载 `/opt/psypic/backups` 到本地电脑，或同步到另一台机器 / 云盘 / 对象存储。

## 20. 定时备份

添加 cron：

```bash
crontab -e
```

每天凌晨 3 点备份：

```text
0 3 * * * cd /opt/psypic/app && bash scripts/backup-single-server.sh >> /opt/psypic/backups/backup.log 2>&1
```

## 21. 日常运维命令

查看容器：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml ps
```

查看 app 日志：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml logs -f app
```

查看数据库日志：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml logs --tail=100 postgres
```

查看磁盘：

```bash
df -h
docker system df
```

清理无用镜像：

```bash
docker image prune -f
```

不要随便执行：

```bash
docker volume prune
docker compose down -v
prisma migrate reset
```

这些命令可能删除数据。

## 22. 安全底线

- `.env.production` 只保存在服务器和密码管理器里。
- 不把 `.env.production` 发到聊天、工单或仓库。
- Postgres 和 Redis 不开放公网端口。
- MinIO API 不开放公网端口。
- MinIO 管理后台如果暴露公网，必须用强密码，staging 验收结束后建议关闭域名入口。
- `SESSION_SECRET` 和 `KEY_ENCRYPTION_SECRET` 必须不同。
- 真实 Sub2API Key 只在测试用户的设置页配置，不写入代码。
- 生产前必须验证 `/api/session` 不返回 API Key 原文。
- 生产前必须确认 `/api/e2e/session` 在 `NODE_ENV=production` 下返回 404。

## 23. 上 production 前检查

staging 必须完成：

- `/api/health` 返回 `ok=true`。
- 注册 / 登录 / 登出通过。
- 手动配置 Sub2API Key 通过。
- 文生图通过。
- 图生图通过。
- 多参考图通过。
- 遮罩编辑通过。
- Board -> Composer -> 图生图通过。
- 素材库可读。
- 社区发布通过。
- 社区详情 -> 生成同款通过。
- 管理台审核 / 下架 / 恢复 / 精选通过。
- app 重启后数据仍可读。
- Postgres 备份可生成。
- MinIO 备份可生成。
- 回滚旧应用提交演练通过。

## 24. 常见故障

### 502 Bad Gateway

检查 app 是否启动：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml ps
docker compose --env-file .env.production -f docker-compose.single-server.yml logs --tail=200 app
```

检查 Caddy：

```bash
sudo systemctl status caddy
sudo journalctl -u caddy -n 100 --no-pager
```

### /api/health storage fail

检查：

```bash
ASSET_STORAGE_DRIVER=minio
ASSET_STORAGE_ENDPOINT=http://minio:9000
ASSET_STORAGE_BUCKET=psypic-staging
ASSET_STORAGE_ACCESS_KEY_ID=psypic-app
ASSET_STORAGE_SECRET_ACCESS_KEY=<已设置>
ASSET_STORAGE_FORCE_PATH_STYLE=true
```

重新执行：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml run --rm minio-init
docker compose --env-file .env.production -f docker-compose.single-server.yml restart app
```

### migration 失败

不要执行 reset。先看：

```bash
docker compose --env-file .env.production -f docker-compose.single-server.yml run --rm app pnpm prisma migrate status
docker compose --env-file .env.production -f docker-compose.single-server.yml logs --tail=200 postgres
```

### 登录失败或 session 丢失

检查：

```bash
SESSION_SECRET 是否设置
PSYPIC_AUTH_STORE=database
DATABASE_URL 是否指向 postgres 容器
```

### 生图失败

检查：

- 设置页是否配置了测试 Sub2API Key。
- `SUB2API_DEFAULT_BASE_URL` 是否正确。
- Sub2API 额度是否足够。
- `/api/health` 是否正常。
- app 日志是否有上游错误。

## 25. 最终建议

如果目标是 RC1 staging：

```text
1 台 4 vCPU / 8 GB / 160 GB Ubuntu 24.04 VPS
1 个主域名
Docker Compose 单机部署
Caddy 自动 HTTPS
Postgres / Redis / MinIO 全部容器内网
每天备份 DB 和 MinIO
```

如果预算紧：

```text
1 台 2 vCPU / 4 GB / 80 GB Ubuntu 24.04 VPS
6 GB swap
只做 staging，不做正式生产
```

真正生产长期运行时，建议后续拆分为：

```text
应用服务器
托管 PostgreSQL
托管 Redis
R2/S3 对象存储
独立备份策略
```
