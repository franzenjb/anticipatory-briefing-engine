// Public-data fetchers. Server-side only.
// Cache TTLs:  NHC/NWS = 5 min, OpenFEMA historicals = 24 hr.

const UA = "briefing.jbf.com (jbf@jbf.com)";

// LightRAG endpoint — direct Railway URL (lightrag.jbf.com DNS is currently stale).
const LIGHTRAG_URL = (process.env.LIGHTRAG_URL || "https://dragons-brain-production-bb2c.up.railway.app").trim().replace(/\\n/g, "");
const LIGHTRAG_KEY = (process.env.LIGHTRAG_KEY || "").trim().replace(/\\n/g, "");

export type LightragMode = "naive" | "local" | "global" | "hybrid" | "mix";

export async function queryLightrag(
  query: string,
  mode: LightragMode = "hybrid",
  topK = 5
): Promise<{ response: string; mode: string; ok: boolean }> {
  if (!LIGHTRAG_KEY) {
    return { response: "LightRAG not configured (missing LIGHTRAG_KEY env var).", mode, ok: false };
  }
  try {
    const res = await fetch(`${LIGHTRAG_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": LIGHTRAG_KEY,
      },
      body: JSON.stringify({ query, mode, top_k: topK }),
      next: { revalidate: 3600 }, // cache identical queries 1hr
    });
    if (!res.ok) {
      const text = await res.text();
      return { response: `LightRAG returned ${res.status}: ${text.slice(0, 200)}`, mode, ok: false };
    }
    const data = await res.json();
    return { response: data.response || JSON.stringify(data).slice(0, 500), mode, ok: true };
  } catch (err: any) {
    return { response: `LightRAG error: ${err?.message || "unknown"}`, mode, ok: false };
  }
}

export type ActiveStorm = {
  id: string;
  name: string;
  classification: string;
  intensity: string;
  pressure: string;
  latitude: number;
  longitude: number;
  movement: string;
  publicAdvisory?: { url?: string };
};

export async function fetchActiveStorms(): Promise<ActiveStorm[]> {
  try {
    const res = await fetch("https://www.nhc.noaa.gov/CurrentStorms.json", {
      next: { revalidate: 300 },
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.activeStorms ?? [];
  } catch {
    return [];
  }
}

// Off-season demo storm. Returned when ?demo=1 so leadership can see the
// briefing format even when NHC has nothing active.
export const DEMO_STORM: ActiveStorm = {
  id: "demo-2026",
  name: "DEMO (synthetic)",
  classification: "Major Hurricane",
  intensity: "Category 3 · 125 mph sustained",
  pressure: "947 mb",
  latitude: 25.2,
  longitude: -85.4,
  movement: "NNE at 12 mph",
};

export type FemaDeclaration = {
  disasterNumber: number;
  declarationDate: string;
  state: string;
  declaredCountyArea: string;
  fipsCountyCode?: string;
  fipsStateCode?: string;
  placeCode?: string;
  incidentType: string;
  declarationTitle: string;
  incidentBeginDate: string;
  incidentEndDate: string;
};

export async function fetchFloridaHurricanes(limit = 1000): Promise<FemaDeclaration[]> {
  const filter = `state eq 'FL' and incidentType eq 'Hurricane' and declarationDate ge '2000-01-01'`;
  const url =
    "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?" +
    new URLSearchParams({
      "$filter": filter,
      "$orderby": "declarationDate desc",
      "$top": String(limit),
      "$format": "json",
    }).toString();

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.DisasterDeclarationsSummaries ?? [];
  } catch {
    return [];
  }
}

// Group declarations by storm event (declarationTitle). One card per storm,
// with the list of counties + earliest/latest impact dates rolled up.
export type StormEvent = {
  title: string;
  disasterNumbers: number[];
  earliestDeclaration: string;
  countyCount: number;
  counties: string[];
  incidentBeginDate: string;
  incidentEndDate: string;
};

export function groupByStorm(rows: FemaDeclaration[]): StormEvent[] {
  const buckets = new Map<string, StormEvent>();
  for (const r of rows) {
    const key = r.declarationTitle.trim().toUpperCase();
    const existing = buckets.get(key);
    if (existing) {
      if (!existing.disasterNumbers.includes(r.disasterNumber)) {
        existing.disasterNumbers.push(r.disasterNumber);
      }
      if (r.declaredCountyArea && !existing.counties.includes(r.declaredCountyArea)) {
        existing.counties.push(r.declaredCountyArea);
        existing.countyCount = existing.counties.length;
      }
      if (r.declarationDate < existing.earliestDeclaration) {
        existing.earliestDeclaration = r.declarationDate;
      }
      if (r.incidentBeginDate && r.incidentBeginDate < existing.incidentBeginDate) {
        existing.incidentBeginDate = r.incidentBeginDate;
      }
      if (r.incidentEndDate && r.incidentEndDate > existing.incidentEndDate) {
        existing.incidentEndDate = r.incidentEndDate;
      }
    } else {
      buckets.set(key, {
        title: r.declarationTitle,
        disasterNumbers: [r.disasterNumber],
        earliestDeclaration: r.declarationDate,
        countyCount: r.declaredCountyArea ? 1 : 0,
        counties: r.declaredCountyArea ? [r.declaredCountyArea] : [],
        incidentBeginDate: r.incidentBeginDate || r.declarationDate,
        incidentEndDate: r.incidentEndDate || r.declarationDate,
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) =>
    b.earliestDeclaration.localeCompare(a.earliestDeclaration)
  );
}

// Filter rows to a single county (matches "Lee (County)" or partial like "Lee").
export function filterByCounty(rows: FemaDeclaration[], county: string | null): FemaDeclaration[] {
  if (!county) return rows;
  const needle = county.toLowerCase().trim();
  return rows.filter((r) =>
    r.declaredCountyArea?.toLowerCase().includes(needle)
  );
}

// NWS active alerts for an area code (e.g. "FL" for state, or zone code).
export type NwsAlert = {
  id: string;
  event: string;
  headline?: string;
  severity?: string;
  urgency?: string;
  areaDesc?: string;
  effective?: string;
  expires?: string;
};

export async function fetchNwsAlerts(area: string = "FL"): Promise<NwsAlert[]> {
  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?area=${encodeURIComponent(area)}`, {
      next: { revalidate: 300 },
      headers: {
        "User-Agent": UA,
        "Accept": "application/geo+json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: any) => ({
      id: f.id,
      event: f.properties?.event,
      headline: f.properties?.headline,
      severity: f.properties?.severity,
      urgency: f.properties?.urgency,
      areaDesc: f.properties?.areaDesc,
      effective: f.properties?.effective,
      expires: f.properties?.expires,
    }));
  } catch {
    return [];
  }
}

