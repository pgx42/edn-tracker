# EDN Tracker — Design System

> **Status:** v0.1 — built from scratch, no codebase or Figma source. All visual decisions are first-pass and meant to be iterated on.

---

## Product context

**EDN Tracker** is a "second brain" study app for medical students preparing the **EDN** (Épreuves Dématérialisées Nationales — the French national medical board exams). The longer-term ambition is to generalize beyond medicine to any high-stakes academic context.

The product is a knowledge graph wrapped around three pillars:

1. **Resource library** — PDFs of lecture notes, course materials, fiches de révision, all annotatable.
2. **Spaced-repetition core** — deep integration with Anki Web, including an internal Anki-style review interface so the student never leaves the app.
3. **Linking & mistake tracking** — every error, annotation, mindmap node, and Anki card can be cross-linked. A *carnet d'erreurs* (mistake journal) and Excalidraw-style mindmaps make the relationships explicit.

The vibe target sits between **Notion** (calm, studious, infinite-canvas) and **Linear / Raycast** (sharp, fast, keyboard-first SaaS). Not clinical-hospital, not gamified. Quiet confidence.

### Audience

- Primary: 2nd–6th year medical students grinding through EDN prep
- Secondary: any student who wants spaced-rep + PDF + linked-notes in one place
- Power users who already use Anki natively and won't tolerate a worse review experience

### Languages

UI ships in **French and English**. Mocks in this system include both.

---

## Sources

This design system was generated **without an existing codebase, Figma, or screenshots**. Everything here — palette, type, components, screens — is a first-pass proposal grounded only in the brief: *"second brain for med students, Anki-integrated, PDFs, mindmaps, carnet d'erreurs, vibe between Notion and Linear."*

When the real product exists, replace these mocks with screen captures or component imports from the actual codebase.

### Tech stack (declared)

**Tauri + React.** Both UI kits in this system are written as Babel-compiled JSX, so components transfer directly into a React app. CSS variables are framework-agnostic. For Tauri-native concerns (window chrome, native menus, file-system bridges), the design system stays silent — those should be handled at the app shell level.

---

## Index

```
README.md                      ← you are here
SKILL.md                       ← agent skill manifest (Claude Code compatible)
colors_and_type.css            ← all CSS variables (colors, type, spacing, radii, shadows)
fonts/                         ← Inter Tight, Instrument Serif, JetBrains Mono
assets/
  logo.svg                     ← primary mark
  logo-mono.svg                ← single-color version
  wordmark.svg                 ← logo + "EDN Tracker"
  icon.svg                     ← square app icon
preview/                       ← cards rendered in the Design System tab
  type-*.html
  color-*.html
  spacing-*.html
  component-*.html
  brand-*.html
ui_kits/
  app/                         ← main dashboard, sidebar, library, calendar, search
  pdf_reader/                  ← annotated PDF view
  anki/                        ← deck list + review card
  mindmap/                     ← Excalidraw-style canvas
  carnet_erreurs/              ← mistake journal
```

Each `ui_kits/<product>/` folder contains:

- `index.html` — interactive click-thru of the product
- `README.md` — what's covered and what isn't
- `*.jsx` — small, well-factored React components

---

## Content fundamentals

EDN Tracker speaks like a **quietly confident study buddy** — never the textbook, never the cheerleader.

| Axis | Direction |
|---|---|
| Person | "Tu" in French (peer, not professor). "You" in English. Never "vous". |
| Casing | Sentence case everywhere. Never Title Case for buttons. Never SHOUTING. |
| Verbs | Active, short. *"Reprendre la révision"* not *"Cliquez ici pour reprendre votre session"*. |
| Length | Buttons: 1–3 words. Empty states: one sentence + one action. Tooltips: ≤ 6 words. |
| Numbers | Always render — *"23 cartes en retard"* not *"plusieurs cartes en retard"*. |
| Emoji | **Almost never.** Reserved for user content (notes, tags). UI itself uses Lucide icons. |
| Honesty | If the student is behind, say so plainly: *"42 cartes en retard"* — not *"Encore un petit effort !"*. |

### Voice examples

