# 观势：NAS / Node.js / PM2

直接运行，无需 Docker、Cloudflare 账户、R2 或数据库。Node.js 22+，pnpm；PM2 6.0.14 作为项目依赖固定安装，沿用当前用户的 PM2 daemon。

默认目录：`/volume1/web/nodejs/economy-observatory`。默认端口：19886。

```sh
cd /volume1/web/nodejs/economy-observatory
pnpm run install
pnpm run update
```

`install` 安装锁定依赖、编译、运行检查、创建本地存档、启动本应用的 PM2 进程、检查健康并保存进程列表。普通 `pnpm install` 只安装依赖，不启动服务。

`update` 先备份存档；如果当前 Git 分支有上游，则 `git pull --ff-only`，遇到已跟踪文件的本地改动即停止；没有上游则使用当前目录的代码重建。之后安装锁定依赖、测试、重启本应用、检查健康并保存进程列表。代码上游为 https://github.com/vanabel/gaoshanwen-eco.git 的 main 分支；NAS 已配置跟踪该分支。没有上游的离线副本仍支持本地重建，不会声称已拉取新代码。

```sh
pnpm run pm2:logs
pnpm run pm2:restart
pnpm run pm2:stop
pnpm run refresh
```

本应用的 PM2 名为 `economy-observatory`，不使用 `pm2 restart all`。单进程负责本地文件写入；不改成 cluster 多实例。PM2 系统开机启动沿用 NAS 已有配置，本项目只执行 `pm2 save`，不改系统启动任务。

## 配置与存档

安装时仅在不存在时从 `.env.example` 创建 `.env`。配置调整后运行 `pnpm run pm2:restart`。默认监听 NAS 的19886端口，不创建外网端口映射或反向代理。若需要全站登录，可配置 `BASIC_AUTH_USER` 与 `BASIC_AUTH_PASSWORD`；外网使用时在已有反向代理上配置 HTTPS。

- `var/archive/annual/*.json`：2012年起的年度存档。
- `var/archive/latest.json`：最新官方综合运行数据。
- `var/archive/worldbank.json`：世界银行原始序列。
- `var/archive/revisions/`：官方数据修订存档。
- `var/archive/runtime/refresh.json`：后台刷新结果。
- `var/admin-token`：自动生成的管理密钥，权限0600；不进入Git。
- `var/backups/`：运行更新脚本前的数据备份。
- `logs/pm2-{out,error}.log`：运行日志。

首次启动只补入缺失的种子数据，不覆盖已有存档。持久数据与源码分开，替换代码时保留 `.env`、`var/` 和 `logs/`。源码压缩包不包含运行数据或管理密钥。

## 自动更新与访问

后台默认启动15秒后检查一次，此后每6小时更新最新综合运行数据、最新年度公报和WDI。`REFRESH_HOURS=0` 可停用后台检查。现有访问时检查和页面每30分钟检查仍保留。上游不可用时展示带统计期的本地存档；原演讲图和观点保留当时版本，不随数据刷新改写。

`/api/health` 显示存档绑定是否可用；`/api/runtime` 提供后台更新周期与上次结果。`POST /api/update`、`POST /api/refresh` 须有 `X-Admin-Token`，令牌不发送给前端。`pnpm run refresh` 从本地读取令牌调用接口。普通阅读、导出、图表和页面内刷新不需要令牌。

## 验证

`pnpm run test:node` 覆盖文件持久化、重启后读取、种子保留、管理接口与跨来源请求保护、可选全站登录，以及后台任务合并。安装和更新还会检查原有23幅图、年度报告、观点、数据解析和来源中断时的回退。

## 域名反向代理

将 `https://gsw.vanabel.cn` 代理到 `http://192.168.8.38:19886`，`.env` 中配置 `PUBLIC_URL=https://gsw.vanabel.cn`。建议保留 Host 或传递 X-Forwarded-Host。本站接口、下载和章节链接均使用相对路径，不需要开放通配 CORS。来源校验仅认可配置的公开域名和同源内网访问，管理令牌要求保留。`.env` 优先于 PM2 保留的旧环境变量，因此改端口后普通 PM2 重启也能生效。域名、证书和代理规则由用户自行设置。
