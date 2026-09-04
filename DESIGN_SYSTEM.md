# My Longevity Hub — Design System

**The Nutty Professor wears one light.** A single periwinkle-to-indigo *iris*
gradient lives in exactly three places — the orb, the one highlighted word in
the greeting, and the send key — floating over a near-white cool-grey canvas of
soft-cornered white surfaces and indigo-tinted diffuse shadows. Everything else
is calm neutral. The mechanism is restraint: a health agent that could easily
read as clinical (charts, warnings, a hospital blue) instead reads as a warm,
intelligent companion you would actually talk to at 1am, because the *only*
saturated, glowing thing on screen is the intelligence itself.

This system is **mobile-first**. The product *is* the 380px single-thread chat;
the desktop rail is an enhancement layered on top, never the design origin. The
reference is BeeBot — light, airy, periwinkle-indigo, a friendly AI companion —
adapted to a persona (a plain-speaking longevity professor), a voice mode (an
animated orb you hold-to-talk to), and a regulated domain (UK ASA/MHRA claims
discipline is a *design* constraint, not a footnote).

---

## Design Principles

1. **Calm over clinical.** The canvas recedes to near-white; the iris is the
   only saturated hue in the room. We win trust by looking like a good night's
   sleep, not an A&E waiting room. This is why the old clinical blue (`#1789DA`
   on a near-black hero) is *replaced*, not re-skinned — that palette shouted
   "medical device," and the professor is a friend, not a diagnosis.

2. **The iris is a signal, not a decoration.** The accent gradient means
   *"this is the intelligence / this is the action."* It is reserved for the
   orb, the greeting keyword, the send key, and active/focus states. It is
   **never** a bubble fill, never a section background, never a border on a
   resting card. Let it fill surfaces and it stops meaning anything — and a
   room full of indigo is exactly the clinical loudness we're avoiding.

3. **Depth comes from soft shadow and tint, not lines.** Surfaces separate by
   floating on an indigo-tinted diffuse shadow over the cool-grey canvas, not by
   drawing a border around everything. Hairlines are a last resort (dividers,
   dense lists), never the primary way a card is defined. Borders everywhere is
   how a soft system turns brittle.

4. **Rounded is non-negotiable.** Corner radius is the signature geometry: pills
   for small controls, 20px for bubbles and cards, 28px for the composer. A
   single stray square corner reads as a rendering bug, not a variant. The lone
   sanctioned near-corner is the **bubble tail** (one corner tucked to 6px
   toward its sender) — and that is a deliberate exception, marked as such.

5. **Mobile is the product; desktop is the enhancement.** Every component is
   designed at 380px first and *allowed* to get better with width. The
   thumb-reachable composer, the one-column thread, and the full-screen voice
   orb are the real design. The desktop sidebar rail is progressive
   enhancement — if it vanished, the product would still be whole.

6. **The professor is honest before he is helpful.** Evidence is tiered
   (Strong → Animal-only), caveats are said once and plainly, and nothing in the
   layout implies a medical claim the copy can't back. In a regulated domain,
   *visual* emphasis is a claim: a giant green "PROVEN" badge would be a
   compliance breach dressed as a design token. Confidence is encoded by
   **saturation, not by traffic-light hue** (see Evidence Tier).

7. **Motion breathes; it never jitters.** The orb has a slow biological breath
   (3.8s) — that is the product's heartbeat. Everything else is a quick,
   interruptible transition (120–320ms). Nothing bounces for attention. And
   `prefers-reduced-motion` stops the breathing, the typing bob, and the record
   pulse — the orb becomes a calm static gradient, still beautiful.

8. **One motif, one token set.** The gradient orb on the empty state and the
   voice-call orb are the *same object* built from the *same tokens*, at
   different sizes and states. Two orbs that drift apart is the failure this
   principle exists to prevent.

**Signature moves**
- **The Iris** — one periwinkle→indigo→violet gradient, three sanctioned homes
  (orb · greeting keyword · send key), forbidden everywhere else.
- **Airy light canvas + indigo-tinted soft shadows** — depth without borders.
- **Round everything, tuck one corner** — the pill/2xl geometry, with the
  single bubble-tail corner as the only exception.

**It is not** — a clinical pharma UI (no hospital blue, no hard white cards with
grey borders, no data-table density); a hype supplement store (no neon, no
"MIRACLE," no urgency banners, no countdown timers); a generic SaaS chat clone
(no stock-blue send button, no default Inter-at-one-weight, no drop-shadow on
literally everything). It is not dark-first: dark mode is a faithful companion
theme, but light is the identity.

---

## Colour

Colour comes from **the iris and nothing else**. The interface is a cool-grey
near-white field; the iris is the single warm-cool signal of intelligence and
action. Neutrals carry a faint indigo cast (hue ~270) so the whole system reads
as one family rather than "grey UI with a blue accent bolted on."

Values are given as **hex (authoritative today) with OKLCH alongside**, because
the target stack is Tailwind v4 whose `@theme` accepts either and because OKLCH
is how the ramp was reasoned (even lightness steps, one hue). Defer ramp/gamut
depth to the **better-colors** skill; the decisions are frozen here.

### The Iris ramp (the one accent)

A perceptually even indigo ramp, hue ~272, that *bends toward violet* at the
light end (periwinkle) and toward deep indigo at the dark end. This bend is what
makes the orb gradient feel alive.

| Token | Hex | OKLCH | Job |
|-------|-----|-------|-----|
| `--iris-50`  | `#F1F0FE` | `oklch(.965 .018 285)` | Tint wash — soft badges, code chips, active-chip fill, hover wells |
| `--iris-100` | `#E5E2FC` | `oklch(.925 .035 283)` | Raised iris surface — selected states, link-card icon well |
| `--iris-200` | `#D0CAF8` | `oklch(.855 .066 282)` | Borders on iris surfaces, disabled-on-iris |
| `--iris-300` | `#B3A9F5` | `oklch(.760 .105 280)` | **Periwinkle** — orb gradient light stop; links/accent text on *dark* |
| `--iris-400` | `#8A5CF0` | `oklch(.640 .190 292)` | **Violet** — orb gradient violet stop; greeting-keyword light stop |
| `--iris-500` | `#6D5DE8` | `oklch(.600 .185 279)` | **Core iris** — focus ring, active nav, dark-theme send fill, greeting-keyword dark stop |
| `--iris-600` | `#5B4BD6` | `oklch(.540 .190 279)` | **Send key fill** (white text, 6.14:1) · primary button · orb core mid |
| `--iris-700` | `#4B3AC9` | `oklch(.480 .190 279)` | **Link text on light** (7.64:1) · pressed primary · orb core deep |
| `--iris-800` | `#38299B` | `oklch(.390 .160 279)` | Deepest orb-core stop; text on iris-100 |

**Accent strategy — where the iris is allowed, and where it is banned.**

- **Allowed:** the orb (all layers); the send key fill (`--iris-600` solid); the
  one highlighted greeting word (gradient text); links (`--iris-700` light /
  `--iris-300` dark); focus rings; active nav item; selected chip; the tier
  badge and link-card icon well (`--iris-50`); list markers (`::marker`).
- **Banned:** as a **bubble fill** (bot bubbles are white/`--surface`; user
  bubbles are `--iris-50`, a *tint*, not the accent); as a full-bleed section
  background; as a resting-card border; as body text; as the read-aloud/talk
  toggle *resting* state (those are neutral until on).

**The gradient is the orb's alone.** The full periwinkle→violet sweep
(`--iris-300 → --iris-400`) appears only on the orb and, as bg-clipped text, on
the single greeting keyword. The send key is a **solid** `--iris-600`, not the
gradient — because white text needs a guaranteed 6.14:1 and the gradient's light
stop would drop below 4.5:1. (Tried the full gradient on the send key; the icon
disappeared over the periwinkle end. Solid iris-600 with a 1px inner top-sheen
won.)

### Canvas & surface

