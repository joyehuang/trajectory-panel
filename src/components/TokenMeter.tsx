import type { TokenUsage } from '../types';
import { fmtNumber } from '../utils/format';

/** Inline segmented bar showing input / output / cache-read proportions of a usage sample. */
export function TokenMeter({ usage, compact = false }: { usage: TokenUsage; compact?: boolean }) {
  const total = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
  if (total <= 0) return null;

  const seg = (n: number) => `${Math.max(0, (n / total) * 100)}%`;

  return (
    <div className={`flex items-center gap-1.5 ${compact ? '' : 'mt-1.5'}`}>
      <div className="flex h-1 w-16 rounded-full overflow-hidden bg-zinc-900 shrink-0">
        <div style={{ width: seg(usage.input) }} className="bg-sky-500/70" />
        <div style={{ width: seg(usage.output) }} className="bg-emerald-500/70" />
        <div style={{ width: seg(usage.cacheRead) }} className="bg-amber-500/60" />
        <div style={{ width: seg(usage.cacheWrite) }} className="bg-violet-500/50" />
      </div>
      <span className="text-[10px] text-zinc-600 font-mono tabular-nums">
        {fmtNumber(usage.input)}↑ {fmtNumber(usage.output)}↓
        {usage.cacheRead > 0 ? ` ${fmtNumber(usage.cacheRead)}⚡` : ''}
      </span>
    </div>
  );
}
