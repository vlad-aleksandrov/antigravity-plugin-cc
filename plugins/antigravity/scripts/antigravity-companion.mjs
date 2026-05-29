#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseArgs } from "./lib/args.mjs";
import {
  getAntigravityAuthStatus,
  getAntigravityAvailability,
  parseStructuredOutput,
  runAntigravityReview,
  runAntigravityTurn
} from "./lib/antigravity.mjs";
import { readStdinIfPiped } from "./lib/fs.mjs";
import { collectReviewContext, resolveReviewTarget } from "./lib/git.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  resolveCancelableJob,
  resolveResultJob,
  sortJobsNewestFirst
} from "./lib/job-control.mjs";
import { loadPromptTemplate, interpolateTemplate } from "./lib/prompts.mjs";
import {
  renderCancelReport,
  renderFreeTextReviewResult,
  renderJobStatusReport,
  renderReviewResult,
  renderSetupReport,
  renderStatusReport,
  renderStoredJobResult,
  renderTaskResult
} from "./lib/render.mjs";
import {
  generateJobId,
  getConfig,
  listJobs,
  readJobFile,
  resolveJobFile,
  setConfig,
  upsertJob
} from "./lib/state.mjs";
import {
  SESSION_ID_ENV,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  runTrackedJob
} from "./lib/tracked-jobs.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";
import { binaryAvailable, terminateProcessTree } from "./lib/process.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

const POLL_INTERVAL_MS = 2000;
const DEFAULT_STATUS_TIMEOUT_MS = 0;

function getNodeAvailability() {
  return binaryAvailable("node", ["--version"]);
}

async function buildSetupReport(cwd, options = {}) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const config = getConfig(workspaceRoot);
  const nodeStatus = getNodeAvailability();
  const agyStatus = getAntigravityAvailability(cwd);
  const authStatus = await getAntigravityAuthStatus();
  const actionsTaken = [];
  const nextSteps = [];

  if (options.enableReviewGate) {
    setConfig(workspaceRoot, "stopReviewGate", true);
    actionsTaken.push("Review gate enabled.");
  } else if (options.disableReviewGate) {
    setConfig(workspaceRoot, "stopReviewGate", false);
    actionsTaken.push("Review gate disabled.");
  }

  const ready = nodeStatus.available && agyStatus.available && authStatus.loggedIn;

  if (!agyStatus.available) {
    nextSteps.push(`Install agy: ${agyStatus.detail}`);
  } else if (!authStatus.loggedIn) {
    if (authStatus.tokenExpired) {
      nextSteps.push("OAuth token has expired. Run `agy` once interactively to refresh Google authentication.");
    } else {
      nextSteps.push("Run `agy` once interactively to complete Google OAuth authentication.");
    }
  }

  return {
    ready,
    node: nodeStatus,
    agy: agyStatus,
    auth: {
      detail: authStatus.loggedIn
        ? `Google account active${authStatus.account ? ` (${authStatus.account})` : ""}`
        : authStatus.tokenExpired
          ? "token expired — re-authenticate by running `agy` interactively"
          : "not authenticated"
    },
    reviewGateEnabled: getConfig(workspaceRoot).stopReviewGate,
    actionsTaken,
    nextSteps
  };
}

function buildReviewCollectionInput(cwd, options = {}) {
  const target = resolveReviewTarget(cwd, {
    scope: options.scope,
    base: options.base
  });
  const context = collectReviewContext(cwd, target, {
    maxInlineFiles: options.maxInlineFiles,
    maxInlineDiffBytes: options.maxInlineDiffBytes,
    includeDiff: options.includeDiff
  });
  return { target, context };
}

async function executeReviewRun(cwd, reviewName, options = {}) {
  const { target, context } = buildReviewCollectionInput(cwd, options);
  const targetLabel = target.label;
  const onProgress = options.onProgress ?? null;

  if (reviewName === "Review") {
    const template = loadPromptTemplate(ROOT_DIR, "review");
    const prompt = interpolateTemplate(template, {
      TARGET_LABEL: targetLabel,
      REVIEW_INPUT: context.content,
      REVIEW_COLLECTION_GUIDANCE: context.collectionGuidance,
      USER_FOCUS: options.focus ?? ""
    });
    const result = await runAntigravityReview(cwd, { prompt, onProgress });
    const rendered = renderFreeTextReviewResult(result, {
      reviewLabel: "Review",
      targetLabel
    });
    return {
      exitStatus: result.status,
      threadId: result.threadId,
      turnId: result.turnId,
      rendered,
      rawOutput: result.finalMessage,
      summary: `Review of ${targetLabel}`,
      payload: { result: { rawOutput: result.finalMessage }, rawOutput: result.finalMessage }
    };
  }

  if (reviewName === "Adversarial Review") {
    const template = loadPromptTemplate(ROOT_DIR, "adversarial-review");
    const prompt = interpolateTemplate(template, {
      TARGET_LABEL: targetLabel,
      USER_FOCUS: options.focus ?? "",
      REVIEW_INPUT: context.content,
      REVIEW_COLLECTION_GUIDANCE: context.collectionGuidance
    });
    const result = await runAntigravityReview(cwd, { prompt, onProgress });
    const parsed = parseStructuredOutput(result.finalMessage.trim(), {
      failureMessage: "Antigravity did not return structured review JSON."
    });
    const rendered = renderReviewResult(parsed, {
      reviewLabel: "Adversarial Review",
      targetLabel,
      reasoningSummary: result.reasoningSummary
    });
    return {
      exitStatus: result.status,
      threadId: result.threadId,
      turnId: result.turnId,
      rendered,
      rawOutput: result.finalMessage,
      summary: `Adversarial review of ${targetLabel}`,
      payload: { result: parsed, rawOutput: result.finalMessage }
    };
  }

  throw new Error(`Unknown review type: ${reviewName}`);
}

