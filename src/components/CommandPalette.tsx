import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '../types';
import { searchAllSessions } from '../utils/globalSearch';
import { fmtDateTime } from '../utils/format';
import { highlightText } from '../utils/highlight';

const KIND_LABEL: Record<string, string> = {
  user: '用户',
  thinking: '思考',
  tool_call: '工具',
  assistant_text: '助手',
  system: '系统',
};

export function CommandPalette({
  sessions,
  onClose,
  onJump,
}: {
  sessions: Session[];
  onClose: () => void;
  onJump: (fileName: string, eventId: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const groups = useMemo(() => searchAllSessions(sessions, query), [sessions, query]);
  const totalHits = groups.reduce((n, g) => n + g.totalCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-[#0e0e13]/95 shadow-2xl shadow-black/60 overflow-hidden animate-fade-rise flex flex-col max-h-[70vh]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-900 shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-zinc-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索全部会话…"
            className="flex-1 bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">Esc</kbd>
        </div>

        <div className="overflow-y-auto flex-1">
          {query.trim() === '' ? (
            <div className="px-4 py-10 text-center text-[12.5px] text-zinc-600">
              输入关键词，跨全部 {sessions.length} 个已加载会话搜索
            </div>
          ) : groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12.5px] text-zinc-600">没有找到匹配结果</div>
          ) : (
            <div className="py-1.5">
              <div className="px-4 py-1 text-[10.5px] text-zinc-600">
                {groups.length} 个会话 · {totalHits} 处匹配
              </div>
              {groups.map((g) => (
                <div key={g.session.meta.fileName} className="px-1.5 py-1">
                  <button
                    onClick={() => onJump(g.session.meta.fileName, null)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-900/70 cursor-pointer text-left"
                  >
                    <span className="text-[12px] font-medium text-zinc-200 truncate">
                      {g.session.meta.modelId ?? g.session.meta.fileName}
                    </span>
                    <span className="text-[10.5px] text-zinc-600 shrink-0">
                      {fmtDateTime(g.session.meta.timestamp)} · {g.totalCount} 处
                    </span>
                  </button>
                  {g.hits.map((h) => (
                    <button
                      key={h.eventId}
                      onClick={() => onJump(g.session.meta.fileName, h.eventId)}
                      className="w-full text-left px-2.5 py-1 ml-2 rounded-md hover:bg-zinc-900/50 cursor-pointer flex items-start gap-2"
                    >
                      <span className="text-[9.5px] mt-0.5 shrink-0 px-1 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                        {KIND_LABEL[h.kind]}
                      </span>
                      <span className="text-[11.5px] text-zinc-500 leading-snug line-clamp-2">
                        {highlightText(h.snippet, query)}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
