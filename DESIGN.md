# BOKASHI design authority

## object
BOKASHI is a colour instrument, not a gallery homepage. The mutable artwork occupies most of the viewport. The silhouette is a contemporary specimen folio opened inside a precise colour laboratory: a black editorial masthead, numbered mode ledger, truthful artwork field, chromatic specimen register, and fixed inspector. The controls remain stable while the output changes.

## palette
- paper: `#f1efe8`
- ink: `#171714`
- quiet ink: `#625f58`
- rule: `#c8c4b9`
- focus: `#174f8a`
- output colours come from the selected recipe and never recolour the control chrome.

## type
- UI: system sans, compact and neutral
- data: `ui-monospace`, tabular numerals
- title: serif stack `Iowan Old Style, Baskerville, Georgia`
- title scale: `clamp(3rem, 5.2vw, 5.55rem)`, normal word breaks, tracking `-0.025em`
- masthead and inspector index bars use ink/paper inversion. This is structural identity, not decorative dark mode.

## geometry
- radius: 0 for rails, buttons, fields, preview. Circular stop and range handles only.
- fullscreen shell: the app occupies one dynamic viewport at desktop, tablet, and mobile sizes; mode lists, controls, and browse ledgers own the scrolling rather than the document.
- the artwork and its specimen register are vertically composed as one folio plate inside a bounded centre stack. Recipe and colour ledgers share that stack and scroll internally beneath the artwork. Their headers remain visible while rows move.
- mode rail, inspector controls, recipe ledger, and colour register each own their overflow. Wheel or trackpad input over one region must not move another region or the document.
- tablet keeps the two-column artwork shell and allows the inspector to follow below; browse ledgers remain height-bounded and independently scrollable.
- mobile: masthead, artwork, compact chromatic register, horizontal mode rail, controls, bounded ledger. Export opens as a fixed contextual bottom sheet over a restrained scrim; it never scrolls the instrument out of view. No squeezed sidebars.
- rules and spacing create hierarchy. No cards, drop shadows, glass, decorative grid, fake washi texture, or Japanese cosplay.

## artwork
The preview is the product. It claims the remaining bounded centre-stack height instead of forcing document growth. It supports linear, radial, conic, air, mono, dither, cube, image-derived palettes, HSL/RGB colour-space projection, deterministic bands, catalogue harmonies, contrast proofing, and catalogue mosaic rendering. A small factual caption shows the renderer, active parameters, colours, and dimensions.

The canvas is not a passive poster. Editable gradient and band modes expose restrained direct controls over the artwork; radial and conic modes expose a draggable centre handle. A data-bearing specimen register below the artwork identifies the active mode and up to five rendered colours using real kanji, romaji, hex values, and output-derived colour bars. It is output metadata, not recoloured control chrome. Browse modes replace the register with their own bounded ledger context. Catalogue mode renders a direct-select colour mosaic instead of recycling the current gradient. Analysis modes preserve visible evidence of their source.

## instrument depth
Every mode must own a distinct renderer or a distinct workflow that visibly changes the result. Controls that do not alter pixels, selection, ordering, or an honest export do not exist.

- Make: geometry, direct stop editing, reverse, and even distribution.
- Recipes: bounded ledger with family/type filters, deterministic selection, and handoff to Make.
- Mono: catalogue base plus adjustable shadow and paper endpoints.
- Air: diffusion, field spread, field strength, origin, and editable colours.
- Dither: matrix family, cell scale, threshold bias, angle, and two endpoints.
- Cube: deterministic colour sequence with shared phase, multiplier, depth count, and direction.
- Source lab: one tabbed local workflow at a time for image extraction, feeling mapping, or audio analysis.
- 3D plane: HSL and RGB projections, rotation, selection, keyboard traversal, and handoff to Make.
- Colours: bounded searchable register, favourites, deterministic sort, direct copy, and handoff to Make.
- Harmony: catalogue-quantised analogous, complementary, split, triad, and tetrad schemes from a chosen base.
- Bands: deterministic repeat pattern using the active palette, angle, scale, gap, and offset.
- Contrast: two-colour proof field with live WCAG ratio and normal/large-text verdicts.

## history and truthfulness
- Bounded undo/redo is part of the instrument, with keyboard shortcuts and disabled states.
- Controls expose only parameters used by the active renderer. Dither shows two endpoints, not decorative extra stops.
- Export options are disabled when the active mode cannot honestly produce that format. Raster-backed SVG is labelled as such.
- Shared state includes every visible reproducible parameter, including colour-plane orientation and selection.

## controls
Buttons are hard rectangles with 1px rules, 44px touch height on mobile, 36px desktop. Active mode inverts ink/paper. Focus uses a 2px blue outline. Colour stops show kanji, romaji, hex, and position. Destructive, disclosure, favourite, and close controls obey the same mobile target minimum.

On mobile, identity compresses before the instrument does. The masthead must not consume the first viewport, and horizontal mode navigation must visibly signal that more modes continue off-screen.

## motion
- No loader, auto-play reveal, cursor hijack, parallax, entrance stagger, or scroll theatre.
- Animation is reserved for direct manipulation, mode/mutate output changes, export disclosure, dialogs, toast, and the live cube.
- mode and mutate output transition: 240ms scale/opacity, `cubic-bezier(.2, 0, 0, 1)`
- desktop/tablet export disclosure: 180ms translate/opacity entry, `cubic-bezier(.16, 1, .3, 1)`; close remains immediate
- mobile export sheet: 200ms translate/opacity entry, 140ms exit, 160ms scrim fade; focus is trapped inside until explicit close, Escape, or scrim click
- dialog entry: 260ms translate/scale/opacity; backdrop: 200ms opacity
- hover and press feedback: 120–180ms, transform/background/border only
- repeated input and range updates remain immediate. No animation on every slider tick.
- `prefers-reduced-motion: reduce` disables cube motion and all non-essential transitions/animations. Dither and exports remain deterministic.

## identity
Use `BOKASHI` and `ぼかし / colour instrument`. No Nuevo.Tokyo naming, layout, copy, paid framing, or proprietary visual assets.
