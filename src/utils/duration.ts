import type { Session, TimelineEvent, ToolCallEvent } from '../types';

function tsMs(ts: string | null): number | null {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? null : t;
}

export function toolCallDurationMs(event: ToolCallEvent): number | null {
  const a = tsMs(event.timestamp);
  const b = tsMs(event.resultTimestamp);
  if (a === null || b === null) return null;
  return Math.max(0, b - a);
}

export function sessionDurationMs(session: Session): number | null {
  let min: number | null = null;
  let max: number | null = null;
  for (const e of session.events) {
    const t = tsMs(e.timestamp);
    if (t === null) continue;
    if (min === null || t < min) min = t;
    if (max === null || t > max) max = t;
  }
  if (min === null || max === null) return null;
  return max - min;
}

/**
 * Response latency: for each user event, time until the next event in the
 * stream (the agent's first reaction — thinking, a tool call, or a reply).
 * Keyed by user event id.
 */
export function responseLatencyMap(events: TimelineEvent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind !== 'user') continue;
    const from = tsMs(e.timestamp);
    if (from === null) continue;
    for (let j = i + 1; j < events.length; j++) {
      const next = events[j];
      const to = tsMs(next.timestamp);
      if (to === null) continue;
      if (to > from) map.set(e.id, to - from);
      break;
    }
  }
  return map;
}
