// Verifies that the import button accepts a v2 JSON export and the resulting
// roadmap renders. This is the end-to-end version of the Phase 0 migration
// test — proves it survives the UI path, not just the unit test.

import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const V2_EXPORT = {
  version: 2,
  settings: { apiKey: null, horizonYears: 5, weeklyCapacity: 1.0, lookaheadDays: 14 },
  tracks: [{ id: "t1", name: "From v2", color: "#5b8def", order: 0 }],
  clips: [
    {
      id: "c1",
      trackId: "t1",
      kind: "goal", // → task
      title: "Imported task",
      start: "2026-08-01",
      end: "2026-10-01",
      effort: 3,
    },
    {
      id: "c2",
      trackId: "t1",
      kind: "recurring", // → stem
      title: "Imported stem",
      start: "2026-08-01",
      effort: 2,
      recurrence: { freq: "weekly", until: "2027-02-01" },
    },
  ],
};

test("importing a v2 JSON export migrates and renders", async ({ page }, info) => {
  const tmp = path.join(info.outputDir, "v2-export.json");
  await fs.mkdir(info.outputDir, { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(V2_EXPORT));

  await page.goto("/");

  // Need at least one interaction to dismiss the empty state — we'll add a
  // throwaway track and then immediately reset via import.
  await page.getByRole("button", { name: /Add a track manually/i }).click();
  await page.getByPlaceholder(/Career, Health, Fatherhood/).fill("placeholder");
  await page.getByRole("button", { name: /^Add$/ }).click();

  // Open settings sheet
  await page.getByRole("button", { name: /Settings/i }).click();

  // Import the v2 file
  const fileInput = page.locator('input[type="file"][accept*="json"]');
  await fileInput.setInputFiles(tmp);

  await expect(page.getByText(/Imported 1 tracks, 2 clips/i)).toBeVisible();

  // Close settings sheet and verify the track + clips render
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^From v2$/ })).toBeVisible();
  await expect(page.locator("svg [data-clip-id]")).toHaveCount(2);
});
