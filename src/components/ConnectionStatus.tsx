import type { ConnectionStatus as Status } from '../hooks/useLiveSessions';

const CONFIG: Record<Status, { label: string; dot: string; text: string; ring: string; title: string }> = {
  demo: {
    label: '演示数据',
    dot: 'bg-sky-400',
    text: 'text-sky-400',
    ring: 'border-sky-900/60',
    title: '当前展示内置 mock 会话（纯虚构）。设置 VITE_LIVE_DATA=1 可接入本地 daemon / Turso 实时数据',
  },
  connecting: {
    label: '连接中',
    dot: 'bg-zinc-500',
    text: 'text-zinc-500',
    ring: 'border-zinc-800',
    title: '正在尝试连接本地实时守护进程…',
  },
  ws: {
    label: '实时连接',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    ring: 'border-emerald-900/60',
    title: '已通过 WebSocket 连接本地守护进程（ws://localhost:8787）— 真实时',
  },
  poll: {
    label: '轮询同步',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    ring: 'border-amber-900/60',
    title: '本地守护进程不可达，正在轮询 R2 云端数据（约 5 秒延迟）',
  },
  offline: {
    label: '离线样本',
    dot: 'bg-zinc-600',
    text: 'text-zinc-500',
    ring: 'border-zinc-800',
    title: '无法连接实时数据源，仅展示内置样本 / 已加载文件',
  },
};

export function ConnectionStatusChip({ status }: { status: Status }) {
  const c = CONFIG[status];
  return (
    <div
      title={c.title}
      className={`hidden sm:flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border bg-zinc-900/60 ${c.ring} ${c.text} shrink-0`}
    >
      <span className="relative flex w-1.5 h-1.5">
        {status === 'ws' && <span className={`absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-75 animate-ping`} />}
        <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${c.dot}`} />
      </span>
      {c.label}
    </div>
  );
}
