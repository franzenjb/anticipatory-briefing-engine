// Synthesized briefing — generates a narrative read from FEMA history + active storm.
// Today: rule-based template synthesis. Future: LightRAG retrieval over KG of historical events.

import type { ActiveStorm, FemaDeclaration, StormEvent } from "./sources";
import { groupByStorm } from "./sources";

export type Briefing = {
  headline: string;
  paragraphs: string[];
  bullets: { label: string; value: string }[];
  citations: string[];
};

export function synthesizeBriefing(
  storm: ActiveStorm | null,
  county: string,
  countyDecls: FemaDeclaration[],
  allEventsCount: number
): Briefing {
  const events = groupByStorm(countyDecls);
  const totalEvents = events.length;
  const totalDecls = countyDecls.length;

  const paragraphs: string[] = [];
  const bullets: { label: string; value: string }[] = [];
  const citations: string[] = [];

  // Lead paragraph — storm context
  let headline: string;
  if (storm) {
    const where = `${storm.latitude.toFixed(1)}°N, ${Math.abs(storm.longitude).toFixed(1)}°W`;
    headline = county
      ? `${storm.name}: anticipatory briefing for ${county} County`
      : `${storm.name}: forecast in motion`;
    const coastalNote = storm.longitude < -82 ? "Gulf side" : "Atlantic side";
    paragraphs.push(
      `${storm.name} is currently a ${storm.classification.toLowerCase()} (${storm.intensity}) at ${where}, moving ${storm.movement}. Position favors a ${coastalNote} approach to FL.`
    );
    citations.push("NHC CurrentStorms.json");
  } else {
    headline = county
      ? `${county} County: hurricane history`
      : "FL hurricane history · standby";
    paragraphs.push(
      "No active tropical system on the NHC feed. The data below is historical baseline — what your county has lived through and how often."
    );
    citations.push("NHC CurrentStorms.json (no active storms)");
  }

  // Historical paragraph
  if (county) {
    if (totalEvents === 0) {
      paragraphs.push(
        `OpenFEMA has no hurricane disaster declarations for ${county} County since 2000. Either the filter spelling is off, or this county genuinely has not seen a federally declared hurricane in the modern record.`
      );
    } else {
      const mostRecent = events[0];
      const oldest = events[events.length - 1];
      const yearsSinceLast = Math.floor(
        (Date.now() - new Date(mostRecent.earliestDeclaration).getTime()) / (365.25 * 24 * 3600 * 1000)
      );
      const span = Math.floor(
        (new Date(mostRecent.earliestDeclaration).getTime() -
          new Date(oldest.earliestDeclaration).getTime()) /
          (365.25 * 24 * 3600 * 1000)
      );
      const cadence = span > 0 && totalEvents > 1 ? (span / (totalEvents - 1)).toFixed(1) : "—";

      paragraphs.push(
        `${county} County has been declared in ${totalEvents} hurricane events since 2000 (${totalDecls} per-county-per-program declaration rows). Most recent: ${mostRecent.title} (${mostRecent.earliestDeclaration.slice(0, 10)}) — ${yearsSinceLast === 0 ? "this year" : `${yearsSinceLast} year${yearsSinceLast === 1 ? "" : "s"} ago`}. Average cadence: roughly one declared hurricane event every ${cadence} year${cadence === "1.0" ? "" : "s"}.`
      );

      const lastThree = events.slice(0, 3).map((e) => e.title).join(" · ");
      paragraphs.push(
        `Your last 3 declared events: ${lastThree}. Each represents a real operational footprint — sheltering, mass care, casework, IA. The LightRAG narrative panel (next) will synthesize the response patterns across these events into operational guidance.`
      );

      bullets.push({ label: "Declared events (since 2000)", value: String(totalEvents) });
      bullets.push({ label: "Most recent", value: `${mostRecent.title.replace(/^HURRICANE\s+/i, "")} · ${mostRecent.earliestDeclaration.slice(0, 4)}` });
      bullets.push({ label: "Years since last", value: yearsSinceLast === 0 ? "this year" : String(yearsSinceLast) });
      if (cadence !== "—") bullets.push({ label: "Cadence", value: `~1 event / ${cadence} yr` });
    }
    citations.push("OpenFEMA Disaster Declarations · state=FL · incidentType=Hurricane");
  } else {
    paragraphs.push(
      `Statewide baseline: ${allEventsCount} distinct hurricane events have produced FEMA declarations across FL counties since 2000. Pick a county to drill into local precedent.`
    );
    bullets.push({ label: "Distinct FL hurricane events", value: String(allEventsCount) });
    bullets.push({ label: "Per-county declaration rows", value: String(totalDecls) });
    citations.push("OpenFEMA Disaster Declarations · state=FL · incidentType=Hurricane");
  }

  // Operational read
  if (storm && county && totalEvents > 0) {
    paragraphs.push(
      `Operational read: ${county} has the muscle memory. Your local team has run this play. The pre-staging questions are the same as last time — only the storm name has changed.`
    );
  } else if (storm && !county) {
    paragraphs.push(
      `Operational read: select a county to see its specific precedent. The questions to ask: when did we last respond there, what did it cost, how many sheltered, what did we wish we'd pre-staged.`
    );
  }

  return { headline, paragraphs, bullets, citations };
}
