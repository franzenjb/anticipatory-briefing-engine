import { renderFLChoropleth } from "@/lib/svg-map";
import type { CountyStats, CountyRisk } from "@/lib/sources";

export default function CountyMapSvg({
  stats,
  selectedCounty,
  demoMode,
  countyRisk,
  metric,
  coneCounties,
}: {
  stats: CountyStats;
  selectedCounty: string;
  demoMode: boolean;
  countyRisk?: CountyRisk[];
  metric?: "events" | "eal";
  coneCounties?: string[];
}) {
  const svg = renderFLChoropleth({ stats, selectedCounty, demoMode, countyRisk, metric, coneCounties });
  return (
    <div
      className="fl-map"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
