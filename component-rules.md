# Component rules

- `AppShell`: masthead + mode navigation + workspace. No dashboard cards.
- `PreviewStage`: dominant output surface, aspect-ratio aware, contains canvas/SVG layers and factual caption.
- `ModeRail`: persistent All modes index plus a horizontal mobile or vertical desktop list with its own scroll region.
- `StopEditor`: 2–5 ordered stops, colour chooser, numeric position, remove/add.
- `ColourCatalogue`: searchable list, not tile soup; each row contains swatch, kanji, romaji, hex, favourite.
- `RecipeLedger`: compact numbered rows with visual strip and metadata.
- `ExportDrawer`: format, dimensions, quality/profile, labels, download/copy.
- `SourceLab`: explicit Image/Feeling/Audio switcher; only the selected local acquisition workflow is rendered.
- `ColourPlane`: canvas with drag rotation, wheel zoom, keyboard rotation, selected-point readout.
- Controls remain neutral regardless of output palette.
- Every control has label, keyboard path, focus state, and visible output change.
