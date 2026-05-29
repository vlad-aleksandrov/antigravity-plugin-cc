---
description: Show the stored final output for a finished Antigravity job in this repository
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Display the final output from a completed Antigravity job stored in this repository.

```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/antigravity-companion.mjs" result --json $ARGUMENTS
```

## Arguments

- `[job-id]`: The job ID to retrieve. If omitted, the most recent finished job is shown.

## Output handling

Present the result comprehensively. Do not summarize or condense it. Show the complete result payload including verdict, summary, findings, details, artifacts, and next steps, with exact file paths, line numbers, and any error messages preserved as originally reported.

Users may then run `/antigravity:status <id>` or `/antigravity:review` for additional information.

Model invocation is disabled for this command. Allowed tools: Bash (node only).
