# UX flows

## create
1. App opens to a deterministic traditional recipe.
2. Select mode from the mode rail.
3. Edit colours/stops/angle/pattern/intensity in the inspector.
4. Preview updates immediately and URL state updates without navigation.
5. Favourite locally, copy CSS/state link, or open export.

## browse
Search kanji, romaji, or hex. Sort the register by source, hue, lightness, or name. Open a colour in Make, copy its hex, or toggle favourite without changing selection. Filter the recipe ledger by family and gradient type while the artwork remains visible.

## source lab
Choose Image, Feeling, or Audio from the source switcher. Only that workflow is shown. Image input is validated and decoded locally, downsampled client-side, reduced to 2–5 colours, optionally ordered by luminance, mapped to the nearest catalogue colours, then applied as gradient stops. Errors preserve prior state.

## audio/feeling
Text feeling maps deterministically to hue/value/chroma targets and selects nearest catalogue colours. Audio analysis reads low/mid/high energy and brightness, then creates a reproducible palette.

## export
Choose PNG/JPG/TIFF/SVG/CSS/JSON, dimensions, and optional labels. Preview estimated dimensions, then download. CSS copies to clipboard. Export must represent current mode.

## share
Copy a URL containing compact state. Loading it reconstructs mode, stops, angle, pattern, and intensity.

## mobile
Artwork remains visible in a viewport-locked shell. All modes stays fixed beside the horizontally scrolling mode list. The workbench scrolls internally. Export opens as a bounded bottom sheet.
