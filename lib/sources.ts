// Public-data fetchers. Server-side only.
// Cache TTLs:  NHC/NWS = 5 min, OpenFEMA historicals = 24 hr.

const UA = "briefing.jbf.com (jbf@jbf.com)";

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
