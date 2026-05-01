"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const Plot: any = dynamic(
  async () => {
    const Plotly = (await import("plotly.js-dist-min")).default;
    const createPlotlyComponent = (await import("react-plotly.js/factory")).default;
    return createPlotlyComponent(Plotly);
  },
  { ssr: false }
);

type CountyStats = Record<string, { name: string; events: number; declarations: number; lastEvent?: string }>;

export default function CountyMap({
  stats,
  selectedCounty,
  demoMode,
}: {
  stats: CountyStats;
  selectedCounty: string;
  demoMode: boolean;
}) {
  const [geo, setGeo] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/fl-counties.geojson")
      .then((r) => r.json())
      .then(setGeo);
  }, []);

  if (!geo) {
    return (
      <div style={{ height: 520, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--rule)", borderRadius: 4, background: "var(--bg-card)" }}>
        <p className="muted">Loading map…</p>
      </div>
    );
  }

  const locations = geo.features.map((f: any) => f.id);
  const z = geo.features.map((f: any) => stats[f.id]?.events ?? 0);
  const text = geo.features.map((f: any) => {
    const name = (f.properties?.name || "").replace(/ County$/, "");
    const s = stats[f.id];
    if (!s) return `<b>${name}</b><br>No FEMA hurricane declarations<br>since 2000`;
    return `<b>${name}</b><br>${s.events} hurricane events declared<br>${s.declarations} per-program rows<br>Last: ${s.lastEvent || "—"}<br><i>click to drill down</i>`;
  });

  // Demo storm cone — synthetic Cat 3 approaching Tampa Bay
  const conePath = demoMode
    ? {
        lon: [-85.4, -84.6, -83.8, -83.0, -82.6, -82.7, -82.9, -82.4, -82.0],
        lat: [25.2, 25.8, 26.5, 27.3, 28.0, 28.7, 29.3, 28.8, 28.0],
      }
    : null;

  return (
    <div style={{ position: "relative" }}>
      <Plot
        data={[
          {
            type: "choropleth" as const,
            geojson: geo,
            locations,
            z,
            text: text as any,
            hoverinfo: "text" as const,
            colorscale: [
              [0, "#f7e8e8"],
              [0.25, "#e8a3a8"],
              [0.5, "#c41e3a"],
              [0.75, "#8c0c1f"],
              [1, "#4a0510"],
            ],
            zmin: 0,
            zmax: Math.max(8, Math.max(...z)),
            marker: { line: { color: "#fff", width: 0.6 } },
            colorbar: {
              title: { text: "Hurricane<br>declarations<br>since 2000", side: "right" },
              thickness: 12,
              len: 0.6,
              x: 1.02,
              tickfont: { size: 10 },
            },
            featureidkey: "id",
          } as any,
          ...(conePath
            ? ([
                {
                  type: "scattergeo" as const,
                  mode: "lines" as const,
                  lon: conePath.lon,
                  lat: conePath.lat,
                  line: { color: "#0066cc", width: 4, dash: "dash" },
                  hoverinfo: "skip" as const,
                  showlegend: false,
                  name: "Demo Storm Track",
                },
                {
                  type: "scattergeo" as const,
                  mode: "markers+text" as const,
                  lon: [conePath.lon[0]],
                  lat: [conePath.lat[0]],
                  text: ["DEMO Cat 3"],
                  textposition: "bottom right" as const,
                  textfont: { size: 12, color: "#0066cc" },
                  marker: { size: 16, color: "#0066cc", symbol: "x" },
                  hoverinfo: "skip" as const,
                  showlegend: false,
                },
              ] as any[])
            : []),
        ]}
        layout={{
          geo: {
            scope: "usa",
            projection: { type: "mercator" } as any,
            showland: true,
            landcolor: "#faf8f3",
            showcoastlines: true,
            coastlinecolor: "#999",
            showocean: true,
            oceancolor: "#e8eef4",
            center: { lon: -83.7, lat: 28.0 },
            lonaxis: { range: [-88, -79] } as any,
            lataxis: { range: [24, 31.5] } as any,
            fitbounds: false as any,
          } as any,
          margin: { t: 10, b: 10, l: 10, r: 60 },
          height: 520,
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { family: "Source Sans Pro, sans-serif" },
        }}
        config={{ displayModeBar: false, scrollZoom: false }}
        style={{ width: "100%", height: 520 }}
        onClick={(e: any) => {
          const pt = e.points?.[0];
          if (!pt) return;
          const feat = geo.features.find((f: any) => f.id === pt.location);
          const name = (feat?.properties?.name || "").replace(/ County$/, "");
          if (name) {
            const params = new URLSearchParams();
            params.set("county", name);
            if (demoMode) params.set("demo", "1");
            router.push(`/?${params.toString()}`);
          }
        }}
      />
      {selectedCounty && (
        <div style={{ position: "absolute", top: 12, left: 12, background: "var(--bg-card)", border: "1px solid var(--rule)", borderRadius: 4, padding: "0.5rem 0.85rem", fontSize: "0.85rem" }}>
          <strong>{selectedCounty}</strong> selected · click another county to switch · <a href={demoMode ? "/?demo=1" : "/"} style={{ color: "var(--rc-red)" }}>show all</a>
        </div>
      )}
    </div>
  );
}
