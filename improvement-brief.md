# BOKASHI thorough improvement brief

## Baseline verdict

The first release is coherent and mechanically sound, but the interface still makes users translate between a large canvas and tiny indirect controls. Several modes reuse the same default gradient surface even when their job is browsing, sampling, or inspection. Mobile spends too much of its first screen on identity, hides half the mode rail without a continuation cue, and contains sub-44px destructive controls.

## Product corrections

1. Make the canvas directly editable: draggable stop rail plus center handle for radial/conic geometry.
2. Add bounded undo/redo history and keyboard shortcuts. Mutation without recovery is hostile.
3. Give browse/analysis modes truthful stage behavior: catalogue mosaic with direct selection, persistent plane selection, image source evidence, and shorter browse canvases that reveal their ledgers.
4. Make dither controls honest: expose only the two endpoint colours the renderer actually uses.
5. Make exports truthful: disable CSS where no equivalent exists, expose useful size presets, and describe raster-backed SVG output.
6. Support browser-decodable SVG uploads through an Image fallback instead of claiming all `image/*` while silently rejecting SVG.
7. Persist and share the colour-plane orientation and selected point.
8. Harden malformed local storage and invalid shared state.

## Visual corrections

- Compact the mobile masthead so the instrument enters the first viewport.
- Keep the artwork dominant, but raise control typography and action legibility one step.
- Show a clear horizontal continuation affordance on the mobile mode rail.
- Enforce 44px touch targets for every visible mobile control, including remove, close, favourite, and add controls.
- Give each mode a semantic caption instead of appending an irrelevant gradient type.
- Preserve the paper folio identity. No cards, shadows, gradients in chrome, fake Japanese decoration, or dashboard furniture.

## Acceptance criteria

- All nine modes produce distinct, intentional stage states.
- Direct stop dragging changes state, output, URL token, and inspector values.
- Undo and redo recover mutations and control changes.
- SVG, raster image, and audio fixture flows succeed or return actionable errors.
- PNG/JPG/TIFF/SVG/JSON downloads have valid signatures; CSS is available only for representable modes.
- Shared URL round-trips plane rotation and selection.
- Desktop and 375px mobile have no page overflow, console errors, clipped modes, or visible targets below 44px on mobile.
- Lighthouse performance, accessibility, best practices, and SEO remain at least 95.
- Independent visual review returns PASS.