| Token | Light | Dark | Job |
|-------|-------|------|-----|
| `--bg`         | `#F6F7FB` | `#121320` | App canvas — the cool near-white field / deep indigo-charcoal |
| `--surface`    | `#FFFFFF` | `#1B1D2B` | Raised surfaces — bot bubble, cards, composer, sheets |
| `--surface-2`  | `#EEEFF4` | `#23263A` | Sunken/secondary — code block, neutral chip, meter track |
| `--user`       | `#F1F0FE` | `#262552` | **User bubble** — iris-50 tint (light) / deep iris (dark) |

Dark bg is `#121320`, a deep indigo-charcoal, **not** black — pure black under a
cool palette reads as a void and makes the iris look radioactive. The faint
indigo keeps the family.

### Neutral ink ramp (cool, hue ~270)

| Token | Light | Dark | Job & contrast |
|-------|-------|------|----------------|
| `--ink`    | `#1E2233` | `#E9E9F2` | Primary text. 14.7:1 on bg / 15.3:1 dark |
| `--ink-2`  | `#454A63` | `#ADB0C6` | Secondary text, sublines. 8.7:1 / 7.8:1 |
| `--ink-3`  | `#616679` | `#838799` | Muted — captions, timestamps, `.lc-sub`. 5.7:1 / 4.7:1 (AA at ≥14px) |
| `--ink-4`  | `#8A8FA3` | `#5A5E74` | Decorative only — placeholders, disabled glyphs (3.2:1, never load-bearing) |
| `--line`   | `#E7E8F0` | `#2C2F45` | Hairline — dividers, dense-list rules, input border-at-rest |

### Semantic & domain colours

Restraint is the voice: **only genuinely actionable states get hue.** The
professor does not paint the screen red to scold.

| Token | Light | Dark | Job |
|-------|-------|------|-----|
| `--danger`      | `#E5484D` | `#F26A6E` | **Record-active** mic + hard errors (fill/icon; 3.9:1 as graphic ok) |
| `--danger-ink`  | `#BC3B36` | `#F49B9E` | Error *text* on light/dark (5.5:1) |
| `--success-ink` | `#17795E` | `#57C89F` | Rare positive confirmations only (5.3:1) — used sparingly |

There is **no green "all good" chip and no amber warning banner**. Health copy
that needs a caveat says it in words, in an `--iris-50` callout, not a hazard
colour. (See Evidence Tier for why medical confidence is encoded in saturation,
not a red/amber/green ladder.)

### Gradients & effects policy

Exactly **two** gradients exist, both recipes frozen:

```
--grad-orb-ring:  conic-gradient(from 210deg, #B3A9F5, #8A5CF0, #6D5DE8, #B3A9F5, #8A5CF0);
--grad-orb-core:  radial-gradient(circle at 34% 30%, #FBFAFF 0%, #C9BFFF 24%, #8A5CF0 56%, #5B4BD6 82%, #38299B 100%);
--grad-greeting:  linear-gradient(96deg, #6D5DE8, #8A5CF0 55%, #6D5DE8);
```

No glassmorphism, no noise overlays, no gradient on any button but the (solid)
send key, no gradient text anywhere but the one greeting keyword. Glows are
`box-shadow`/`filter:blur`, never a stacked gradient div soup.

### Contrast & theming

- **Target: WCAG 2.2 AA** (4.5:1 text, 3:1 large text & UI). Load-bearing pairs
  are cited in the ink ramp and iris ramp tables above; all pass. AAA where it
  came free (ink, links).
- **Mechanism:** light is the default (`:root`). Dark applies via
  `@media (prefers-color-scheme: dark)` **and** a `:root[data-theme="dark"]`
  override so a manual toggle wins both ways; a `[data-theme="light"]` guard
  keeps the media block from overriding an explicit light choice. This mirrors
  what `index.html` already does — keep it.
- Dark is a **true companion theme**, not a dual-canvas rhythm. Same components,
  re-tokened. The iris shifts *up* the ramp on dark (links → `--iris-300`, send
  → `--iris-500`) because a mid-indigo that reads on white disappears on
  `#121320`.

---

## Typography

### Typeface

**Inter**, with a system fallback that degrades gracefully:

