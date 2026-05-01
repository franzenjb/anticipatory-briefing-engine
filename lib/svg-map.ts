// Server-side SVG choropleth — no client JS, renders instantly.
// Uses Mercator projection so FL shape is correct (lat-stretched).

import type { CountyStats, CountyRisk } from "./sources";
import fs from "fs";
import path from "path";

const FL_BOUNDS = { minLon: -88, maxLon: -79.5, minLat: 24.0, maxLat: 31.5 };
const SVG_WIDTH = 1200;
const SVG_HEIGHT = 800;
const PADDING = 24;

let cachedGeo: any = null;
function getGeo() {
  if (cachedGeo) return cachedGeo;
  const p = path.join(process.cwd(), "public", "fl-counties.geojson");
  cachedGeo = JSON.parse(fs.readFileSync(p, "utf-8"));
  return cachedGeo;
}

// Web Mercator y projection (preserves shapes)
function mercY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
}

const MERC_Y_MIN = mercY(FL_BOUNDS.minLat);
const MERC_Y_MAX = mercY(FL_BOUNDS.maxLat);
const LON_RANGE = FL_BOUNDS.maxLon - FL_BOUNDS.minLon;
const MERC_RANGE = MERC_Y_MAX - MERC_Y_MIN;

// Compute scale that fits both axes within the SVG (preserve aspect ratio).
const W_INNER = SVG_WIDTH - PADDING * 2;
const H_INNER = SVG_HEIGHT - PADDING * 2;
const SCALE = Math.min(W_INNER / LON_RANGE, H_INNER / MERC_RANGE);
const RENDER_W = LON_RANGE * SCALE;
const RENDER_H = MERC_RANGE * SCALE;
const X_OFFSET = (SVG_WIDTH - RENDER_W) / 2;
const Y_OFFSET = (SVG_HEIGHT - RENDER_H) / 2;

