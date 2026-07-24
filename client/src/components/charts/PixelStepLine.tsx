interface Props {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  positiveOnly?: boolean;
  label?: string;
}

export function PixelStepLine({ data, width = 220, height = 60, stroke = '#5fb27a', fill = 'rgba(95,178,122,0.18)', label }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{ maxWidth: width, height, aspectRatio: `${width} / ${height}` }}
        className="w-full max-w-full flex items-center justify-center bg-cream-100 border-2 border-ink-900 font-hud text-[10px] text-ink-700"
      >
        No data
      </div>
    );
  }
  const min = Math.min(0, ...data);
  const max = Math.max(...data, 0);
  const range = Math.max(1, max - min);
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = w / Math.max(1, data.length - 1);
  const y = (v: number) => pad + h - ((v - min) / range) * h;
  const points: string[] = [];
  data.forEach((v, i) => {
    const x = pad + i * step;
    if (i === 0) {
      points.push(`${x},${y(v)}`);
    } else {
      points.push(`${x},${y(data[i - 1])}`);
      points.push(`${x},${y(v)}`);
    }
  });
  const path = points.join(' ');
  const areaPath = `M ${pad},${y(0)} L ${path.split(' ').join(' L ')} L ${pad + w},${y(0)} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full max-w-full h-auto"
      style={{ maxWidth: width }}
    >
      {label && (
        <text x={pad} y={10} className="font-hud" fontSize={9} fill="#5a4a37">
          {label}
        </text>
      )}
      <rect x={0} y={0} width={width} height={height} fill="#fdf8ec" stroke="#2a2017" strokeWidth={2} />
      {/* gridline at 0 */}
      <line x1={pad} y1={y(0)} x2={pad + w} y2={y(0)} stroke="#bfae90" strokeDasharray="2 3" />
      <path d={areaPath} fill={fill} />
      <polyline points={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="butt" strokeLinejoin="miter" />
    </svg>
  );
}
