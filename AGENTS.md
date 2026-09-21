# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable prototype decisions

- Public project name: “KochKlar”. Describe it as an independent, non-commercial prototype for accessible use of recipes from HelloFresh; never present it as an official or HelloFresh-authorized product. Keep the compact independence and trademark notice as one non-interactive footer paragraph without adding focus stops.
- Selected visual direction: Option 1, the calm linear reading list.
- Accessibility is the primary product requirement: keyboard operation, semantic landmarks and headings, visible focus, live announcements, responsive zoom behavior, and compatibility with VoiceOver, NVDA, and JAWS.
- Core flow: German weekly menu → recipe details → ingredient quantities with concrete packaging descriptions → one-step-at-a-time cooking mode.
- Out of scope: login, ordering, box management, and a “found” state for ingredients.
- In cooking mode, keep steps up to 250 characters as one paragraph. Split longer steps only at verified sentence or source-paragraph boundaries, preserving the original text exactly; each resulting paragraph is a separate screen-reader reading unit.
- Render “Schritt X von Y” and the first instruction segment visibly and semantically as one literal text node in one ordinary paragraph without heading role or aria-level; do not duplicate either part in hidden or presentational DOM. Later segments remain separate reading units. After the instruction paragraphs, place “Nächster Schritt” before “Vorheriger Schritt” in DOM and focus order.
- On the final cooking step, replace “Nächster Schritt” with “Zurück zu den Rezeptdetails”, followed by “Vorheriger Schritt” and “Zurück zum Wochenmenü” in DOM and focus order.
- Restore focus on the exact changed week or filter control only after the updated recipe list has committed; force a fresh focus event for VoiceOver when necessary. A week change waits for its menu data to finish loading. Resetting all filters keeps focus on the reset button.
- Treat Escape, including VoiceOver's two-finger Z gesture, as one contextual back level: cooking mode to recipe details and recipe details to the weekly menu. Do nothing in the weekly menu. Do not override any other standard screen-reader gesture or keyboard interaction.
- Offer one native portion select in recipe details with the HelloFresh-supported values 2, 3, and 4. Keep the selection when moving between recipe details and cooking mode. Prefer explicit per-portion ingredient data when present; otherwise scale only numeric amounts and leave ambiguous or non-numeric amounts unchanged. Resolve HelloFresh step alternatives in the form “base [three portions | four portions]” to one selected value before segmenting and presenting the cooking instruction.
- Recipe details offer “Kochmodus starten” both near the top before the ingredient list and again in the preparation section, so returning users can start cooking quickly.
- In the weekly menu, keep the visible recipe number hidden from assistive technology and include “Gericht X von Y” in the image alternative text, so VoiceOver reads the position and image as one element.
- Render weekly-menu time and difficulty as separate complete text nodes, and recipe-detail portion, time, and difficulty as one complete text node each, so every label-value pair is a single VoiceOver stop.
- On wide screens, lay out recipe-detail metadata as two equal columns: portions on the left and total time above difficulty on the right. Collapse to the same linear DOM order on small screens without adding semantic groups.
- Keep a “Zurück zum Wochenmenü” link after the lower “Kochmodus starten” action in recipe details.
- Render each ingredient as exactly two literal text nodes: one combines ingredient name and quantity, and the second combines “Verpackung erkennen” with the complete packaging description. This keeps each pair together as one VoiceOver stop.
- Load the menu through the Site's internal read-only `/api/menu` endpoint, backed by a versioned snapshot of public HelloFresh recipe data. Keep the same snapshot compiled into the client as an offline fallback.
- Clearly distinguish imported HelloFresh recipe data from the prototype's own example packaging descriptions, and link every recipe to its public original source.
- Use native select controls for both week selection and the dietary recipe filter so VoiceOver users can change either value efficiently on iPhone.
- Use native select controls for the difficulty and total-time filters. Combine all active filters as an intersection and restore the complete week when filters are reset.
- Base the total-time filter on HelloFresh's recipe `totalTime`; use preparation time only when no total time exists.
- Bundle every currently available public week as a complete snapshot. Never present the four-recipe emergency fallback as if it were the full weekly menu.
- Do not show the redundant top navigation for Wochenmenü, Rezept, and Kochmodus. Use only contextual back links and actions.
- Do not show the selected week as a separate heading before the week selector, and do not expose technical import or cache-status messages in the interface.
- Serve recipe details for every displayed menu card from bundled public HelloFresh detail snapshots so opening recipes does not depend on a live third-party request.
- Use HelloFresh's working media endpoint for dish images. Keep weekly-list image position and description as one screen-reader element; treat the repeated hero image in recipe details as decorative.
- Only show a packaging description when a concrete curated description exists; do not synthesize a package type from the ingredient name.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