```
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

Inter is chosen because it is the reference's face, it is neutral-but-warm at
text sizes, and its tall x-height keeps 16px body comfortable on a phone. It
carries *competence without stiffness* — the professor sounds smart, not
starchy. On the target stack, load it via `next/font/google` (`Inter`, subset
`latin`, `display: "swap"`, variable) so there is no external stylesheet and no
layout shift; the current `index.html` loads it from Google Fonts, which is
acceptable for the static prototype but should become self-hosted at build.

The **wordmark** ("My Longevity Hub") is set in Inter 800, uppercase, `0.14em`
tracking — a fixed lockup, never re-typeset ad hoc. The **3-slash mark** (the
motion glyph, three ascending parallelograms) is an SVG asset in `currentColor`,
never recreated inline per call-site.

### Weights & emphasis

Load **400 / 500 / 600 / 700 / 800**. Default body is **400**. Emphasis comes
first from **weight step (600/700) and colour**, not from size inflation.
Reserve 800 for the wordmark and the empty-state greeting. `strong` in prose is
**650** (via `font-variation-settings` or 600→700), coloured `--ink` — bold text
should feel *set*, not shouty.

### Type scale

Mobile-first sizes; the display step grows one notch at `md`. `rem`-based so user
zoom works.

| Role | Size / line-height / tracking | Weight | Tailwind |
|------|-------------------------------|--------|----------|
| Greeting (empty state) | 28px→32px `md` / 1.14 / -0.02em | 800 | `text-[1.75rem] md:text-[2rem]` |
| Guide H1 | 30px→36px / 1.14 / -0.02em | 800 | `text-[1.875rem] md:text-[2.25rem]` |
| Guide lede | 18px / 1.5 / -0.01em | 400, `--ink-2` | `text-lg` |
| H2 (guide) | 22px / 1.25 / -0.015em | 700 | `text-[1.375rem]` |
| H3 (in-bubble / guide) | 17px / 1.35 / -0.01em | 700 | `text-[1.0625rem]` |
| **Body** | **16px / 1.6 / 0** | 400 | `text-base` |
| Body-sm (chips, cards, lede-in-bubble) | 14px / 1.5 | 400–500 | `text-sm` |
| Label / eyebrow / kicker | 12px / 1.3 / 0.08em, UPPERCASE | 700, `--ink-3` or `--iris-700` | `text-xs tracking-[0.08em] uppercase` |
| Caption / foot / disclaimer | 12px / 1.5 | 400, `--ink-3` | `text-xs` |
| Tier badge | 11px / 1 / 0.05em, UPPERCASE | 700 | `text-[0.6875rem]` |

**Body is 16px, up from the prototype's 15.5px** — a deliberate a11y decision:
16px is the iOS input-zoom floor (the composer textarea *must* be ≥16px or the
page zooms on focus) and the readability floor for long health prose. Never ship
a text input below 16px.

### Detail rules

- **Measure:** reading columns (guide prose, bubble text) cap at ~68ch
  (`max-width: 34rem` for the welcome block; guides at `--maxw: 45rem`). Bot
  bubbles cap at `92%` of the thread, user bubbles at `80%`, so the eye never
  tracks the full width.
- **Wrapping:** headings and the greeting use `text-wrap: balance`; all prose
  paragraphs use `text-wrap: pretty` (kills orphans/rivers). Link-card titles
  are single-line `text-overflow: ellipsis`.
- **Numerics:** `font-variant-numeric: tabular-nums` on any figure that stacks or
  updates in place — the mic-level readout, call timer, and any dosage-*range* in
  guide tables — so digits don't jitter. Prose keeps proportional figures.
- **Tracking:** negative tracking (−0.01 to −0.02em) on large/bold headings only
  (Inter tightens well large); positive (+0.05–0.14em) on uppercase labels and
  the wordmark; body stays at 0.
- **Smart punctuation:** curly quotes and real ellipses in copy (the prototype
  already uses `…`, `’`). UK English throughout (see Voice).

---

## Spacing, Grid & Layout

### Base unit & scale

**4px base.** Steps: `0,1,2,3,4,5,6,8,10,12,16` × 4px = `0,4,8,12,16,20,24,32,
40,48,64`. Spacing is chosen from the scale, never typed ad hoc. Tailwind's
`--spacing: 0.25rem` gives this for free.

### Vertical rhythm (mobile-first)

Governing rule: **on a phone, the thread should feel like breathing room around
speech, not a form.** No dead band larger than ~24px inside the conversation.

| Gap | Value | Where |
|-----|-------|-------|
| Between messages | 16px | `.thread { gap }` |
| Between same-sender stacked bubbles | 6px | consecutive bot/bot |
| Bubble padding | 12px 16px | `.b` |
| Greeting → subline | 8px | welcome block |
| Greeting block → chips | 20px | |
| Chip → chip | 8px | `.chips { gap }` |
| Composer inner padding | 8px (10px around the field) | `.box` |
| Composer outer padding | 12px 16px (+ safe-area) | `.composer` |
| Orb → status word | 16px | voice stage |
| Guide section (h2) top | 40px | `--space-10` |
| Guide paragraph | 12px | |

### Grid & content width

There is **no multi-column grid in chat** — it is a single centred column.

- **Chat column:** `max-width: 48rem` (768px), centred, with 16px page gutters on
  mobile, 24px from `sm`.
- **Guide column:** `max-width: 45rem` (720px) — narrower for reading measure.
- **Desktop rail:** fixed `280px` at `lg`; chat column stays centred in the
  remaining space (it does not stretch to fill).

Any internal grid (chip wrap, card lists) uses `flex-wrap` or
`grid-template-columns: minmax(0,1fr)` — the `minmax(0,…)` is mandatory so a long
unbroken URL or product name can't push a column wider than the 380px phone.

### Breakpoints

Mobile-first; `min-width` queries. Design target is **380px**.

| Name | Min | What changes |
|------|-----|--------------|
| *(base)* | 0 | Single column; slim sticky header; nav is an off-canvas drawer; composer sticky at bottom |
| `sm` | 480px | Page gutters 16→24px; greeting/orb scale up slightly; pill labels reappear |
| `md` | 768px | Greeting +1 step; guide gets wider gutters; header shows all action labels |
| `lg` | 1024px | **Persistent 280px sidebar rail** replaces the drawer; hamburger hidden; New Chat moves into the rail |
| `xl` | 1280px | Rail + centred chat + comfortable side margins |

### Fixed chrome & safe areas

- Sticky header (`top:0`) and sticky composer (`bottom:0`) both live above the
  scroll. The scroll region gets top/bottom padding equal to their heights so
  content never hides behind them.
- The composer adds `padding-bottom: max(18px, env(safe-area-inset-bottom))` so
  it clears the iPhone home indicator — the single most common mobile-chat bug.
- The voice stage is `position: fixed` full-viewport during a call and also
  respects the safe-area inset for its bottom controls.

---

## Shape, Surface & Elevation

### Radius scale (concentric)

| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 6px | Tier badge, inline `code`, the tucked **bubble-tail** corner |
| `--radius-sm` | 10px | Nav item, small pill inner, meter |
| `--radius-md` | 14px | Icon buttons, link-card icon well, callouts |
| `--radius-lg` | 20px | **Bubbles, cards, link cards, chips, funnel card** |
| `--radius-xl` | 28px | **Composer box, hold-to-talk button, sheets/drawer** |
| `--radius-2xl` | 32px | Voice-stage panels, modal |
| `--radius-full` | 9999px | **Pills** — action buttons, toggles, avatar, the professor pill, the orb |

**Concentric rule:** an inner control's radius = outer radius − padding, so
curves stay parallel. The composer (`--radius-xl` 28px, 8px padding) holds a send
key that is `--radius-full` (a pill/circle reads correct inside a 28px well) and
a mic icon-button at `--radius-md` 14px+ so it nests without a visible corner
clash. A card at `--radius-lg` 20px with 14px padding holds inner media at ~6px.

**Signature control shape:** small controls are **pills** (`--radius-full`);
containers are **soft 20/28px rectangles**. Forbidden: sharp corners (≤4px)
anywhere except the one bubble tail; mixing a pill button beside a sharp button
in the same cluster.

### Elevation

Depth is **soft, diffuse, and indigo-tinted** — never a hard grey/black drop
shadow, which reads muddy on the cool-white canvas. Four rungs:

```
--shadow-xs:  0 1px 2px rgba(30,34,60,.05);
--shadow-sm:  0 1px 2px rgba(30,34,60,.04), 0 6px 16px -10px rgba(70,60,150,.18);
--shadow-md:  0 2px 4px rgba(30,34,60,.05), 0 14px 30px -14px rgba(70,60,150,.24);
--shadow-lg:  0 10px 44px -14px rgba(80,70,160,.30);
--shadow-orb: 0 24px 70px -16px rgba(110,94,230,.50);
```

- `--shadow-sm`: resting bot bubbles, chips, cards.
- `--shadow-md`: the composer, link-card hover, the desktop rail edge.
- `--shadow-lg`: the drawer/sheet, modal.
- `--shadow-orb`: the orb's ground glow (paired with an inner core glow).

Dark theme deepens shadows with black rather than indigo (indigo shadow is
invisible on `#121320`): `--shadow-sm: 0 2px 8px rgba(0,0,0,.4)` etc.

Reserve shadow for genuinely floating UI. The app canvas, guide prose, and
section backgrounds are **flat** — depth there comes from the surface/bg
contrast, not a shadow.

### Borders & hairlines

Borders are secondary. Use `--line` (1px) for: dividers between guide sections,
the input's resting outline, dense list rules, and card edges *in dark mode*
(where shadow is weak). On light, prefer a shadow + surface change over a border.
On focus, the border becomes the iris ring (see Motion → states).

### Z-index scale

Named, so it is never a bidding war:

```
--z-base: 0;  --z-raised: 10;  --z-sticky: 20 (header, composer);
--z-drawer: 40;  --z-overlay: 45 (scrim);  --z-voice: 50 (in-call stage);
--z-modal: 60;  --z-toast: 70;
```

### Texture / blur

The sticky header uses `backdrop-filter: blur(12px)` over a translucent
`--bg`/90% so the thread ghosts pleasantly beneath it. That is the *only*
sanctioned backdrop-blur. No noise, no glass panels, no frosted cards.

### Image / media treatment

Rare in chat, present in guides. Contained media sits in a `--radius-lg` well
with a `1px` inset ring at `rgba(30,34,60,.08)` (never a tinted-grey border — a
low-opacity ink ring disappears into any background). Avatars are
`--radius-full`.

---

## Motion & Interaction

Defer choreography depth to **better-ui**; the language is fixed here.

### Principles

