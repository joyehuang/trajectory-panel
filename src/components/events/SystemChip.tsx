import type { SystemEvent } from '../../types';
import { KindIcon } from './shared';
import { highlightText } from '../../utils/highlight';

export function SystemChip({ event, time, query }: { event: SystemEvent; time: string; query: string }) {
  return (
    <div
      id={`event-${event.id}`}
      data-event-id={event.id}
      className="flex items-center gap-2 pl-10 md:pl-[52px] py-1 text-[11px] text-zinc-600 scroll-mt-24"
    >
      <span className="text-zinc-700 shrink-0">
        <KindIcon name="system" className="w-3 h-3" />
      </span>
      <span>{highlightText(event.label, query)}</span>
      <span className="text-zinc-800">·</span>
      <span className="font-mono truncate">{highlightText(event.detail, query)}</span>
      {time && <span className="ml-auto text-zinc-700 shrink-0 tabular-nums">{time}</span>}
    </div>
  );
}
