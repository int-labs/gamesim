interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  width?: number;
  height?: number;
  showLabels?: boolean;
}

export function PixelStackedBar({ data, width = 240, height = 22, showLabels = true }: Props) {
  const total = Math.max(1, data.reduce((a, b) => a + b.value, 0));
  let x = 0;
  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full h-auto"
        style={{ height }}
      >
        <rect x={0} y={0} width={width} height={height} fill="#fdf8ec" stroke="#2a2017" strokeWidth={2} />
        {data.map((d) => {
          const w = (d.value / total) * (width - 4);
          const rect = <rect key={d.label} x={2 + x} y={2} width={w} height={height - 4} fill={d.color} />;
          x += w;
          return rect;
        })}
      </svg>
      {showLabels && (
        <div className="flex flex-wrap gap-2 chart-label">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 border border-ink-900" style={{ background: d.color }} />
              <span>
                {d.label} {Math.round(d.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
