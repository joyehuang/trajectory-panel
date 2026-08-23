import type { Session } from '../types';
import { relativeDayLabel } from './format';

export interface SessionGroup {
  label: string;
  sessions: Session[];
}

/** Groups sessions by calendar day (newest first), preserving incoming sort order within a day. */
export function groupSessionsByDay(sessions: Session[]): SessionGroup[] {
  const order: string[] = [];
  const byLabel = new Map<string, Session[]>();
  for (const s of sessions) {
    const label = relativeDayLabel(s.meta.timestamp);
    if (!byLabel.has(label)) {
      byLabel.set(label, []);
      order.push(label);
    }
    byLabel.get(label)!.push(s);
  }
  return order.map((label) => ({ label, sessions: byLabel.get(label)! }));
}

/** Cheap activity sparkline: bucket event count across N buckets by position. */
export function activityBuckets(session: Session, bucketCount = 16): number[] {
  const n = session.events.length;
  const buckets = new Array(bucketCount).fill(0);
  if (n === 0) return buckets;
  for (let i = 0; i < n; i++) {
    const idx = Math.min(bucketCount - 1, Math.floor((i / n) * bucketCount));
    buckets[idx] += 1;
  }
  return buckets;
}
