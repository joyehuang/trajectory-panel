import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from './types';
import { parseSession } from './parse';
import { SessionList } from './components/SessionList';
import { Timeline } from './components/Timeline';
import { CommandPalette } from './components/CommandPalette';
import { KeyboardHelpButton, KeyboardHelpModal } from './components/KeyboardHelp';
import { ConnectionStatusChip } from './components/ConnectionStatus';
import { useLocalStorageSet } from './hooks/useLocalStorageSet';
import { useLiveSessions } from './hooks/useLiveSessions';

const DEMO_FILES = ['sample-1.jsonl', 'sample-2.jsonl', 'sample-3.jsonl'];

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-900 p-3 space-y-2">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-2.5 w-40 rounded" />
          <div className="skeleton h-2.5 w-32 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scrollToEventId, setScrollToEventId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { set: starred, toggle: toggleStar } = useLocalStorageSet('trajectory-panel:starred');
  const { sessions: liveSessions, status: liveStatus, activeFileName: liveActiveFileName } = useLiveSessions();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded: Session[] = [];
      for (const name of DEMO_FILES) {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}samples/${name}`);
          if (!res.ok) continue;
          const text = await res.text();
          loaded.push(parseSession(text, name));
        } catch {
          // demo data is best-effort; ignore fetch failures
        }
      }
      if (!cancelled) {
        if (loaded.length > 0) {
          setSessions(loaded);
          setSelected(loaded[0].meta.fileName);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // global shortcuts: Cmd/Ctrl+K opens the command palette, ? opens shortcut help, Esc closes overlays
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setHelpOpen(false);
        setDrawerOpen(false);
        (document.activeElement as HTMLElement | null)?.blur();
        return;
      }
      if (!typing && e.key === '?') {
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoadError(null);
    const newSessions: Session[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        newSessions.push(parseSession(text, file.name));
      } catch (err) {
        setLoadError(`加载 ${file.name} 失败：${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (newSessions.length > 0) {
      setSessions((prev) => {
        const byName = new Map(prev.map((s) => [s.meta.fileName, s]));
        for (const s of newSessions) byName.set(s.meta.fileName, s);
        return Array.from(byName.values());
      });
      setSelected(newSessions[0].meta.fileName);
      setDrawerOpen(false);
    }
  };

  const jumpTo = (fileName: string, eventId: string | null) => {
    setSelected(fileName);
    setScrollToEventId(eventId);
    setPaletteOpen(false);
    setDrawerOpen(false);
  };

  // samples + uploads, merged with live daemon/R2 sessions (live wins on fileName collision),
  // newest first — live sessions arrive in insertion order, not necessarily sorted
  const allSessions = useMemo(() => {
    const byName = new Map(sessions.map((s) => [s.meta.fileName, s]));
    for (const s of liveSessions) byName.set(s.meta.fileName, s);
    return Array.from(byName.values()).sort((a, b) => (b.meta.timestamp || '').localeCompare(a.meta.timestamp || ''));
  }, [sessions, liveSessions]);

  const activeSession = allSessions.find((s) => s.meta.fileName === selected) ?? null;

  return (
    <div className="h-dvh flex flex-col app-bg">
      <header className="flex items-center justify-between gap-2 px-3 md:px-4 py-2.5 border-b border-zinc-900 shrink-0 z-20 relative">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden w-8 h-8 rounded-md flex items-center justify-center text-zinc-300 hover:bg-zinc-900 cursor-pointer"
            aria-label="打开会话列表"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-400 via-violet-400 to-emerald-400 flex items-center justify-center text-[11px] font-bold text-zinc-950 shrink-0 shadow-[0_0_14px_rgba(125,211,252,0.25)]">
            π
          </div>
          <h1 className="text-[13px] md:text-[14px] font-medium text-zinc-100 truncate tracking-tight">Trajectory Panel</h1>
          <span className="hidden sm:inline text-[11px] text-zinc-600">Agent 轨迹可视化面板</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConnectionStatusChip status={liveStatus} />
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 text-[11.5px] px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            全局搜索
            <kbd className="text-[9.5px] font-mono px-1 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-600">⌘K</kbd>
          </button>
          <KeyboardHelpButton onClick={() => setHelpOpen(true)} />
          {loadError && (
            <span className="hidden md:inline text-[11px] text-rose-400 max-w-[180px] truncate">{loadError}</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jsonl,.json,.txt"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[12px] px-2.5 md:px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
          >
            加载会话
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-[19rem] border-r border-zinc-900 overflow-y-auto shrink-0 flex-col">
          <div className="px-3 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wide sticky top-0 bg-[#0a0a0c]/95 backdrop-blur border-b border-zinc-900 z-10">
            会话列表 ({allSessions.length})
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <SessionList
              sessions={allSessions}
              selectedFileName={selected}
              onSelect={setSelected}
              starred={starred}
              onToggleStar={toggleStar}
              liveFileName={liveActiveFileName}
            />
          )}
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-[320px] bg-[#0d0d10] border-r border-zinc-800 flex flex-col shadow-2xl animate-fade-rise">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
                <span className="text-[13px] font-medium text-zinc-100">会话列表 ({allSessions.length})</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:bg-zinc-900 cursor-pointer"
                  aria-label="关闭"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <LoadingSkeleton />
                ) : (
                  <SessionList
                    sessions={allSessions}
                    selectedFileName={selected}
                    onSelect={(name) => {
                      setSelected(name);
                      setDrawerOpen(false);
                    }}
                    starred={starred}
                    onToggleStar={toggleStar}
                    liveFileName={liveActiveFileName}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-sky-400" style={{ animation: 'spin-slow 0.8s linear infinite' }} />
                <div className="text-[12px] text-zinc-600">加载会话数据…</div>
              </div>
            </div>
          ) : activeSession ? (
            <Timeline
              key={activeSession.meta.fileName}
              session={activeSession}
              scrollToEventId={activeSession.meta.fileName === selected ? scrollToEventId : null}
              onConsumedScroll={() => setScrollToEventId(null)}
              isLive={activeSession.meta.fileName === liveActiveFileName}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[13px] text-zinc-600 px-6 text-center animate-fade-rise">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl">📡</div>
              <div className="text-zinc-400">选择一个会话查看时间线</div>
              <div className="text-[11.5px] text-zinc-700 max-w-xs leading-relaxed">
                左侧列出了已加载的会话；也可以拖入或选择本地 <span className="font-mono">.jsonl</span> 文件继续查看
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[12px] px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors cursor-pointer mt-1"
              >
                加载本地 JSONL 文件
              </button>
            </div>
          )}
        </main>
      </div>

      {paletteOpen && <CommandPalette sessions={allSessions} onClose={() => setPaletteOpen(false)} onJump={jumpTo} />}
      {helpOpen && <KeyboardHelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
