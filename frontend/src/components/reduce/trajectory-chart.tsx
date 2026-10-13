'use client';

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReductionPlanContent } from '@/lib/types';
import { formatT } from './format';

const PROJECTED = '#059669';
const BASELINE = 'hsl(var(--muted-foreground))';

interface TooltipProps {
  active?: boolean;
  label?: number;
  payload?: { payload: ReductionPlanContent['trajectory'][number] }[];
}

function TrajectoryTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const cut = point.baselineTonnes - point.projectedTonnes;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      <p className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROJECTED }} />
        Projected {formatT(point.projectedTonnes)} t
      </p>
      <p className="flex items-center gap-2">
        <span className="h-0.5 w-2 bg-muted-foreground" />
        Baseline {formatT(point.baselineTonnes)} t
      </p>
      {cut > 0 && <p className="mt-1 text-muted-foreground">{formatT(cut)} t/yr avoided</p>}
    </div>
  );
}

/** Baseline (dashed line) against the projected emissions (area) for each year to the target. */
export function TrajectoryChart({ trajectory }: { trajectory: ReductionPlanContent['trajectory'] }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PROJECTED }} />
          Projected with the plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-muted-foreground" />
          Baseline (no action)
        </span>
      </div>
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trajectory} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="projected-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PROJECTED} stopOpacity={0.35} />
                <stop offset="100%" stopColor={PROJECTED} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              minTickGap={16}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              domain={[0, 'auto']}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => formatT(v)}
            />
            <Tooltip content={<TrajectoryTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }} />
            <Area
              type="stepAfter"
              dataKey="projectedTonnes"
              name="Projected"
              stroke={PROJECTED}
              strokeWidth={2}
              fill="url(#projected-fill)"
              isAnimationActive={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
            />
            <Line
              type="linear"
              dataKey="baselineTonnes"
              name="Baseline"
              stroke={BASELINE}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">t CO2e per year</p>
    </div>
  );
}
