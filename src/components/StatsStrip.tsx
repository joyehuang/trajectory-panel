import type { Session } from '../types';
import { fmtDuration, fmtNumber, fmtCost, fmtFullDate } from '../utils/format';
import { sessionDurationMs } from '../utils/duration';

function Chip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 shrink-0">
      <span className="text-[9.5px] uppercase tracking-wider text-zinc-600">{label}</span>
      <span className={`text-[12px] font-mono tabular-nums ${accent ?? 'text-zinc-300'}`}>{value}</span>
    </div>
  );
}

export function StatsStrip({ session }: { session: Session }) {
  const { meta } = session;
  const dur = sessionDurationMs(session);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
      <Chip label="日期" value={fmtFullDate(meta.timestamp)} />
      {dur !== null && <Chip label="时长" value={fmtDuration(dur)} accent="text-sky-300" />}
      <Chip label="轮次" value={String(meta.turnCount)} />
      <Chip label="工具" value={String(meta.toolCallCount)} accent="text-violet-300" />
      {meta.usageTotal.totalTokens > 0 && (
        <Chip label="Token" value={fmtNumber(meta.usageTotal.totalTokens)} accent="text-emerald-300" />
      )}
      {meta.usageTotal.costTotal > 0 && <Chip label="花费" value={fmtCost(meta.usageTotal.costTotal)} accent="text-amber-300" />}
    </div>
  );
}
