import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readJsonFile } from "./fs.mjs";
import { binaryAvailable } from "./process.mjs";

export function getAntigravityAvailability(cwd) {
  return binaryAvailable("agy", ["--version"], { cwd });
}

export async function getAntigravityAuthStatus() {
  const credsFile = path.join(os.homedir(), ".gemini", "oauth_creds.json");
  const accountsFile = path.join(os.homedir(), ".gemini", "google_accounts.json");
  if (!fs.existsSync(credsFile)) {
    return { loggedIn: false, requiresAuth: true, account: null };
  }
  try {
    const accounts = JSON.parse(fs.readFileSync(accountsFile, "utf8"));
    return {
      loggedIn: Boolean(accounts?.active),
      account: accounts?.active ?? null,
      requiresAuth: !accounts?.active
    };
  } catch {
    return { loggedIn: false, requiresAuth: true, account: null };
  }
}

export function getSessionRuntimeStatus() {
  return {
    mode: "direct",
    label: "agy subprocess",
    detail: "Antigravity runs via subprocess on demand.",
    endpoint: null
  };
}

function readLastConversationId(workspaceRoot) {
  const mapFile = path.join(
    os.homedir(),
    ".gemini",
    "antigravity-cli",
    "cache",
    "last_conversations.json"
  );
  try {
    const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
    return map[workspaceRoot] ?? null;
  } catch {
    return null;
  }
}

export async function runAntigravityTurn(workspaceRoot, { prompt, resumeLast, conversationId, onProgress }) {
  return new Promise((resolve) => {
    const args = ["--dangerously-skip-permissions", "--print-timeout", "15m"];
    if (conversationId) {
      args.push("--conversation", conversationId);
    } else if (resumeLast) {
      args.push("--continue");
    }
    args.push("--print", prompt);

    const proc = spawn("agy", args, {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk;
      onProgress?.({ message: "Antigravity is working…", phase: "running" });
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    proc.on("close", () => {
      const threadId = readLastConversationId(workspaceRoot);
      const failed = !stdout.trim() && stderr.trim();
      resolve({
        status: failed ? 1 : 0,
        finalMessage: stdout,
        stderr,
        threadId,
        turnId: null,
        reasoningSummary: []
      });
    });

    proc.on("error", (err) => {
      resolve({
        status: 1,
        finalMessage: "",
        stderr: err.message,
        threadId: null,
        turnId: null,
        reasoningSummary: []
      });
    });
  });
}

export async function runAntigravityReview(cwd, options = {}) {
  const availability = getAntigravityAvailability(cwd);
  if (!availability.available) {
    throw new Error(
      `Antigravity CLI (agy) is not available: ${availability.detail}. Run /antigravity:setup.`
    );
  }
  return runAntigravityTurn(cwd, {
    prompt: options.prompt,
    onProgress: options.onProgress,
    resumeLast: false,
    conversationId: null
  });
}

export function parseStructuredOutput(rawOutput, fallback = {}) {
  if (!rawOutput) {
    return {
      parsed: null,
      parseError: fallback.failureMessage ?? "Antigravity did not return a final structured message.",
      rawOutput: rawOutput ?? "",
      ...fallback
    };
  }

  const text = rawOutput.trim();

  // Try raw text first, then any markdown-fenced blocks (Gemini wraps JSON in ```json...```)
  const candidates = [text];
  for (const match of text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)) {
    candidates.push(match[1].trim());
  }

  for (const candidate of candidates) {
    try {
      return { parsed: JSON.parse(candidate), parseError: null, rawOutput, ...fallback };
    } catch {
      // try next candidate
    }
  }

  let parseError = "unknown parse error";
  try {
    JSON.parse(text);
  } catch (err) {
    parseError = err.message;
  }
  return { parsed: null, parseError, rawOutput, ...fallback };
}

export function readOutputSchema(schemaPath) {
  return readJsonFile(schemaPath);
}
