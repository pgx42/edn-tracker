---
name: edn-tracker-design
description: Use this skill to generate well-branded interfaces and assets for EDN Tracker, a "second brain" study tool for French medical students preparing the EDN exams. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

This design system covers:
- `colors_and_type.css` — design tokens (colors, type, spacing, radii, shadows). Light + dark modes via `data-theme` attribute on `<body>`.
- `assets/` — logo (SVG), wordmark, icon.
- `preview/` — small specimen cards for type, color, spacing, components, brand.
- `ui_kits/app/` — main app shell (sidebar, top bar, dashboard, library, calendar, search, command palette).
- `ui_kits/pdf_reader/` — PDF reader with annotations, highlights, backlinks.
- `ui_kits/anki/` — Anki-style deck list + active review card.
- `ui_kits/mindmap/` — Excalidraw-style canvas with sketched nodes.
- `ui_kits/carnet_erreurs/` — mistakes journal layout.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Always import `colors_and_type.css` and use the CSS variables — don't hard-code colors.

If working on production code, the project uses **Tauri + React**. The UI kits in this folder are written as Babel-compiled JSX and lift directly into a real React app. Lucide is the icon set.

Key voice rules: "tu" in French, sentence case, never SHOUTING, almost never emoji in chrome, blunt-but-kind microcopy ("42 cartes en retard. 12 minutes pour rattraper.")

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
