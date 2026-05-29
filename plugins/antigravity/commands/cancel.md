---
description: Cancel an active background Antigravity job in this repository
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Cancel an active background Antigravity job in this repository.

```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/antigravity-companion.mjs" cancel --json $ARGUMENTS
```

## Arguments

- `[job-id]`: The job ID to cancel. If omitted, cancels the only active job for this session (errors if there are multiple).

Model invocation is disabled for this command. Allowed tools: Bash (node only).
