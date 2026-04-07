/**
 * DonutChart — zero-dependency SVG donut.
 *
 * I'm not pulling in recharts for one chart shape on three pages.
 * This is ~80 lines, deterministic, server-renderable, and accessible.
 *
 * Slices are passed in as raw numbers and rendered in order. Each
 * slice carries its own color (so the threat-axis colors stay
 * pinned where they belong, no theme indirection). The center slot
 * holds whatever children you pass.
 *
 * Numerical safety: if every slice value is 0, render an empty ring
 * placeholder rather than NaN paths.
 */

export interface DonutSlice {
  /** Display label, e.g. "Hash-protected". */
  label: string;
  /** Slice value in any unit; only ratios matter. */
  value: number;
  /** CSS color string, e.g. "#10b981". */
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  /** Outer SVG box dimension in px. */
  size?: number;
  /** Inner radius as a fraction of outer radius (0..1). */
  innerRadiusRatio?: number;
  /** ARIA label describing the whole chart. */
  ariaLabel: string;
  /** Children render in the center (a number, a percentage, etc). */
  children?: React.ReactNode;
}

export function DonutChart({
  slices,
  size = 220,
  innerRadiusRatio = 0.6,
  ariaLabel,
  children,
}: DonutChartProps) {
  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * innerRadiusRatio;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={ariaLabel}
      >
        {total > 0 ? (
          (() => {
            let cursor = -Math.PI / 2; // start at 12 o'clock
            return slices.map((slice) => {
              const value = Math.max(0, slice.value);
              if (value === 0) return null;
              const angle = (value / total) * Math.PI * 2;
              const startAngle = cursor;
              const endAngle = cursor + angle;
              cursor = endAngle;
              const path = arcPath(cx, cy, outerR, innerR, startAngle, endAngle);
              return (
                <path
                  key={slice.label}
                  d={path}
                  fill={slice.color}
                  stroke="#020617"
                  strokeWidth={1}
                >
                  <title>
                    {slice.label}: {fmtPct(value, total)}
                  </title>
                </path>
              );
            });
          })()
        ) : (
          <circle
            cx={cx}
            cy={cy}
            r={(outerR + innerR) / 2}
            fill="none"
            stroke="#334155"
            strokeWidth={outerR - innerR}
          />
        )}
      </svg>
      {children !== undefined && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * SVG path for an annular sector — outer arc forward, inner arc back,
 * closed. This is the standard donut-slice formula; no library.
 */
function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  const x0 = cx + rOuter * Math.cos(startAngle);
  const y0 = cy + rOuter * Math.sin(startAngle);
  const x1 = cx + rOuter * Math.cos(endAngle);
  const y1 = cy + rOuter * Math.sin(endAngle);

  const xi0 = cx + rInner * Math.cos(endAngle);
  const yi0 = cy + rInner * Math.sin(endAngle);
  const xi1 = cx + rInner * Math.cos(startAngle);
  const yi1 = cy + rInner * Math.sin(startAngle);

  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1} ${y1}`,
    `L ${xi0} ${yi0}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xi1} ${yi1}`,
    "Z",
  ].join(" ");
}

function fmtPct(value: number, total: number): string {
  if (total === 0) return "0%";
  return ((value / total) * 100).toFixed(1) + "%";
}

/**
 * Compact legend that mirrors the donut. Use it next to the chart.
 */
export function DonutLegend({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  return (
    <ul className="space-y-2 text-sm">
      {slices.map((s) => (
        <li key={s.label} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <span className="text-slate-200">{s.label}</span>
          </span>
          <span className="mono text-slate-400">{fmtPct(s.value, total)}</span>
        </li>
      ))}
    </ul>
  );
}
