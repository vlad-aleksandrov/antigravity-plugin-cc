Display active and recent Antigravity jobs for this repository, including review-gate status.

```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/antigravity-companion.mjs" status --json $ARGUMENTS
```

## Arguments

- `[job-id]`: Show details for a specific job.
- `--wait`: Poll until all active jobs complete, then show results.
- `--timeout-ms <ms>`: Maximum wait time in milliseconds when `--wait` is used.
- `--all`: Show all jobs, not just recent ones.

## Output handling

- When no job ID is provided: output as a single Markdown table for current and past runs. Keep it compact without extra formatting.
- When a job ID is specified: present the full command output to the user without summarization.

Preserve actionable fields: job ID, status, phase, duration, and follow-up commands.

Model invocation is disabled for this command. Allowed tools: Bash (node only).
