import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { makeTempDir, initGitRepo, run } from "./helpers.mjs";
import { resolveReviewTarget, collectReviewContext } from "../plugins/antigravity/scripts/lib/git.mjs";

function makeCommit(cwd, files, message) {
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(cwd, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    run("git", ["add", name], { cwd });
  }
  run("git", ["commit", "-m", message], { cwd });
}

test("resolveReviewTarget returns working-tree when repo is dirty", () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  makeCommit(cwd, { "README.md": "initial\n" }, "init");
  fs.writeFileSync(path.join(cwd, "file.js"), "changed\n", "utf8");

  const target = resolveReviewTarget(cwd);
  assert.equal(target.mode, "working-tree");
});

test("resolveReviewTarget returns branch comparison when repo is clean", () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  makeCommit(cwd, { "README.md": "initial\n" }, "init");
  makeCommit(cwd, { "file.js": "new file\n" }, "add file");

  const target = resolveReviewTarget(cwd, { scope: "branch", base: "HEAD~1" });
  assert.equal(target.mode, "branch");
  assert.match(target.label, /HEAD~1/);
});

test("collectReviewContext handles small working tree changes inline", () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  makeCommit(cwd, { "README.md": "initial\n" }, "init");
  fs.writeFileSync(path.join(cwd, "file.js"), "const x = 1;\n", "utf8");
  run("git", ["add", "file.js"], { cwd });

  const target = resolveReviewTarget(cwd, { scope: "working-tree" });
  const ctx = collectReviewContext(cwd, target, { maxInlineFiles: 10 });

  assert.equal(ctx.mode, "working-tree");
  assert.ok(ctx.content.includes("file.js"), "should include file in content");
});

test("collectReviewContext skips nested git repos gracefully", () => {
  const cwd = makeTempDir();
  initGitRepo(cwd);
  makeCommit(cwd, { "README.md": "initial\n" }, "init");

  const nestedDir = path.join(cwd, "nested");
  fs.mkdirSync(nestedDir);
  run("git", ["init", "-b", "main"], { cwd: nestedDir });

  const target = resolveReviewTarget(cwd, { scope: "working-tree" });
  assert.doesNotThrow(() => {
    collectReviewContext(cwd, target);
  });
});
