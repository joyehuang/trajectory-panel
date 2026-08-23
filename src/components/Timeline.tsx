import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session, TimelineEvent } from '../types';
import { EventRow } from './EventRow';
import { collapsibleIdsFor } from '../utils/collapsibleIds';
import { FilterBar, type Filters } from './FilterBar';
import { SearchBox } from './SearchBox';
import { StatsStrip } from './StatsStrip';
import { ExportMenu } from './ExportMenu';
import { responseLatencyMap } from '../utils/duration';

interface TimelineProps {
  session: Session;
  scrollToEventId?: string | null;
  onConsumedScroll?: () => void;
  isLive?: boolean;
}

const KIND_DOT: Record<TimelineEvent['kind'], string> = {
  user: '#38bdf8',
  thinking: '#818cf8',
  tool_call: '#c084fc',
  assistant_text: '#34d399',
  system: '#52525b',
};

function searchableText(e: TimelineEvent): string {
  switch (e.kind) {
    case 'user':
    case 'thinking':
    case 'assistant_text':
      return e.text;
    case 'system':
      return `${e.label} ${e.detail}`;
    case 'tool_call':
      return `${e.name} ${JSON.stringify(e.arguments)} ${e.result?.text ?? ''}`;
  }
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}

export function Timeline({ session, scrollToEventId = null, onConsumedScroll, isLive = false }: TimelineProps) {
  const [filters, setFilters] = useState<Filters>({ thinking: true, tools: true, system: true });
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const latencyMap = useMemo(() => responseLatencyMap(session.events), [session]);

  const events = useMemo(() => {
    const q = search.trim().toLowerCase();
    return session.events.filter((e) => {
      if (e.kind === 'thinking' && !filters.thinking) return false;
      if (e.kind === 'tool_call' && !filters.tools) return false;
      if (e.kind === 'system' && !filters.system) return false;
      if (q && !searchableText(e).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [session, filters, search]);

  // jump-to-event from the global command palette
  useEffect(() => {
    if (!scrollToEventId) return;
    const el = document.getElementById(`event-${scrollToEventId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedId(scrollToEventId);
      setFlashId(scrollToEventId);
      const t = setTimeout(() => setFlashId(null), 1200);
      onConsumedScroll?.();
      return () => clearTimeout(t);
    }
    onConsumedScroll?.();
  }, [scrollToEventId, onConsumedScroll]);

  // live sessions: auto-scroll to newly-arrived events, but only if the user
  // hasn't scrolled up to read earlier history — never yank them back down
  const eventCount = session.events.length;
  useEffect(() => {
    if (!isLive || !nearBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, eventCount]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = atBottom;
    setNearBottom(atBottom);
  };

  // keyboard: j/k move focus, e toggles expand of the focused event
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (events.length === 0) return;

      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const currentIdx = focusedId ? events.findIndex((ev) => ev.id === focusedId) : -1;
        const delta = e.key === 'j' ? 1 : -1;
        const nextIdx = Math.min(events.length - 1, Math.max(0, currentIdx + delta));
        const nextEvent = events[nextIdx];
        setFocusedId(nextEvent.id);
        document.getElementById(`event-${nextEvent.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (e.key === 'e' && focusedId) {
        const ev = events.find((x) => x.id === focusedId);
        if (!ev) return;
        const ids = collapsibleIdsFor(ev);
        if (ids.length === 0) return;
        const anyCollapsed = ids.some((id) => !expanded.has(id));
        setExpanded((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            if (anyCollapsed) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [events, focusedId, expanded]);

  const { meta } = session;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* session header */}
      <div className="px-3 md:px-5 pt-3 pb-2.5 border-b border-zinc-900 shrink-0 bg-[#0a0a0c]/95 backdrop-blur">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h2 className="text-[13px] md:text-[14px] font-medium text-zinc-100 font-mono">
            {meta.modelId ?? '会话'}
          </h2>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-800/60">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </span>
              进行中
            </span>
          )}
          {meta.thinkingLevel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-500 border border-zinc-800">
              thinking: {meta.thinkingLevel}
            </span>
          )}
          <ExportMenu session={session} />
        </div>

        <StatsStrip session={session} />

        <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
          <FilterBar filters={filters} onChange={setFilters} />
          <SearchBox ref={searchRef} value={search} onChange={setSearch} />
        </div>
      </div>

      {/* timeline body */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 md:px-5 pb-16">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-700">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </div>
            <div className="text-[12.5px] text-zinc-600">没有匹配的事件</div>
          </div>
        ) : (
          <div className="relative max-w-3xl mx-auto">
            <div className="absolute left-[9px] md:left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-zinc-800 via-zinc-800/50 to-transparent" />
            {events.map((e, i) => (
              <div
                key={e.id}
                className={flashId === e.id ? 'animate-pulse-ring rounded-lg' : ''}
                style={{ animationDelay: `${Math.min(i, 20) * 12}ms` }}
              >
                <EventRow
                  event={e}
                  expanded={expanded}
                  onToggle={toggle}
                  focused={focusedId === e.id}
                  query={search}
                  latencyMs={e.kind === 'user' ? (latencyMap.get(e.id) ?? null) : null}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* scrubber rail — clickable event-position markers, desktop only */}
      {events.length > 3 && (
        <div className="hidden lg:block w-6 shrink-0 relative py-3 pr-2">
          <div className="absolute left-1/2 top-3 bottom-3 w-px bg-zinc-900" />
          {events.map((e, i) => (
            <button
              key={e.id}
              onClick={() => {
                document.getElementById(`event-${e.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setFocusedId(e.id);
              }}
              title={`${e.kind} · ${i + 1}/${events.length}`}
              style={{ top: `${(i / Math.max(1, events.length - 1)) * 100}%`, backgroundColor: KIND_DOT[e.kind] }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer transition-all ${
                focusedId === e.id ? 'w-2 h-2 ring-2 ring-offset-1 ring-offset-[#0a0a0c] ring-zinc-400' : 'w-1.5 h-1.5 opacity-50 hover:opacity-90'
              }`}
            />
          ))}
        </div>
      )}

      {isLive && !nearBottom && (
        <button
          onClick={() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            nearBottomRef.current = true;
            setNearBottom(true);
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-emerald-500 text-emerald-950 font-medium shadow-lg shadow-emerald-500/20 cursor-pointer animate-fade-rise"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          跳到最新
        </button>
      )}
      </div>
    </div>
  );
}
