Cancel an active background Antigravity job in this repository.

```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/antigravity-companion.mjs" cancel --json $ARGUMENTS
```

## Arguments

- `[job-id]`: The job ID to cancel. If omitted, cancels the only active job for this session (errors if there are multiple).

Model invocation is disabled for this command. Allowed tools: Bash (node only).
