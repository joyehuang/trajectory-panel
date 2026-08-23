import { useEffect, useRef, useState } from 'react';
import type { Session } from '../types';
import { sessionToMarkdown, sessionSummaryText, downloadTextFile } from '../utils/markdownExport';

export function ExportMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const exportMarkdown = () => {
    const name = `${session.meta.fileName.replace(/\.jsonl?$/, '')}.md`;
    downloadTextFile(name, sessionToMarkdown(session));
    setOpen(false);
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(sessionSummaryText(session));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* no-op */
    }
    setOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors cursor-pointer"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
        </svg>
        导出
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-zinc-800 bg-[#111116] shadow-xl shadow-black/50 overflow-hidden z-20 animate-fade-rise">
          <button
            onClick={exportMarkdown}
            className="w-full text-left px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-900 cursor-pointer flex items-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            导出为 Markdown
          </button>
          <button
            onClick={copySummary}
            className="w-full text-left px-3 py-2 text-[12px] text-zinc-300 hover:bg-zinc-900 cursor-pointer flex items-center gap-2 border-t border-zinc-900"
          >
            {copied ? (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="12" height="12" rx="1.5" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            )}
            {copied ? '已复制摘要' : '复制会话摘要'}
          </button>
        </div>
      )}
    </div>
  );
}
