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

export type FemaDeclaration = {
  disasterNumber: number;
  declarationDate: string;
  state: string;
  declaredCountyArea: string;
  incidentType: string;
  declarationTitle: string;
  incidentBeginDate: string;
  incidentEndDate: string;
};

export async function fetchFloridaHurricanes(limit = 25): Promise<FemaDeclaration[]> {
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

// Group declarations by disasterNumber so multi-county incidents fold into one event.
export function dedupeByEvent(rows: FemaDeclaration[]): FemaDeclaration[] {
  const seen = new Map<number, FemaDeclaration>();
  for (const r of rows) {
    if (!seen.has(r.disasterNumber)) seen.set(r.disasterNumber, r);
  }
  return Array.from(seen.values());
}
