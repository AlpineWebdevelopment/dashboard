# Styling conventions

The dashboard supports a user-chosen wallpaper (Supabase Storage, dark mode only).
Everything here exists because a photo behind the UI breaks the default design
system: surfaces are built from `dark:bg-white/[0.02]`–`[0.06]`, which reads as a
subtle lift over flat `#07070f` but is **invisible over an image**.

All of it is gated. The tokens below default to `transparent`/`none`/`0`, and
`BackgroundProvider` emits a `<style>` block overriding them **only when a
wallpaper is set**. With no wallpaper, and in light mode, the app is unchanged.

---

## 1. The tokens (`src/app/globals.css`)

```css
:root {
  --bg-text-shadow: none;
  --panel-bg: transparent;
  --panel-blur: none;
  --card-prio-alpha: 0;
}

.panel {
  background-image: linear-gradient(var(--panel-bg), var(--panel-bg));
  backdrop-filter: var(--panel-blur);
}

.panel-card {                 /* task cards: priority tint over the frosted base */
  background-image:
    linear-gradient(var(--card-priority, transparent), var(--card-priority, transparent)),
    linear-gradient(var(--panel-bg), var(--panel-bg));
  backdrop-filter: var(--panel-blur);
}

body { text-shadow: var(--bg-text-shadow); }   /* inherited — reaches all text */
```

`globals.css` also carries a second, unrelated token block (`--md-*`) for the
markdown the chat recreator renders. It has nothing to do with the wallpaper — it
exists so one set of `.md-*` rules serves both themes.

Two non-obvious choices:

- **`background-image`, not `background-color`.** Elements already carry
  `bg-zinc-50 dark:bg-white/[0.03]`. Using `background-color` would fight them for
  the same property; a gradient layer composites *over* whatever they set.
- **Earlier `background-image` layers paint above later ones.** That's why the
  priority tint is listed first in `.panel-card`.

---

## 2. Where `.panel` goes

On the **individual card / row / button / input**. Not on `<main>`, not on a route's
content column — both were tried and rejected. A full-bleed translucent layer is
mathematically identical to the dim slider and just dims the wallpaper twice.

| Situation | Rule |
|---|---|
| Card, row, input, standalone button | gets `panel` |
| Segmented control | the **container** gets `panel`; the active pill does **not** |
| Element inside an already-panelled card | no `panel` — the card is the dark base |
| Surface that is already opaque | no `panel` — it only darkens, and costs a backdrop-filter |
| Transient drag/drop highlight | no `panel` |

`backdrop-filter` creates a stacking context **and** a containing block for `fixed`
descendants. Never put `.panel` on an ancestor of a `position: fixed` node.

The `/tools` pages funnel all of this through `src/components/tools/ui.tsx`. Its
`nested` flag is exactly the "element inside an already-panelled card" row above —
reach for those primitives rather than re-deriving the class strings.

---

## 3. Typography

**Size floor.** No `text-xs`, no `text-[8px]`–`text-[11px]`.

- `text-[13px]` — body, labels, most UI text
- `text-[12px]` — badges, captions, dense chrome
- `text-sm` (14px) and larger — fine as-is

Bumping a size can break layout. Two real cases: a `w-10` column where uppercase
`tracking-widest` "CALLS" needed ~47px, and week-view event blocks where a 12px
title needs 15px inside an 18px block. **Check the geometry after a size bump.**

**Dark mode.**

| Role | Class |
|---|---|
| Secondary / resting | `dark:text-zinc-200` |
| Primary / emphasis | `dark:text-white` |
| Hover | `dark:hover:text-white` |

`dark:text-zinc-300` and dimmer are **violations for resting text**. Legitimate
exceptions, which should stay dim: separator glyphs (`·`), faint watermark icons in
empty states, and badge families with their own internal scale (the status pipes all
sit at `-300`, so the neutral one matches them rather than the global rule).

**Light mode.** Floor is `text-zinc-500`. No bare `text-zinc-300`/`text-zinc-400`
for resting text. `text-zinc-700/800/900` for primary.

**Dead hovers.** A hover that resolves to the same colour as its resting state does
nothing. After raising resting text to `zinc-200`, any `dark:hover:text-zinc-200` on
the same element is dead — send it to `white`.

**Specificity trap.** A bare `group-hover:text-zinc-500` is (0,2,0) and outranks
`dark:text-zinc-200` at (0,1,0), so it *dims* text in dark mode. Pair it with an
explicit `dark:group-hover:` counterpart.

**`transition-colors` does not animate `opacity`.** Use `transition-all` when an
element both changes colour and fades.

---

## 4. Deliberate exclusions

| Area | Why |
|---|---|
| `src/app/landing/` | own Nunito scale and inline text shadows |
| `/ads` pages | already opaque `dark:bg-zinc-950` |
| `Sidebar` | own backdrop; filling the active-nav highlight would flatten it |
| Settings nav list | hidden-vs-shown items encode a hierarchy a flat brightening would erase |
| Modal shells | opaque backgrounds of their own |

---

## 5. Applying this at scale

Sweeps are done with line-scoped scripts. Hard-won rules:

- **Never use `[^"]*` to match a class string.** Negated character classes match
  newlines, so the "string" runs across lines and the replacement eats the code
  between them. Use `[^"\n]*`. This corrupted `KanbanBoard.tsx` twice.
- **Back up before a scripted rewrite**, and `assert` the line count is unchanged
  before writing. A balanced diff (+N/−N) is the signal that nothing structural moved.
- **Compare lint per-file against `HEAD`**, not totals — totals across differently
  sized diff sets are meaningless.
- **Check the rendered page**, not just the source. Class present in the file ≠
  class reaching the DOM ≠ layout still intact.
- New code written *against* this convention usually lands one notch dim rather than
  in the pre-styling state. Use a **floor-raising** map there (`zinc-300..900 → 200`,
  leaving anything already at or above the floor alone), not the full remap — the
  full remap pushes correct tokens too bright.
