// Server-side SVG choropleth — no client JS, renders instantly.
// Uses simple equirectangular projection over FL bounding box.

import type { CountyStats } from "./sources";
import fs from "fs";
import path from "path";

const FL_BOUNDS = { minLon: -88, maxLon: -79.5, minLat: 24.0, maxLat: 31.5 };
const SVG_WIDTH = 1100;
const SVG_HEIGHT = 700;

let cachedGeo: any = null;
function getGeo() {
  if (cachedGeo) return cachedGeo;
  const p = path.join(process.cwd(), "public", "fl-counties.geojson");
  cachedGeo = JSON.parse(fs.readFileSync(p, "utf-8"));
  return cachedGeo;
}

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - FL_BOUNDS.minLon) / (FL_BOUNDS.maxLon - FL_BOUNDS.minLon)) * SVG_WIDTH;
  const y = ((FL_BOUNDS.maxLat - lat) / (FL_BOUNDS.maxLat - FL_BOUNDS.minLat)) * SVG_HEIGHT;
  return [x, y];
}

function ringToPath(ring: number[][]): string {
  return ring
    .map(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("") + "Z";
}

function polygonPath(coords: number[][][]): string {
  return coords.map(ringToPath).join("");
}

function multiPolygonPath(coords: number[][][][]): string {
  return coords.map((p) => polygonPath(p)).join("");
}

function colorFor(events: number, max: number): string {
  if (events === 0) return "#f5ece8";
  const t = Math.min(1, events / max);
  // Red gradient: light pink → deep red
  if (t < 0.25) return "#f4c5ca";
  if (t < 0.5) return "#e8848e";
  if (t < 0.75) return "#c41e3a";
  if (t < 0.9) return "#8c0c1f";
  return "#4a0510";
}

export function renderFLChoropleth(opts: {
  stats: CountyStats;
  selectedCounty: string;
  demoMode: boolean;
}): string {
  const { stats, selectedCounty, demoMode } = opts;
  const geo = getGeo();

  const allCounts = Object.values(stats).map((s) => s.events);
  const max = Math.max(8, ...allCounts);

  const selLower = selectedCounty.trim().toLowerCase();

  let counties = "";
  for (const f of geo.features) {
    const fips = String(f.id);
    const props = f.properties || {};
    const name = (props.name || "").replace(/ County$/, "");
    const s = stats[fips];
    const events = s?.events ?? 0;
    const fill = colorFor(events, max);
    const isSelected = selLower && name.toLowerCase() === selLower;

    let path = "";
    if (f.geometry.type === "Polygon") {
      path = polygonPath(f.geometry.coordinates);
    } else if (f.geometry.type === "MultiPolygon") {
      path = multiPolygonPath(f.geometry.coordinates);
    }

    const tooltipLines = s
      ? [`${name} County`, `${s.events} hurricane events`, `${s.declarations} per-program rows`, s.lastEvent ? `Last: ${s.lastEvent}` : ""]
      : [`${name} County`, "No FEMA hurricane declarations since 2000"];
    const title = tooltipLines.filter(Boolean).join("\n");

    const params = new URLSearchParams();
    params.set("county", name);
    if (demoMode) params.set("demo", "1");
    const href = `/?${params.toString()}`;

    counties += `<a href="${href}" class="county-link" data-name="${name}">`;
    counties += `<path d="${path}" fill="${fill}" stroke="${isSelected ? "#0066cc" : "#fff"}" stroke-width="${isSelected ? 2.5 : 0.6}" data-events="${events}">`;
    counties += `<title>${title}</title></path></a>`;
  }

  // Demo storm cone polyline
  let cone = "";
  if (demoMode) {
    const path = [
      [-85.4, 25.2],
      [-84.6, 25.8],
      [-83.8, 26.5],
      [-83.0, 27.3],
      [-82.6, 28.0],
      [-82.7, 28.7],
      [-82.9, 29.3],
    ]
      .map(([lon, lat]) => project(lon, lat))
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const [sx, sy] = project(-85.4, 25.2);
    cone = `
      <g class="demo-cone">
        <path d="${path}" fill="none" stroke="#0066cc" stroke-width="3" stroke-dasharray="8 6" opacity="0.85"/>
        <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="9" fill="#0066cc"/>
        <text x="${sx + 12}" y="${sy + 4}" font-size="13" font-weight="600" fill="#0066cc">DEMO Cat 3</text>
      </g>`;
  }

  // Legend
  const legendBins = [
    { label: "0", color: "#f5ece8" },
    { label: `1–${Math.ceil(max * 0.25)}`, color: "#f4c5ca" },
    { label: `${Math.ceil(max * 0.25) + 1}–${Math.ceil(max * 0.5)}`, color: "#e8848e" },
    { label: `${Math.ceil(max * 0.5) + 1}–${Math.ceil(max * 0.75)}`, color: "#c41e3a" },
    { label: `${Math.ceil(max * 0.75) + 1}+`, color: "#8c0c1f" },
  ];
  let legend = '<g class="legend" transform="translate(20, 20)">';
  legend += `<text font-size="11" font-weight="600" fill="#1a1a1a" letter-spacing="1.2" x="0" y="0">HURRICANE DECLARATIONS · 2000–2026</text>`;
  legendBins.forEach((b, i) => {
    const x = i * 95;
    legend += `<rect x="${x}" y="10" width="20" height="14" fill="${b.color}" stroke="#fff" stroke-width="0.5"/>`;
    legend += `<text x="${x + 26}" y="22" font-size="11" fill="#1a1a1a">${b.label}</text>`;
  });
  legend += "</g>";

  return `<svg viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;background:#e8eef4">
    <rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#e8eef4"/>
    <g class="counties">${counties}</g>
    ${cone}
    ${legend}
  </svg>`;
}
