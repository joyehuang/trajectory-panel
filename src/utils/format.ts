export function fmtClock(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

export function fmtDateTime(ts: string | null): string {
  if (!ts) return '未知时间';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '未知时间';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtFullDate(ts: string | null): string {
  if (!ts) return '未知日期';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '未知日期';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

/** 今天 / 昨天 / MM月DD日 style relative day label, for grouping headers. */
export function relativeDayLabel(ts: string | null): string {
  if (!ts) return '未知日期';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '未知日期';
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';
  if (diffDays > 2 && diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

export function fmtDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  if (m < 60) return `${m}m${rem ? ` ${rem}s` : ''}`;
  const h = Math.floor(m / 60);
  const remM = m - h * 60;
  return `${h}h${remM ? ` ${remM}m` : ''}`;
}

export function fmtNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function fmtCost(n: number): string {
  if (n <= 0) return '';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
