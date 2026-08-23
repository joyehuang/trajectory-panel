import type { ToolCallEvent } from '../../types';
import { EventShell, StatusBadge, DurationChip } from './shared';
import { TokenMeter } from '../TokenMeter';
import { CollapsibleText } from '../Collapsible';
import { toolCallDurationMs } from '../../utils/duration';
import { fmtDuration } from '../../utils/format';

export function ToolCard({
  event,
  time,
  focused,
  query,
  argsExpanded,
  resultExpanded,
  onToggleArgs,
  onToggleResult,
}: {
  event: ToolCallEvent;
  time: string;
  focused: boolean;
  query: string;
  argsExpanded: boolean;
  resultExpanded: boolean;
  onToggleArgs: () => void;
  onToggleResult: () => void;
}) {
  const argsStr = JSON.stringify(event.arguments, null, 2) ?? '{}';
  const durationMs = toolCallDurationMs(event);

  return (
    <EventShell
      id={event.id}
      icon="tool"
      iconColor="text-violet-400"
      iconBg="bg-violet-500/10 ring-violet-800/60"
      time={time}
      focused={focused}
      copyText={() => JSON.stringify(event, null, 2)}
    >
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-violet-400 tracking-wide">工具调用</span>
        <span className="text-[12.5px] font-mono text-zinc-200 break-all">{event.name}</span>
        <StatusBadge status={event.status} />
        {durationMs !== null && <DurationChip label={fmtDuration(durationMs)} />}
        {time && <span className="md:hidden text-[10px] text-zinc-700 tabular-nums ml-auto">{time}</span>}
      </div>

      {/* connected call → result unit */}
      <div className="rounded-lg border border-violet-900/30 bg-violet-500/[0.02] overflow-hidden">
        <div className="px-3 py-2">
          <div className="text-[10px] font-medium text-zinc-600 mb-1 tracking-wide uppercase">参数</div>
          <CollapsibleText
            text={argsStr}
            expanded={argsExpanded}
            onToggle={onToggleArgs}
            previewLength={160}
            mono
            highlight={query}
            className="text-zinc-400"
          />
        </div>

        {event.result && (
          <>
            <div className="flex items-center gap-1.5 px-3">
              <div className="w-px h-3 bg-violet-900/40" />
            </div>
            <div className={`px-3 py-2 border-t ${event.result.isError ? 'border-rose-900/40 bg-rose-500/[0.03]' : 'border-violet-900/25'}`}>
              <div className={`flex items-center gap-1 text-[10px] font-medium mb-1 tracking-wide uppercase ${event.result.isError ? 'text-rose-400' : 'text-zinc-600'}`}>
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 -rotate-90" fill="currentColor">
                  <path d="M12 15.5 5 8.5l1.4-1.4L12 12.7l5.6-5.6L19 8.5z" />
                </svg>
                {event.result.isError ? '错误' : '结果'}
              </div>
              <CollapsibleText
                text={event.result.text || '(空)'}
                expanded={resultExpanded}
                onToggle={onToggleResult}
                previewLength={160}
                mono
                highlight={query}
                className={event.result.isError ? 'text-rose-300' : 'text-zinc-400'}
              />
            </div>
          </>
        )}
      </div>

      {event.usage && <TokenMeter usage={event.usage} />}
    </EventShell>
  );
}
