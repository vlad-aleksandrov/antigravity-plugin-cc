# Antigravity plugin for Claude Code

Use Antigravity from inside Claude Code for code reviews or to delegate tasks to `agy`.

This plugin is for Claude Code users who want an easy way to start using Antigravity from the workflow they already have.

## What You Get

- `/antigravity:review` for a normal read-only Antigravity review
- `/antigravity:adversarial-review` for a steerable challenge review
- `/antigravity:rescue`, `/antigravity:status`, `/antigravity:result`, and `/antigravity:cancel` to delegate work and manage background jobs

## Requirements

- **Antigravity CLI (`agy`) installed and authenticated via Google OAuth.**
- **Node.js 18.18 or later**

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add vlad-aleksandrov/antigravity-plugin-cc
```

Install the plugin:

```bash
/plugin install antigravity@antigravity
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/antigravity:setup
```

`/antigravity:setup` will tell you whether Antigravity is ready.

If `agy` is installed but not yet authenticated, run it once interactively to complete Google OAuth:

```bash
agy
```

After install, you should see:

- the slash commands listed below
- the `antigravity:antigravity-rescue` subagent in `/agents`

One simple first run is:

```bash
/antigravity:review --background
/antigravity:status
/antigravity:result
```

## Usage

### `/antigravity:review`

Runs a normal Antigravity review on your current work.

> [!NOTE]
> Code review especially for multi-file changes might take a while. It's generally recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your branch compared to a base branch like `main`

Use `--base <ref>` for branch review. Also supports `--wait`, `--background`, and `--focus <text>`.

Examples:

```bash
/antigravity:review
/antigravity:review --base main
/antigravity:review --background
/antigravity:review --focus "check error handling"
```

This command is read-only and will not perform any changes.

### `/antigravity:adversarial-review`

Runs a **steerable** review that questions the chosen implementation and design.

It can be used to pressure-test assumptions, tradeoffs, failure modes, and whether a different approach would have been safer or simpler.

It uses the same review target selection as `/antigravity:review`, including `--base <ref>` for branch review.
Also supports `--wait`, `--background`, and `--focus <text>`.

Use it when you want:

- a review before shipping that challenges the direction, not just the code details
- review focused on design choices, tradeoffs, hidden assumptions, and alternative approaches
- pressure-testing around specific risk areas like auth, data loss, rollback, race conditions, or reliability

Examples:

```bash
/antigravity:adversarial-review
/antigravity:adversarial-review --base main --focus "challenge the caching and retry design"
/antigravity:adversarial-review --background --focus "look for race conditions"
```

This command is read-only. It does not fix code.

### `/antigravity:rescue`

Hands a task to Antigravity through the `antigravity:antigravity-rescue` subagent.

Use it when you want Antigravity to:

- investigate a bug
- try a fix
- continue a previous Antigravity task

> [!NOTE]
> Depending on the task, these tasks might take a long time and it's generally recommended to run in the background.

It supports `--background`, `--wait`, `--resume`, and `--fresh`. If you omit `--resume` and `--fresh`, the plugin can offer to continue the latest rescue thread for this repo.

Examples:

```bash
/antigravity:rescue investigate why the tests started failing
/antigravity:rescue fix the failing test with the smallest safe patch
/antigravity:rescue --resume apply the top fix from the last run
/antigravity:rescue --background investigate the regression
```

You can also just ask for a task to be delegated to Antigravity:

```text
Ask Antigravity to redesign the database connection to be more resilient.
```

### `/antigravity:status`

Shows running and recent Antigravity jobs for the current repository.

Examples:

```bash
/antigravity:status
/antigravity:status task-abc123
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `/antigravity:result`

Shows the final stored Antigravity output for a finished job.

Examples:

```bash
/antigravity:result
/antigravity:result task-abc123
```

### `/antigravity:cancel`

Cancels an active background Antigravity job.

Examples:

```bash
/antigravity:cancel
/antigravity:cancel task-abc123
```

### `/antigravity:setup`

Checks whether Antigravity is installed and authenticated.

You can also use `/antigravity:setup` to manage the optional review gate.

#### Enabling review gate

```bash
/antigravity:setup --enable-review-gate
/antigravity:setup --disable-review-gate
```

When the review gate is enabled, the plugin uses a `Stop` hook to run a targeted Antigravity review based on Claude's response. If that review finds issues, the stop is blocked so Claude can address them first.

> [!WARNING]
> The review gate can create a long-running Claude/Antigravity loop and may drain usage limits quickly. Only enable it when you plan to actively monitor the session.

## Typical Flows

### Review Before Shipping

```bash
/antigravity:review
```

### Hand A Problem To Antigravity

```bash
/antigravity:rescue investigate why the build is failing in CI
```

### Start Something Long-Running

```bash
/antigravity:adversarial-review --background
/antigravity:rescue --background investigate the flaky test
```

Then check in with:

```bash
/antigravity:status
/antigravity:result
```

## Antigravity Integration

The Antigravity plugin wraps the local `agy` binary installed in your environment. It uses your existing Google OAuth credentials and runs in the context of the current repository.

### Model Configuration

The model used by `agy` is configured in `~/.gemini/antigravity-cli/settings.json`. Open `agy` interactively and use `/settings` to change the model. The plugin inherits whatever model is configured there.

### Moving The Work Over To Antigravity

Delegated tasks can be continued directly inside `agy` by running it interactively and using `/resume` to select a previous conversation, or by passing `--conversation <uuid>` to resume a specific session.

## FAQ

### Do I need a separate Antigravity account for this plugin?

If you are already signed into `agy` on this machine, your existing Google account works immediately. This plugin uses your local `agy` authentication.

### Does the plugin use a separate Antigravity runtime?

No. This plugin delegates through your local `agy` binary on the same machine. That means it uses the same install, the same authentication, and the same repository checkout.

### Will it use the same Antigravity config I already have?

Yes. The plugin inherits your `~/.gemini/antigravity-cli/settings.json` configuration, including model selection.
