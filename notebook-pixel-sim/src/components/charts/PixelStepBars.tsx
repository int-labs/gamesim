interface Bar {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  data: Bar[];
  width?: number;
  height?: number;
  showValues?: boolean;
}

export function PixelStepBars({ data, width = 240, height = 100, showValues = true }: Props) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const pad = 6;
  const w = width - pad * 2;
  const h = height - pad * 2 - 14;
  const barW = Math.max(8, Math.floor(w / Math.max(1, data.length)) - 6);
  return (
    <svg width={width} height={height}>
      <rect x={0} y={0} width={width} height={height} fill="#fdf8ec" stroke="#2a2017" strokeWidth={2} />
      {data.map((b, i) => {
        const bx = pad + i * (barW + 6);
        const bh = (Math.abs(b.value) / max) * h;
        const by = pad + (h - bh);
        return (
          <g key={i}>
            <rect x={bx} y={by} width={barW} height={bh} fill={b.color ?? 'var(--c-fin-revenue)'} stroke="#2a2017" strokeWidth={2} />
            <text x={bx + barW / 2} y={pad + h + 12} className="chart-label" fill="#3b2e21" textAnchor="middle">
              {b.label}
            </text>
            {showValues && (
              <text x={bx + barW / 2} y={by - 2} className="chart-value" fill="#3b2e21" textAnchor="middle">
                {Math.round(b.value)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
