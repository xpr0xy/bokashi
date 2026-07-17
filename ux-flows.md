# UX flows

## create
1. App opens to a deterministic traditional recipe.
2. Select mode from the mode rail.
3. Edit colours/stops/angle/pattern/intensity in the inspector.
4. Preview updates immediately and URL state updates without navigation.
5. Favourite locally, copy CSS/state link, or open export.

## browse
Search kanji, romaji, or hex. Select a colour to make it the active stop. Toggle favourite without changing selection. Filter recipe ledger by family/mode.

## image
Choose or drop an image. Validate file and decode. Downsample client-side, cluster pixels into 6 dominant colours, map each to nearest catalogue colour, then apply as gradient stops. Errors preserve prior state.

## audio/feeling
Text feeling maps deterministically to hue/value/chroma targets and selects nearest catalogue colours. Optional audio file analysis reads low/mid/high energy and brightness, then creates a reproducible palette.

## export
Choose PNG/JPG/TIFF/SVG/CSS/JSON, dimensions, and optional labels. Preview estimated dimensions, then download. CSS copies to clipboard. Export must represent current mode.

## share
Copy a URL containing compact state. Loading it reconstructs mode, stops, angle, pattern, and intensity.

## mobile
Artwork first. Mode rail scrolls horizontally. Editors stack below. Export opens as an in-flow disclosure, never an offscreen desktop sidebar.
