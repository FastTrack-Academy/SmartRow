interface Series {
  name: string;
  values: (number | null)[];
  color: string;
  dashed?: boolean;
}
interface Props {
  series: Series[];
  lower?: number[];
  upper?: number[];
  title: string;
  xLabel: string;
  xMax: number;
  markers?: { index: number; label: string }[];
}

export function SignalChart({
  series,
  lower,
  upper,
  title,
  xLabel,
  xMax,
  markers = [],
}: Props) {
  const values = [
    ...series.flatMap((item) => item.values),
    ...(lower ?? []),
    ...(upper ?? []),
  ].filter((v): v is number => v !== null && Number.isFinite(v));
  if (!values.length) return <p>No measurements available.</p>;
  const min = Math.floor((Math.min(...values) - 5) / 10) * 10;
  const max = Math.ceil((Math.max(...values) + 5) / 10) * 10;
  const count = series[0].values.length;
  const x = (index: number) => 58 + (index / Math.max(1, count - 1)) * 802;
  const y = (value: number) => 230 - ((value - min) / (max - min)) * 200;
  function path(data: (number | null)[]) {
    let connected = false;
    return data
      .map((value, i) => {
        if (value === null) {
          connected = false;
          return "";
        }
        const command = connected ? "L" : "M";
        connected = true;
        return `${command}${x(i).toFixed(2)},${y(value).toFixed(2)}`;
      })
      .join(" ");
  }
  return (
    <div
      className="chart"
      tabIndex={0}
      role="region"
      aria-label={`${title}. Scroll horizontally on a small screen.`}
    >
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
        {lower ? (
          <span>
            <i className="band-key" />
            Reference ±1 SD
          </span>
        ) : null}
      </div>
      <svg viewBox="0 0 900 290" role="img" aria-label={title}>
        <title>{title}</title>
        <text x="15" y="16" className="axis-label">
          Degrees
        </text>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = min + ((max - min) * tick) / 4;
          return (
            <g key={tick}>
              <line
                x1="58"
                x2="860"
                y1={y(value)}
                y2={y(value)}
                className="gridline"
              />
              <text x="46" y={y(value) + 4} textAnchor="end">
                {value.toFixed(0)}°
              </text>
            </g>
          );
        })}
        {lower && upper ? (
          <path
            d={`${path(upper)} ${lower
              .map((_, reverse) => {
                const i = lower.length - 1 - reverse;
                return `L${x(i)},${y(lower[i])}`;
              })
              .join(" ")} Z`}
            fill="#147d8018"
          />
        ) : null}
        {markers.map((marker) => (
          <g key={`${marker.label}-${marker.index}`}>
            <line
              x1={x(marker.index)}
              x2={x(marker.index)}
              y1="30"
              y2="230"
              stroke="#9aabb3"
              strokeDasharray="4 5"
            />
            <text x={x(marker.index)} y="20" textAnchor="middle">
              {marker.label}
            </text>
          </g>
        ))}
        {series.map((item) => (
          <path
            key={item.name}
            d={path(item.values)}
            fill="none"
            stroke={item.color}
            strokeWidth="2.5"
            strokeDasharray={item.dashed ? "5 4" : undefined}
          />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <text
            key={fraction}
            x={x(fraction * (count - 1))}
            y="251"
            textAnchor="middle"
          >
            {(fraction * xMax).toFixed(xMax === 99 ? 0 : 1)}
          </text>
        ))}
        <text x="450" y="278" textAnchor="middle" className="axis-label">
          {xLabel}
        </text>
      </svg>
    </div>
  );
}
