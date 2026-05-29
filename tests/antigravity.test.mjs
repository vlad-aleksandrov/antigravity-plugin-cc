import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { makeTempDir, initGitRepo, writeExecutable } from "./helpers.mjs";
import { createFakeAgy, readFakeAgyArgs } from "./fake-agy-fixture.mjs";
import { runAntigravityTurn } from "../plugins/antigravity/scripts/lib/antigravity.mjs";

function makeEnvWithAgy(binDir) {
  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`
  };
}

test("runAntigravityTurn returns stdout as finalMessage on success", async () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  const { binDir } = createFakeAgy({ stdout: "Review looks good.\n" });
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;

  try {
    const result = await runAntigravityTurn(cwd, {
      prompt: "Review this code",
      resumeLast: false,
      conversationId: null,
      onProgress: null
    });

    assert.equal(result.status, 0);
    assert.equal(result.finalMessage, "Review looks good.\n");
    assert.equal(result.turnId, null);
    assert.deepEqual(result.reasoningSummary, []);
  } finally {
    process.env.PATH = origPath;
  }
});

test("runAntigravityTurn trusts exit-code-0 as success even with empty stdout and non-empty stderr", async () => {
  // agy exits 0 even for some error conditions; we trust the exit code as authoritative.
  // Stderr warnings/notices do not override a clean exit. Callers inspect result.stderr
  // if they need to surface warning content.
  const cwd = makeTempDir();
  initGitRepo(cwd);
  const { binDir } = createFakeAgy({ stdout: "", stderr: "agy internal error\n" });
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;

  try {
    const result = await runAntigravityTurn(cwd, {
      prompt: "Review this code",
      resumeLast: false,
      conversationId: null,
      onProgress: null
    });

    assert.equal(result.status, 0);           // exit-code-0 → success
    assert.equal(result.finalMessage, "");
    assert.match(result.stderr, /agy internal error/); // stderr still captured for callers
  } finally {
    process.env.PATH = origPath;
  }
});

test("runAntigravityTurn reports failure for non-zero exit code", async () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  const dir = makeTempDir("fake-agy-nonzero-");
  const binPath = path.join(dir, "agy");
  writeExecutable(binPath, [
    "#!/usr/bin/env node",
    'import fs from "node:fs";',
    'import process from "node:process";',
    `fs.writeFileSync(${JSON.stringify(path.join(dir, "agy-args.json"))}, JSON.stringify(process.argv.slice(2)));`,
    'process.stderr.write("fatal crash\\n");',
    "process.exit(1);"
  ].join("\n"));

  const origPath = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${origPath}`;

  try {
    const result = await runAntigravityTurn(cwd, {
      prompt: "do something",
      resumeLast: false,
      conversationId: null,
      onProgress: null
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /fatal crash/);
  } finally {
    process.env.PATH = origPath;
  }
});

test("runAntigravityTurn passes --conversation flag when conversationId is set", async () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  const { binDir, argsFile } = createFakeAgy({ stdout: "Continuing...\n" });
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;

  try {
    await runAntigravityTurn(cwd, {
      prompt: "continue the task",
      resumeLast: false,
      conversationId: "test-conv-id-123",
      onProgress: null
    });

    const args = readFakeAgyArgs(argsFile);
    assert.ok(Array.isArray(args), "args file should exist");
    assert.ok(args.includes("--conversation"), "should include --conversation flag");
    assert.ok(args.includes("test-conv-id-123"), "should include the conversation ID");
    assert.ok(!args.includes("--continue"), "should not include --continue when conversationId is set");
  } finally {
    process.env.PATH = origPath;
  }
});

test("runAntigravityTurn passes --continue flag when resumeLast is true and no conversationId", async () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  const { binDir, argsFile } = createFakeAgy({ stdout: "Resuming...\n" });
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;

  try {
    await runAntigravityTurn(cwd, {
      prompt: "continue",
      resumeLast: true,
      conversationId: null,
      onProgress: null
    });

    const args = readFakeAgyArgs(argsFile);
    assert.ok(Array.isArray(args), "args file should exist");
    assert.ok(args.includes("--continue"), "should include --continue flag");
    assert.ok(!args.includes("--conversation"), "should not include --conversation when no ID");
  } finally {
    process.env.PATH = origPath;
  }
});

test("runAntigravityTurn passes --dangerously-skip-permissions on every call", async () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  const { binDir, argsFile } = createFakeAgy({ stdout: "ok\n" });
  const origPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;

  try {
    await runAntigravityTurn(cwd, {
      prompt: "do something",
      resumeLast: false,
      conversationId: null,
      onProgress: null
    });

    const args = readFakeAgyArgs(argsFile);
    assert.ok(args.includes("--dangerously-skip-permissions"), "should always pass --dangerously-skip-permissions");
  } finally {
    process.env.PATH = origPath;
  }
});

test("runAntigravityTurn reads threadId from last_conversations.json", async () => {
  // Use a temp home dir so the test never touches the real ~/.gemini directory.
  const workspaceRoot = makeTempDir();
  initGitRepo(workspaceRoot);
  const { binDir } = createFakeAgy({ stdout: "done\n" });

  const fakeHome = makeTempDir("fake-home-");
  const convCacheDir = path.join(fakeHome, ".gemini", "antigravity-cli", "cache");
  fs.mkdirSync(convCacheDir, { recursive: true });
  const convFile = path.join(convCacheDir, "last_conversations.json");
  fs.writeFileSync(convFile, JSON.stringify({ [workspaceRoot]: "conv-uuid-abc123" }), "utf8");

  const origPath = process.env.PATH;
  const origHome = process.env.HOME;
  process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
  process.env.HOME = fakeHome;

  try {
    const result = await runAntigravityTurn(workspaceRoot, {
      prompt: "run task",
      resumeLast: false,
      conversationId: null,
      onProgress: null
    });

    assert.equal(result.threadId, "conv-uuid-abc123");
  } finally {
    process.env.PATH = origPath;
    process.env.HOME = origHome;
  }
});