function project(lon: number, lat: number): [number, number] {
  const x = X_OFFSET + (lon - FL_BOUNDS.minLon) * SCALE;
  const y = Y_OFFSET + (MERC_Y_MAX - mercY(lat)) * SCALE;
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

// Equal-count quantile binning — handles heavy-tailed $ distributions.
// Same approach as intel.jbf.com.
function quantileColor(value: number, sortedVals: number[]): string {
  if (value == null || value === 0) return "#f5ece8";
  const ramp = ["#fef0d9", "#fdcc8a", "#fc8d59", "#e34a33", "#c41e3a", "#8c0c1f", "#4a0510"];
  const n = sortedVals.length;
  if (n === 0) return ramp[0];
  let idx = 0;
  for (const b of sortedVals) { if (value > b) idx++; else break; }
  const bucket = Math.min(ramp.length - 1, Math.floor((idx / n) * ramp.length));
  return ramp[bucket];
}

function quantileBreaks(values: number[], bins = 7): number[] {
  const sorted = values.filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
  if (sorted.length < bins) return [];
  const breaks: number[] = [];
  for (let i = 1; i < bins; i++) {
    breaks.push(sorted[Math.floor((i / bins) * sorted.length)]);
  }
  return breaks;
}

export function renderFLChoropleth(opts: {
  stats: CountyStats;
  selectedCounty: string;
  demoMode: boolean;
  countyRisk?: CountyRisk[];
  metric?: "events" | "eal";
  coneCounties?: string[];
}): string {
  const { stats, selectedCounty, demoMode, countyRisk = [], metric = "eal", coneCounties = [] } = opts;
  const geo = getGeo();

  const allCounts = Object.values(stats).map((s) => s.events);
  const max = Math.max(8, ...allCounts);

  // EAL by FIPS lookup
  const ealByFips = new Map<string, number>();
  const popByFips = new Map<string, number>();
  for (const r of countyRisk) {
    const fips = String(r.county_fips).padStart(5, "0");
    if (r.expected_annual_loss != null) ealByFips.set(fips, r.expected_annual_loss);
    if (r.population != null) popByFips.set(fips, r.population);
  }
  const ealVals = Array.from(ealByFips.values()).filter((v) => v > 0).sort((a, b) => a - b);
  const ealBreaks = quantileBreaks(ealVals);

  const coneSet = new Set(coneCounties.map((c) => c.toLowerCase()));
  const selLower = selectedCounty.trim().toLowerCase();

  let counties = "";
  for (const f of geo.features) {
    const fips = String(f.id).padStart(5, "0");
    const props = f.properties || {};
    const name = (props.name || "").replace(/ County$/, "");
    const s = stats[fips];
    const events = s?.events ?? 0;
    const eal = ealByFips.get(fips) ?? 0;
    const pop = popByFips.get(fips) ?? 0;
    const perCap = eal && pop ? eal / pop : 0;

    const fill = metric === "eal"
      ? quantileColor(eal, ealBreaks)
      : colorFor(events, max);

    const isSelected = selLower && name.toLowerCase() === selLower;
    const inCone = demoMode && coneSet.has(name.toLowerCase());

    let path = "";
    if (f.geometry.type === "Polygon") {
      path = polygonPath(f.geometry.coordinates);
    } else if (f.geometry.type === "MultiPolygon") {
      path = multiPolygonPath(f.geometry.coordinates);
    }

    const ealStr = eal >= 1e6 ? `$${(eal/1e6).toFixed(0)}M/yr` : eal > 0 ? `$${(eal/1e3).toFixed(0)}K/yr` : "—";
    const perCapStr = perCap ? `$${Math.round(perCap)}/capita/yr` : "";
    const tooltipLines = [
      `${name} County`,
      `Annual loss: ${ealStr}`,
      perCapStr,
      pop ? `Population: ${pop.toLocaleString()}` : "",
      events > 0 ? `${events} hurricane events declared` : "",
      inCone ? "🌀 IN DEMO STORM CONE" : "",
    ];
    const title = tooltipLines.filter(Boolean).join("\n");

    const params = new URLSearchParams();
    params.set("county", name);
    if (demoMode) params.set("demo", "1");
    const href = `/?${params.toString()}`;

    let stroke = "#fff";
    let strokeW = 0.6;
    if (isSelected) { stroke = "#0066cc"; strokeW = 2.5; }
    else if (inCone) { stroke = "#0066cc"; strokeW = 1.5; }

    counties += `<a href="${href}" class="county-link" data-name="${name}">`;
    counties += `<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" data-events="${events}">`;
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
  let legend = '<g class="legend" transform="translate(20, 20)">';
  if (metric === "eal") {
    const ramp = ["#fef0d9", "#fdcc8a", "#fc8d59", "#e34a33", "#c41e3a", "#8c0c1f", "#4a0510"];
    const breaks = ealBreaks;
    legend += `<text font-size="11" font-weight="600" fill="#1a1a1a" letter-spacing="1.2" x="0" y="0">EXPECTED ANNUAL LOSS · FEMA NRI · equal-count bins</text>`;
    ramp.forEach((c, i) => {
      const x = i * 70;
      legend += `<rect x="${x}" y="10" width="60" height="12" fill="${c}" stroke="#fff" stroke-width="0.5"/>`;
      const v = i === 0 ? 0 : breaks[i - 1];
      const lbl = v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : v > 0 ? `$${(v/1e3).toFixed(0)}K` : "$0";
      legend += `<text x="${x}" y="34" font-size="9" fill="#555">${lbl}</text>`;
    });
  } else {
    const legendBins = [
      { label: "0", color: "#f5ece8" },
      { label: `1–${Math.ceil(max * 0.25)}`, color: "#f4c5ca" },
      { label: `${Math.ceil(max * 0.25) + 1}–${Math.ceil(max * 0.5)}`, color: "#e8848e" },
      { label: `${Math.ceil(max * 0.5) + 1}–${Math.ceil(max * 0.75)}`, color: "#c41e3a" },
      { label: `${Math.ceil(max * 0.75) + 1}+`, color: "#8c0c1f" },
    ];
    legend += `<text font-size="11" font-weight="600" fill="#1a1a1a" letter-spacing="1.2" x="0" y="0">HURRICANE DECLARATIONS · 2000–2026</text>`;
    legendBins.forEach((b, i) => {
      const x = i * 95;
      legend += `<rect x="${x}" y="10" width="20" height="14" fill="${b.color}" stroke="#fff" stroke-width="0.5"/>`;
      legend += `<text x="${x + 26}" y="22" font-size="11" fill="#1a1a1a">${b.label}</text>`;
    });
  }
  legend += "</g>";

  return `<svg viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;background:#e8eef4">
    <rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#e8eef4"/>
    <g class="counties">${counties}</g>
    ${cone}
    ${legend}
  </svg>`;
}
