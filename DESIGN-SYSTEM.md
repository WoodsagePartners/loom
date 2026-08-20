# HMW Collective — Type & Color System

Reference for the type and color decisions made during the August 2026 design pass. Use this to keep new pages, emails, and one-off documents consistent with the brand.

## Typography

**Headings (h1–h4): Bricolage Grotesque**
A characterful grotesque used with restraint — headlines and section titles only, never body copy.
- Weights used: 400, 500, 600, 700, 800
- Google Fonts: `Bricolage Grotesque`
- Portal: loaded via `next/font/google` in `app/layout.tsx` as `--font-bricolage`, applied globally to `h1, h2, h3, h4` in `app/globals.css`
- Marketing site (`public/index.html`): loaded via a Google Fonts `<link>` tag, applied the same way

**Body text: Manrope**
Quiet, highly legible workhorse for everything that isn't a heading — paragraphs, labels, buttons, form fields, badges, dense UI text.
- Portal: loaded via `next/font/google` as `--font-manrope`, set as the default Tailwind `font-sans`
- Marketing site currently still uses **Inter** for body text, not Manrope — a known variance between the two surfaces. Worth aligning if the marketing site gets revisited.

**Sentence case throughout** — headings, buttons, labels, nav items. Never Title Case or ALL CAPS outside of small uppercase eyebrow labels (11–12px, letter-spaced).

## Color palette

CPS quadrant palette — the four accent colors map to the Basadur quadrants (Generating / Conceptualizing / Optimizing / Implementing), shared by the marketing site and portal.

| Token | Hex | Quadrant / use |
|---|---|---|
| `orange` (amber) | `#E8872A` | Implementing · primary brand accent, CTAs |
| `red` | `#D94B2B` | Hover state for orange, urgency |
| `blue` | `#4A7FD8` | Generating |
| `purple` (violet) | `#9B7CE8` | Conceptualizing |
| `teal` | `#38B2AC` | Optimizing |
| `dark` | `#1A1510` | Primary text |
| `cream` | `#F9F6F2` | Page background |
| `border` | `#E2D9CE` | Hairlines, card borders |
| `muted` | `#6B5E50` | Secondary text |

Defined as CSS custom properties in `app/globals.css` (`:root`) and mirrored as Tailwind color tokens in `tailwind.config.ts`, so both `var(--blue)` and `text-blue` / `bg-blue` / `border-blue` resolve to the same value.

Note: `blue` and `purple` are lighter than typical body-text colors — good for badges, borders, icons, and decorative accents, but don't use them as small text on a light background without checking contrast first.

## Focus states

Every interactive element (links, buttons, inputs) gets a visible keyboard-focus ring — orange, 2px, offset 2px, only on `:focus-visible` (not on mouse click). Defined once in `app/globals.css`, applies portal-wide.

## Where it's implemented

- `app/layout.tsx` — font loading (Bricolage Grotesque, Manrope)
- `app/globals.css` — CSS variables, heading font rule, focus-visible rule
- `tailwind.config.ts` — color tokens, `fontFamily.sans`
- `public/index.html` — marketing site's own copy of the fonts/colors (static file, not wired to the app's CSS)
