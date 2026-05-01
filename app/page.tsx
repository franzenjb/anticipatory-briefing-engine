import { fetchActiveStorms, fetchFloridaHurricanes, groupByStorm, filterByCounty, fetchNwsAlerts, queryLightrag, DEMO_STORM, DEMO_NWS_ALERTS } from "@/lib/sources";
import { synthesizeBriefing } from "@/lib/briefing";

export const revalidate = 300;

const FL_COUNTIES = [
  "Lee", "Pinellas", "Hillsborough", "Sarasota", "Charlotte", "Collier", "Manatee",
  "Miami-Dade", "Broward", "Palm Beach", "Brevard", "Volusia", "Orange",
  "Duval", "Bay", "Escambia", "Leon", "Monroe", "Polk", "Pasco",
];

type SearchParams = Promise<{ county?: string; demo?: string }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const { county = "", demo: demoParam } = await searchParams;
  const demoMode = demoParam === "1";

  const lightragQuery = county
    ? `What are the disaster history, hazards, and vulnerabilities of ${county} County, Florida? Include hurricane risk, social vulnerability, and any historical FEMA disaster declarations.`
    : `Summarize Florida hurricane disaster history and the most-affected counties.`;

  const [realStorms, allDecls, realAlerts, lightragResult] = await Promise.all([
    fetchActiveStorms(),
    fetchFloridaHurricanes(1000),
    fetchNwsAlerts("FL"),
    queryLightrag(lightragQuery, "hybrid", 5),
  ]);

  const activeStorms = demoMode ? [DEMO_STORM] : realStorms;
  const alerts = demoMode ? DEMO_NWS_ALERTS : realAlerts.filter((a) => /hurricane|tropical|storm surge|flood/i.test(a.event));

  const filtered = filterByCounty(allDecls, county || null);
  const events = groupByStorm(filtered).slice(0, 8);

  const totalEvents = groupByStorm(allDecls).length;
  const totalDeclarations = allDecls.length;

  return (
    <main className="container">
      <p className="eyebrow">Anticipatory Briefing Engine · v0.3</p>
      <h1 style={{ fontSize: "2.5rem", margin: "0.25rem 0 0.5rem" }}>
        5-day briefings per county.
      </h1>
      <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 720 }}>
        Forecast + historical precedent + asset position + vulnerable population.
        v1: Florida hurricane MVP · Demo target: Red Cross Leadership AAR.
      </p>

      {/* MODE TOGGLE */}
      <p style={{ fontSize: "0.9rem", marginTop: "1rem" }}>
        {demoMode ? (
          <>
            <span style={{ background: "#FFE9C4", color: "#7A4400", padding: "0.2rem 0.5rem", borderRadius: 3, fontWeight: 600, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              DEMO MODE
            </span>
            <span className="muted" style={{ marginLeft: "0.75rem" }}>
              Synthetic storm injected for off-season preview.
            </span>
            <a href={county ? `/?county=${encodeURIComponent(county)}` : "/"} style={{ marginLeft: "0.75rem", color: "var(--rc-red)", textDecoration: "none", fontSize: "0.85rem" }}>
              ← exit demo
            </a>
          </>
        ) : (
          <a href={`/?demo=1${county ? `&county=${encodeURIComponent(county)}` : ""}`} className="muted" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
            → preview with synthetic storm (off-season demo)
          </a>
        )}
      </p>

      {/* COUNTY SELECTOR */}
      <section style={{ margin: "2rem 0" }}>
        <p className="eyebrow">Select county</p>
        <form method="GET" style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            name="county"
            placeholder="Type a FL county (e.g. Pinellas)"
            defaultValue={county}
            style={{
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              fontSize: "1rem",
              minWidth: 260,
              fontFamily: "inherit",
              background: "white",
            }}
          />
          <button type="submit" style={{
            padding: "0.5rem 1rem",
            background: "var(--rc-red)",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
          }}>
            Show precedent
          </button>
          {county && (
            <a href="/" className="muted" style={{ fontSize: "0.9rem", textDecoration: "none" }}>
              clear
            </a>
          )}
          <span className="muted" style={{ fontSize: "0.85rem", marginLeft: "auto" }}>
            quick: {FL_COUNTIES.slice(0, 6).map((c, i) => (
              <span key={c}>
                {i > 0 ? " · " : ""}
                <a href={`/?county=${encodeURIComponent(c)}`} style={{ color: "var(--rc-red)", textDecoration: "none" }}>
                  {c}
                </a>
              </span>
            ))}
          </span>
        </form>
      </section>

      {/* FORECAST PANEL */}
      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">Forecast · NHC active storms</p>
        <div className="card" style={{ marginTop: "0.75rem" }}>
          {activeStorms.length === 0 ? (
            <div>
              <p style={{ marginTop: 0 }}>
                <strong>No active tropical storms or hurricanes.</strong>
              </p>
              <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                Atlantic hurricane season runs June 1 – November 30. Switch to demo mode (top of page) to preview the briefing with a synthetic storm.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ marginTop: 0 }}>
                <strong>{activeStorms.length} active storm{activeStorms.length === 1 ? "" : "s"}.</strong>
              </p>
              {activeStorms.map((s) => (
                <div key={s.id} style={{ marginBottom: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid var(--rule)" }}>
                  <h3 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1.15rem" }}>
                    {s.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.95rem" }}>
                    {s.classification} {s.intensity ? `· ${s.intensity}` : ""}
                    {s.pressure ? ` · pressure ${s.pressure}` : ""}
                  </p>
                  <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                    Position {s.latitude?.toFixed(1)}°N, {Math.abs(s.longitude || 0).toFixed(1)}°W
                    {s.movement ? ` · moving ${s.movement}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* LIGHTRAG NARRATIVE PANEL */}
      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">
          LightRAG narrative · {county ? `${county} County` : "FL statewide"} · KG hybrid retrieval
        </p>
        <div className="card" style={{ marginTop: "0.75rem" }}>
          {lightragResult.ok ? (
            <div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: 1.6 }}>
                {lightragResult.response}
              </div>
              <p className="muted" style={{ fontSize: "0.8rem", marginTop: "1rem", paddingTop: "0.5rem", borderTop: "1px solid var(--rule)" }}>
                Source: dragons-brain LightRAG · Neo4j + pgvector · 27K+ docs · gpt-4o-mini · mode={lightragResult.mode}
              </p>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {lightragResult.response}
            </p>
          )}
        </div>
      </section>

      {/* NWS ALERTS PANEL */}
      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">NWS active alerts · {alerts.length} hurricane/tropical/surge/flood</p>
        <div className="card" style={{ marginTop: "0.75rem" }}>
          {alerts.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No active hurricane, tropical-storm, surge, or flood alerts in FL.
            </p>
          ) : (
            <div>
              {alerts.slice(0, 5).map((a) => (
                <div key={a.id} style={{ marginBottom: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid var(--rule)" }}>
                  <p style={{ margin: 0 }}>
                    <strong>{a.event}</strong>
                    {a.severity ? <span className="muted" style={{ fontSize: "0.85rem", marginLeft: "0.5rem" }}>· {a.severity} · {a.urgency}</span> : null}
                  </p>
                  {a.headline && <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>{a.headline}</p>}
                  {a.areaDesc && <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>{a.areaDesc}</p>}
                </div>
              ))}
              {alerts.length > 5 && <p className="muted" style={{ fontSize: "0.85rem", margin: "0.5rem 0 0" }}>+{alerts.length - 5} more alerts</p>}
            </div>
          )}
        </div>
      </section>

      {/* HISTORICAL PRECEDENT PANEL */}
      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">
          Historical precedent · {county ? `${county} County` : "all FL counties"} · {events.length} of {county ? "" : `${totalEvents} `}storm events
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
          {events.length === 0 ? (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                No FL hurricane declarations match {county ? `"${county}"` : "the filter"}. Try a different county or clear the filter.
              </p>
            </div>
          ) : events.map((e) => (
            <div key={e.title + e.earliestDeclaration} className="card">
              <p className="eyebrow" style={{ color: "var(--ink-muted)" }}>
                {e.earliestDeclaration.slice(0, 10)} · DR-{e.disasterNumbers.join(", DR-")}
              </p>
              <h3 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.1rem" }}>{e.title}</h3>
              <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                Impact window: {e.incidentBeginDate?.slice(0, 10)} → {e.incidentEndDate?.slice(0, 10) || "ongoing"}
              </p>
              <p style={{ fontSize: "0.9rem", margin: "0.5rem 0 0" }}>
                <strong>{e.countyCount}</strong> {county ? "match" : "FL counties"} declared
              </p>
              {!county && e.counties.length > 0 && (
                <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0", lineHeight: 1.4 }}>
                  {e.counties.slice(0, 6).join(", ")}{e.counties.length > 6 ? `, +${e.counties.length - 6} more` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
          Source: OpenFEMA Disaster Declarations · {totalDeclarations} FL hurricane declaration rows since 2000 · grouped into {totalEvents} storm events. Future: pass FIPS+metadata to LightRAG for similar-event retrieval and narrative briefing.
        </p>
      </section>

      {/* ASSETS + ALICE — placeholder */}
      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">Coming next</p>
        <div className="grid-4" style={{ marginTop: "0.75rem" }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>NWS alerts</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>County-level watches/warnings.</p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Atlas overlay</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>RC properties, warehouses, trailers, ERVs in cone.</p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>ALICE weighting</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>Vulnerable population per tract inside impact area.</p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>LightRAG narrative</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>"Last 3 times {county || "Pinellas"} got a Cat 4: response cost, sheltered, lessons."</p>
          </div>
        </div>
      </section>
    </main>
  );
}
