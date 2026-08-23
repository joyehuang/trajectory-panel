import type { TimelineEvent } from '../types';
import { fmtClock } from '../utils/format';
import { UserCard } from './events/UserCard';
import { ThinkingCard } from './events/ThinkingCard';
import { AssistantCard } from './events/AssistantCard';
import { ToolCard } from './events/ToolCard';
import { SystemChip } from './events/SystemChip';

interface EventRowProps {
  event: TimelineEvent;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  focused: boolean;
  query: string;
  latencyMs?: number | null;
}

export function EventRow({ event, expanded, onToggle, focused, query, latencyMs = null }: EventRowProps) {
  const time = fmtClock(event.timestamp);

  switch (event.kind) {
    case 'system':
      return <SystemChip event={event} time={time} query={query} />;
    case 'user':
      return <UserCard event={event} time={time} focused={focused} query={query} latencyMs={latencyMs} />;
    case 'thinking': {
      const id = `t:${event.id}`;
      return (
        <ThinkingCard
          event={event}
          time={time}
          focused={focused}
          query={query}
          expanded={expanded.has(id)}
          onToggle={() => onToggle(id)}
        />
      );
    }
    case 'assistant_text':
      return <AssistantCard event={event} time={time} focused={focused} query={query} />;
    case 'tool_call': {
      const argsId = `a:${event.id}`;
      const resId = `r:${event.id}`;
      return (
        <ToolCard
          event={event}
          time={time}
          focused={focused}
          query={query}
          argsExpanded={expanded.has(argsId)}
          resultExpanded={expanded.has(resId)}
          onToggleArgs={() => onToggle(argsId)}
          onToggleResult={() => onToggle(resId)}
        />
      );
    }
  }
}
