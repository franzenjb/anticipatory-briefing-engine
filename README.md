# Anticipatory Briefing Engine

5-day forecast briefings per county — one operational view fusing:

- **Forecast** (NHC 5-day cone, NWS alerts)
- **Historical precedent** (LightRAG retrieval over OpenFEMA + AAR corpus)
- **Current assets** (Atlas — RC properties, warehouses, trailers, ERVs)
- **Vulnerable population** (ALICE Master DB by census tract)

**Live:** [briefing.jbf.com](https://briefing.jbf.com) (TBD — DNS pending)
**v1 scope:** Florida hurricane MVP
**Demo target:** Red Cross Leadership AAR (after-action review meeting)

## Why

Five existing projects (Cascade, LightRAG, Atlas, ALICE, Smart-Query) become more than the sum. The white paper on anticipatory disaster mapping made operational.

## Architecture (v1)

```
Poll NHC every 15 min
  → if active FL-threatening storm:
      → fetch NWS alerts + cone GIS
      → intersect cone with FL county FIPS
      → query OpenFEMA for those FIPS' historical declarations
      → pass FIPS+storm metadata to LightRAG retrieval
      → render briefing
```

Caching: 5-min TTL on NHC/NWS, 24-hr on OpenFEMA historicals.

## Development

```bash
npm install
npm run dev
```

## Status

Scaffold complete. Panels are placeholders — wiring next.

## Related

- Project note (vault): `Projects/anticipatory-briefing-engine.md`
- Strategy index: `methods/stretch-ideas-2026-05.md`
- Data sources: see project note "Public data plumbing" section

## License

MIT
