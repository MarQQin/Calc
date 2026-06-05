# Copilot coding instructions

## Before coding

- Do not assume requirements.
- State assumptions explicitly before implementing.
- If multiple interpretations exist, present them instead of silently choosing.
- If a simpler approach exists, say so.
- Push back when the requested approach is likely overcomplicated.
- If something is unclear, stop, name the ambiguity, and ask.

## Simplicity

- Write the minimum code that solves the requested problem.
- Do not add features beyond what was asked.
- Do not introduce abstractions for single-use code.
- Do not add configurability unless requested.
- Do not add error handling for impossible scenarios.
- Prefer 50 clear lines over 200 generic lines.

## Surgical changes

- Touch only the files and lines required for the task.
- Do not refactor unrelated code.
- Do not reformat adjacent code.
- Match the existing project style.
- Remove only imports, variables, or functions made unused by your own change.
- Mention unrelated dead code, but do not delete it unless asked.

## Patch discipline

Every changed line must directly trace to the user request.
