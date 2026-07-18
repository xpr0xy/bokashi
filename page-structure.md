# Page structure

BOKASHI remains one route and twelve instrument modes. State lives in the hash and localStorage. There is no marketing page before the tool.

## desktop application shell

1. bounded editorial masthead with history, mutate, share, and export
2. viewport-bound workspace
   - independently scrolling numbered mode rail
   - centre canvas stack
     - output stage
     - factual caption and specimen register
     - Recipe or Colour ledger when those modes are active
   - fixed-width inspector with independently scrolling controls
3. compact source/licence status bar

The document itself does not scroll above 1020px. The centre stack owns all remaining height. Recipe and Colour ledger headers stay visible while their rows scroll. Changing or scrolling a ledger cannot move the canvas, inspector, rail, masthead, or footer.

## tablet

The mode rail and canvas remain paired. The inspector follows as a full-width region. Browse ledgers are capped to the available viewport and scroll internally. The document may scroll only to reach the inspector because a truthful three-column application cannot fit at this width.

## mobile

1. compact masthead and actions
2. artwork, caption, and compact specimen strip
3. horizontal mode rail
4. controls
5. bounded Recipe or Colour ledger
6. source/licence footer

Dense ledgers never expand to their full row count. They use internal scrolling with a sticky heading and visible scroll affordance. Export remains a modal bottom sheet with locked background position.

## mode taxonomy

1. Make
2. Recipes
3. Mono
4. Air
5. Dither
6. Cube
7. Image
8. 3D plane
9. Colours
10. Harmony
11. Bands
12. Contrast

Keyboard number shortcuts address modes 1–9. Bracket keys cycle all modes without conflicting with text inputs.
