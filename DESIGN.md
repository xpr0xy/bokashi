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
- desktop shell: 11.5rem numbered mode rail, flexible artwork field, 19rem inspector.
- the artwork and its specimen register are vertically composed as one folio plate. Browse ledgers remain separate layout siblings below it.
- mobile: masthead, artwork, compact chromatic register, horizontal mode rail, controls, ledger, export drawer. No squeezed sidebars.
- rules and spacing create hierarchy. No cards, drop shadows, glass, decorative grid, fake washi texture, or Japanese cosplay.

## artwork
The preview is the product. Minimum 58vh desktop and 42vh mobile. It supports linear, radial, conic, air, mono, dither, cube, image, and 3D-plane rendering. A small factual caption shows type, stops, angle, and dimensions.

The canvas is not a passive poster. Editable gradient modes expose a restrained stop rail over the artwork; radial and conic modes expose a draggable centre handle. A data-bearing specimen register below the artwork identifies the active mode and up to five rendered colours using real kanji, romaji, hex values, and output-derived colour bars. It is output metadata, not recoloured control chrome. Browse modes replace the register with their own bounded ledger context. Catalogue mode renders a direct-select colour mosaic instead of recycling the current gradient. Analysis modes preserve visible evidence of their source.

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
- export disclosure: 220ms translate/opacity on entry; close is immediate
- dialog entry: 260ms translate/scale/opacity; backdrop: 200ms opacity
- hover and press feedback: 120–180ms, transform/background/border only
- repeated input and range updates remain immediate. No animation on every slider tick.
- `prefers-reduced-motion: reduce` disables cube motion and all non-essential transitions/animations. Dither and exports remain deterministic.

## identity
Use `BOKASHI` and `ぼかし / colour instrument`. No Nuevo.Tokyo naming, layout, copy, paid framing, or proprietary visual assets.
