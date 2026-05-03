# UI Kit — App principale (dashboard + library + calendar)

The "shell" of EDN Tracker: sidebar, top bar, dashboard with revision stats, resource library, calendar, global search palette.

## What's covered
- `Sidebar.jsx` — collapsible left nav with sections (Aujourd'hui, Bibliothèque, Anki, Mindmaps, Carnet, Calendrier, Recherche)
- `TopBar.jsx` — page title + search + theme toggle + user
- `Dashboard.jsx` — stats hero, today queue, recent items, streak
- `Library.jsx` — list of PDFs/fiches/decks
- `Calendar.jsx` — week view of upcoming reviews
- `CommandPalette.jsx` — Cmd+K overlay
- `index.html` — interactive click-thru between all of the above

## Click-thru
Sidebar items switch the main view. ⌘K (or button) opens the palette. Theme toggle in the top bar flips light/dark across the app.

## Caveats
First-pass layout. Real product likely needs onboarding and account screens; not built here.
