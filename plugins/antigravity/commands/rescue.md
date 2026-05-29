---
description: Delegate investigation, an explicit fix request, or follow-up rescue work to the Antigravity rescue subagent
argument-hint: '[--background|--wait] [--resume|--fresh] [what Antigravity should investigate, solve, or continue]'
allowed-tools: Bash(node:*), AskUserQuestion, Agent
---

Delegate an investigation, implementation, or follow-up task to Antigravity (`agy`).

Use the `Agent` tool with `subagent_type: "antigravity:antigravity-rescue"`, forwarding the raw user request as the prompt. Do not call it as a skill.

## Execution modes

- `--background`: Runs in background; check with `/antigravity:status`.
- `--wait`: Runs in foreground (default if neither flag is specified).

## Resume logic

Before starting a new task, check for resumable threads:

```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/antigravity-companion.mjs" status --json
```

If a recent completed task job exists and the user has not passed `--resume` or `--fresh`, ask the user once with `AskUserQuestion` whether to continue the previous conversation or start fresh.

- `--resume`: Resume the previous conversation without asking.
- `--fresh`: Start a new conversation without asking.

## Output

Return the subagent's stdout verbatim without paraphrasing, summarization, or added commentary.

## Guidelines

- Do not ask the subagent for follow-up inspections, polling, or status checks.
- If `agy` is missing or unauthenticated, direct users to run `/antigravity:setup`.
