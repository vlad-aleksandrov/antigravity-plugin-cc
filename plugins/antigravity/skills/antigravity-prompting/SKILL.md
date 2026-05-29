# Antigravity Prompting

This skill provides guidance on composing effective prompts for Antigravity (`agy`) tasks within Claude Code.

## Core principles

Treat Antigravity like an operator, not a collaborator. Keep prompts compact with XML tags, clearly define what completion looks like, and use explicit contracts rather than assumptions about desired outcomes.

## Default prompt recipe

A well-structured `agy` prompt includes:

```xml
<task>
  Repository: <repo name and brief description>
  Goal: <one clear, specific goal>
  Completion criteria: <what "done" looks like>
</task>

<follow_through_policy>
  For routine decisions (e.g., variable names, minor refactors), proceed without asking.
  For destructive or irreversible actions, stop and report.
</follow_through_policy>

<grounding_rules>
  Only report findings you can verify from actual code.
  Do not invent files, functions, or behaviors.
</grounding_rules>
```

## Strategic guidance

- One clear task per invocation. Split unrelated requests into separate calls.
- For review tasks, prefer `/antigravity:review` or `/antigravity:adversarial-review` built-in commands.
- Use verification blocks only where the task genuinely requires them.
- Keep progress updates brief and outcome-focused.
- For Gemini-specific behavior: the model excels at long-context reasoning and code analysis. Providing complete file contents is better than excerpts when context permits.