function resolveLatestTrackedTaskThread(cwd, options = {}) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));

  // Use `||` (not `??`) so an empty-string env var falls through to null,
  // which causes the latestTask filter to match all sessions (no-session behaviour).
  const currentSessionId = options.sessionId || process.env[SESSION_ID_ENV] || null;

  const runningJob = jobs.find((j) =>
    j.sessionId === currentSessionId &&
    (j.status === "queued" || j.status === "running")
  );
  if (runningJob) {
    throw new Error(
      `Antigravity job ${runningJob.id} is still ${runningJob.status}. Check /antigravity:status or cancel it before resuming.`
    );
  }

  const latestTask = jobs.find(
    (j) => j.jobClass === "task" && j.threadId &&
      (!currentSessionId || j.sessionId === currentSessionId)
  );
  return latestTask ? { id: latestTask.threadId } : null;
}

async function handleSetup(argv) {
  const { options } = parseArgs(argv, {
    booleanOptions: ["json", "enable-review-gate", "disable-review-gate"]
  });
  const cwd = process.cwd();
  const report = await buildSetupReport(cwd, {
    enableReviewGate: options["enable-review-gate"],
    disableReviewGate: options["disable-review-gate"]
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return report.ready ? 0 : 1;
  }

  process.stdout.write(renderSetupReport(report));
  return report.ready ? 0 : 1;
}

async function handleReview(argv, reviewName) {
  const { options, positionals } = parseArgs(argv, {
    booleanOptions: ["wait", "background", "json"],
    valueOptions: ["scope", "base", "focus", "timeout-ms"]
  });

  const cwd = process.cwd();
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const focus = options.focus ?? positionals.join(" ").trim() || null;
  const reviewOptions = {
    scope: options.scope,
    base: options.base,
    focus
  };

  const kindLabel = reviewName === "Review" ? "review" : "adversarial-review";
  const jobId = generateJobId(kindLabel === "review" ? "rev" : "adv");
  const jobRecord = createJobRecord({
    id: jobId,
    workspaceRoot,
    jobClass: "review",
    kind: kindLabel,
    kindLabel,
    title: `Antigravity ${reviewName}`,
    status: "queued",
    write: false
  });
  const logFile = createJobLogFile(workspaceRoot, jobId, `Antigravity ${reviewName}`);
  const updateProgress = createJobProgressUpdater(workspaceRoot, jobId);
  const reporter = createProgressReporter({ stderr: true, logFile, onEvent: updateProgress });

  const execution = await runTrackedJob(jobRecord, async () => {
    return executeReviewRun(cwd, reviewName, { ...reviewOptions, onProgress: reporter });
  }, { logFile });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ jobId, rawOutput: execution.rawOutput, rendered: execution.rendered })}\n`);
  } else {
    process.stdout.write(execution.rendered ?? "");
  }

  return execution.exitStatus ?? 0;
}

async function handleTask(argv) {
  const stdinInput = readStdinIfPiped();
  const { options, positionals } = parseArgs(argv, {
    booleanOptions: ["wait", "background", "json", "resume-last", "write"],
    valueOptions: ["timeout-ms"]
  });

  const cwd = process.cwd();
  const workspaceRoot = resolveWorkspaceRoot(cwd);

  let prompt = [...positionals, stdinInput].filter(Boolean).join("\n").trim();
  if (!prompt) {
    throw new Error("A prompt is required for the task command.");
  }

  let conversationId = null;
  let resumeLast = false;

  if (options["resume-last"]) {
    const thread = resolveLatestTrackedTaskThread(cwd);
    if (thread) {
      conversationId = thread.id;
    } else {
      resumeLast = true;
    }
  }

  const jobId = generateJobId("task");
  const jobRecord = createJobRecord({
    id: jobId,
    workspaceRoot,
    jobClass: "task",
    kind: "task",
    kindLabel: "rescue",
    title: `Antigravity Task: ${prompt.slice(0, 56)}`,
    status: "queued",
    write: options.write !== false
  });
  const logFile = createJobLogFile(workspaceRoot, jobId, "Antigravity Task");
  const updateProgress = createJobProgressUpdater(workspaceRoot, jobId);
  const reporter = createProgressReporter({ stderr: true, logFile, onEvent: updateProgress });

  const runner = async () => {
    const result = await runAntigravityTurn(workspaceRoot, {
      prompt,
      resumeLast,
      conversationId,
      onProgress: reporter
    });
    const rendered = renderTaskResult({ rawOutput: result.finalMessage, failureMessage: result.stderr }, {});
    return {
      exitStatus: result.status,
      threadId: result.threadId,
      turnId: result.turnId,
      rendered,
      rawOutput: result.finalMessage,
      summary: prompt.slice(0, 72),
      payload: { rawOutput: result.finalMessage }
    };
  };

  const execution = await runTrackedJob(jobRecord, runner, { logFile });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ jobId, rawOutput: execution.rawOutput, rendered: execution.rendered })}\n`);
  } else {
    process.stdout.write(execution.rendered ?? "");
  }

  return execution.exitStatus ?? 0;
}

