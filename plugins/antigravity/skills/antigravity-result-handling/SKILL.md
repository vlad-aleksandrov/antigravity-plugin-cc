# Antigravity Result Handling

This skill governs how to present Antigravity helper output to the user.

## Preservation requirements

- Keep the helper's verdict, summary, findings, and next steps structure intact.
- Present review findings ordered by severity with exact file paths and line numbers.
- Maintain distinctions between facts, inferences, and uncertainties that Antigravity marked.

## Critical restrictions

After presenting review findings, STOP. Do not make any code changes. Users must explicitly approve which issues to fix before any modifications occur.

## Error handling

- Report failed or incomplete Antigravity runs without attempting Claude-side fixes.
- Include actionable stderr output when setup or authentication issues arise.
- Direct users to `/antigravity:setup` for authentication needs rather than improvising alternatives.

## Output integrity

- Explicitly state when Antigravity made edits and list affected files.
- Report when no findings exist with a brief risk note.
- Never substitute Claude implementations for failed Antigravity invocations.
