# Design QA

## Evidence

- Source visual truth: `/workspace/scratch/d4b78421b38d/einfach-kochen-prototyp/qa/reference-option-1.png`
- Browser-rendered implementation: `/workspace/scratch/d4b78421b38d/einfach-kochen-prototyp/qa/implementation-menu-v2.jpg`
- Combined comparison: `/workspace/scratch/d4b78421b38d/einfach-kochen-prototyp/qa/comparison-menu-v2.jpg`
- Additional rendered states: `qa/implementation-recipe.jpg`, `qa/implementation-cook.jpg`
- Source pixels: 1487 × 1058.
- Implementation pixels: 1348 × 926 at device scale factor 1.
- CSS viewport: 1363 × 936; the screenshot content is 1348 × 926 because the browser scrollbar and capture bounds are excluded.
- Density normalization: source resized to 1348 × 926 for the side-by-side comparison; aspect-ratio drift is under one percent.
- State: weekly menu for 14.–20. September 2026 with the first “Rezept öffnen” button focused.

## Full-view comparison evidence

The final side-by-side comparison reproduces the source hierarchy and composition: serif wordmark, centered text navigation, large weekly-menu heading, explanatory sentence, symmetrical week controls, four numbered list rows with food thumbnails, dark-green actions, light row dividers, blue focus treatment, and the cream keyboard hint. All four dishes and the keyboard hint remain visible in the desktop viewport.

## Focused-region evidence

A separate crop was not needed because the normalized full-view comparison is at 1:1 implementation resolution and the typography, button focus ring, food crops, row separators, and keyboard hint are legible. The recipe-detail and cooking-mode screenshots were inspected independently for the extended flow.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: the source’s editorial serif wordmark and strong sans-serif application hierarchy are matched with Georgia and Arial/Helvetica system fallbacks. Heading size, weight, wrapping, body size, and metadata hierarchy are visually consistent with the source.
- Spacing and layout rhythm: header height, page margins, week selector, thumbnail dimensions, row rhythm, dividers, and action alignment match the selected direction. The final density keeps the keyboard hint visible without reducing control targets below 48 pixels.
- Colors and visual tokens: white base, near-black text, dark forest green actions, warm cream secondary surfaces, light gray dividers, and blue focus ring map closely to the source and retain strong contrast.
- Image quality and asset fidelity: every visible food image is a real project asset generated for its named dish, with consistent lighting, crop, and art direction. No placeholder, CSS art, inline SVG, emoji, or generic icon substitute is present.
- Copy and content: the visible menu text matches the selected design. App-specific extensions are concise and support the requested accessibility flow.
- Accessibility: semantic header, navigation, main, sections, headings, ordered list, descriptions, progress element, live status announcements, descriptive alternative text, skip link, minimum control sizes, reduced-motion handling, and visible keyboard focus are present. Initial focus remains at the document start; focus moves to the new heading only after a view transition.

## Comparison history

### Iteration 1

- Earlier finding: [P2] The first implementation used taller rows and a larger display heading than the source, pushing the keyboard hint below the initial viewport.
- Fix made: reduced desktop display-heading maximum from 68 to 60 pixels, shortened menu row height from 155 to 140 pixels, reduced thumbnail height from 130 to 116 pixels, tightened page and week spacing, and reduced action width while preserving accessible target size.
- Post-fix evidence: `qa/comparison-menu-v2.jpg` shows all four rows and the keyboard hint in the same viewport, with the first action’s focus ring matching the source state.

## Primary interactions tested

- Previous- and next-week controls update the visible date range and live announcement.
- Opening the first recipe moves focus to its level-one heading.
- Recipe details expose an additional “Kochmodus starten” action directly after the key facts and before the ingredient list; the original action remains in the preparation section. The upper action was verified to open step 1 with the complete step text focused.
- Recipe details expose quantities and concrete packaging descriptions.
- Cooking mode starts at step 1, advances through all five steps, enables the previous-step action after step 1, and exposes the completion action on step 5.
- Cooking mode programmatically focuses the complete current step as one group, including “Schritt X von Y”; one Tab then reaches the next available control. This was verified both on entry and after advancing to step 2.
- The focused paragraph now contains “Schritt X von Y” as real accessible text before the instruction, ensuring VoiceOver announces the current position instead of relying on a group label.
- The complete position and instruction are rendered as one literal DOM text node. The accessibility snapshot confirms one active paragraph—without separate nodes for “Schritt”, the numbers, or “von”—on both step 1 and step 2.
- Keyboard tab order begins with the skip link and reaches the first recipe action in a predictable order.
- Browser console checked: no application errors; observed errors originated only from the browser’s installed extension, not `terminal.local`.

## Follow-up polish

- Residual test gap: the cloud browser exposes a fixed desktop viewport, so the mobile media-query rules were reviewed in source but not captured as a separate browser screenshot.

## Implementation checklist

- [x] Selected visual direction implemented.
- [x] Core flow works from weekly menu through cooking completion.
- [x] Keyboard and focus behavior verified.
- [x] Browser-rendered design comparison completed.
- [x] Production build and Sites packaging tests pass.

final result: passed
