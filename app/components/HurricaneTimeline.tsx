"use client";

import dynamic from "next/dynamic";

const Plot: any = dynamic(
  async () => {
    const Plotly = (await import("plotly.js-dist-min")).default;
    const createPlotlyComponent = (await import("react-plotly.js/factory")).default;
    return createPlotlyComponent(Plotly);
  },
  { ssr: false }
);

type Event = {
  title: string;
  earliestDeclaration: string;
  countyCount: number;
};

export default function HurricaneTimeline({
  events,
  county,
}: {
  events: Event[];
  county: string;
}) {
  if (events.length === 0) {
    return null;
  }

  const sorted = [...events].sort((a, b) =>
    a.earliestDeclaration.localeCompare(b.earliestDeclaration)
  );

  const x = sorted.map((e) => e.earliestDeclaration.slice(0, 10));
  const y = sorted.map((e) => e.countyCount);
  const labels = sorted.map((e) => e.title.replace(/^HURRICANE\s+/i, ""));
  const text = sorted.map(
    (e) => `<b>${e.title}</b><br>Declared: ${e.earliestDeclaration.slice(0, 10)}<br>Counties impacted: ${e.countyCount}`
  );

  return (
    <Plot
      data={[
        {
          type: "bar" as const,
          x,
          y,
          text: labels as any,
          textposition: "outside" as const,
          hovertext: text as any,
          hoverinfo: "text" as const,
          marker: {
            color: y,
            colorscale: [
              [0, "#e8a3a8"],
              [0.5, "#c41e3a"],
              [1, "#8c0c1f"],
            ] as any,
            cmin: 0,
            cmax: Math.max(...y),
            line: { color: "#fff", width: 1 },
          },
          textfont: { size: 10 },
        } as any,
      ]}
      layout={{
        title: {
          text: county
            ? `Hurricane events affecting ${county} County · 2000–present`
            : "FL hurricane events · 2000–present (height = counties impacted)",
          font: { size: 14, family: "Libre Baskerville, serif" },
        },
        xaxis: { title: { text: "" }, type: "date", tickfont: { size: 10 } },
        yaxis: { title: { text: "Counties declared" }, gridcolor: "#e5e0d3" },
        height: 320,
        margin: { t: 50, b: 60, l: 50, r: 20 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { family: "Source Sans Pro, sans-serif" },
        showlegend: false,
      }}
      config={{ displayModeBar: false }}
      style={{ width: "100%", height: 320 }}
    />
  );
}
