# Fonts

EDN Tracker uses three open-source families loaded from Google Fonts:

| Role | Family | Why |
|---|---|---|
| UI (default) | **Inter Tight** | A tighter cousin of Inter; better optical density for SaaS UI without changing the family completely. |
| Display | **Instrument Serif** | Italic-leaning serif used for hero moments and the carnet d'erreurs cover. Gives a notebook/journal accent without being twee. |
| Mono | **JetBrains Mono** | Excellent code legibility, includes ligatures (off by default in our system), tabular by design. |

## Loading

For prototypes and slides we load these via the Google Fonts CDN (see `colors_and_type.css`). For production, bundle the woff2 files locally — Google Fonts ships a "download family" button on each family page.

## ⚠ Substitution flag

The original brief did not provide brand fonts. These three are **proposals**, not approved choices. If the EDN Tracker brand later gets dedicated typefaces (e.g. a paid display face), update `colors_and_type.css` to swap them and replace the Google Fonts links.

## License

All three are licensed under the SIL Open Font License — free for commercial use.