The orb **breathes** (the one continuous, organic motion — the product's pulse).
Everything else is **crisp and interruptible**: quick colour/scale transitions on
interaction, a smooth typewriter reveal for streamed replies, and gentle
enter transitions for new bubbles. Nothing bounces to grab attention; urgency is
not our register.

### Tokens (motion v13 / CSS)

```
--dur-fast: 120ms;   /* press feedback, colour flips */
--dur-base: 180ms;   /* hover, focus ring, chip states */
--dur-slow: 320ms;   /* bubble enter, drawer, sheet */
--ease-out:  cubic-bezier(0.2, 0, 0, 1);      /* emphasized decelerate — default */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

In **motion v13** (Framer Motion): interactive transitions use
`transition={{ duration: 0.18, ease: [0.2,0,0,1] }}`; bubble enters use a spring
`{ type: "spring", stiffness: 500, damping: 40, mass: 1 }` for a soft settle with
no overshoot; the orb states are CSS keyframes (below), not motion springs, so
they run without React re-renders during a call.

### Interaction states (the shared contract, every control)

| State | Treatment |
|-------|-----------|
| Hover | `--iris` hint: border/colour → iris, or 4% iris wash; `--dur-base` |
| Press | `scale(0.96)` (icon/pill) or `scale(0.98)` (large button); `--dur-fast` |
| Focus-visible | `outline: 2px solid var(--iris-500); outline-offset: 2px` — consistent everywhere, never removed |
| Active/selected | Solid or `--iris-50` fill + iris text (nav, chip, toggle-on) |
| Disabled | `opacity: .4; cursor: not-allowed`; no hover |
| Loading | typing dots / streaming reveal / orb "thinking" |

Press-scale is the tactile signature the prototype already ships (`scale(.96)`
on every control) — keep it universally. Use CSS `transition` for interactive
state (interruptible) and `@keyframes` only for one-shot or looping ambient
motion (orb, typing, record pulse).

### The orb & ambient keyframes

- `orb-breathe` 3.8s ease-in-out infinite — scale .95↔1.05, opacity .9↔1 (glow +
  core).
- `orb-spin` 9s linear infinite — the conic ring.
- `orb-speak` 1s ease-in-out infinite — core scale .97↔1.06, active only while
  speaking.
- `bob` 1.1s — typing dots (staggered 0/.15/.3s).
- `record-pulse` 1.6s — expanding `--danger` ring on the active mic.
- Live mic level drives `--lvl` (0–1) → orb `transform: scale(1 + lvl*0.16)` and
  the hold-button meter width, at `--dur-fast` linear.

### Reduced motion

`@media (prefers-reduced-motion: reduce)` disables: orb breathe/spin/speak (orb
becomes a static gradient, still on-brand), typing bob (dots become static),
record pulse (mic stays solid `--danger`), and bubble-enter springs (bubbles
appear instantly). It **keeps**: colour/opacity state changes and the mic-level
meter (functional feedback, not decorative). The orb's `--lvl` scale is dampened,
not removed, so listening still reads.

### Loading language

- **Text chat:** three-dot typing indicator on request; then a **streaming
  typewriter reveal** (`setInterval(16ms)`, speed = `max(2, remaining/10)`
  chars/tick — deliberately *not* `requestAnimationFrame`, which pauses in a
  backgrounded tab and stalls the reveal). This is already built and correct;
  the design system blesses it.
- **Voice:** the orb *is* the loading state (connecting → listening → thinking →
  speaking). No spinner ever appears during a call.

---

## Components

Each entry: principle → variants/states → a11y → the rule people get wrong →
rationale. Only what the product uses; no padding to a catalogue.

### Buttons & icon buttons

The product's button vocabulary is deliberately small.

**Variants**

| Variant | Fill / border | Text | Use |
|---------|---------------|------|-----|
| **Primary (send)** | `--iris-600` solid + 1px inner top-sheen `rgba(255,255,255,.18)` | white | The send key; guide funnel CTA |
| **Ghost** | transparent → `rgba(iris,.07)` hover | `--ink-2`→`--ink` | Header "New chat", "Type instead" |
| **Toggle** | transparent + `--line` border (off) → `--iris-600` fill (on) | `--ink-2` → white | Read-aloud, Talk-to-the-Prof |
| **Icon** | `--surface` + `--line` border | `--ink-2`→iris hover | Mic, menu, close |
| **Icon-danger** | `--danger` fill + `record-pulse` | white | Mic while recording |

**Sizes:** default control height **44px** (touch target); icon buttons
`40×40` visual with hit area extended to 44 via padding; the send key `40×40`
pill inside the composer.

**States:** per the shared contract. Send is `disabled` (opacity .4) until the
textarea has non-whitespace content — never let the user fire an empty message.

**A11y:** every icon button has an `aria-label`; toggles use `aria-pressed`; the
44px hit area is mandatory (extend with padding or a `::before` if the glyph is
smaller). Focus ring is the iris outline, never removed.

**Rule people get wrong:** the **iris is a fill only on the send key and the
funnel CTA**. Do not make the read-aloud/talk toggles iris in their *resting*
state — they are neutral until active, or the header lights up like a christmas
tree and "active" stops meaning anything.

**Rationale:** one primary action per surface (send / CTA) earns the accent;
everything else is ghost or neutral-icon so the eye always knows where the action
is.

### Message bubbles

**Anatomy:** a row (`.msg`, flex) → a bubble (`.b`, padded, radius-lg) →
markdown content. Bot rows align left and cap at 92% width; user rows align right
and cap at 80%.

| Variant | Surface | Text | Tail corner |
|---------|---------|------|-------------|
| **Bot** | `--surface` + `--shadow-sm` (no border on light; `--line` border on dark) | `--ink` | top-left → `--radius-xs` (6px) |
| **User** | `--user` (`--iris-50` light / deep iris dark) | `--ink` | top-right → `--radius-xs` |
| **Error** | `--surface`, `--danger-ink` accent text | `--ink` | same as bot |

**States:** enter (spring, `--dur-slow`); streaming (content grows via
typewriter); a bubble containing only a link card drops its chrome
(`:has(.linkcard:only-child)` → transparent, no padding/shadow) so the card
floats.

**A11y:** the thread is an `aria-live="polite"` log region so streamed replies
are announced; each bubble is a listitem in an ordered log. User text is
HTML-escaped before render (already done — never `innerHTML` raw user input).

**Rule people get wrong:** the **bubble tail** (one 6px corner toward the sender)
is the *only* non-round corner in the whole product. Do not "round it back" for
consistency and do not add tails to cards or chips — the tail is what makes a
bubble read as speech.

**Rationale:** bot bubbles are white and shadowed (they *arrive*, they float);
user bubbles are a flat iris tint (they belong to you, calmer, no shadow). The
asymmetry does the "who said this" work without avatars in the thread.

### Markdown prose (inside bubbles & guides)

One renderer, one set of styles, used by both the safe-markdown bubble renderer
and the guide pages.

| Element | Spec |
|---------|------|
| `p` | 16px/1.6, `--ink`, `.55em` block margin, `text-wrap: pretty` |
| `h3` | 17px/700, `--ink`, `-0.01em`, `.8em` top / `.3em` bottom |
| `ul/ol` | `.55em` margin, `1.25em` pad; `li` `.24em` |
| `li::marker` | `--iris-500` — the accent's quietest sanctioned home |
| `strong` | 650, `--ink` |
| `code` | `--iris-50` bg, `--iris-700` text, `--radius-xs`, `.9em` |
| `a` | `--iris-700` (light) / `--iris-300` (dark), 600, underline, `text-underline-offset: 2px`, `text-decoration-thickness: 1px` |

**Rationale:** headings inside a bubble are H3, not H1/H2 — a chat reply is a
subsection of the conversation, not a page. Links are underlined *and* coloured
(never colour-only — a11y).

### Evidence Tier badge (domain component)

The professor's honesty made visible. Tiers: **Strong · Moderate · Promising ·
Animal-only** (parsed from `*Strong*` etc. in the model output).

**Confidence is encoded by iris saturation, not by a traffic-light hue** — a
deliberate compliance-driven decision. Green=proven / red=weak would (a) imply a
medical rating the copy can't legally make and (b) read as a hazard system on a
wellness site.

| Tier | Fill / text | Reading |
|------|-------------|---------|
| Strong | `--iris-600` fill, white text | Highest confidence |
| Moderate | `--iris-100` fill, `--iris-700` text | Solid |
| Promising | `--iris-50` fill, `--iris-700` text | Emerging |
| Animal-only | `--surface-2` fill, `--ink-2` text (neutral, no iris) | Preclinical — deliberately drained of accent |

Style: 11px/700 uppercase, `0.05em`, `--radius-xs`, `2px 8px`. Non-colour cue:
the **label text itself** always names the tier, so the meaning survives
greyscale and colour-blindness.

**Rule:** never invent a tier the model didn't emit; never upgrade a tier for
emphasis. The badge is a claim.

### Suggestion chips

Empty-state prompts that seed the conversation.

**Anatomy:** a pill-ish `--radius-lg` button, `--surface` + `--shadow-sm`, 14px
text, `10px 14px`. **Hover/focus:** border → `--iris`, text → `--iris-700`.
**Press:** `scale(.96)`. **Selected** (if used as filters elsewhere):
`--iris-50` fill + iris text.

**A11y:** real `<button>`s in a group; clicking sends the chip's text as the
user's message. Min 44px effective height.

**Rationale:** chips are cards, not links — they carry a shadow and a radius so
they read as tappable objects, and they vanish (`firstMessageCleanup`) the moment
the first message is sent, because their only job is to break the blank-page
freeze.

### Composer

The one persistent action surface. **Large rounded input with small pill actions
inside it** (the BeeBot move), sticky at the bottom.

**Anatomy:** `.composer` (sticky, safe-area padding) → `.box` (`--surface`,
`--radius-xl` 28px, `--shadow-md`, flex, items-end) → `[textarea]` (auto-grows
1→~6 rows, max 140px, 16px text) + `.mic` icon-button + `.send` primary pill.
Below the box: a 12px `--ink-3` foot disclaimer.

**States:** `focus-within` → box border becomes `--iris-500` (2px, replacing the
resting `--line`); send enables when non-empty; textarea `::placeholder` is
`--ink-4`. On `talking` the box is replaced by the hold-to-talk button.

**A11y:** the textarea is the labelled input (`aria-label="Ask the professor"`);
Enter sends, Shift+Enter newlines; 16px text (no iOS zoom); the whole box has a
≥44px tap target.

**Rule people get wrong:** the send key is the **only** iris fill in the
composer. The mic stays a neutral icon-button until *recording* (then
`--danger`). Don't tint the mic iris — recording is a danger/attention state, and
iris is reserved for "the intelligence/the action."

**Rationale:** 28px outer radius + a full-pill send inside is the concentric
signature; the auto-growing single field (not a multi-line box that's always
tall) keeps the thread maximised on a short phone.

### Pill action buttons

The small actions that live inside/under the composer and in the header
(mic, send, read-aloud, talk, new-chat). All share the pill/`--radius-full`
geometry and the shared state contract. Labels collapse to icon-only below `sm`
(a documented responsive move — the prototype hides `.pill` and label spans at
520px).

### Typing indicator

Three `--ink-3` dots, 7px, in a bot bubble, `bob` 1.1s staggered. Reduced-motion
→ static dots. It is a *bot bubble* (same surface/shadow) so the reply appears to
land in the same place the dots were — no jump.

### Hold-to-talk button

Replaces the composer box in talk mode. Full-width, 64px tall, `--radius-xl`,
`--surface`, mic glyph + "Hold to talk" label.

**States:** resting (neutral); **holding** → `--iris-600` fill, white, label
"Listening…", `hold-pulse` glow, and a **level meter** — a 3px bar pinned near
the bottom edge, `transform: scaleX(var(--lvl))`, so you can see it hearing you.
Below: a live `aria-live` transcript-hint line and a "Type instead" ghost link.

**A11y:** pointer-capture press/release (works for touch + mouse); **Space** is
the hold key on desktop (with `e.repeat` guard and an input-focus guard so typing
a space doesn't trigger it); `window blur` releases; the button is
`tabindex="-1"` and the mode is entered via the labelled header toggle so the
hold itself isn't a focus trap.

**Rule people get wrong:** hold-to-talk, **never hands-free VAD** — a settled
decision from the voice spike (continuous upload stalled on real mobile
networks; audio only streams while held). Don't re-add auto-listening.

### Voice orb (the signature)

See the dedicated **The Orb** section below — it is a motif, not just a
component, and its tokens are shared with the empty-state hero.

### Link card (tappable hook)

Instead of speaking or spelling a URL, the professor drops a card. Also used
inline in text replies (guide cards) and floating over the orb during a call.

**Anatomy:** an `<a>` (`--surface`, `--radius-lg`, `--shadow-sm`) → iris icon
well (`--iris-50` bg, `--iris-700` link glyph, `--radius-md`) + body (title 15px
700 single-line-ellipsis + `--ink-3` subtitle "Tap to open") + chevron `--ink-3`.

**States:** hover → border `--iris`, `--shadow-md`; press → `scale(.99)`. When it
is the only child of a bot bubble, the bubble chrome is stripped so the card
floats.

**A11y:** a real link, `target="_blank" rel="noopener"`; the whole card is the
hit target; title is `text` (never dangerouslySet from the model). Subtitle
carries the brand/context so the destination is honest before the tap.

**Rationale:** in voice mode a URL is unspeakable and unspellable; the card turns
a compliance requirement (real, verified URLs only — the backend `_resolve_card`
guarantees them) into a nicer UX than a raw link.

### Header / top bar

**Mobile (base):** slim sticky bar, `backdrop-blur`, translucent `--bg`. Left:
hamburger (opens drawer) + 3-slash mark + wordmark. Right: action pills (New
chat, Read-aloud, Talk) collapsing to icons ≤ `sm`. Below the row: the
**disclaimer strip** — a 2px iris rule + one line of `--ink-3` general-info text
with `999`/`111` in `--ink`.

**Desktop (`lg`+):** the wordmark/nav move into the rail; the top bar shrinks to
just the current-conversation title + action pills, or disappears entirely into
the rail. The disclaimer strip persists (it is a legal requirement, not chrome).

**Rationale:** the disclaimer is *permanent and quiet* — always visible, never
alarming. The prototype's near-black glowing hero is **replaced** by this light
slim bar; the brand no longer needs a dark billboard to feel premium.

### Sidebar / nav (drawer on mobile, rail on desktop)

BeeBot's Home / Explore / Library / History, adapted.

**Mobile:** off-canvas **drawer** (`--radius-xl` right edge, `--shadow-lg`, a
scrim `rgba(18,19,32,.4)` behind). Opens from the hamburger, closes on scrim tap
/ Esc / nav select. Focus is trapped while open; the trigger regains focus on
close.

**Desktop (`lg`+):** persistent **280px rail**, `--surface`, right edge
`--line`/`--shadow-md`. Contents top→bottom: the lockup; a **New chat** primary-
ghost button; nav items (Home · Explore · Library · History) each a
`--radius-sm` row, active = `--iris-50` fill + `--iris-700` text + a 3px iris left
marker; then **time-grouped conversation history** (Today / Yesterday / Previous
7 days / Older) as `--ink-2` truncated rows; the professor **avatar** + name pinned
to the bottom.

**A11y:** `<nav>` with a labelled list; active item `aria-current="page"`; the
drawer is a `role="dialog"` with `aria-modal` on mobile.

**Rule people get wrong:** the rail is an **enhancement** — the chat must be fully
usable with the drawer never opened. Don't move a *required* action (send, new
chat on mobile) into the rail only.

### Guide / article page

Long-form SEO content that funnels to a brand. (See Page Archetypes for section
order.) Restyle the current `guides/*.html` from clinical-blue to iris.

| Part | Spec |
|------|------|
| Hero | Slim light bar (mark + wordmark + "Ask the professor →" back-link), *not* the old dark gradient |
| Kicker | Label style, `--iris-700` |
| H1 | Guide-H1 scale, `text-wrap: balance` |
| Byline | 13px `--ink-3` |
| Lede | 18px `--ink-2` |
| TOC | `--surface` card, `--radius-lg`, `--shadow-sm`; label + `--ink-2` links → iris hover |
| Prose | Markdown-prose rules above, at guide sizes |
| Callout | `--iris-50` bg, 3px `--iris-500` left border, `--radius-md` |
| Funnel card | `--surface` card, `--radius-lg`, `--shadow-sm`; kicker + copy + **Primary CTA** (the sanctioned second iris fill) |
| FAQ | `--line` top-border rows, H3 + `--ink-2` answer |
| Refs | small `--ink-2` ordered list, `--line` top-rule |
| Footer disclaimer | 12px `--ink-3`, full general-info paragraph with `999`/`111` bolded |

**Rationale:** guides carry the FAQ/Article JSON-LD (already present) — the design
must not imply claims the schema and copy don't make (no star ratings, no
`aggregateRating` without real reviews — see Honesty).

### Disclaimers (a first-class component, not fine print)

Three placements, one voice: **header strip** (always visible, one line),
**composer foot** ("Answers are AI-generated. The professor is an original
character, not a real doctor."), and **guide footer** (full paragraph). Style:
`--ink-3`, 12px, `text-wrap: pretty`, key items (`999`, `111`, "General
information only") lifted to `--ink`/`--ink-2` `strong`. Never red, never a
dismissible banner — it is calm, permanent, and legally load-bearing.

### Shared primitives & composition

One **Button**, one **Field** (the composer textarea pattern), one **Card**
(`--surface` + `--radius-lg` + `--shadow-sm` — bubbles, chips, link cards, TOC,
funnel, drawer rows all descend from it), one **Pill**, one **Orb**, one
**markdown renderer**. Never write a second Card or a second orb. Nesting follows
the concentric radius rule (Shape).

---

## The Orb — one motif, two homes

The orb is the brand's face. It appears **large and calm** above the empty-state
greeting, and **full-screen and reactive** during a voice call. Same object, same
tokens, different size and state. This section exists because "two orbs that
drift apart" is the single most likely way this system decays.

**Anatomy — three stacked layers** (all `position:absolute`, `border-radius:50%`):

1. **Glow** (`.orb-glow`) — `inset:-28%`, `--grad-orb` radial bloom,
   `filter: blur(22px)`, `orb-breathe`. The ground `--shadow-orb` under it.
2. **Ring** (`.orb-ring`) — `--grad-orb-ring` conic sweep,
   `filter: blur(7px) saturate(1.15)`, `orb-spin` 9s.
3. **Core** (`.orb-core`) — `inset:15%`, `--grad-orb-core` radial with an inner
   highlight at 34%/30% and inset shadows for a liquid-glass sphere; `orb-breathe`.

**Sizes:** empty-state `clamp(96px, 30vw, 132px)`; in-call
`clamp(150px, 46vw, 210px)`. Both scale with live mic `--lvl`.

**States (in-call):**

| State | Ring | Core | Status word |
|-------|------|------|-------------|
| idle | 9s spin, breathe | calm | "Hold to talk" |
| connecting | 9s | calm | "Connecting…" |
| listening | 3.4s (faster) | 1.5s breathe + `--lvl` scale | "Listening…" |
| thinking | 1.5s, opacity 1 | desaturated `.82`, slightly dim | "Thinking…" |
| speaking | 2.2s | `orb-speak` 1s pulse | "Speaking…" |

**A11y:** the orb is `aria-hidden` (decorative); the **status word** is the
accessible state, `aria-live="polite"`. Reduced motion freezes all three layers
into a static gradient sphere — still the hero, just not breathing.

**Empty-state usage:** the orb sits centred above the greeting; the greeting's
one keyword wears `--grad-greeting` (bg-clipped text) so the eye connects the orb
to the word — the *only* place gradient text is allowed.

**Rationale:** a Siri-style orb (not a transcript) is the right voice-UI on a
phone — it says "I'm listening" without asking you to read while you talk. Making
it the empty-state hero too means the first thing a new user sees is the same
friendly intelligence they'll later call.

---

## Voice Mode & Spoken UI (bespoke)

Voice is a first-class surface with its own rules, because what works on screen
(lists, links, a disclaimer footer) fails aloud.

- **No transcript.** During a call the thread is hidden; the orb + status word +
  floating link cards are the entire UI. (Transcripts are still captured
  server-side to feed the guardrail, but never shown — a settled decision.)
- **Spoken copy is different copy.** Voice replies are 1–3 conversational
  sentences: no markdown, no lists, **no spoken URLs**. When the professor wants
  to point somewhere he **calls the link-card tool** and says "I've put it on
  your screen," and a card appears. The screen disclaimer is *not* read aloud
  (the page shows it permanently; reading it every turn is hostile).
- **Barge-in.** Holding the button again cuts the professor off mid-sentence
  (flush playback) and starts listening — conversation, not a walkie-talkie.
- **Guardrail in voice.** An emergency ("chest pain") flushes the model audio,
  shows a readable `--iris-50` **voice-note** on the stage, sets the status to
  "Please read the screen," and speaks the safety line via the browser voice.
  Safety overrides the no-transcript rule.
- **Cost/time as UX.** Calls are capped (`LIVE_MAX_CALL_SEC` 600s); on the limit,
  a calm "Call ended (time limit)" note, not an error. Voice is per-minute
  costly — the UI never encourages an idle open mic (hence hold-to-talk).

---

## States, Feedback & Forms

### State matrix

| Surface | Empty | Loading | Success | Error / edge |
|---------|-------|---------|---------|--------------|
| Chat thread | Orb + greeting + chips (welcome) | Typing dots → streaming reveal | Reply renders + read-aloud (if on) | Bot bubble: "Sorry — I couldn't reach the professor…" with `--ink-3` detail |
| Rate limit (429) | — | — | — | Bot bubble: "You're sending messages a little fast — give me a few seconds." (calm, no red) |
| Too long (413) | — | — | — | Bot bubble: "That message is a bit long for me — try trimming it down." |
| Mic permission | — | "Getting the microphone ready…" | level meter moves | "Microphone access is blocked for this site. Allow it in your browser's settings…" |
| Voice call | Orb idle "Hold to talk" | orb connecting/thinking | orb speaking + cards | orb idle + "Call dropped. Tap Talk to reconnect." |
| History (drawer) | "No conversations yet" | — | time-grouped list | — |

**Errors speak as the professor, in a bubble, never as a red toast.** A wellness
companion that throws hazard-red system errors breaks character and alarms an
already-anxious user. The one exception is the mic-blocked message, which is
instructional (still calm text).

### Forms

The only real form is the composer. Rules that generalise to any future form
(auth, feedback): real `<label>` (never placeholder-as-label — placeholder is
`--ink-4` and vanishes on type); help/error text sits *below* the field in
`--danger-ink`; validate on submit or blur, not per-keystroke; required inputs
marked in text ("required"), not colour alone; inputs ≥16px.

### Feedback ranking

Inline bot bubble (default, conversational) > drawer/sheet (nav, history, longer
choices) > modal (only destructive confirms, e.g. "Clear all conversations?").
**No toasts** — they don't fit a chat where the thread *is* the feedback channel.

---

## Page & Screen Archetypes

### A. Chat (the product) — mobile

| # | Zone | Job |
|---|------|-----|
| 1 | Sticky header + disclaimer strip | Identity, actions, permanent legal line |
| 2 | Scroll thread | Welcome (orb+greeting+chips) → messages; the whole reading surface |
| 3 | Sticky composer | The single persistent action; safe-area clearance |
| — | Voice stage (fixed overlay) | Replaces 2 during a call |
| — | Drawer (off-canvas) | Nav + history, enhancement |

**Conditional rendering:** the welcome block exists only until the first message
(`firstMessageCleanup`); the voice stage only during a call; link cards only when
the reply/model emits one; the tier badge only when the model emits a tier. One
route serves a blank first-run and a long returning thread with no empty
scaffolding.

### B. Chat — desktop (`lg`+)

Rail (280px, persistent) + centred chat column (max 768px) + slim top bar. The
composer stays at the column's bottom, not the viewport's full width.

### C. Guide / article

| # | Section | Job | Conditional |
|---|---------|-----|-------------|
| 1 | Slim light hero | Brand + back-to-chat | always |
| 2 | Kicker + H1 + byline + lede | Answer the query in the first screen | always |
| 3 | TOC card | Orient a long read | if > ~4 sections |
| 4 | Prose (h2 sections) | The honest, tiered answer | always |
| 5 | Callout(s) | The one thing to remember | as content earns |
| 6 | Funnel card | Soft, compliant brand pointer | **only** when a stocked, bridge-eligible product genuinely fits |
| 7 | FAQ | SEO + real follow-ups | if FAQ schema present |
| 8 | Refs | Trust (NHS, Examine, etc.) | always for health claims |
| 9 | Footer disclaimer | Legal | always |

The funnel card is *conditional and singular* — one soft pointer per guide, never
a wall of CTAs. This is the compliance line made visual.

---

## Voice, Tone & Content

**Persona:** The Nutty Professor — a plain-speaking, evidence-first longevity
professor. Warm, dry, occasionally funny, never hype, never a lecture. "The
honest version, no hype" is the brand's own line — live up to it.

**Tone by context:** friendly and direct in answers; calm and human in errors
("Sorry — I couldn't reach the professor just now"); quiet and factual in
disclaimers; never alarmist in health caveats (say the caveat *once*, plainly,
then move on).

### Copy rules

- **UK English.** "colour", "personalise", "programme", metric units, £. NHS-
  aware (999 / 111, "GP", "pharmacist", melatonin is POM in the UK).
- **Evidence discipline.** Lead with the science; attach a tier
  (Strong/Moderate/Promising/Animal-only) to a claim rather than overstating it.
  Research peptides are "sold for research use only" — said **once**, no dosing,
  no human-use/injection guidance, ever.
- **No medical claims, no diagnosis, no dosing.** Layout must not imply them
  (no "PROVEN" badges, no before/after, no dosage calculators).
- **No hype vocabulary.** Banned: "miracle", "cure", "guaranteed", "melt fat",
  "anti-ageing" as a promise, urgency/countdowns. Preferred: "may help", "the
  evidence suggests", "worth a try once the basics are in place".
- **Em dashes are fine** in this document and in editorial guide prose (they suit
  the professor's voice); avoid them in tight UI microcopy where a comma or full
  stop is cleaner. (A deliberate choice — the reference brand banned them; we
  don't, because the persona is chatty.)
- **The platform is not a shop and not a URL.** "My Longevity Hub" is the site
  you're on; never write or speak "mylongevityhub.com". Only the four partner
  brands are real URLs: `my-peptides.co.uk`, `mypeptideslabs.com`,
  `thenad.co.uk`, `imnatura.co.uk`. Only my-peptides has verified `/products/…`
  deep links; the others link to the bare homepage only.

### Microcopy patterns

- Buttons are verbs or plain nouns: "New chat", "Read aloud", "Talk to the Prof",
  "Hold to talk", "Type instead", "Browse imnatura supplements →".
- Empty state: a big honest promise ("Straight answers on living longer,
  better.") + a plain subline naming the topics.
- Placeholder: "Ask the professor…".
- Errors: apologise as the character, give the next action, no error codes in the
  primary sentence (technical detail goes in `--ink-3` parenthetical).

### Formats

Sentence case for UI and headings (except the tracked uppercase wordmark, labels,
and tier badges). Numbers: spell out one–nine in prose, numerals for ranges and
data ("7–9 hours", "16–18°C"). Ranges use an en dash. Currency £, tabular figures
in any stacked/updating number.

### Claims / legal honesty (a design rule)

Never invent a policy, price, review, rating, citation, or dosage in copy *or* in
a component default. Guides cite real sources (NHS, Sleep Foundation, Examine).
No `aggregateRating`/star UI without real reviews. Unsettled facts →
`TODO`, never a plausible sentence — because this document is the source of truth
and a confident invention here propagates into every page.

---

## Accessibility

- **Target:** WCAG 2.2 **AA**. Supported: current Chrome/Safari/Firefox/Edge,
  iOS Safari + Android Chrome (mobile is primary), with VoiceOver/TalkBack.
- **Contrast:** all load-bearing pairs cited in Colour meet AA (text 4.5:1, large
  3:1, UI 3:1); links and primary ink reach AAA.
- **Focus visibility:** `outline: 2px solid var(--iris-500); outline-offset: 2px`
  on `:focus-visible`, everywhere, never removed. Visible on both themes (iris-500
  on light 4.79:1; use iris-300 on dark).
- **Hit areas:** 44×44 minimum on touch; icon glyphs may be smaller but the tap
  target is padded/`::before`-extended to 44. Desktop ≥ 40.
- **Keyboard & semantics:** Enter sends / Shift+Enter newline; Space = hold-to-
  talk (guarded against firing while an input is focused); Esc closes drawer/
  modal; roving focus in the nav list; real `<button>`/`<nav>`/`<a>`, not
  click-`div`s; `aria-live` on the thread, the talk-hint, and the orb status;
  `aria-pressed` on toggles; the orb itself is `aria-hidden`.
- **Motion:** `prefers-reduced-motion` honoured (Motion section) — orb, typing,
  pulse all calm; functional feedback (level meter) kept.
- **Colour independence:** never signal by colour alone — tier badges name their
  tier in text; links are underlined; errors carry words, not just a red.
- **Input floor:** 16px on the textarea (and any future input) to prevent iOS
  focus-zoom.

---

## Engineering Foundations

### Token architecture

Three tiers so the accent can be retargeted without a find-and-replace:
**primitive** (`--iris-600`, `--ink-2`, raw hex) → **semantic** (`--accent`,
`--bg`, `--surface`, `--danger`) → **component** (`--send-fill: var(--accent)`,
`--bubble-bot-bg: var(--surface)`). Components reference semantic tokens;
semantic tokens reference primitives; only primitives hold raw values.

### Copy-paste tokens (framework-agnostic)

```css
:root {
  /* iris primitives */
  --iris-50:#F1F0FE; --iris-100:#E5E2FC; --iris-200:#D0CAF8; --iris-300:#B3A9F5;
  --iris-400:#8A5CF0; --iris-500:#6D5DE8; --iris-600:#5B4BD6; --iris-700:#4B3AC9;
  --iris-800:#38299B;

  /* neutrals (light) */
  --bg:#F6F7FB; --surface:#FFFFFF; --surface-2:#EEEFF4; --user:#F1F0FE;
  --ink:#1E2233; --ink-2:#454A63; --ink-3:#616679; --ink-4:#8A8FA3; --line:#E7E8F0;

  /* semantic */
  --accent:var(--iris-600); --accent-strong:var(--iris-700);
  --link:var(--iris-700); --focus:var(--iris-500);
  --danger:#E5484D; --danger-ink:#BC3B36; --success-ink:#17795E;

  /* gradients */
  --grad-orb-ring:conic-gradient(from 210deg,#B3A9F5,#8A5CF0,#6D5DE8,#B3A9F5,#8A5CF0);
  --grad-orb-core:radial-gradient(circle at 34% 30%,#FBFAFF 0%,#C9BFFF 24%,#8A5CF0 56%,#5B4BD6 82%,#38299B 100%);
  --grad-orb-glow:radial-gradient(circle,rgba(138,92,240,.45),transparent 62%);
  --grad-greeting:linear-gradient(96deg,#6D5DE8,#8A5CF0 55%,#6D5DE8);

  /* radius */
  --radius-xs:6px; --radius-sm:10px; --radius-md:14px; --radius-lg:20px;
  --radius-xl:28px; --radius-2xl:32px; --radius-full:9999px;

  /* elevation (indigo-tinted) */
  --shadow-xs:0 1px 2px rgba(30,34,60,.05);
  --shadow-sm:0 1px 2px rgba(30,34,60,.04),0 6px 16px -10px rgba(70,60,150,.18);
  --shadow-md:0 2px 4px rgba(30,34,60,.05),0 14px 30px -14px rgba(70,60,150,.24);
  --shadow-lg:0 10px 44px -14px rgba(80,70,160,.30);
  --shadow-orb:0 24px 70px -16px rgba(110,94,230,.50);

  /* type */
  --font-sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;

  /* motion */
  --dur-fast:120ms; --dur-base:180ms; --dur-slow:320ms;
  --ease-out:cubic-bezier(.2,0,0,1); --ease-in-out:cubic-bezier(.4,0,.2,1);

  /* z */
  --z-sticky:20; --z-drawer:40; --z-overlay:45; --z-voice:50; --z-modal:60; --z-toast:70;
}

/* dark: media default + explicit override, light guard wins both ways */
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]){ /* dark block */ } }
:root[data-theme="dark"]{
  --bg:#121320; --surface:#1B1D2B; --surface-2:#23263A; --user:#262552;
  --ink:#E9E9F2; --ink-2:#ADB0C6; --ink-3:#838799; --ink-4:#5A5E74; --line:#2C2F45;
  --accent:var(--iris-500); --accent-strong:var(--iris-400);
  --link:var(--iris-300); --focus:var(--iris-300);
  --danger:#F26A6E; --danger-ink:#F49B9E; --success-ink:#57C89F;
  --shadow-sm:0 2px 8px rgba(0,0,0,.40);
  --shadow-md:0 8px 24px rgba(0,0,0,.50);
  --shadow-lg:0 16px 48px rgba(0,0,0,.60);
}
```

### Tailwind v4 `@theme` mapping (target stack)

```css
/* app/globals.css */
@import "tailwindcss";
@theme {
  --color-iris-50:#F1F0FE; /* …through --color-iris-800; enables bg-iris-600, text-iris-700 */
  --color-bg:#F6F7FB; --color-surface:#FFFFFF; --color-surface-2:#EEEFF4; --color-user:#F1F0FE;
  --color-ink:#1E2233; --color-ink-2:#454A63; --color-ink-3:#616679; --color-ink-4:#8A8FA3;
  --color-line:#E7E8F0;
  --color-accent:#5B4BD6; --color-danger:#E5484D; --color-danger-ink:#BC3B36;

  --radius-xs:6px; --radius-sm:10px; --radius-md:14px; --radius-lg:20px;
  --radius-xl:28px; --radius-2xl:32px; /* → rounded-lg etc. */

  --shadow-sm:0 1px 2px rgb(30 34 60/.04),0 6px 16px -10px rgb(70 60 150/.18);
  --shadow-md:0 2px 4px rgb(30 34 60/.05),0 14px 30px -14px rgb(70 60 150/.24);

  --font-sans:"Inter",ui-sans-serif,system-ui,sans-serif;
  --ease-out:cubic-bezier(.2,0,0,1);
  --animate-breathe:orb-breathe 3.8s ease-in-out infinite;
}
```

- **Fonts:** `next/font/google` → `Inter` (variable, `latin`, `display:swap`),
  apply `--font-sans` on `<html>`. No external stylesheet in production.
- **Class composition:** `clsx` + `tailwind-merge` (a `cn()` helper) for variant
  props. Motion via **motion v13** (`motion/react`) using the duration/ease
  tokens; orb keyframes stay in CSS. Validate any form payloads with **zod v4**.
  No Stripe / commerce SDK — this is a chat frontend.

### File / architecture reference

| File | Owns |
|------|------|
| `backend/app/static/index.html` | The live single-page chat UI (tokens, all chat/voice components, JS wiring) — restyle from clinical-blue to iris here first |
| `backend/app/static/guides/*.html` | Long-form guide/article pages (hero, prose, callout, funnel, FAQ, refs, disclaimer) |
| `DESIGN_SYSTEM.md` | This document — the source of truth |
| `design/preview.html` | Self-contained mobile-first mockup proving the system |
| *(future Next.js port)* `app/globals.css` | The `@theme` token block above |
| *(future)* `components/Orb.tsx`, `Composer.tsx`, `Bubble.tsx`, `LinkCard.tsx`, `Chip.tsx`, `Sidebar.tsx` | One primitive each, per Components |
| `backend/app/live.py` | Voice-mode contract (orb states, card tool, spoken-copy rules) the frontend design must match |

When this doc and the code disagree, the doc is the intent and the code is
behind — update the code, or record a deliberate exception here.

---

## Key Principles (recap)

1. **One light — the iris**, in three homes (orb, greeting keyword, send), banned
   as a fill everywhere else.
2. **Calm over clinical** — near-white cool-grey canvas; the accent is the only
   saturated thing.
3. **Depth from soft indigo-tinted shadow + tint**, not borders.
4. **Round everything; tuck one bubble corner** — the only sanctioned near-corner.
5. **Mobile is the product**; the desktop rail is enhancement.
6. **Honest before helpful** — evidence tiers by saturation not traffic-light;
   layout never implies a medical claim.
7. **Motion breathes, never jitters**; reduced-motion respected.
8. **One motif, one token set** — the two orbs are the same object.
9. **Errors speak as the professor in a bubble**, never a red toast.
10. **Inter, 16px body floor**, emphasis from weight + colour not size.

---

## Decision Log

- **Replaced the clinical blue.** The prototype's `#1789DA` on a near-black
  glowing hero read as "medical device / pharma." It was competent but cold.
  Now: iris (periwinkle→indigo) on a light airy canvas — a companion, not a
  clinic. The dark hero billboard is gone; premium comes from restraint and the
  orb, not a dark slab.
- **Send key is solid, not gradient.** Tried the full orb gradient on the send
  key; the white icon vanished over the periwinkle stop (dropped below 4.5:1).
  Now: solid `--iris-600` (6.14:1) with a 1px inner top-sheen; the gradient stays
  the orb's alone.
- **Evidence tiers by saturation, not hue.** A red/amber/green tier ladder was
  the obvious move; it implies a medical rating we can't legally make and reads
  as a hazard system. Now: iris saturation encodes confidence (Strong = solid
  iris → Animal-only = drained neutral), and the label text always names the tier
  (colour-independent).
- **Body bumped 15.5px → 16px.** The prototype's 15.5px textarea triggered iOS
  focus-zoom and was thin for health prose. 16px is the floor now.
- **Shadows are indigo-tinted, not black.** Black shadows on the cool-white
  canvas read grey and muddy. Tinting them with the ink/iris hue keeps them in
  the family and softer.
- **Hold-to-talk, not hands-free VAD.** From the voice spike: continuous 16kHz
  upload stalled on real mobile networks and looked "dead after 3 turns";
  push-to-talk ran 19 turns flawlessly. Voice mode is hold-to-talk, settled.
- **No transcript in voice mode.** A transcript asks you to read while you talk.
  The orb + status word + link cards are the whole voice UI; transcripts stay
  server-side for the guardrail only.
- **Errors as bubbles, not toasts.** A wellness companion throwing hazard-red
  system errors breaks character and alarms anxious users. Errors speak as the
  professor.
- **Platform name is not a URL.** The model once invented `mylongevityhub.com`;
  the design/copy rule (and backend sanitizer) forbid it — only the 4 partner
  brands are real URLs.

## Deliberate Exceptions

*Do not "fix" these:*
- **The bubble tail** — one corner of each bubble is tucked to `--radius-xs` 6px
  toward its sender. It is the only near-sharp corner in the product, on purpose
  (it makes a bubble read as speech). Don't round it back.
- **Gradient text on the greeting keyword** — the single place `background-clip:
  text` is allowed, to echo the orb. Don't extend gradient text to other
  headings.
- **The link-card-only bubble** strips its chrome (`:has(.linkcard:only-child)`).
  That "missing" bubble background is intentional — the card floats.
- **The read-aloud/talk/mic toggles stay neutral at rest** (not iris) even though
  they are primary features. Their *active* state earns the accent; resting does
  not.

## Open Questions / TODO

- [ ] **Sidebar/history** is speced but not built in `index.html` (the prototype
  has no nav rail or conversation history yet). Ship the drawer/rail when
  server-side session persistence lands (Redis/Postgres — noted as TODO in
  project memory).
- [ ] **Professor avatar** — the rail and (optionally) bot bubbles reference an
  avatar; no asset exists yet. Needs an illustrated mark consistent with the
  3-slash wordmark. `TODO` (do not ship a stock photo).
- [ ] **Guide pages restyle** — `guides/*.html` are still clinical-blue; port
  them to iris per the Guide archetype.
- [ ] **Dark-theme orb glow** — verify the `--shadow-orb` bloom reads on
  `#121320` without haloing; may need a lower-alpha variant.
- [ ] **P3 / wide-gamut** iris — an optional `@media (color-gamut:p3)` layer could
  make the orb more vivid on modern phones; not yet specified (defer to
  better-colors).
- [ ] **Real UK search-volume numbers** for guide prioritisation were unavailable
  at research time (Ahrefs quota) — not a design gap, but flagged so no content
  archetype invents traffic claims.
