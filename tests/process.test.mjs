import test from "node:test";
import assert from "node:assert/strict";

import { terminateProcessTree } from "../plugins/antigravity/scripts/lib/process.mjs";

test("terminateProcessTree uses taskkill on windows", () => {
  const calls = [];
  const result = terminateProcessTree(1234, {
    platform: "win32",
    runCommandImpl: (cmd, args) => {
      calls.push({ cmd, args });
      return { error: null, status: 0, stdout: "", stderr: "" };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "taskkill");
  assert.deepEqual(calls[0].args, ["/PID", "1234", "/T", "/F"]);
  assert.equal(result.delivered, true);
  assert.equal(result.method, "taskkill");
});

test("terminateProcessTree handles missing process gracefully on windows", () => {
  const result = terminateProcessTree(1234, {
    platform: "win32",
    runCommandImpl: () => ({
      error: null,
      status: 128,
      stdout: "",
      stderr: 'ERROR: The process "1234" not found.'
    })
  });

  assert.equal(result.attempted, true);
  assert.equal(result.delivered, false);
  assert.equal(result.method, "taskkill");
});
