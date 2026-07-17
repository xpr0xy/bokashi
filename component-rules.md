# Component rules

- `AppShell`: masthead + mode navigation + workspace. No dashboard cards.
- `PreviewStage`: dominant output surface, aspect-ratio aware, contains canvas/SVG layers and factual caption.
- `ModeRail`: horizontally scrollable on mobile, vertical on desktop, always visible.
- `StopEditor`: 2–5 ordered stops, colour chooser, numeric position, remove/add.
- `ColourCatalogue`: searchable list, not tile soup; each row contains swatch, kanji, romaji, hex, favourite.
- `RecipeLedger`: compact numbered rows with visual strip and metadata.
- `ExportDrawer`: format, dimensions, quality/profile, labels, download/copy.
- `ImageSampler`: drop zone, uploaded image, extracted swatches, clear error state.
- `ColourPlane`: canvas with drag rotation, wheel zoom, keyboard rotation, selected-point readout.
- Controls remain neutral regardless of output palette.
- Every control has label, keyboard path, focus state, and visible output change.
