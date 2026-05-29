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

Performs a standard, read-only code review on your local git state.

Use it when you want a second pass on uncommitted working-tree changes before you commit, or when you want to audit everything on your feature branch relative to `main` before opening a PR.

How it works: the plugin collects your git status, staged and unstaged diffs, and untracked file contents. For small changesets the full diff is embedded directly in the prompt; for larger ones the model reads files via read-only tool calls inside its sandbox. The output is free-form Markdown covering logic bugs, missing edge cases, and safety concerns.

> [!NOTE]
> Multi-file reviews can take a while. Running in the background is usually the right call unless the change is tiny.

```bash
/antigravity:review
/antigravity:review --base main
/antigravity:review --background
/antigravity:review --focus "validate error handling and retries"
```

Flags:
- `--scope <working-tree|branch|auto>` — limit the review to uncommitted edits or branch differences (default: `auto`)
- `--base <ref>` — compare against a specific branch or commit (e.g. `--base main`)
- `--focus <text>` — direct attention to a specific area or concern
- `--wait` / `--background` — run in the foreground or as a detached background job

This command is read-only and will not modify any files.

### `/antigravity:adversarial-review`

Runs a challenge review that actively questions the chosen implementation and design rather than just looking for defects.

Use it when you want to pressure-test the direction, not just the code. It is well-suited for changes that touch authentication boundaries, data loss paths, schema migrations, lock ordering, or retry logic — anywhere the cost of a wrong design is high.

It uses the same git context extraction as `/antigravity:review` but enforces a structured JSON output contract. The result is rendered as a verdict (`approve` / `needs-attention`), a summary, and a list of findings sorted by severity (`critical`, `high`, `medium`, `low`), each with a file location, confidence score, and concrete recommendation.

```bash
/antigravity:adversarial-review
/antigravity:adversarial-review --base main --focus "challenge the caching and retry design"
/antigravity:adversarial-review --background --focus "look for race conditions"
```

Supports all the same flags as `/antigravity:review`. This command is read-only.

### `/antigravity:rescue`

Delegates a coding, debugging, or investigative task to Antigravity through the `antigravity:antigravity-rescue` subagent.

Use it when you want Antigravity to investigate a regression, attempt a fix, continue a previous run, or take a second implementation pass when Claude Code is stuck.

Unlike the review commands, rescue defaults to **write-capable mode** — `agy` can modify files and write patches directly into your repository. The task runs headlessly through the local `agy` runtime.

If you omit `--resume` and `--fresh`, the plugin checks for a resumable conversation from this session and offers to continue it or start fresh.

> [!NOTE]
> Complex tasks can take a long time. Running in the background is usually the right call, especially for multi-step investigations or fixes.

```bash
/antigravity:rescue investigate why the tests started failing
/antigravity:rescue fix the failing test with the smallest safe patch
/antigravity:rescue --resume apply the top fix from the last run
/antigravity:rescue --background investigate the regression
```

You can also delegate conversationally:

```text
Ask Antigravity to redesign the database connection to be more resilient.
```

Flags:
- `--background` — launch as a detached background job; check progress with `/antigravity:status`
- `--wait` — run in the foreground and block until complete (default)
- `--resume` — continue the previous Antigravity conversation for this repo without asking
- `--fresh` — start a new conversation without asking

### `/antigravity:status`

Shows active and recently completed Antigravity jobs for the current repository.

```bash
/antigravity:status
/antigravity:status task-abc123
/antigravity:status --wait
```

Without a job ID, renders a compact table of current and recent jobs: Job ID, kind, status, phase, elapsed time, conversation ID, and quick-action commands.

With a job ID, shows the full detail view: active phase, run duration, log location, and progress lines.

`--wait` polls until all active jobs complete before returning the final status table.

### `/antigravity:result`

Retrieves the complete stored output for a finished job.

```bash
/antigravity:result
/antigravity:result task-abc123
```

Without a job ID, returns the most recently completed job. With a job ID, returns that specific job's full result — verdict, summary, findings, artifacts, and any error messages — exactly as produced, without summarisation.

For review jobs, also shows the conversation ID so you can continue the work directly in `agy` with `agy --conversation <uuid>`.

### `/antigravity:cancel`

Cancels an active background job.

```bash
/antigravity:cancel
/antigravity:cancel task-abc123
```

Terminates the entire process group (killing `agy` and any child processes), then marks the job as cancelled in the workspace state. Without a job ID, cancels the only active job for this session; if multiple are running, a job ID is required.

### `/antigravity:setup`

Checks whether the local Antigravity CLI is installed, authenticated, and ready to use.

```bash
/antigravity:setup
```

Inspects: Node.js availability, `agy` binary presence, and Google OAuth credentials (`~/.gemini/oauth_creds.json` token validity and `~/.gemini/google_accounts.json` active account). Reports diagnostic status and lists the next steps if anything is missing or expired.

If `agy` is installed but not authenticated, follow the prompt to run `agy` once interactively to complete Google OAuth.

#### Review gate

```bash
/antigravity:setup --enable-review-gate
/antigravity:setup --disable-review-gate
```

When the review gate is enabled, the plugin registers a `Stop` hook that runs a targeted Antigravity review of Claude's last response before allowing the session to end. If the review finds blocking issues, the stop is held so Claude can address them first.

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
