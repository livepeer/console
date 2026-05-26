import type { NetworkStat } from "@/lib/dashboard/types";
import KpiCard from "@/components/dashboard/KpiCard";

/**
 * Thin compatibility wrapper that maps the existing NetworkStat shape onto the
 * unified `<KpiCard>` primitive. Network/Usage tabs pass `NetworkStat` objects
 * by reference; this lets us collapse three KPI implementations to one without
 * touching every caller.
 *
 * Optional `spark` and `sparkColor` pass through to `KpiCard` so monitoring
 * surfaces (Network Overview, Network GPUs) can show a small trend chip
 * inline with each stat.
 */
export default function StatCard({
  stat,
  spark,
  sparkColor,
}: {
  stat: NetworkStat;
  spark?: number[];
  sparkColor?: string;
}) {
  return (
    <KpiCard
      label={stat.label}
      value={stat.value}
      delta={stat.delta}
      trend={stat.trend ?? "flat"}
      spark={spark}
      sparkColor={sparkColor}
    />
  );
}
