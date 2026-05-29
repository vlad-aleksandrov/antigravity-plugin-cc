import test from "node:test";
import assert from "node:assert/strict";

import { renderReviewResult, renderStoredJobResult, renderFreeTextReviewResult } from "../plugins/antigravity/scripts/lib/render.mjs";

test("renderReviewResult degrades gracefully when JSON is missing required review fields", () => {
  const output = renderReviewResult(
    {
      parsed: {
        verdict: "approve",
        summary: "Looks fine."
      },
      rawOutput: JSON.stringify({
        verdict: "approve",
        summary: "Looks fine."
      }),
      parseError: null
    },
    {
      reviewLabel: "Adversarial Review",
      targetLabel: "working tree diff"
    }
  );

  assert.match(output, /Antigravity returned JSON with an unexpected review shape\./);
  assert.match(output, /Missing array `findings`\./);
  assert.match(output, /Raw final message:/);
});

test("renderStoredJobResult prefers rendered output for structured review jobs", () => {
  const output = renderStoredJobResult(
    {
      id: "review-123",
      status: "completed",
      title: "Antigravity Adversarial Review",
      jobClass: "review",
      threadId: "conv-abc123"
    },
    {
      threadId: "conv-abc123",
      rendered: "# Antigravity Adversarial Review\n\nTarget: working tree diff\nVerdict: needs-attention\n",
      result: {
        result: {
          verdict: "needs-attention",
          summary: "One issue.",
          findings: [],
          next_steps: []
        },
        rawOutput:
          '{"verdict":"needs-attention","summary":"One issue.","findings":[],"next_steps":[]}'
      }
    }
  );

  assert.match(output, /^# Antigravity Adversarial Review/);
  assert.doesNotMatch(output, /^\{/);
  assert.match(output, /Antigravity conversation ID: conv-abc123/);
  assert.match(output, /Resume: \/antigravity:rescue --resume/);
});

test("renderFreeTextReviewResult renders finalMessage as output", () => {
  const output = renderFreeTextReviewResult(
    { finalMessage: "Looks good. No issues found.", stderr: "", status: 0 },
    { reviewLabel: "Review", targetLabel: "working tree diff" }
  );

  assert.match(output, /# Antigravity Review/);
  assert.match(output, /Target: working tree diff/);
  assert.match(output, /Looks good\. No issues found\./);
});

test("renderFreeTextReviewResult shows failure message when stdout is empty and status is non-zero", () => {
  const output = renderFreeTextReviewResult(
    { finalMessage: "", stderr: "connection refused", status: 1 },
    { reviewLabel: "Review", targetLabel: "working tree diff" }
  );

  assert.match(output, /Antigravity review failed\./);
  assert.match(output, /connection refused/);
});
