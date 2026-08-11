# Hospital-sys 医院智能回复系统

> **全局 memory 入口**：`~/.claude/projects/-Users-gloom/memory/MEMORY.md`（路由表 → `_index_*.md`）。本项目最相关：`_index_projects.md`（Hospital-sys 身份/FAQ Citations）、`_index_business-integration.md`（OpenRouter Key 轮换）、`_index_infra-deploy.md`（Vercel/Supabase）。

## 项目概况

- **用途**：医院社交平台智能回复系统，真实可交互的运营后台
- **线上地址**：https://ardr.ai
- **技术栈**：Next.js 16 (API Routes) + 单页 HTML 前端 + Supabase pgvector + OpenRouter embedding
- **部署**：Vercel + Cloudflare DNS

## 架构

前端是 `public/index.html` 单文件（~2500 行），包含 9 个页面、真实邮箱密码登录、RBAC 权限控制。
后端 13 个 API 路由，Supabase 中 6 张表（faqs, reply_history, queue_items, users, sensitive_keywords, system_settings）。
AI 能力通过 OpenRouter `text-embedding-3-small` + Supabase pgvector `match_faqs` RPC + `gpt-4o-mini` 实现。

## 数据库表

| 表 | 用途 |
|---|---|
| `faqs` | FAQ 知识库 + pgvector 语义搜索 |
| `reply_history` | 回复记录（支持标注 correct/wrong） |
| `queue_items` | 人工处理队列 |
| `users` | 用户账号（SHA-256 密码哈希） |
| `sensitive_keywords` | 敏感词管理（按分类） |
| `system_settings` | 系统配置（KV 存储） |

## API 路由

| 路由 | 用途 |
|---|---|
| `/api/auth` | POST 登录 / GET 验证 token |
| `/api/faq/search` | POST 语义搜索 / GET FAQ 列表 |
| `/api/faq/manage` | POST 创建 / PUT 更新 / DELETE 切换 |
| `/api/ai/reply` | POST AI 回复生成（支持 auto_save） |
| `/api/queue` | GET 队列列表 / POST 创建 |
| `/api/queue/[id]` | PATCH 队列操作 |
| `/api/history` | GET 历史列表 / POST 创建记录 |
| `/api/history/[id]` | PATCH 标注 |
| `/api/keywords` | GET/POST/DELETE 敏感词管理 |
| `/api/settings` | GET/PUT 系统设置 |
| `/api/dashboard` | GET 聚合统计 |

## 默认账号

测试账号见 memory `hospital-sys-test-accounts.md`（4 个角色：super/admin + 2 运营专员）。

## 已上线 Feature 锚点

- **FAQ Citations** — 已上线，回复带引用源，详见 memory `hospital-sys-project.md`

## OpenRouter Key 项目特化

- **分 scope 建 key**：embedding 与 chat 拆不同 key 隔离爆破面，详见 memory `feedback-openrouter-key-rotation.md`
- **文件传值，不走 env 拷贝**：避免 secret 进 shell history / transcript
- **容器内 python 验证**：`vercel env pull` 拉下来后必须在 container 内跑 python 实测调用，**Vercel sensitive env pull 返空值是已知坑**（见 memory `feedback-vercel-deploy-gotchas.md`），单看本地文件会误以为成功

## 开发规范

- 修改前端交互：编辑 `public/index.html`，CSS/JS 都在同一文件内
- 修改后端 API：`src/app/api/` 目录下对应路由文件
- Supabase 客户端必须用函数式 lazy init（`createServiceClient()`），不能模块顶层初始化
- 部署：`vercel --yes --prod` —— **当前直推 prod 无 preview 路径，风险高**
- FAQ 数据变更后需重新运行 `npx tsx scripts/seed-faq.ts`
- 数据库 DDL 在 `supabase/schema.sql`，通过 Supabase SQL Editor 执行

## Rollback

当前直推 prod 模式下，回滚路径：
- `vercel rollback <deployment-url>` —— 从 `vercel ls` 取上一个 Ready 部署 URL
- 或 Vercel Dashboard → Deployments → 找上一个 Production → "Promote to Production"

**推荐改进**：切换到标准 preview → promote 流程（`vercel` 出 preview URL → 验证后 `vercel promote <url>`），避免错误改动直接命中线上

## 需求来源

PRD / 架构图 / 原型文件在 `~/Downloads/`，详见项目 memory。
