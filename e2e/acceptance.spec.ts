// Phase 1 acceptance: "a never-seen-it user builds a 3-track roadmap by hand
// in under 3 minutes, nothing visually overlaps — passes at 390px with touch."
// The test does it via UI clicks, then walks the DOM to verify the layout
// invariant that no two clips share both an X and a Y range.

import { test, expect, type Page } from "@playwright/test";

const TRACKS = ["Career", "Health", "Fatherhood"];

async function addTrack(page: Page, name: string) {
  // The first track on an empty roadmap is added from the EmptyState door;
  // subsequent ones use the toolbar "+ Track".
  if (await page.getByText("Three ways to start").isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /Add a track manually/i }).click();
  } else {
    await page.getByRole("button", { name: /^\+ Track$/ }).click();
  }
  await page.getByPlaceholder(/Career, Health, Fatherhood/).fill(name);
  await page.getByRole("button", { name: /^Add$/ }).click();
}

async function addClip(page: Page, title: string, trackName: string) {
  await page.getByRole("button", { name: /^\+ Clip$/ }).click();
  await page.getByPlaceholder(/What's it called|Sunday calls home/).fill(title);
  await page.locator("select").selectOption({ label: trackName });
  await page.getByRole("button", { name: /^Add$/ }).click();
}

test("user builds a 3-track roadmap by hand at 390px touch viewport", async ({
  page,
}) => {
  const started = Date.now();
  await page.goto("/");

  // Empty state shows three doors
  await expect(page.getByText("Three ways to start")).toBeVisible();

  for (const name of TRACKS) {
    await addTrack(page, name);
  }

  // Each track should now have a header visible in the timeline column.
  // exact:true avoids matching the per-track "+" / "×" buttons that share the name.
  for (const name of TRACKS) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }

  // Add one clip per track
  await addClip(page, "Promo packet", "Career");
  await addClip(page, "Marathon training", "Health");
  await addClip(page, "Birth class", "Fatherhood");

  // Three clips render in the SVG canvas
  const clipGroups = page.locator("svg [data-clip-id]");
  await expect(clipGroups).toHaveCount(3);

  // Layout invariant: no two clips visually overlap (same X AND Y range).
  const boxes = await clipGroups.evaluateAll((els) =>
    els.map((el) => {
      const r = (el as SVGGraphicsElement).getBoundingClientRect();
      return { id: el.getAttribute("data-clip-id") ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const xOverlap = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1;
      const yOverlap = a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
      expect(
        xOverlap && yOverlap,
        `clips ${a.id} and ${b.id} visually overlap`,
      ).toBe(false);
    }
  }

  // 3-minute budget for the whole flow.
  const elapsed = (Date.now() - started) / 1000;
  expect(elapsed, `took ${elapsed.toFixed(1)}s`).toBeLessThan(180);
});

test("the sample-life door produces a non-empty roadmap", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Load a sample life/i }).click();

  await expect(page.locator("svg [data-clip-id]").first()).toBeVisible();
  const clipCount = await page.locator("svg [data-clip-id]").count();
  expect(clipCount).toBeGreaterThanOrEqual(10);

  // Track tags should render for the three seeded tracks.
  await expect(page.getByRole("button", { name: /^Career$/ })).toBeVisible();
});
