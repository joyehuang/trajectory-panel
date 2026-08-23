# Trajectory Panel（开源 Demo 版）

> Agent 轨迹可视化面板 —— 把 coding agent（pi / Claude Code / Codex）的 `.jsonl` 会话记录渲染成一条可读的纵向时间线：用户提问、思考过程、工具调用与结果、助手回复。

这是 **开源演示版**：仓库内所有会话数据都是脚本生成的**纯虚构 mock 数据**，不含任何真实用户会话、真实凭据或私人信息。克隆下来 `npm run dev` 即可直接看到完整界面。

在线 Demo：部署后的 Vercel 地址（见仓库首页 About）

---

## 功能

- **时间线视图** —— 每个会话一条纵向流：用户消息、思考块（可折叠的深色卡片）、工具调用及其参数/结果、助手回复
- **搜索与过滤** —— `⌘K` 全局搜索（跨会话），按事件类型 / 模型 / 时间过滤
- **键盘导航** —— `j` / `k` 上下移动，`e` 展开折叠，`?` 查看全部快捷键
- **会话浏览** —— 按天分组、收藏置顶（localStorage 持久化）、每个会话一条 token 走势 sparkline
- **Token 用量** —— 每条消息的输入 / 输出 / 缓存 token 条形图与成本汇总
- **导出** —— 复制单个事件的原始 JSON，或把整个会话导出为 Markdown
- **本地文件** —— 直接选择本机 `.jsonl` 会话文件加载查看，数据不出浏览器
- **可选实时** —— 本地 daemon tail 会话文件 → 脱敏 → WebSocket 推送 / 同步 Turso，前端轮询展示（默认关闭，见下）

## 架构

```
agent 会话文件 (*.jsonl)
        │
        ├──────────────► 浏览器直接加载（本地文件 / public/samples 内置 mock）
        │
        ▼
daemon/server.js ──(tail + 脱敏)──► Turso (sessions / events 两张表)
        │                                     ▲
        │ WebSocket (localhost:8787)          │ HTTP
        ▼                                     ▼
   前端 (React + Vite)  ◄──── Vercel API 路由 (/api/sessions)
```

| 目录 | 说明 |
| --- | --- |
| `src/` | React 前端：`parse.ts` 把原始 JSONL 解析成 `TimelineEvent[]`，`components/` 是时间线各类卡片 |
| `public/samples/` | 内置的**虚构** demo 会话，由 `scripts/generate-fake-samples.py` 生成 |
| `daemon/` | 可选的本地 Node 守护进程：`fs.watch` + 按字节偏移增量 tail 会话 JSONL，脱敏后广播 WebSocket 并写入 Turso |
| `api/` | 可选的 Vercel serverless 路由：`GET /api/sessions`（列表）、`GET /api/sessions/:id`（详情），从 Turso 读数据 |
| `scripts/` | mock 数据生成脚本 |

## 快速开始

```bash
git clone https://github.com/joyehuang/trajectory-panel.git
cd trajectory-panel
npm install
npm run dev      # http://localhost:5173
```

打开后左侧会列出三个内置 demo 会话，点任意一个即可查看时间线。也可以点右上角「加载会话」选择本机的 `.jsonl` 文件。

其他命令：

```bash
npm run build    # tsc -b && vite build，产物在 dist/
npm run preview  # 本地预览生产构建
npm run lint     # oxlint
```

重新生成 mock 数据：

```bash
python3 scripts/generate-fake-samples.py    # 覆盖写入 public/samples/
```

## 支持的会话格式

前端 `src/parse.ts` 逐行解析 JSONL，识别这些行类型：

- `{"type":"session", ...}` —— 会话头（id / 时间戳 / cwd / 模型）
- `{"type":"message", "message":{"role":"user"|"assistant"|"toolResult", "content":[...]}}` —— 内容块支持 `text` / `thinking` / `toolCall` / `toolResult`
- 顶层的 `usage` / `model` / `stopReason` 字段用于 token 统计与模型标签

pi 的原生格式开箱即用；Claude Code / Codex 的 transcript 结构相近，缺字段会安全降级（不会崩，只是少显示一些元信息）。

## 可选：接入实时数据

Demo 版默认**不**连接任何后端，只渲染 mock 数据（右上角状态显示「演示数据」）。想接真实数据：

1. 准备一个 [Turso](https://turso.tech) 数据库，把 `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` 写进 `~/.config/turso/env`（daemon 用）和部署平台的环境变量（API 路由用）。
2. 启动本地 daemon：

   ```bash
   cd daemon && npm install
   node server.js --dir ~/.pi/agent/sessions/<你的项目目录>
   # 监听 :8787 提供 WebSocket，并把脱敏后的事件写入 Turso
   ```

3. 构建前端时打开实时开关：

   ```bash
   VITE_LIVE_DATA=1 npm run build
   ```

   前端会优先连本地 daemon 的 WebSocket（真实时），连不上则退回轮询 `/api/sessions`（约 2.5 秒延迟，手机等异地设备也能看）。

更多参数、DB schema 和 launchd 常驻配置见 [`daemon/README.md`](daemon/README.md)。

## 数据与隐私

- 仓库里的 `public/samples/*.jsonl` 全部由 `scripts/generate-fake-samples.py` 生成，是虚构内容，**不包含任何真实会话**。
- `daemon/lib/redact.js` 会在数据离开本机前剥离常见密钥形态（Telegram bot token、`sk-` / `ghp_` / `AKIA` / `xox*` / `Bearer …` 等）以及疑似 secret 的字段名。
- 浏览器里「加载本地 JSONL」是纯前端读取，文件不会被上传到任何服务器。

## 部署

```bash
vercel --prod    # 静态构建 + api/ serverless 路由
```

`vercel.json` 里配置了构建命令、输出目录和 SPA rewrite。只跑 demo 的话不需要任何环境变量；要启用 `/api/sessions` 才需要配 Turso 变量。

## 技术栈

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Node（daemon，仅依赖 `ws` + `@libsql/client`）· Turso / libSQL

## License

MIT