- ✅ *"Reprends là où tu t'es arrêté."*
- ❌ *"Bienvenue ! Êtes-vous prêt à reprendre votre fantastique session de révision ? 💪"*
- ✅ *"Aucune erreur cette semaine. Continue."*
- ❌ *"Bravo champion ! Tu es au top de ta forme cette semaine !!! 🎉"*
- ✅ *"PDF introuvable."*
- ❌ *"Oups ! Quelque chose s'est mal passé… 😕"*

### Microcopy patterns

- **Empty states** open with the situation, not the encouragement: *"Pas encore de carnet d'erreurs. Marque une réponse comme fausse pour commencer."*
- **Confirmation dialogs** name the consequence, not the action: not *"Êtes-vous sûr ?"* but *"Supprimer 12 annotations. Irréversible."*
- **Save indicators** are silent — a small dot, no toast.

---

## Visual foundations

### Color

Two neutrals, one accent, three semantic colors. No gradients in chrome — only inside graphs and mindmap edges.

- **Backgrounds**: `--bg-canvas` (the page), `--bg-surface` (cards, panels), `--bg-sunken` (input wells, code blocks). Light mode is **off-white** (`#fafaf9`, a hint of warmth, paper-adjacent), not pure white.
- **Foreground**: 4-stop gray scale — `fg-1` for primary text, `fg-2` for secondary, `fg-3` for tertiary/placeholder, `fg-muted` for icons.
- **Accent**: a single **blue** (`#2563eb` light / `#60a5fa` dark) used sparingly. Never on more than one element per screen at full saturation.
- **Semantic**: `success` (green), `warning` (amber), `danger` (rose), each in `-fg`, `-bg`, `-border` triplets.
- **Highlight tokens** for PDF annotation: yellow, green, rose, blue, lavender. Used at low opacity (~25%) on text spans.

Dark mode is a near-black slate (`#0a0a0b`), not navy. Surfaces step up by ~4% lightness, never with borders alone.

### Type

- **Display** — *Instrument Serif*, used for hero moments and the carnet d'erreurs cover (it gives a "notebook" feel without leaning Catholic-academic). Italic by default.
- **UI** — *Inter Tight*, all weights 400–700. Tabular numbers on for stats, decks, calendars.
- **Mono** — *JetBrains Mono* for code blocks, card IDs, keyboard hints.

Scale is **modular at 1.125** from a 14px base. UI text never falls below 13px. Body reading text in PDFs / notes is 16px minimum.

### Spacing

8pt base, 4pt half-step. Tokens: `space-0` (0), `space-1` (4), `space-2` (8), `space-3` (12), `space-4` (16), `space-5` (24), `space-6` (32), `space-7` (48), `space-8` (64), `space-9` (96).

Dense work surfaces (Anki review, PDF reader) use 4–8 spacing. Navigation (sidebar, settings) uses 12–24.

### Radii

- `radius-xs` 4px — chips, tags
- `radius-sm` 6px — inputs, buttons
- `radius-md` 8px — cards, popovers
- `radius-lg` 12px — modals, large surfaces
- `radius-pill` 999px — counts, status pills
- `radius-none` for tables, code blocks, full-bleed regions

No `border-radius: 16px+` rounded-blob look. Corners are crisp.

### Shadows & elevation

Three tiers, all cool-toned (no warm shadows):

- `shadow-sm` — `0 1px 2px rgba(15, 23, 42, .06)` — resting cards
- `shadow-md` — `0 4px 12px rgba(15, 23, 42, .08)` — popovers, dropdowns
- `shadow-lg` — `0 12px 32px rgba(15, 23, 42, .12)` — modals, command palette

Dark mode: shadows fade out, replaced with **1px borders** at `border-subtle` (an 8% white). Elevation reads through tone, not blur.

### Borders

- `border-subtle` — default — `slate-200` light / `slate-800` dark
- `border-default` — input borders — one tick darker
- `border-strong` — focus, selected — `accent` at full

Hairlines are 1px. No 2px+ borders except for focus rings.

### States

