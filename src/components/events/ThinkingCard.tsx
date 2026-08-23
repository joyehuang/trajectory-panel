import type { ThinkingEvent } from '../../types';
import { EventShell } from './shared';
import { TokenMeter } from '../TokenMeter';
import { CollapsibleText } from '../Collapsible';

export function ThinkingCard({
  event,
  time,
  focused,
  query,
  expanded,
  onToggle,
}: {
  event: ThinkingEvent;
  time: string;
  focused: boolean;
  query: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <EventShell
      id={event.id}
      icon="brain"
      iconColor="text-indigo-300/80"
      iconBg="bg-indigo-500/10 ring-indigo-800/50"
      time={time}
      focused={focused}
      copyText={() => JSON.stringify(event, null, 2)}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-semibold text-indigo-300/70 tracking-wide">思考</span>
        {time && <span className="md:hidden text-[10px] text-zinc-700 tabular-nums">{time}</span>}
      </div>
      <div className="blueprint-grid relative rounded-lg border border-dashed border-indigo-900/50 bg-[#0b0d16]/70 px-3 py-2.5 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none rounded-lg shadow-[inset_0_1px_0_rgba(165,180,214,0.06)]" />
        <CollapsibleText
          text={event.text}
          expanded={expanded}
          onToggle={onToggle}
          previewLength={220}
          highlight={query}
          className="text-indigo-200/60 relative"
        />
      </div>
      {event.usage && <TokenMeter usage={event.usage} />}
    </EventShell>
  );
}
