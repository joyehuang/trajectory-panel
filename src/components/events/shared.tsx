import type { ReactNode } from 'react';
import type { ToolStatus } from '../../types';

export type IconName = 'user' | 'brain' | 'tool' | 'reply' | 'system';

export function KindIcon({ name, className = 'w-3.5 h-3.5' }: { name: IconName; className?: string }) {
  switch (name) {
    case 'user':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      );
    case 'brain':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="4" y="4" width="16" height="16" rx="1.5" strokeDasharray="2.5 2" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 4v3.5M12 16.5V20M4 12h3.5M16.5 12H20" />
        </svg>
      );
    case 'tool':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2z" />
        </svg>
      );
    case 'reply':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v12H8l-4 4V4z" />
        </svg>
      );
    case 'system':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1z" />
        </svg>
      );
  }
}

export function StatusBadge({ status }: { status: ToolStatus }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
        运行中
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-950/70 text-rose-400 border border-rose-900/70">错误</span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-900/60">完成</span>
  );
}

export function DurationChip({ label }: { label: string }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800 font-mono tabular-nums">
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
      {label}
    </span>
  );
}

interface RowProps {
  id: string;
  icon: IconName;
  iconColor: string;
  iconBg: string;
  time: string;
  focused: boolean;
  children: ReactNode;
  copyText: () => string;
}

export function EventShell({ id, icon, iconColor, iconBg, time, focused, children, copyText }: RowProps) {
  return (
    <div
      id={`event-${id}`}
      data-event-id={id}
      className={`relative flex gap-2.5 md:gap-3 py-2 md:py-2.5 group scroll-mt-24 rounded-lg transition-shadow duration-200 ${
        focused ? 'ring-1 ring-sky-500/50 bg-sky-500/[0.03]' : ''
      }`}
    >
      <div className="flex flex-col items-center w-5 md:w-6 shrink-0 relative z-10">
        <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center ring-1 ${iconBg} ${iconColor} bg-[#08080a]`}>
          <KindIcon name={icon} />
        </div>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
      <div className="hidden md:flex flex-col items-end gap-1 shrink-0 pt-1">
        <span className="text-[10px] text-zinc-700 tabular-nums">{time}</span>
        <CopyIconButton getText={copyText} />
      </div>
    </div>
  );
}

function CopyIconButton({ getText }: { getText: () => string }) {
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
        } catch {
          /* no-op */
        }
      }}
      title="复制事件 JSON"
      className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center text-zinc-700 hover:text-zinc-300 hover:bg-zinc-900 cursor-pointer"
    >
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="12" height="12" rx="1.5" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
    </button>
  );
}
