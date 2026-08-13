# Amazon FBA (elyona-fba) 腾讯云服务器与 Cloudflare 部署指南

本文档记录了将 Amazon FBA 库存与发货管理系统从 Manus 托管环境完整迁移至用户自有腾讯云 Ubuntu 服务器（IP: `43.130.0.81`），并结合 `afba.cc.cd` 域名接入 Cloudflare 的全套步骤。

---

## 一、架构准备与核心决策

1. **数据库**：可直接连接原 TiDB 数据库（保留 `?ssl=true`），或在腾讯云宝塔面板中新建 MySQL 5.7+ 数据库并导入 SQL 备份。
2. **认证体系**：项目内置了本地用户名/密码数据库认证（`users` 表），自托管后可直接使用本地账号登录，无需依赖 Manus OAuth。
3. **文件存储**：可继续通过 Manus 代理访问 S3，或迁移至自建存储。

---

## 二、腾讯云 Ubuntu 服务器部署步骤

### 1. 登录服务器并安装基础环境
使用宝塔面板终端或 SSH 登录服务器（公网 IP: `43.130.0.81`）：

```bash
# 更新系统并安装 Node.js 20+ 和 pnpm / git / nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get update && sudo apt-get install -y nodejs git nginx build-essential
sudo npm install -g pnpm pm2
```

### 2. 克隆代码并安装依赖
```bash
git clone https://github.com/JohnnyTenkyo/AmazonFBA.git /var/www/elyona-fba
cd /var/www/elyona-fba
pnpm install
```

### 3. 配置生产环境变量
在 `/var/www/elyona-fba/.env` 中写入以下配置：
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://your_db_user:your_db_password@localhost:3306/your_db_name?ssl=true
JWT_SECRET=your_super_secret_jwt_key
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_forge_api_key
```

### 4. 构建前端并打包后端
```bash
pnpm build
```

### 5. 使用 PM2 启动服务
```bash
pm2 start ecosystem.config.cjs --name "elyona-fba"
pm2 save
pm2 startup
```

---

## 三、Cloudflare 与域名 `afba.cc.cd` 配置步骤

1. **登录 Cloudflare**：将 `afba.cc.cd` 域名托管到 Cloudflare（修改 DNS 服务器为 Cloudflare 提供商给出的地址）。
2. **添加 DNS 记录**：
   - 类型：`A`
   - 名称：`@` （或留空代表根域名 `afba.cc.cd`，也可以添加 `www`）
   - IPv4 地址：`43.130.0.81`
   - 代理状态：**已开启代理（橙色小云朵 Proxy status: Proxied）**
3. **SSL/TLS 设置**：
   - 将 SSL/TLS 加密模式设置为 **Full (完全)** 或 **Flexible**。
4. **宝塔/Nginx 反向代理配置**：
   在服务器宝塔面板中添加网站 `afba.cc.cd`，配置反向代理：
   - 目标 URL：`http://127.0.0.1:3000`
   - 发送域名：`$host`
5. **开启防火墙**：在腾讯云控制台和宝塔面板中放行 `80`、`443` 端口。
