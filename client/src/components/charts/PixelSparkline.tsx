interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function PixelSparkline({ data, width = 80, height = 24, color = '#5fb27a' }: Props) {
  if (data.length === 0) {
    return <div style={{ width, height }} className="bg-cream-100 border border-ink-700" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const step = width / Math.max(1, data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="block">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}
