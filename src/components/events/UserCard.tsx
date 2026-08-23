import type { UserEvent } from '../../types';
import { EventShell, DurationChip } from './shared';
import { TokenMeter } from '../TokenMeter';
import { highlightText } from '../../utils/highlight';
import { fmtDuration } from '../../utils/format';

export function UserCard({
  event,
  time,
  focused,
  query,
  latencyMs,
}: {
  event: UserEvent;
  time: string;
  focused: boolean;
  query: string;
  latencyMs: number | null;
}) {
  return (
    <EventShell
      id={event.id}
      icon="user"
      iconColor="text-sky-400"
      iconBg="bg-sky-500/10 ring-sky-800/60"
      time={time}
      focused={focused}
      copyText={() => JSON.stringify(event, null, 2)}
    >
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <span className="text-[11px] font-semibold text-sky-400 tracking-wide">用户</span>
        {latencyMs !== null && latencyMs > 800 && <DurationChip label={`响应 ${fmtDuration(latencyMs)}`} />}
        {time && <span className="md:hidden text-[10px] text-zinc-700 tabular-nums">{time}</span>}
      </div>
      <div className="text-[13px] text-zinc-100 whitespace-pre-wrap break-words leading-relaxed">
        {highlightText(event.text, query)}
      </div>
      {event.usage && <TokenMeter usage={event.usage} />}
    </EventShell>
  );
}