async function handleStatus(argv) {
  const { options, positionals } = parseArgs(argv, {
    booleanOptions: ["json", "wait", "all"],
    valueOptions: ["timeout-ms"]
  });

  const cwd = process.cwd();
  const jobReference = positionals[0] ?? null;

  if (jobReference) {
    const { job } = buildSingleJobSnapshot(cwd, jobReference);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(job)}\n`);
    } else {
      process.stdout.write(renderJobStatusReport(job));
    }
    return 0;
  }

  const timeoutMs = options["timeout-ms"] ? Number(options["timeout-ms"]) : DEFAULT_STATUS_TIMEOUT_MS;
  const shouldWait = options.wait || timeoutMs > 0;

  if (shouldWait) {
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : Infinity;
    while (true) {
      const snapshot = buildStatusSnapshot(cwd, { all: options.all });
      const running = snapshot.running.length > 0;
      if (!running || Date.now() >= deadline) {
        if (options.json) {
          process.stdout.write(`${JSON.stringify(snapshot)}\n`);
        } else {
          process.stdout.write(renderStatusReport(snapshot));
        }
        return 0;
      }
      await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
    }
  }

  const snapshot = buildStatusSnapshot(cwd, { all: options.all });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(snapshot)}\n`);
  } else {
    process.stdout.write(renderStatusReport(snapshot));
  }
  return 0;
}

async function handleResult(argv) {
  const { options, positionals } = parseArgs(argv, {
    booleanOptions: ["json"]
  });

  const cwd = process.cwd();
  const jobReference = positionals[0] ?? null;
  const { workspaceRoot, job } = resolveResultJob(cwd, jobReference);

  const jobFile = resolveJobFile(workspaceRoot, job.id);
  const storedJob = fs.existsSync(jobFile) ? readJobFile(jobFile) : null;

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ job, storedJob })}\n`);
  } else {
    process.stdout.write(renderStoredJobResult(job, storedJob));
  }
  return 0;
}

async function handleCancel(argv) {
  const { options, positionals } = parseArgs(argv, {
    booleanOptions: ["json"]
  });

  const cwd = process.cwd();
  const jobReference = positionals[0] ?? null;
  const { job } = resolveCancelableJob(cwd, jobReference);

  try {
    terminateProcessTree(job.pid ?? NaN);
  } catch {
    // Ignore
  }

  const workspaceRoot = resolveWorkspaceRoot(cwd);
  upsertJob(workspaceRoot, { id: job.id, status: "cancelled" });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ cancelled: true, jobId: job.id })}\n`);
  } else {
    process.stdout.write(renderCancelReport({ ...job, status: "cancelled" }));
  }
  return 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const subcommand = argv[0] ?? "";
  const rest = argv.slice(1);

  let exitCode = 0;

  switch (subcommand) {
    case "setup":
      exitCode = await handleSetup(rest);
      break;
    case "review":
      exitCode = await handleReview(rest, "Review");
      break;
    case "adversarial-review":
      exitCode = await handleReview(rest, "Adversarial Review");
      break;
    case "task":
      exitCode = await handleTask(rest);
      break;
    case "status":
      exitCode = await handleStatus(rest);
      break;
    case "result":
      exitCode = await handleResult(rest);
      break;
    case "cancel":
      exitCode = await handleCancel(rest);
      break;
    default:
      process.stderr.write(`Unknown subcommand: ${subcommand}\n`);
      process.stderr.write("Usage: antigravity-companion.mjs <setup|review|adversarial-review|task|status|result|cancel> [options]\n");
      exitCode = 1;
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