// OpenFEMA Individual Assistance — count of registrants by disaster.
export type IaSummary = {
  disasterNumber: number;
  totalValidRegistrations: number;
  totalDamage?: number;
  approvedForFemaAssistance?: number;
  totalApprovedIhpAmount?: number;
};

export async function fetchIaForDisasters(disasterNumbers: number[]): Promise<Record<number, IaSummary>> {
  if (disasterNumbers.length === 0) return {};
  const filter = disasterNumbers.map((n) => `disasterNumber eq ${n}`).join(" or ");
  const url =
    "https://www.fema.gov/api/open/v1/IndividualAssistanceHousingRegistrantsLargeDisasters?" +
    new URLSearchParams({
      "$filter": filter,
      "$top": String(Math.min(disasterNumbers.length * 80, 1000)),
      "$format": "json",
    }).toString();

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const rows = data.IndividualAssistanceHousingRegistrantsLargeDisasters ?? [];
    const out: Record<number, IaSummary> = {};
    for (const r of rows) {
      const dn = r.disasterNumber;
      if (!out[dn]) {
        out[dn] = { disasterNumber: dn, totalValidRegistrations: 0, totalApprovedIhpAmount: 0 };
      }
      out[dn].totalValidRegistrations += r.validRegistrations || 0;
      out[dn].totalApprovedIhpAmount = (out[dn].totalApprovedIhpAmount || 0) + (r.totalApprovedIhpAmount || 0);
    }
    return out;
  } catch {
    return {};
  }
}

export function formatUSD(n: number | undefined): string {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatNum(n: number | undefined): string {
  if (!n) return "—";
  return n.toLocaleString();
}

// Off-season demo NWS alerts to pair with DEMO_STORM.
export const DEMO_NWS_ALERTS: NwsAlert[] = [
  {
    id: "demo-hurricane-warning",
    event: "Hurricane Warning",
    headline: "Hurricane Warning issued for Pinellas, Hillsborough, Manatee, Sarasota, Lee, Charlotte, Collier",
    severity: "Extreme",
    urgency: "Immediate",
    areaDesc: "Pinellas; Hillsborough; Manatee; Sarasota; Lee; Charlotte; Collier",
    effective: new Date().toISOString(),
    expires: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  },
  {
    id: "demo-storm-surge",
    event: "Storm Surge Warning",
    headline: "Storm Surge Warning · 8–12 ft above ground level expected",
    severity: "Extreme",
    urgency: "Immediate",
    areaDesc: "Coastal Lee; Coastal Charlotte; Coastal Sarasota; Coastal Manatee",
    effective: new Date().toISOString(),
    expires: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
  },
];
