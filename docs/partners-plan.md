# Plan: Add Partners Section + Partner-Focused Page

> Canonical execution reference. Mirrors the approved plan. Check off items as they land.

## Context

Premier Paws Pet Care has officially partnered with three local pet-care providers and wants to present these partnerships on the marketing site. There are **two audiences and two deliverables**:

1. **Homepage Partners section** (audience = clients): a general statement on *why* Premier Paws values partnerships and how it strengthens the value clients receive, plus a clean logo wall of the current partners.
2. **Standalone `/partners` page** (audience = prospective partners): why partnerships matter, the value of partnering with Premier Paws, who the current partners are, and how to get in touch.

The current partners form a natural **"circle of care"** story — primary/wellness vet, dental specialist, and compassionate end-of-life care:

| Partner | Site |
|---|---|
| Companion Animal Veterinary Associates (full-service "Fear Free" vet, **in Middletown** — our service area) | https://cavavet.com/ |
| Delaware Pet Aquamation (eco-friendly flameless aquamation / end-of-life aftercare) | https://delawarepetaquamation.com/ |
| Delaware Veterinary Dental Practice (specialized veterinary dentistry, upfront pricing) | https://www.delvetdental.com/ |

The site is a single-page Astro static site today; `/partners` will be its **first additional route**.

## Confirmed decisions

