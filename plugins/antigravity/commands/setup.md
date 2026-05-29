---
description: Check whether the local Antigravity CLI is ready and optionally toggle the stop-time review gate
argument-hint: '[--enable-review-gate|--disable-review-gate]'
allowed-tools: Bash(node:*), AskUserQuestion
---

Check whether the local Antigravity CLI is ready and manage the stop-time review gate.

Run:

```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/antigravity-companion.mjs" setup --json $ARGUMENTS
```

Display the final setup output to the user.

If `agy` is available but the user is not authenticated, show the guidance from the setup output directing them to run `agy` once interactively to complete Google OAuth authentication.

Supported arguments: `--enable-review-gate`, `--disable-review-gate`.