| State | Treatment |
|---|---|
| Hover (button) | Background steps one tone darker (light) / lighter (dark). No shadow change. |
| Hover (link) | Underline. Color unchanged. |
| Hover (row) | `bg-hover` token (~3% accent tint). |
| Press | Subtle shrink: `scale(.98)` + 60ms ease-out. No color change. |
| Focus | 2px `accent` ring with 2px offset. Always visible on keyboard. |
| Disabled | 40% opacity. Cursor `not-allowed`. |
| Selected (row, card) | 2px left-inset accent bar + `bg-selected` (~6% accent tint). |

### Animation

Sparse and short. Default easing is `cubic-bezier(.2, .8, .2, 1)` ("Linear-style ease-out"). Durations:

- 80ms — micro (hover, focus)
- 160ms — small (popovers, dropdowns)
- 240ms — medium (modals, route transitions)
- 480ms — only for the celebration after a clean Anki session

No bounces. No big spring physics. **One** hero moment: when the student finishes a session with 0 wrong, the streak counter does a single tasteful scale-up.

### Backgrounds & imagery

- **Default**: solid `bg-canvas`. No textures.
- **Reading mode** (PDF, long-form notes): warmer paper tone, `#faf7f2`, with subtle 1px `border-subtle` ruling on long content.
- **Mindmap canvas**: dot grid at `border-subtle`, 24px spacing.
- **Hero / marketing**: a single soft radial wash from the accent, ≤8% opacity. No mesh gradients.

No stock photos. No 3D illustrations. The product looks like a tool, not a brochure.

### Layout rules

- Top bar: 48px, sticky, `bg-canvas` with 1px bottom border on scroll
- Sidebar: 240px expanded / 56px collapsed
- Right panels (links, backlinks, AI): 320px
- Content max-width for reading: 720px
- Modals: 480px (small), 640px (medium), 880px (large)

### Transparency & blur

Used sparingly. Only the command palette and the global search overlay use `backdrop-filter: blur(12px)` with `bg-canvas / 80%`. Everything else is opaque.

### Cards

The default card: 1px `border-subtle`, `radius-md`, `bg-surface`, no shadow at rest. On hover, `border-default` and the `shadow-sm` token. Internal padding 16–24.

---

## Iconography

**Lucide** as the primary icon library — neutral stroke icons, 1.5px stroke at 16/20/24 sizes. Loaded from CDN (`lucide@latest`) for prototypes; bundled via `lucide-react` for production.

- **No emoji in product chrome.** Emoji are user content only (note bodies, tags the user types).
- **Unicode glyphs** are allowed for keyboard hints (`⌘`, `⇧`, `↵`, `↑↓`) and only there.
- **Custom marks**: the EDN Tracker logo and the carnet d'erreurs cover badge are the only bespoke glyphs in the system.

When a domain-specific icon is missing in Lucide (e.g. anatomy, syringe), use the closest neutral equivalent and log it in `assets/icon-substitutions.md` rather than drawing one.

### Logo & marks

- `logo.svg` — primary (mono blue on transparent)
- `logo-mono.svg` — single-color version for dark backgrounds
- `wordmark.svg` — logo + "EDN Tracker" lockup
- `icon.svg` — 1024×1024 app icon

The mark is a stacked-square + check motif: a tracker checking off a knowledge node. It works at 16px (favicon) up to print.

---

## Caveats & open questions for iteration

This is v0.1, built without source material. Likely points of disagreement:

1. **Name & logo** — *EDN Tracker* is a working title. The mark is a placeholder. Replace both when confirmed.
2. **Accent blue** — the chosen `#2563eb` is medical-confident but generic. A more distinctive option (teal, indigo, deep green) might be worth exploring.
3. **Anki interface fidelity** — the kit recreates Anki's layout faithfully but is not pixel-perfect against AnkiWeb. If exact parity matters, screenshot the real thing and replace.
4. **PDF reader chrome** — modeled on a hybrid of Highlights and PDF.js. Real Excalidraw / pdf-lib integration would shift details.
5. **Mistakes journal layout** — first guess. Flow probably needs user research.
6. **No real product copy yet** — strings are first-draft. Run them by a med student.
