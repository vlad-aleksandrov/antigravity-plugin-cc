# Antigravity CLI Runtime

This skill governs how the `antigravity:antigravity-rescue` subagent invokes the companion runtime.

## Contract

The rescue subagent is a forwarder, not an orchestrator. Its sole responsibility is to invoke the `task` subcommand once and return stdout unchanged.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/antigravity-companion.mjs" task --json [--resume-last] [--write] "<prompt>"
```

## Rules

- Use exactly one `task` invocation per rescue handoff.
- Strip routing flags (`--background`, `--wait`, `--resume`, `--fresh`) before execution.
- Default to write-capable mode by passing `--write` unless read-only is explicitly requested.
- Pass `--resume-last` when the user asked to continue a previous session.
- Do not call `setup`, `review`, `adversarial-review`, `status`, `result`, or `cancel`.
- Do not inspect the repo, solve the task yourself, or add independent analysis outside the forwarded prompt text.
- Return task stdout exactly as-is without modification or summarization.
- If invocation fails, return nothing.
