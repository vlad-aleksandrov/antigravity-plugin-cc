import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMMANDS_DIR = path.join(ROOT, "plugins", "antigravity", "commands");
const AGENTS_DIR = path.join(ROOT, "plugins", "antigravity", "agents");
const SKILLS_DIR = path.join(ROOT, "plugins", "antigravity", "skills");

function readCommand(name) {
  return fs.readFileSync(path.join(COMMANDS_DIR, `${name}.md`), "utf8");
}

function readAgent(name) {
  return fs.readFileSync(path.join(AGENTS_DIR, `${name}.md`), "utf8");
}

function readSkill(name) {
  return fs.readFileSync(path.join(SKILLS_DIR, name, "SKILL.md"), "utf8");
}

test("review command uses antigravity-companion.mjs", () => {
  const content = readCommand("review");
  assert.match(content, /antigravity-companion\.mjs/);
});

test("review command supports AskUserQuestion flow (foreground or background)", () => {
  const content = readCommand("review");
  assert.match(content, /AskUserQuestion/);
  assert.match(content, /--wait/);
  assert.match(content, /--background/);
});

test("adversarial-review command uses antigravity-companion.mjs", () => {
  const content = readCommand("adversarial-review");
  assert.match(content, /antigravity-companion\.mjs/);
});

test("review and adversarial-review commands are review-only (no patches)", () => {
  const review = readCommand("review");
  const adversarial = readCommand("adversarial-review");
  assert.match(review, /Do not fix/);
  assert.match(adversarial, /Do not fix/);
});

test("rescue command routes to antigravity:antigravity-rescue subagent", () => {
  const content = readCommand("rescue");
  assert.match(content, /antigravity:antigravity-rescue/);
});

test("rescue command does not mention --model or --effort flags", () => {
  const content = readCommand("rescue");
  assert.doesNotMatch(content, /--model/);
  assert.doesNotMatch(content, /--effort/);
});

test("rescue command supports --resume and --fresh flags", () => {
  const content = readCommand("rescue");
  assert.match(content, /--resume/);
  assert.match(content, /--fresh/);
});

test("status command has model invocation disabled", () => {
  const content = readCommand("status");
  assert.match(content, /Model invocation is disabled/);
});

test("result command has model invocation disabled", () => {
  const content = readCommand("result");
  assert.match(content, /Model invocation is disabled/);
});

test("cancel command has model invocation disabled", () => {
  const content = readCommand("cancel");
  assert.match(content, /Model invocation is disabled/);
});

test("setup command does not mention npm install codex", () => {
  const content = readCommand("setup");
  assert.doesNotMatch(content, /npm install.*codex/);
  assert.doesNotMatch(content, /codex login/);
});

test("setup command mentions agy authentication", () => {
  const content = readCommand("setup");
  assert.match(content, /agy/);
  assert.match(content, /auth/i);
});

test("rescue agent uses antigravity-companion.mjs task subcommand", () => {
  const content = readAgent("antigravity-rescue");
  assert.match(content, /antigravity-companion\.mjs/);
  assert.match(content, /task/);
});

test("rescue agent does not mention --model or --effort", () => {
  const content = readAgent("antigravity-rescue");
  assert.doesNotMatch(content, /--model/);
  assert.doesNotMatch(content, /--effort/);
});

test("rescue agent references antigravity-cli-runtime skill", () => {
  const content = readAgent("antigravity-rescue");
  assert.match(content, /antigravity-cli-runtime/);
});

test("cli-runtime skill uses single task invocation contract", () => {
  const content = readSkill("antigravity-cli-runtime");
  assert.match(content, /exactly one `task` invocation/);
  assert.match(content, /antigravity-companion\.mjs/);
});

test("cli-runtime skill does not mention model or effort", () => {
  const content = readSkill("antigravity-cli-runtime");
  assert.doesNotMatch(content, /--model/);
  assert.doesNotMatch(content, /--effort/);
  assert.doesNotMatch(content, /spark/);
});
