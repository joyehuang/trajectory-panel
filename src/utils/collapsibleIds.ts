import type { TimelineEvent } from '../types';

/** Expand-toggle keys associated with an event, for the `e` keyboard shortcut. */
export function collapsibleIdsFor(event: TimelineEvent): string[] {
  if (event.kind === 'thinking') return [`t:${event.id}`];
  if (event.kind === 'tool_call') return [`a:${event.id}`, `r:${event.id}`];
  return [];
}