- **Partner inquiry form** posts to the dedicated Formspree endpoint **`https://formspree.io/f/xrevljlo`** (keeps partner leads separate from client bookings).
- **Logo presentation = a Payhawk-style logo wall on BOTH pages**: logos only (no names/descriptions/category tags), **monochrome** single-color marks on a **transparent** background (no card "plate"), with hover + click affordances (each logo links to the partner's site).
- **Logo wall layout:** distributed across the **full width of the standard content container** (`max-w-6xl`) and **wrapping** as the partner list grows — *not* a fixed 3-per-row grid.
- **Logo wall background/color:** a **light band** (`bg-violet-50`) with logos in a single **dark/neutral tone**.
- **Logos are branded SVG placeholder files**; swapping in a real logo later = replacing one file at the same path (zero code change).
- **Homepage section placement:** after `ServiceArea`, before `Merch`.
- **Partner-page hero:** a clearly-labeled **photo-slot placeholder** (styled, commented box sized for a future real photo — not a stock photo, not full-bleed), with a darker / more B2B treatment so it reads distinct from the client homepage hero.

## Architecture notes

- **Cross-page anchors (critical):** `Nav` / `Footer` render on every page including `/partners`, but use bare hashes (`#services`) that won't resolve from `/partners`. Fix: change the **shared** `Nav` / `Footer` anchors to root-relative `/#services`, `/#why-us`, `/#testimonials`, `/#service-area`, `/#contact`. These still smooth-scroll on `/` (global.css `scroll-behavior: smooth`). **Component-internal** anchors (Hero/Services/WhyUs/HowItWorks/ServiceArea/Contact) render only on `/`, so they stay bare.
- **No `astro.config` changes needed.** Static output; no `base`; apex domain → root-relative links are safe. Link to `/partners` (no trailing slash).
- **`public/` images need no import** — placeholder logos referenced as `/images/partners/...` (same as the Nav logo). Swap point; avoids Astro `Image`'s static-import requirement.
- **Same-page anchor** `#partner-inquiry` on `/partners` stays bare.

## Files

Create: `src/data/partners.json`, `src/components/PartnerLogoWall.astro`, `src/components/Partners.astro`, `src/pages/partners.astro`, `public/images/partners/{cava,delaware-pet-aquamation,delaware-vet-dental}.svg`.

Edit: `src/pages/index.astro` (render `Partners` between `ServiceArea` and `Merch`), `src/components/Nav.astro` (root-relative anchors + `Partners` → `/#partners`), `src/components/Footer.astro` (root-relative anchors + `Partners` → `/partners`).

**Two-audience nav model:** nav "Partners" → `/#partners` (homepage section); footer "Partners" + homepage CTA → `/partners` (standalone page).

## partners.json schema (minimal — only logo + link are shown)

```json
[
  { "id": "cava", "name": "Companion Animal Veterinary Associates", "url": "https://cavavet.com/", "logo": "/images/partners/cava.svg" }
]
```

`name` powers `alt` / `aria-label`; `logo` is the swap point.

## PartnerLogoWall.astro

Transparent, monochrome, wrapping row that fills the container width (background-agnostic):

```html
<div class="flex flex-wrap items-center justify-center sm:justify-between gap-x-12 gap-y-10">
  <a href={partner.url} target="_blank" rel="noopener noreferrer" aria-label={partner.name}>
    <img src={partner.logo} alt={partner.name}
         class="h-9 md:h-10 w-auto opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition" />
  </a>
</div>
```

`justify-between` (sm+) spreads logos full width; `flex-wrap` grows/wraps with the list. `grayscale`+`opacity-70` → mono look; hover restores; forward-compatible with future color logos.

## Homepage Partners section (Partners.astro)

- `id="partners"`, `bg-violet-50 py-20 lg:py-28`, inner `max-w-6xl mx-auto px-6`.
- Header: eyebrow `text-violet-600` "Our Partners"; `h2` `text-black` "A trusted circle of care."
- Client statement: *"Great pet care doesn't happen in isolation. We partner with trusted local providers so your pet is surrounded by a connected circle of care — and you always know where to turn."*
- `PartnerLogoWall`.
- Centered CTA (primary button): **"Partner With Us" → `/partners`**.

## /partners page (partners.astro)

Partner-focused `title` / `description`. Sections (each `max-w-6xl mx-auto px-6`, `py-20 lg:py-28`):

1. **Nav** (shared).
2. **Hero — dark, photo-slot placeholder.** `bg-gradient-to-br from-violet-950 via-black to-black`; `grid lg:grid-cols-2`. Left: eyebrow "Partnerships", `h1` *"Better care happens when we work together."* (violet-400 accent), subhead, primary "Become a Partner" → `#partner-inquiry`, secondary white-outline "Talk to Our Team" → `tel:` from site.json. Right: photo-slot placeholder (`aspect-[4/3] rounded-2xl border border-white/10 bg-white/5`, centered icon + label, wrapped in an HTML comment showing how to swap in an Astro `Image`). Not a stock photo; not full-bleed.
3. **Why we value partnerships** (`bg-white`). Eyebrow "Our Philosophy"; `h2` *"No single provider does it all."*; 2–3 short paragraphs (vet-tech-led in-home care; confident referrals; continuity). No invented stats.
4. **The value of partnering with us** (`bg-black`, `WhyUs` pillar pattern, icons via `Fragment` + `set:html`). Eyebrow "Why Partner With Us"; `h2` "What a partnership offers."; 4 pillars: Clinically informed referrals; A trusted local name (insured, Chamber member, Bear/Middletown/Odessa); Continuity of in-home care; Genuine two-way referrals.
5. **Current partners** (`bg-white`) — logos-only wall, `PartnerLogoWall`. Eyebrow "Our Partners"; `h2` "The partners we trust." No descriptions.
6. **How to become a partner + form** — `id="partner-inquiry"`, `bg-black`, mirrors `Contact`. Steps (`HowItWorks` pattern, dark): Reach out → Let's talk → Start referring. Form: white card reusing Contact's input/label/button classes; `action="https://formspree.io/f/xrevljlo"`, hidden `_subject="New Partnership Inquiry"`; B2B fields (Name*, Business*, Email*, Phone, Type of business select, How would you like to partner?*, Anything else?); submit "Send Partnership Inquiry". No client script. Formspree default redirect.
7. **Footer** (shared).

## Conventions

- Reuse existing tokens only (container, `py-20 lg:py-28`, buttons, cards, pills). No new fonts/colors.
- Logo wall: transparent, monochrome, no labels, full-width-within-container, wrapping, hover+click.
- Outbound links `target="_blank" rel="noopener noreferrer"`; logo link `aria-label` + img `alt` = partner name; SVGs carry an internal title.
- Headings: one `h1` on `/partners`, `h2` per section, `h3`/`h4` for cards/steps.

## Verification

1. `npm run dev` — `/partners` renders; homepage Partners section between Service Area and Merch (violet-50 band, logo wall).
2. `npm run build` — `dist/partners/index.html` and `dist/images/partners/*.svg` exist; no broken imports.
3. Anchors: from `/partners`, Nav/Footer links reach homepage sections; from `/`, links still smooth-scroll; nav "Partners" → `#partners`; footer "Partners" + homepage CTA → `/partners`; hero "Become a Partner" → `#partner-inquiry`.
4. Logo wall (both pages): mono logos, correct outbound URLs in new tab, hover affordance; row distributes/wraps (not 3-col lock); swapping a `logo` path swaps the logo with no other edit.
5. Form: posts to `xrevljlo` with subject "New Partnership Inquiry"; required fields enforce; styling matches Contact; no console errors.
6. Responsive/a11y: logo wall + pillar/step grids collapse on mobile; mobile nav shows Partners link and closes on click; partner hero distinct from client hero.
