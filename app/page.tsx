import { fetchActiveStorms, fetchFloridaHurricanes, groupByStorm, filterByCounty, fetchNwsAlerts, queryLightrag, buildCountyStats, DEMO_STORM, DEMO_NWS_ALERTS } from "@/lib/sources";
import { marked } from "marked";
import CountyMapSvg from "./components/CountyMapSvg";

marked.setOptions({ gfm: true, breaks: false });

export const revalidate = 300;

const FL_COUNTIES = ["Lee", "Pinellas", "Hillsborough", "Sarasota", "Charlotte", "Collier", "Manatee", "Miami-Dade", "Broward", "Brevard", "Bay", "Escambia"];

type SearchParams = Promise<{ county?: string; demo?: string }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const { county = "", demo: demoParam } = await searchParams;
  const demoMode = demoParam === "1";

  const backgroundQuery = county
    ? `What are the disaster history, hazards, and vulnerabilities of ${county} County, Florida? Include hurricane risk, social vulnerability, and historical FEMA disaster declarations.`
    : `Summarize Florida hurricane disaster history and the most-affected counties.`;

  const operationalQuery = county
    ? `Briefing for Red Cross disaster operations team. ${county} County, Florida, facing incoming Cat 3 hurricane: (1) historical shelter capacity needed there, (2) most socially vulnerable neighborhoods, (3) infrastructure most at risk, (4) what to pre-stage. Be specific. Cite past events.`
    : `Florida: which counties are highest-priority for hurricane pre-staging given combined hazard risk and social vulnerability? Cite specific data.`;

  const [realStorms, allDecls, realAlerts, backgroundResult, operationalResult] = await Promise.all([
    fetchActiveStorms(),
    fetchFloridaHurricanes(1000),
    fetchNwsAlerts("FL"),
    queryLightrag(backgroundQuery, "hybrid", 5),
    queryLightrag(operationalQuery, "hybrid", 8),
  ]);

  const activeStorms = demoMode ? [DEMO_STORM] : realStorms;
  const alerts = demoMode ? DEMO_NWS_ALERTS : realAlerts.filter((a) => /hurricane|tropical|storm surge|flood/i.test(a.event));

  const filtered = filterByCounty(allDecls, county || null);
  const events = groupByStorm(filtered).slice(0, 10);
  const allEvents = groupByStorm(allDecls);
  const totalEvents = allEvents.length;
  const countyStats = buildCountyStats(allDecls);

  const top5 = Object.entries(countyStats)
    .sort(([, a], [, b]) => b.events - a.events)
    .slice(0, 5);

  return (
    <main className="page">
      {/* HERO */}
      <header className="hero">
        <div className="hero-row">
          <p className="eyebrow">Anticipatory Briefing Engine · v0.9</p>
          {demoMode ? (
            <span className="demo-chip">DEMO MODE · synthetic Cat 3</span>
          ) : null}
        </div>
        <h1>5-day hurricane briefings · Florida</h1>
        <p className="lede">
          Forecast + historical precedent + asset position + vulnerable population. Click a county for a LightRAG-synthesized briefing.
        </p>
        <div className="hero-actions">
          {demoMode ? (
            <a className="btn btn-ghost" href={county ? `/?county=${encodeURIComponent(county)}` : "/"}>← exit demo</a>
          ) : (
            <a className="btn btn-primary" href={`/?demo=1${county ? `&county=${encodeURIComponent(county)}` : ""}`}>▶ Preview demo storm</a>
          )}
          <span className="muted small">
            quick: {FL_COUNTIES.slice(0, 6).map((c, i) => (
              <span key={c}>{i > 0 ? " · " : " "}<a href={`/?county=${encodeURIComponent(c)}${demoMode ? "&demo=1" : ""}`}>{c}</a></span>
            ))}
          </span>
        </div>
      </header>

      {/* KPI STRIP */}
      <section className="kpi-strip">
        <div className="kpi">
          <span className="kpi-label">Active storms</span>
          <span className="kpi-value">{activeStorms.length}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">FL alerts</span>
          <span className="kpi-value">{alerts.length}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Hurricane events tracked</span>
          <span className="kpi-value">{totalEvents}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">FEMA decl rows</span>
          <span className="kpi-value">{allDecls.length.toLocaleString()}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">KG docs</span>
          <span className="kpi-value">27K+</span>
        </div>
      </section>

      {/* MAP — server-rendered SVG, no flash */}
      <section className="block">
        <div className="block-head">
          <p className="eyebrow">Interactive map · 67 counties · click to drill down</p>
          {county && <span className="muted small">selected: <strong>{county}</strong> · <a href={demoMode ? "/?demo=1" : "/"}>show all</a></span>}
        </div>
        <div className="card map-card">
          <CountyMapSvg stats={countyStats} selectedCounty={county} demoMode={demoMode} />
        </div>
      </section>

      <div className="two-col">
        {/* ACTIVE STORM + ALERTS — left column */}
        <div className="block">
          <p className="eyebrow">Forecast · NHC + NWS</p>
          <div className="card">
            {activeStorms.length === 0 ? (
              <p className="muted small no-margin">No active tropical systems. Demo mode injects a synthetic Cat 3.</p>
            ) : (
              activeStorms.map((s) => (
                <div key={s.id} className="storm-row">
                  <h3>{s.name}</h3>
                  <p className="small no-margin">{s.classification} · {s.intensity}{s.pressure ? ` · ${s.pressure}` : ""}</p>
                  <p className="muted small no-margin">{s.latitude?.toFixed(1)}°N, {Math.abs(s.longitude || 0).toFixed(1)}°W · {s.movement}</p>
                </div>
              ))
            )}
            {alerts.length > 0 && (
              <>
                <hr />
                {alerts.slice(0, 4).map((a) => (
                  <div key={a.id} className="alert-row">
                    <p className="no-margin"><strong>{a.event}</strong>{a.severity ? <span className="muted small"> · {a.severity}</span> : null}</p>
                    {a.areaDesc && <p className="muted small no-margin">{a.areaDesc}</p>}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* TOP-IMPACTED COUNTIES — right column */}
        <div className="block">
          <p className="eyebrow">Top-impacted FL counties · since 2000</p>
          <div className="card">
            <table className="rank-table">
              <thead>
                <tr><th>#</th><th>County</th><th className="num">Events</th><th>Last</th></tr>
              </thead>
              <tbody>
                {top5.map(([fips, s], i) => (
                  <tr key={fips}>
                    <td className="rank">{i + 1}</td>
                    <td>
                      <a href={`/?county=${encodeURIComponent(s.name.replace(/ \(County\)$/, ""))}${demoMode ? "&demo=1" : ""}`}>{s.name.replace(/ \(County\)$/, "")}</a>
                    </td>
                    <td className="num">{s.events}</td>
                    <td className="muted small">{s.lastEvent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OPERATIONAL BRIEFING — the headline */}
      <section className="block">
        <p className="eyebrow">🎯 Operational briefing · {county || "FL statewide"} · LightRAG synthesis</p>
        <div className="card briefing-card">
          {operationalResult.ok ? (
            <>
              <div className="kg-output" dangerouslySetInnerHTML={{ __html: marked.parse(operationalResult.response) as string }} />
              <p className="muted small footnote">Source: dragons-brain LightRAG · 27K+ docs · Neo4j+pgvector · gpt-4o-mini · mode=hybrid</p>
            </>
          ) : (
            <p className="muted no-margin">{operationalResult.response}</p>
          )}
        </div>
      </section>

      {/* HISTORICAL EVENTS — compact card grid */}
      {events.length > 0 && (
        <section className="block">
          <p className="eyebrow">Historical events · {county || "FL"} · {events.length} events</p>
          <div className="event-grid">
            {events.map((e) => (
              <div key={e.title + e.earliestDeclaration} className="event-card">
                <p className="muted tiny">{e.earliestDeclaration.slice(0, 10)} · DR-{e.disasterNumbers.slice(0, 2).join(", DR-")}</p>
                <h4>{e.title.replace(/^HURRICANE\s+/i, "")}</h4>
                <p className="small no-margin"><strong>{e.countyCount}</strong> counties · {e.incidentBeginDate?.slice(0, 4)}–{e.incidentEndDate?.slice(2, 4)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* BACKGROUND — collapsed by default */}
      <section className="block">
        <details className="card">
          <summary className="muted small">▸ Disaster history & hazard profile (full LightRAG synthesis)</summary>
          {backgroundResult.ok ? (
            <div style={{ marginTop: "1rem" }}>
              <div className="kg-output" dangerouslySetInnerHTML={{ __html: marked.parse(backgroundResult.response) as string }} />
              <p className="muted small footnote">Source: dragons-brain LightRAG · FEMA NRI + ACS + CDC SVI + FEMA Declarations</p>
            </div>
          ) : null}
        </details>
      </section>

      <footer className="footer">
        <p className="muted small">Demo target: Red Cross Leadership AAR · briefing.jbf.com · scope: FL hurricane MVP</p>
      </footer>
    </main>
  );
}
