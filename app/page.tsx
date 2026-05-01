export default function Home() {
  return (
    <main className="container">
      <p className="eyebrow">Anticipatory Briefing Engine · v0.1 scaffold</p>
      <h1 style={{ fontSize: "2.5rem", margin: "0.25rem 0 0.5rem" }}>
        5-day briefings per county.
      </h1>
      <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 720 }}>
        Forecast + historical precedent + asset position + vulnerable population — one operational view.
        v1 scope: Florida hurricane MVP. Demo target: Red Cross Leadership AAR.
      </p>

      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">v1 panels</p>
        <div className="grid-4" style={{ marginTop: "0.75rem" }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Forecast</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>
              NHC 5-day cone · NWS active alerts · county-overlap intersect.
            </p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Historical Precedent</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>
              LightRAG retrieval over OpenFEMA Disaster Declarations + AAR corpus.
            </p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Current Assets</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>
              Atlas overlay — properties, warehouses, trailers, ERVs in cone.
            </p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Vulnerable Population</h3>
            <p className="muted" style={{ fontSize: "0.95rem" }}>
              ALICE Master DB · weighted by census tract inside impact area.
            </p>
          </div>
        </div>
      </section>

      <section style={{ margin: "2.5rem 0" }}>
        <p className="eyebrow">Status</p>
        <p>Scaffold only. Wiring panels next.</p>
      </section>
    </main>
  );
}
