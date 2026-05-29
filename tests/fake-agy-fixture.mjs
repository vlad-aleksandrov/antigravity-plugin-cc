import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeTempDir, writeExecutable } from "./helpers.mjs";

/**
 * Creates a temporary fake `agy` binary that:
 * - Always exits 0
 * - Writes configurable stdout
 * - Optionally records invocation args to a file
 *
 * Returns { binDir, argsFile } where binDir should be prepended to PATH.
 */
export function createFakeAgy(options = {}) {
  const binDir = makeTempDir("fake-agy-bin-");
  const argsFile = path.join(binDir, "agy-args.json");
  const stdout = options.stdout ?? "Fake agy output.\n";
  const stderr = options.stderr ?? "";

  const script = [
    "#!/usr/bin/env node",
    `import fs from "node:fs";`,
    `import process from "node:process";`,
    ``,
    `const argsFile = ${JSON.stringify(argsFile)};`,
    `fs.writeFileSync(argsFile, JSON.stringify(process.argv.slice(2)), "utf8");`,
    ``,
    `if (${JSON.stringify(stderr)}) {`,
    `  process.stderr.write(${JSON.stringify(stderr)});`,
    `}`,
    `process.stdout.write(${JSON.stringify(stdout)});`,
    `process.exit(0);`
  ].join("\n");

  const binPath = path.join(binDir, "agy");
  writeExecutable(binPath, script);

  return { binDir, argsFile };
}

/**
 * Reads the recorded args from a fake agy invocation.
 */
export function readFakeAgyArgs(argsFile) {
  if (!fs.existsSync(argsFile)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(argsFile, "utf8"));
}
