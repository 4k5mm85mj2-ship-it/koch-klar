# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable prototype decisions

- Selected visual direction: Option 1, the calm linear reading list.
- Accessibility is the primary product requirement: keyboard operation, semantic landmarks and headings, visible focus, live announcements, responsive zoom behavior, and compatibility with VoiceOver, NVDA, and JAWS.
- Core flow: German weekly menu → recipe details → ingredient quantities with concrete packaging descriptions → one-step-at-a-time cooking mode.
- Out of scope: login, ordering, box management, and a “found” state for ingredients.
- In cooking mode, focus the complete current step as one programmatic focus target; the next Tab moves directly to the step controls.
- Put “Schritt X von Y” inside the focused step text itself so VoiceOver announces the position before the instruction; do not rely only on a container label.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
