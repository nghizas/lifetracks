// Phase 2 acceptance: the empty-state Composer door yields a real proposal
// (rendered as ghosts + a deck), and "Accept all" materializes the proposal
// as real tracks and clips on the canvas.
//
// The Anthropic Messages API is stubbed via context.route — we never make a
// real network call from the test. The BYOK key is preseeded into
// localStorage so the no-key empty state is bypassed.

import { test, expect } from "@playwright/test";

const ASSISTANT_PROPOSAL = {
  message: "Here's a starter roadmap for your writing project.",
  questions: [],
  suggestions: [],
  proposal: {
    newTrack: { tempId: "T1", name: "Writing", color: "#5b8def" },
    newClips: [
      {
        trackId: "T1",
        kind: "span",
        title: "Draft chapter 1",
        start: "2026-06-20",
        end: "2026-07-20",
        effort: 3,
      },
      {
        trackId: "T1",
        kind: "stem",
        title: "Morning pages",
        start: "2026-06-15",
        recurrence: { freq: "daily", until: "2026-12-15" },
      },
    ],
    modifications: [],
    removals: [],
  },
};

test("the empty-state Composer door produces a proposal that can be accepted", async ({
  context,
  page,
}) => {
  // Pre-seed the API key so the no-key empty state is bypassed.
  await context.addInitScript(() => {
    localStorage.setItem(
      "lifetracks.anthropic-key",
      "sk-ant-stub-key-for-tests-abcdefghij",
    );
  });

  // Stub the Anthropic Messages API to return our canned response.
  await context.route("https://api.anthropic.com/v1/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg_stub",
        model: "claude-sonnet-4-6-stub",
        content: [{ type: "text", text: JSON.stringify(ASSISTANT_PROPOSAL) }],
      }),
    });
  });

  await page.goto("/");

  // Empty-state door
  await expect(page.getByText("Three ways to start")).toBeVisible();
  await page.getByRole("button", { name: /Tell the Composer one thing/i }).click();

  // Composer sheet opens with the New-track focus already selected
  await expect(page.getByText("Composer · New track")).toBeVisible();

  // Type a message and send
  await page.getByPlaceholder(/Type a message/i).fill("Help me plan a writing project");
  await page.keyboard.press("Enter");

  // The proposal deck appears with three items: new track + 2 new clips
  await expect(page.getByText(/Proposed · 3 items/i)).toBeVisible();
  await expect(page.getByText("Writing").first()).toBeVisible();
  await expect(page.getByText(/Draft chapter 1/i)).toBeVisible();
  await expect(page.getByText(/Morning pages/i)).toBeVisible();

  // Accept all
  await page.getByRole("button", { name: /Accept all/i }).click();

  // Proposal deck is gone
  await expect(page.getByText(/Proposed ·/i)).toHaveCount(0);

  // Close the sheet and verify the new track + clips render on the canvas
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Writing$/ })).toBeVisible();
  await expect(page.locator("svg [data-clip-id]")).toHaveCount(2);
});
