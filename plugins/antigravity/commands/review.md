Run an Antigravity review through `agy`. The review is read-only — no fixes or patches are applied.

```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/antigravity-companion.mjs" review $ARGUMENTS
```

## Execution modes

- `--wait`: Run in foreground and return output immediately.
- `--background`: Launch as a detached background job; check progress with `/antigravity:status`.
- Default (neither flag): Estimate review scope, then use `AskUserQuestion` to ask the user whether to run in foreground or background.

## Scope estimation

Before asking the user, inspect:
- Untracked files and git status
- Staged and unstaged diffs
- Branch diff when a base reference is provided

Recommend background for anything beyond a 1-2 file change. Default to background when scope is unclear.

## Output handling

Return the companion script output verbatim. Do not summarize, condense, or modify it.

## Constraints

- Do not fix issues, apply patches, or suggest you are about to make changes.
- Model invocation is disabled for this command.
- Allowed tools: Read, Glob, Grep, Bash (node and git only).

## Optional arguments

- `--scope auto|working-tree|branch`: Control review scope (default: auto).
- `--base <ref>`: Set the base branch reference for branch-mode reviews.
- `--focus <text>`: Focus the review on a specific area or concern.
