export function Sparkline({ values, color = '#52525b', className = '' }: { values: number[]; color?: string; className?: string }) {
  const max = Math.max(1, ...values);
  const w = 100;
  const h = 20;
  const barW = w / values.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none">
      {values.map((v, i) => {
        const bh = Math.max(1, (v / max) * h);
        return (
          <rect
            key={i}
            x={i * barW + 0.5}
            y={h - bh}
            width={Math.max(0.5, barW - 1)}
            height={bh}
            rx={0.5}
            fill={color}
            opacity={v === 0 ? 0.25 : 0.85}
          />
        );
      })}
    </svg>
  );
}
