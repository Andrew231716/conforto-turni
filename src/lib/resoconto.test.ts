import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildResoconto } from "./resoconto";
import { createSeedData } from "./seed";

describe("resoconto", () => {
  it("aggregates visits in window and ranks forecast by oldest", () => {
    const seed = createSeedData();
    // Seed is Set–Nov 2026; use asOf inside that window
    const asOf = new Date("2026-11-15T12:00:00Z");
    const report = buildResoconto(seed.programs, seed.people, {
      monthsBack: 6,
      asOf,
    });

    assert.ok(report.destinatari.length >= 10);
    assert.ok(report.totals.visits > 0);
    assert.ok(report.forecast.length > 0);

    // Chronology sorted ascending per person who has events
    const withEvents = report.destinatari.find((d) => d.chronology.length > 1);
    if (withEvents) {
      for (let i = 1; i < withEvents.chronology.length; i++) {
        assert.ok(
          withEvents.chronology[i - 1].date <= withEvents.chronology[i].date
        );
      }
    }

    // Never-visited (in window) should appear before recently visited in forecast
    const neverIdx = report.forecast.findIndex((f) =>
      f.reason.startsWith("Mai")
    );
    const recent = report.destinatari
      .filter((d) => d.lastVisitDate)
      .sort((a, b) => b.lastVisitDate!.localeCompare(a.lastVisitDate!))[0];
    if (neverIdx >= 0 && recent) {
      const recentIdx = report.forecast.findIndex(
        (f) => f.recipientId === recent.id
      );
      if (recentIdx >= 0) assert.ok(neverIdx < recentIdx);
    }
  });
});
