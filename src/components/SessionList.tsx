import { useMemo, useState } from 'react';
import type { Session } from '../types';
import { fmtDateTime, fmtNumber, fmtCost } from '../utils/format';
import { groupSessionsByDay, activityBuckets } from '../utils/sessionGroups';
import { Sparkline } from './Sparkline';

interface SessionListProps {
  sessions: Session[];
  selectedFileName: string | null;
  onSelect: (fileName: string) => void;
  starred: Set<string>;
  onToggleStar: (fileName: string) => void;
  liveFileName?: string | null;
}

function LivePulseDot() {
  return (
    <span className="relative flex w-1.5 h-1.5 shrink-0" title="进行中 — 正在实时写入">
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
      <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
    </span>
  );
}

function StarButton({ starred, onClick }: { starred: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={starred ? '取消置顶' : '置顶会话'}
      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
        starred ? 'text-amber-400' : 'text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-zinc-400'
      }`}
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.5 6.9-6.1-3.6-6.1 3.6 1.5-6.9-5.2-4.7 6.9-.7z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function SessionItem({
  session,
  active,
  starred,
  live,
  onSelect,
  onToggleStar,
}: {
  session: Session;
  active: boolean;
  starred: boolean;
  live: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
}) {
  const buckets = useMemo(() => activityBuckets(session), [session]);
  return (
    <button
      onClick={onSelect}
      className={`group relative w-full text-left px-3 py-2.5 border-b border-zinc-900/80 transition-colors cursor-pointer ${
        active ? 'bg-zinc-900/90' : 'hover:bg-zinc-900/40'
      }`}
    >
      {active && <span className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-gradient-to-b from-sky-400 to-violet-400" />}
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1.5 text-[12.5px] truncate ${active ? 'text-zinc-100' : 'text-zinc-300'}`}>
          {live && <LivePulseDot />}
          {fmtDateTime(session.meta.timestamp)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <StarButton starred={starred} onClick={onToggleStar} />
          {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {session.meta.modelId && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 truncate max-w-[140px] font-mono">
            {session.meta.modelId}
          </span>
        )}
        <span className="text-[10px] text-zinc-600">{session.meta.turnCount} 轮</span>
        <span className="text-[10px] text-zinc-600">{session.meta.toolCallCount} 调用</span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-1.5">
        <div className="text-[10px] text-zinc-700 font-mono truncate">
          {session.meta.usageTotal.totalTokens > 0
            ? `${fmtNumber(session.meta.usageTotal.totalTokens)} tok${session.meta.usageTotal.costTotal > 0 ? ` · ${fmtCost(session.meta.usageTotal.costTotal)}` : ''}`
            : session.meta.fileName}
        </div>
        <Sparkline values={buckets} color={active ? '#7dd3fc' : '#52525b'} className="w-12 h-3 shrink-0 opacity-80" />
      </div>
    </button>
  );
}

export function SessionList({ sessions, selectedFileName, onSelect, starred, onToggleStar, liveFileName = null }: SessionListProps) {
  const [modelFilter, setModelFilter] = useState<string | null>(null);

  const models = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) if (s.meta.modelId) set.add(s.meta.modelId);
    return Array.from(set);
  }, [sessions]);

  const filtered = useMemo(
    () => (modelFilter ? sessions.filter((s) => s.meta.modelId === modelFilter) : sessions),
    [sessions, modelFilter],
  );

  const pinned = useMemo(() => filtered.filter((s) => starred.has(s.meta.fileName)), [filtered, starred]);
  const unpinned = useMemo(() => filtered.filter((s) => !starred.has(s.meta.fileName)), [filtered, starred]);
  const groups = useMemo(() => groupSessionsByDay(unpinned), [unpinned]);

  if (sessions.length === 0) {
    return (
      <div className="text-[12px] text-zinc-600 px-3 py-8 text-center leading-relaxed">
        暂无会话
        <br />
        加载一个 JSONL 文件开始
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {models.length > 1 && (
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto shrink-0 border-b border-zinc-900/80">
          <button
            onClick={() => setModelFilter(null)}
            className={`text-[10.5px] px-2 py-1 rounded-full border whitespace-nowrap transition-colors cursor-pointer ${
              modelFilter === null ? 'border-zinc-600 bg-zinc-800 text-zinc-100' : 'border-zinc-800/60 text-zinc-600 hover:text-zinc-400'
            }`}
          >
            全部
          </button>
          {models.map((m) => (
            <button
              key={m}
              onClick={() => setModelFilter(m)}
              className={`text-[10.5px] px-2 py-1 rounded-full border whitespace-nowrap font-mono transition-colors cursor-pointer ${
                modelFilter === m ? 'border-zinc-600 bg-zinc-800 text-zinc-100' : 'border-zinc-800/60 text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {pinned.length > 0 && (
        <div>
          <div className="px-3 pt-2.5 pb-1 text-[10px] font-medium text-amber-400/80 uppercase tracking-wide flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor">
              <path d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.5 6.9-6.1-3.6-6.1 3.6 1.5-6.9-5.2-4.7 6.9-.7z" />
            </svg>
            已置顶
          </div>
          {pinned.map((s) => (
            <SessionItem
              key={s.meta.fileName}
              session={s}
              active={s.meta.fileName === selectedFileName}
              starred
              live={s.meta.fileName === liveFileName}
              onSelect={() => onSelect(s.meta.fileName)}
              onToggleStar={() => onToggleStar(s.meta.fileName)}
            />
          ))}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pt-2.5 pb-1 text-[10px] font-medium text-zinc-600 uppercase tracking-wide sticky top-0 bg-[#0a0a0c]/95 backdrop-blur z-10">
            {group.label}
          </div>
          {group.sessions.map((s) => (
            <SessionItem
              key={s.meta.fileName}
              session={s}
              active={s.meta.fileName === selectedFileName}
              starred={starred.has(s.meta.fileName)}
              live={s.meta.fileName === liveFileName}
              onSelect={() => onSelect(s.meta.fileName)}
              onToggleStar={() => onToggleStar(s.meta.fileName)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
