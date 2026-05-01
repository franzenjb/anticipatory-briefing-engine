import { renderFLChoropleth } from "@/lib/svg-map";
import type { CountyStats } from "@/lib/sources";

export default function CountyMapSvg({
  stats,
  selectedCounty,
  demoMode,
}: {
  stats: CountyStats;
  selectedCounty: string;
  demoMode: boolean;
}) {
  const svg = renderFLChoropleth({ stats, selectedCounty, demoMode });
  return (
    <div
      className="fl-map"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
