# BOKASHI design authority

## object
BOKASHI is a colour instrument, not a gallery homepage. The mutable artwork occupies most of the viewport. Controls form one stable paper-white rail. The silhouette is a specimen folio opened beside a colour field.

## palette
- paper: `#f1efe8`
- ink: `#171714`
- quiet ink: `#6d6a61`
- rule: `#c8c4b9`
- focus: `#174f8a`
- output colours come from the selected recipe and never recolour the control chrome.

## type
- UI: system sans, compact and neutral
- data: `ui-monospace`, tabular numerals
- title: serif stack `Iowan Old Style, Baskerville, Georgia`
- title scale: `clamp(2.1rem, 4vw, 4.8rem)`, normal word breaks, tracking `-0.025em`

## geometry
- radius: 0 for rails, buttons, fields, preview. Circular stop handles only.
- desktop shell: 18rem tool rail, flexible 2fr artwork, 15rem inspector.
- mobile: masthead, artwork, mode rail, controls, export drawer. No squeezed sidebars.
- rules and spacing create hierarchy. No cards, drop shadows, glass, decorative grid, fake washi texture, or Japanese cosplay.

## artwork
The preview is the product. Minimum 58vh desktop and 42vh mobile. It supports linear, radial, conic, air, mono, dither, cube, image, and 3D-plane rendering. A small factual caption shows type, stops, angle, and dimensions.

## controls
Buttons are hard rectangles with 1px rules, 44px touch height on mobile, 36px desktop. Active mode inverts ink/paper. Focus uses a 2px blue outline. Colour stops show kanji, romaji, hex, and position.

## motion
Only output-state transitions and cube animation move. No entrance stagger. Respect reduced motion. Dither and exports are deterministic.

## identity
Use `BOKASHI` and `ぼかし / colour instrument`. No Nuevo.Tokyo naming, layout, copy, paid framing, or proprietary visual assets.
