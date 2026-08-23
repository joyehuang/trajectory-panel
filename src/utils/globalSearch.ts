import type { Session, TimelineEvent } from '../types';

export interface GlobalSearchHit {
  sessionKey: string;
  eventId: string;
  kind: TimelineEvent['kind'];
  snippet: string;
}

export interface GlobalSearchGroup {
  session: Session;
  hits: GlobalSearchHit[];
  totalCount: number;
}

function eventText(e: TimelineEvent): string {
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

function snippetAround(text: string, query: string, radius = 48): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

const KIND_KEY = (session: Session) => session.meta.fileName;

/** Cross-session search — returns per-session grouped hits, most-hits-first, capped per session. */
export function searchAllSessions(sessions: Session[], query: string, maxPerSession = 4): GlobalSearchGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const groups: GlobalSearchGroup[] = [];
  for (const session of sessions) {
    const hits: GlobalSearchHit[] = [];
    let totalCount = 0;
    for (const e of session.events) {
      const text = eventText(e);
      if (!text.toLowerCase().includes(q)) continue;
      totalCount += 1;
      if (hits.length < maxPerSession) {
        hits.push({
          sessionKey: KIND_KEY(session),
          eventId: e.id,
          kind: e.kind,
          snippet: snippetAround(text, q),
        });
      }
    }
    if (totalCount > 0) groups.push({ session, hits, totalCount });
  }
  return groups.sort((a, b) => b.totalCount - a.totalCount);
}
