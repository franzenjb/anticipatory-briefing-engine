import { fetchActiveStorms, fetchFloridaHurricanes, dedupeByEvent } from "@/lib/sources";

export const revalidate = 300;

export default async function Home() {
  const [activeStorms, allDecls] = await Promise.all([
    fetchActiveStorms(),
    fetchFloridaHurricanes(50),
  ]);

  const events = dedupeByEvent(allDecls).slice(0, 6);

  return (
    <main className="container">
      <p className="eyebrow">Anticipatory Briefing Engine · v0.2</p>
      <h1 style={{ fontSize: "2.5rem", margin: "0.25rem 0 0.5rem" }}>
        5-day briefings per county.
      </h1>
      <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 720 }}>
        Forecast + historical precedent + asset position + vulnerable population.
        v1: Florida hurricane MVP · Demo target: Red Cross Leadership AAR.
      </p>

      {/* FORECAST PANEL */}
      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">Forecast · NHC active storms</p>
        <div className="card" style={{ marginTop: "0.75rem" }}>
          {activeStorms.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No active tropical storms or hurricanes. NHC feed clear as of last poll.
            </p>
          ) : (
            <div>
              <p style={{ marginTop: 0 }}>
                <strong>{activeStorms.length} active storm{activeStorms.length === 1 ? "" : "s"}.</strong>
              </p>
              <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
                {activeStorms.map((s) => (
                  <li key={s.id} style={{ marginBottom: "0.5rem" }}>
                    <strong>{s.name}</strong> — {s.classification}{s.intensity ? ` · ${s.intensity}` : ""}
                    {s.movement ? <span className="muted"> · moving {s.movement}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* HISTORICAL PRECEDENT PANEL */}
      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">Historical precedent · FL hurricane declarations (FEMA)</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
          {events.length === 0 ? (
            <div className="card"><p className="muted" style={{margin:0}}>OpenFEMA returned no rows. Retry on next deploy.</p></div>
          ) : events.map((e) => (
            <div key={e.disasterNumber} className="card">
              <p className="eyebrow" style={{ color: "var(--ink-muted)" }}>DR-{e.disasterNumber} · {e.declarationDate.slice(0, 10)}</p>
              <h3 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.1rem" }}>{e.declarationTitle}</h3>
              <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>
                {e.incidentBeginDate?.slice(0, 10)} → {e.incidentEndDate?.slice(0, 10) || "ongoing"}
              </p>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}>
          Stub: future versions intersect this with the active-storm cone and pass FIPS+metadata to LightRAG for similar-event retrieval.
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
            <h3 style={{ marginTop: 0 }}>LightRAG</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>Structured similar-event retrieval, narrative briefing.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
