# 玄镜 OracleMind · 前端

这是 OracleMind（玄镜）的前端。

OracleMind 是一套已上线的生产级 AI 平台，前端、AI 服务、后端三端解耦。本仓库是面向用户的界面层：Web 应用（Next.js 14 App Router）、管理后台、以及对接 AI 流式解读的全部交互。

如果你在找「既懂怎么把模型能力做成产品、又知道什么时候根本不该等后端」的前端，这个仓库的离线降级和构建期 env 防呆，是我对「稳定」两个字的理解。

---

## 这块解决什么问题

- **断网 / AI 不可达时，产品不能变砖**：用户的生辰排盘、数字命理这类确定性计算，在前端就能算，不该因为后端抖一下就白屏。
- **多端同一套体验**：Web、管理后台、小程序入口共用一套组件与主题，不能各写一套导致视觉和行为对不上。
- **`NEXT_PUBLIC_*` 漏配的静默坑**：这类变量在**构建期内联**，部署时一旦漏配，产物里就会硬编码一个 `localhost` 回环地址——线上请求全打到用户自己电脑上，且不报任何错。
- **流式解读要边收边渲染**：AI 服务的 SSE 输出，前端必须能渐进渲染，而不是等全部生成完才显示。

---

## 核心设计决策

### 1. 前端自己能算的，绝不求后端

排盘 / 历法 / 数字命理的核心算法前端也有一份实现（`lunar-typescript` + 自研 `@/lib/lunar.ts`，农历换算单一来源），与后端用同一套口径（命理走农历、占星走公历）。

> 这是三端「确定性计算不交给模型」这一判断在前端的落地：**前端优先调后端 API，失败就静默降级到本地算法**——用户感知不到后端掉了，只是少了一段 AI 解读，核心排盘结果照常出。知道什么时候不该等网络，比会发请求重要。

### 2. 暗色主题单一源，组件库自研

所有颜色变量集中在 `src/styles/tokens.scss` 的 `:root`（暗色紫青主题），不散落各组件；公共类加容器限定，避免全局污染。视觉一致性靠「一套设计令牌」而不是「每个人凭感觉调色」。

### 3. 构建期内联 env 的防呆

`src/lib/api.ts` 对 `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_AI_API_BASE` 做三层兜底：显式配置 → 开发回落 `localhost` → 生产回落**内置的生产域名**（而非回环地址）。漏配时打日志提醒，而不是默默把回环地址打进生产产物。

### 4. SSE 流式消费

对接 AI 服务的流式接口，边收边渲染解读文本；配合 AI 服务层的「单 chunk 不活跃超时」机制，上游 stall 时前端也不会永久转圈。

### 5. dev / build 走包装脚本

`scripts/next.js` 在 `next dev` 之上包了一层 daemon / kill / clean，避免开发期端口漂移与孤儿进程（和 AI 服务层的 `ai_server.py` 是同一个出发点）。

---

## 怎么跑起来

### 环境要求

- Node.js 18 / 20+
- 依赖：`next@14` / `react@18` / `typescript` / `sass` / `lunar-typescript` 等（见 `package.json`）

### 安装与启动

```bash
cd oraclemind-frontend
npm install

npm run dev:daemon    # 守护模式启动（或 npm run dev）
# 访问 http://localhost:3000
```

常用脚本：

```bash
npm run dev:daemon    # 守护进程启动
npm run dev:kill      # 停止
npm run dev:clean     # 清缓存 + 强启
npm run build         # 生产构建
npm run start         # 生产启动
```

### 环境变量示例

```bash
# 以下为构建期内联变量，务必在构建时注入（本地未配则回落 localhost）
NEXT_PUBLIC_API_BASE=https://oraclemind-backend.vercel.app
NEXT_PUBLIC_AI_API_BASE=https://oraclemind-ai-eight.vercel.app
```

### 部署（Vercel）

独立 Vercel 项目，`Root Directory = oraclemind-frontend`，框架选 Next.js。在环境变量配好上面的 `NEXT_PUBLIC_*`；**改了环境变量必须 Redeploy**（Vercel 只对 push commit 自动部署，不会因改面板变量重新构建）。详见根主仓库 `docs/deployment.md`。
