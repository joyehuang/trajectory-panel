import type { AssistantTextEvent } from '../../types';
import { EventShell } from './shared';
import { TokenMeter } from '../TokenMeter';
import { highlightText } from '../../utils/highlight';

export function AssistantCard({
  event,
  time,
  focused,
  query,
}: {
  event: AssistantTextEvent;
  time: string;
  focused: boolean;
  query: string;
}) {
  return (
    <EventShell
      id={event.id}
      icon="reply"
      iconColor="text-emerald-400"
      iconBg="bg-emerald-500/10 ring-emerald-800/60"
      time={time}
      focused={focused}
      copyText={() => JSON.stringify(event, null, 2)}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-semibold text-emerald-400 tracking-wide">助手</span>
        {time && <span className="md:hidden text-[10px] text-zinc-700 tabular-nums">{time}</span>}
      </div>
      <div className="text-[13px] text-zinc-100 whitespace-pre-wrap break-words leading-[1.65]">
        {highlightText(event.text, query)}
      </div>
      {event.usage && <TokenMeter usage={event.usage} />}
    </EventShell>
  );
}
