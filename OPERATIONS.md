# elyona-fba 生产运维与安全记录

**系统地址：** `https://afba.cc.cd`  
**生产主机：** 腾讯云 `43.130.0.81`  
**应用目录：** `/var/www/elyona-fba`  
**运行方式：** PM2 集群进程 `elyona-fba`，由 Nginx 反向代理到本机 3000 端口。  
**数据库：** 本机 MariaDB 数据库 `elyona_fba`。

## 当前上线状态

系统已从托管环境迁移至腾讯云，正式域名使用 Cloudflare 代理和 Origin CA 证书，TLS 模式为 **Full (strict)**。生产应用已完成构建并由 PM2 平滑重载。

多品牌注册保持开放。每个用户的 `brandName` 与用户名关联；所有业务接口均要求登录，并在请求携带品牌名称时强制与当前会话品牌匹配。涉及 SKU、货件、促销、实际发货和工厂库存的单条写入或读取，还会二次检查记录归属。

| 验证项目 | 结果 | 说明 |
|---|---|---|
| 正式 HTTPS 页面 | 通过 | `https://afba.cc.cd/login` 正常加载。 |
| 单元测试 | 通过 | 27 项测试全部通过，包含跨品牌读取与修改拒绝断言。 |
| 生产构建 | 通过 | Vite 前端构建和 Node 后端打包均成功。 |
| 第二品牌读取 ELYONA 数据 | 已拒绝 | 服务端返回“无权访问其他品牌的数据”。 |
| 第二品牌修改 ELYONA SKU | 已拒绝 | 服务端返回“SKU不存在或无权访问”，原数据保持不变。 |
| 临时测试数据 | 已清理 | 验证账户、Cookie 文件和一次性 SKU 均已自动删除。 |
| 促销项目页面 | 通过 | 正式域名可加载促销时间轴与项目管理空状态。 |
| 运输配置页面 | 通过 | 正式域名可加载标准件/大件运输参数与公式说明。 |
| 春节配置页面 | 通过 | 正式域名可加载 2026 年春节日期配置表单。 |
| FBA 库存同步页面 | 通过 | 正式域名可加载 Excel 导入说明和空的同步历史记录。 |
| 库存预警页面 | 通过 | 正式域名可加载标准件与大件的库存预警面板。 |

> 多品牌隔离由服务端执行，不能仅依赖前端页面隐藏。不要将一个品牌的会话 Cookie、登录账户或数据库凭据交给其他品牌使用。

## 日常运维命令

在服务器上执行以下命令前，先进入应用目录并确认 Node.js 22 路径可用：

```bash
export PATH=/usr/local/node22/bin:$PATH
cd /var/www/elyona-fba
```

| 目的 | 命令 |
|---|---|
| 查看应用状态 | `pm2 status elyona-fba` |
| 查看实时应用日志 | `pm2 logs elyona-fba --lines 200` |
| 平滑重载应用 | `pm2 reload ecosystem.config.cjs --update-env && pm2 save` |
| 重启应用 | `pm2 restart elyona-fba --update-env && pm2 save` |
| 检查 Nginx 配置 | `nginx -t` |
| 平滑重载 Nginx | `systemctl reload nginx` |
| 查看 Nginx 状态 | `systemctl status nginx --no-pager` |
| 查看 MariaDB 状态 | `systemctl status mariadb --no-pager` |

## 代码更新流程

每次上线前应先在本地或 CI 运行测试和构建。确认变更已推送至 GitHub 的 `main` 分支后，在服务器运行：

```bash
export PATH=/usr/local/node22/bin:$PATH
cd /var/www/elyona-fba
git pull --ff-only
pnpm install --frozen-lockfile
pnpm test
pnpm build
pm2 reload ecosystem.config.cjs --update-env
pm2 save
```

如果 `git pull --ff-only` 提示冲突或非快进更新，应停止操作，先在 GitHub 或本地处理冲突；不要用 `git reset --hard` 覆盖服务器或远程代码。

## 数据备份与恢复

建议至少每天执行一次 MariaDB 全量逻辑备份，并将加密后的副本同步到受控的异地存储。以下示例在服务器以本机数据库管理员身份创建带时间戳的备份：

```bash
mkdir -p /root/backups/elyona-fba
mariadb-dump --single-transaction --routines --events elyona_fba \
  > /root/backups/elyona-fba/elyona_fba-$(date +%F-%H%M%S).sql
```

恢复前先停止应用或安排维护窗口，并先备份当前数据库。确认目标库允许覆盖后，可使用：

```bash
mariadb elyona_fba < /root/backups/elyona-fba/目标备份文件.sql
pm2 reload ecosystem.config.cjs --update-env
```

原托管环境的历史业务数据需要先导出为 SQL 备份，再导入本机 MariaDB。若当前生产库已存在新数据，应先制定合并方案；不要直接覆盖数据库，以免丢失上线后的用户或业务记录。

## 安全收尾状态

本次部署使用的临时 SSH 公钥已从服务器 `/root/.ssh/authorized_keys` 移除，部署环境中的临时私钥 `linshi.pem` 已删除。服务器 root 密码已由管理员更换。

后续应使用单独的长期管理员账户、最小化 SSH 权限及独立密钥进行日常维护，并定期检查 `/root/.ssh/authorized_keys`、PM2 日志、Nginx 错误日志和数据库备份是否正常。不得将 `.env`、数据库备份、私钥或 Cloudflare API 凭据提交至 Git 仓库。
