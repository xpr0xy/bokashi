import './style.css';
import { COLORS } from './colors.js';
import {
  DEFAULT_STATE, MODES, DITHER_PATTERNS, HARMONY_SCHEMES, SORT_ORDERS, RECIPES, clamp, contrastRatio, contrastText, cssForState,
  extractPaletteFromImage, feelingPalette, getModeStops, harmonyPalette, luminance, normaliseState, renderPreview, rgbaToTiff,
  sortColourIndices, stateToToken, tokenToState,
} from './core.js';

const MODE_LABELS = {
  make: 'Make', traditional: 'Recipes', mono: 'Mono', air: 'Air', dither: 'Dither',
  cube: 'Cube', image: 'Source lab', plane: '3D plane', catalogue: 'Colours',
  harmony: 'Harmony', bands: 'Bands', contrast: 'Contrast',
};
const MODE_NOTES = {
  make: 'construct', traditional: 'generated', mono: 'tonal', air: 'diffuse', dither: 'matrix',
  cube: 'sequence', image: 'acquire', plane: 'spatial', catalogue: 'register',
  harmony: 'relate', bands: 'repeat', contrast: 'prove',
};
const STATE_LIMITS = {
  angle: [0, 360], centerX: [0, 100], centerY: [0, 100], blur: [0, 180], cubeSpeed: [0.1, 1.5], cubePhase: [0, 1],
  cubeCount: [4, 24], monoDark: [10, 90], monoLight: [5, 90], airSpread: [20, 100], airStrength: [10, 100],
  ditherScale: [1, 12], ditherBias: [-45, 45], imagePaletteCount: [2, 5], harmonySpread: [10, 90],
  bandScale: [4, 96], bandGap: [0, 80], bandOffset: [0, 100],
};

const app = document.querySelector('#app');
const fromHash = location.hash.startsWith('#s=') ? tokenToState(location.hash.slice(3)) : null;
const fromStorage = (() => {
  try { return JSON.parse(localStorage.getItem('bokashi-state') || 'null'); } catch { return null; }
})();
let state = normaliseState(fromHash || fromStorage || DEFAULT_STATE);
let favourites = (() => {
  try {
    const value = JSON.parse(localStorage.getItem('bokashi-favourites') || '[]');
    return new Set(Array.isArray(value) ? value.filter((index) => Number.isInteger(index) && index >= 0 && index < COLORS.length) : []);
  } catch { return new Set(); }
})();
let planePoints = [];
let animationFrame = null;
let dragStart = null;
let stageDrag = null;
let toastTimer = null;
let sampledImage = null;
let sampledPaletteCandidates = [];
let analysisStatus = { image: '', audio: '' };
let undoStack = [structuredClone(state)];
let redoStack = [];
let specimenSignature = '';
let recipeFilters = { family: 'all', type: 'all' };
let colourQuery = '';
let favouriteOnly = false;

app.innerHTML = `
  <header class="masthead">
    <div class="brand-block">
      <p class="eyebrow">ぼかし / colour instrument</p>
      <h1>BOKASHI</h1>
    </div>
    <p class="masthead-note"><span>250 source colours</span><span>120 deterministic recipes</span><span>12 local instruments / six exports</span></p>
    <div class="masthead-actions">
      <div class="history-actions" role="group" aria-label="History">
        <button class="quiet-button icon-button" id="undo" type="button" aria-label="Undo" title="Undo (⌘Z)" disabled>↶</button>
        <button class="quiet-button icon-button" id="redo" type="button" aria-label="Redo" title="Redo (⇧⌘Z)" disabled>↷</button>
      </div>
      <button class="quiet-button" id="randomise" type="button">Mutate</button>
      <button class="quiet-button" id="share-state" type="button"><span class="desktop-copy">Copy state URL</span><span class="mobile-copy">Copy URL</span></button>
      <button class="ink-button" id="open-export" type="button" aria-expanded="false" aria-controls="export-panel">Export</button>
    </div>
  </header>
  <main id="workspace" class="workspace">
    <nav class="mode-rail" aria-label="Instrument modes">
      <p class="rail-index">MODE</p>
      <button class="mode-more" id="open-mode-index" type="button" aria-haspopup="dialog" aria-controls="mode-index-dialog">All modes</button>
      <div class="mode-list">${MODES.map((mode, index) => `<button type="button" data-mode="${mode}"><span class="mode-number">${String(index + 1).padStart(2, '0')}</span><span class="mode-name">${MODE_LABELS[mode]}<small>${MODE_NOTES[mode]}</small></span></button>`).join('')}</div>
    </nav>
    <div class="canvas-stack">
      <section class="stage-column" aria-label="Gradient output">
      <div class="preview-stage" id="preview-stage">
        <canvas id="preview" aria-label="Current gradient preview" aria-describedby="preview-summary"></canvas>
        <p class="sr-only" id="preview-summary" role="status" aria-live="polite"></p>
        <div class="stage-crosshair" aria-hidden="true"></div>
        <div class="stage-direct-controls" id="stage-direct-controls" aria-label="Direct canvas controls"></div>
        <div class="source-evidence" id="source-evidence" hidden></div>
        <div class="plane-legend" id="plane-legend" hidden aria-hidden="true"><span>HUE</span><span>SATURATION</span><span>LIGHTNESS</span></div>
      </div>
      <div class="stage-caption">
        <span id="caption-mode">MAKE / LINEAR</span>
        <span id="caption-stops">3 STOPS</span>
        <span id="caption-size">LIVE CANVAS</span>
      </div>
      <div class="specimen-register" id="specimen-register" aria-hidden="true"></div>
      <p class="sr-only" id="ledger-status" role="status" aria-live="polite" aria-atomic="true"></p>
      </section>
      <section class="ledger" id="ledger"></section>
    </div>
    <aside class="inspector" aria-label="Gradient controls">
      <div class="inspector-head">
        <p>CONTROL</p>
        <span id="mode-readout">MAKE</span>
      </div>
      <div id="controls"></div>
      <div class="export-scrim" id="export-scrim" hidden aria-hidden="true"></div>
      <section class="export-panel" id="export-panel" aria-labelledby="export-title" hidden>
        <div class="section-heading"><h2 id="export-title">Export</h2><button type="button" id="close-export" aria-label="Close export panel">×</button></div>
        <div class="export-presets" role="group" aria-label="Export size presets">
          <button type="button" data-export-size="1600x900">16:9</button>
          <button type="button" data-export-size="2048x2048">Square</button>
          <button type="button" data-export-size="1080x1920">Story</button>
          <button type="button" data-export-size="3840x2160">4K</button>
        </div>
        <div class="field-pair">
          <label>Width<input id="export-width" type="number" min="64" max="4096" step="64" value="1600"></label>
          <label>Height<input id="export-height" type="number" min="64" max="4096" step="64" value="900"></label>
        </div>
        <label class="check-row"><input id="export-labels" type="checkbox"> Add specimen label</label>
        <div class="export-grid">
          ${['png', 'jpg', 'tiff', 'svg', 'css', 'json'].map((format) => `<button type="button" data-export="${format}">${format.toUpperCase()}</button>`).join('')}
        </div>
        <p class="microcopy" id="export-note">Raster exports render locally. No image leaves this browser.</p>
      </section>
    </aside>
  </main>
  <dialog class="mode-index-dialog" id="mode-index-dialog" aria-labelledby="mode-index-title">
    <div class="mode-index-head"><div><p>INSTRUMENT INDEX</p><h2 id="mode-index-title">All modes</h2></div><button type="button" id="close-mode-index" aria-label="Close mode index">×</button></div>
    ${[
      ['Construct', ['make', 'traditional', 'mono', 'air']],
      ['Process', ['dither', 'cube', 'image', 'plane']],
      ['Reference', ['catalogue', 'harmony', 'bands', 'contrast']],
    ].map(([group, modes]) => `<section><h3>${group}</h3><div>${modes.map((mode) => { const index = MODES.indexOf(mode); return `<button type="button" data-mode-index="${mode}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${MODE_LABELS[mode]}</strong><small>${MODE_NOTES[mode]}</small></button>`; }).join('')}</div></section>`).join('')}
  </dialog>
  <footer class="site-footer">
    <p>250 colours · 120 recipes · 12 instruments · 6 export formats</p>
    <p>Colour data adapted from <a href="https://github.com/xiaohk/nippon-colors" target="_blank" rel="noreferrer">xiaohk/nippon-colors</a> under MIT. Reference, not historical scholarship.</p>
  </footer>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`;

const canvas = document.querySelector('#preview');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const controls = document.querySelector('#controls');
const ledger = document.querySelector('#ledger');
const previewStage = document.querySelector('#preview-stage');
const toast = document.querySelector('#toast');
const exportPanel = document.querySelector('#export-panel');
const exportScrim = document.querySelector('#export-scrim');
const exportTrigger = document.querySelector('#open-export');
const mobileExportQuery = matchMedia('(max-width: 680px)');
const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let exportTransitionId = 0;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
}

function animateStageChange() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  canvas.getAnimations().forEach((animation) => animation.cancel());
  canvas.animate([
    { opacity: 0.72, transform: 'scale(1.008)' },
    { opacity: 1, transform: 'scale(1)' },
  ], { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
}

function persist() {
  try {
    localStorage.setItem('bokashi-state', JSON.stringify(state));
    localStorage.setItem('bokashi-favourites', JSON.stringify([...favourites]));
  } catch {}
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${stateToToken(state)}`);
}

function updateHistoryButtons() {
  document.querySelector('#undo').disabled = undoStack.length <= 1;
  document.querySelector('#redo').disabled = redoStack.length === 0;
}

function recordHistory() {
  const current = stateToToken(state);
  if (stateToToken(undoStack.at(-1)) === current) return;
  undoStack.push(structuredClone(state));
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function travelHistory(direction) {
  if (direction < 0 && undoStack.length > 1) {
    redoStack.push(undoStack.pop());
    state = structuredClone(undoStack.at(-1));
  } else if (direction > 0 && redoStack.length) {
    state = structuredClone(redoStack.pop());
    undoStack.push(structuredClone(state));
  } else return;
  commit({ record: false });
  showToast(direction < 0 ? 'Undone' : 'Redone');
}

function updateNav() {
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-mode-index]').forEach((button) => {
    const active = button.dataset.modeIndex === state.mode;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('#mode-readout').textContent = MODE_LABELS[state.mode].toUpperCase();
  requestAnimationFrame(revealActiveMode);
  const mutateButton = document.querySelector('#randomise');
  mutateButton.disabled = state.mode === 'catalogue';
  mutateButton.title = state.mode === 'catalogue' ? 'The catalogue is a fixed source register' : `Mutate ${MODE_LABELS[state.mode]} output`;
}

function stopRows(indices = state.stops.map((_, index) => index), { positions = true } = {}) {
  return indices.map((index, order) => {
    const stop = state.stops[index];
    const colour = COLORS[stop.color];
    const displayIndex = order + 1;
    return `<div class="stop-row${positions ? '' : ' no-position'}" data-stop="${index}">
      <button class="swatch-button" type="button" data-open-colour="${index}" style="--swatch:${colour.hex};--swatch-text:${contrastText(colour.hex)}" aria-label="${colour.kanji}, choose colour for ${state.mode === 'dither' ? 'endpoint' : 'stop'} ${displayIndex}">${colour.kanji}</button>
      <div><strong>${colour.romaji}</strong><code>${colour.hex}</code></div>
      ${positions ? `<label>POS<input type="number" min="0" max="100" step="1" value="${Math.round(stop.position)}" data-stop-position="${index}"></label>` : ''}
      <button class="remove-stop" type="button" data-remove-stop="${index}" aria-label="Remove ${state.mode === 'dither' ? 'endpoint' : 'stop'} ${displayIndex}" ${state.stops.length <= 2 ? 'disabled' : ''}>×</button>
    </div>`;
  }).join('');
}

function commonGeometry() {
  return `<div class="control-group">
    <div class="section-heading"><h2>Geometry</h2><span>${state.angle}°</span></div>
    <div class="segmented" role="group" aria-label="Gradient type">
      ${['linear', 'radial', 'conic'].map((type) => `<button type="button" data-gradient-type="${type}" class="${state.gradientType === type ? 'is-active' : ''}" aria-pressed="${state.gradientType === type}">${type}</button>`).join('')}
    </div>
    <label>Angle <output>${state.angle}°</output><input type="range" min="0" max="360" value="${state.angle}" data-state="angle"></label>
    ${state.gradientType !== 'linear' ? `<div class="field-pair"><label>Center X<input type="number" min="0" max="100" value="${state.centerX}" data-state="centerX"></label><label>Center Y<input type="number" min="0" max="100" value="${state.centerY}" data-state="centerY"></label></div>` : ''}
  </div>`;
}

function makerControls(extra = '') {
  return `${commonGeometry()}
    <div class="control-group">
      <div class="section-heading"><h2>Stops</h2><button type="button" data-add-stop ${state.stops.length >= 5 ? 'disabled' : ''}>+ add</button></div>
      <div class="button-pair"><button type="button" data-reverse-stops>Reverse</button><button type="button" data-distribute-stops>Distribute</button></div>
      <div class="stop-list">${stopRows()}</div>
    </div>${extra}`;
}

function focusSelectorForControl(element) {
  if (!element || !controls.contains(element)) return null;
  if (element.id) return `#${CSS.escape(element.id)}`;
  const attribute = ['data-state', 'data-gradient-type', 'data-stop-position', 'data-open-colour', 'data-remove-stop', 'data-recipe-step', 'data-add-stop', 'data-reverse-stops', 'data-distribute-stops', 'data-cube-direction', 'data-source-type', 'data-plane-space', 'data-open-mono', 'data-open-harmony', 'data-swap-contrast'].find((name) => element.hasAttribute(name));
  return attribute ? `[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]` : null;
}

function renderControls() {
  const focusSelector = focusSelectorForControl(document.activeElement);
  if (state.mode === 'make') controls.innerHTML = makerControls();
  else if (state.mode === 'traditional') {
    const recipe = RECIPES[state.recipe];
    const families = [...new Set(RECIPES.map((item) => item.family))];
    controls.innerHTML = `<div class="control-group recipe-control">
      <p class="specimen-number">${recipe.id}</p>
      <h2>${recipe.family}</h2>
      <p>${recipe.type} / ${recipe.stops.length} colours / ${recipe.angle}°</p>
      <div class="button-pair"><button type="button" data-recipe-step="-1">Previous</button><button type="button" data-recipe-step="1">Next</button></div>
      <button type="button" data-use-recipe>Open in maker</button>
    </div><div class="control-group"><div class="section-heading"><h2>Ledger filter</h2><span>LOCAL</span></div>
      <label>Family<select id="recipe-family"><option value="all">All families</option>${families.map((family) => `<option value="${family}" ${recipeFilters.family === family ? 'selected' : ''}>${family}</option>`).join('')}</select></label>
      <label>Geometry<select id="recipe-type"><option value="all">All types</option>${['linear', 'radial', 'conic'].map((type) => `<option value="${type}" ${recipeFilters.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
    </div>`;
  } else if (state.mode === 'mono') {
    const colour = COLORS[state.monoBase];
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Monochrome</h2><span>${colour.kanji}</span></div>
      <button class="colour-hero" data-open-mono type="button" style="--swatch:${colour.hex};--swatch-text:${contrastText(colour.hex)}"><strong>${colour.romaji}</strong><code>${colour.hex}</code></button>
      <label>Shadow depth <output>${state.monoDark}%</output><input type="range" min="10" max="90" value="${state.monoDark}" data-state="monoDark"></label>
      <label>Paper lift <output>${state.monoLight}%</output><input type="range" min="5" max="90" value="${state.monoLight}" data-state="monoLight"></label></div>${commonGeometry()}`;
  } else if (state.mode === 'air') {
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Atmosphere</h2><span>${state.blur}px</span></div>
      <label>Diffusion <output>${state.blur}px</output><input type="range" min="0" max="180" value="${state.blur}" data-state="blur"></label>
      <label>Field spread <output>${state.airSpread}%</output><input type="range" min="20" max="100" value="${state.airSpread}" data-state="airSpread"></label>
      <label>Field strength <output>${state.airStrength}%</output><input type="range" min="10" max="100" value="${state.airStrength}" data-state="airStrength"></label>
      <div class="field-pair"><label>Origin X<input type="number" min="0" max="100" value="${Math.round(state.centerX)}" data-state="centerX"></label><label>Origin Y<input type="number" min="0" max="100" value="${Math.round(state.centerY)}" data-state="centerY"></label></div></div>
      <div class="control-group"><div class="section-heading"><h2>Colour fields</h2><button type="button" data-add-stop ${state.stops.length >= 5 ? 'disabled' : ''}>+ add</button></div><div class="stop-list">${stopRows(undefined, { positions: false })}</div></div>`;
  } else if (state.mode === 'dither') {
    const endpointIndices = state.stops.length > 1 ? [0, state.stops.length - 1] : [0];
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Direction</h2><span>${state.angle}°</span></div><label>Angle <output>${state.angle}°</output><input type="range" min="0" max="360" value="${state.angle}" data-state="angle"></label></div>
      <div class="control-group"><div class="section-heading"><h2>Two-colour matrix</h2><span>${state.pattern}</span></div><p class="microcopy">The matrix uses two ink endpoints across the selected direction.</p><div class="stop-list">${stopRows(endpointIndices, { positions: false })}</div>
      <label>Pattern<select data-state="pattern">${DITHER_PATTERNS.map((pattern) => `<option ${pattern === state.pattern ? 'selected' : ''}>${pattern}</option>`).join('')}</select></label>
      <label>Cell scale <output>${state.ditherScale}×</output><input type="range" min="1" max="12" value="${state.ditherScale}" data-state="ditherScale"></label>
      <label>Threshold bias <output>${state.ditherBias}</output><input type="range" min="-45" max="45" value="${state.ditherBias}" data-state="ditherBias"></label></div>`;
  } else if (state.mode === 'cube') {
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Sequence colours</h2><button type="button" data-add-stop ${state.stops.length >= 5 ? 'disabled' : ''}>+ add</button></div><div class="stop-list">${stopRows(undefined, { positions: false })}</div></div>
      <div class="control-group"><div class="section-heading"><h2>Sequence</h2><span>${state.cubeSpeed.toFixed(2)}×</span></div>
      <label>Phase <output>${Math.round(state.cubePhase * 100)}%</output><input type="range" min="0" max="1" step="0.01" value="${state.cubePhase}" data-state="cubePhase"></label>
      <label>Phase multiplier <output>${state.cubeSpeed.toFixed(2)}×</output><input type="range" min="0.1" max="1.5" step="0.05" value="${state.cubeSpeed}" data-state="cubeSpeed"></label>
      <label>Depth <output>${state.cubeCount}</output><input type="range" min="4" max="24" value="${state.cubeCount}" data-state="cubeCount"></label>
      <div class="segmented" role="group" aria-label="Sequence direction"><button type="button" data-cube-direction="1" class="${state.cubeDirection === 1 ? 'is-active' : ''}" aria-pressed="${state.cubeDirection === 1}">Outward</button><button type="button" data-cube-direction="-1" class="${state.cubeDirection === -1 ? 'is-active' : ''}" aria-pressed="${state.cubeDirection === -1}">Inward</button></div></div>`;
  } else if (state.mode === 'image') {
    const sourceTabs = `<div class="control-group source-switcher"><div class="section-heading"><h2>Source</h2><span>LOCAL</span></div><div class="segmented" role="group" aria-label="Palette source">${[['image', 'Image'], ['feeling', 'Feeling'], ['audio', 'Audio']].map(([type, label]) => `<button type="button" data-source-type="${type}" class="${state.sourceType === type ? 'is-active' : ''}" aria-pressed="${state.sourceType === type}">${label}</button>`).join('')}</div></div>`;
    const sourcePanel = state.sourceType === 'image' ? `<div class="control-group"><div class="section-heading"><h2>Image sampler</h2><span>LOCAL</span></div>
      <div class="field-pair"><label>Colours<select data-state="imagePaletteCount">${[2, 3, 4, 5].map((count) => `<option value="${count}" ${count === state.imagePaletteCount ? 'selected' : ''}>${count}</option>`).join('')}</select></label><label>Order<select data-state="imageSort"><option value="dominance" ${state.imageSort === 'dominance' ? 'selected' : ''}>dominance</option><option value="luminance" ${state.imageSort === 'luminance' ? 'selected' : ''}>luminance</option></select></label></div>
      <label class="drop-zone" data-drop-kind="image">Drop or choose image<input id="image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"></label><p class="microcopy" id="image-status" role="status" aria-live="polite">${analysisStatus.image || `Extract ${state.imagePaletteCount} dominant colours and match them to the catalogue.`}</p>${sampledImage ? '<button type="button" id="clear-source">Clear source evidence</button>' : ''}</div>`
      : state.sourceType === 'feeling'
        ? `<div class="control-group"><div class="section-heading"><h2>Feeling</h2><span>TEXT → COLOUR</span></div><label>Describe a feeling<textarea id="feeling-input" rows="3" placeholder="cold rain over dark cedar"></textarea></label><button type="button" id="generate-feeling">Generate palette</button><p class="microcopy" id="feeling-status" role="status" aria-live="polite"></p></div>`
        : `<div class="control-group"><div class="section-heading"><h2>Audio tone</h2><span>WAVEFORM</span></div><label class="drop-zone" data-drop-kind="audio">Drop or choose audio<input id="audio-input" type="file" accept="audio/*"></label><p class="microcopy" id="audio-status" role="status" aria-live="polite">${analysisStatus.audio || 'Maps amplitude, density and transient shape to colour indices.'}</p></div>`;
    controls.innerHTML = `${sourceTabs}${sourcePanel}${makerControls()}`;
  } else if (state.mode === 'plane') {
    const selected = state.planeSelected == null ? null : COLORS[state.planeSelected];
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Colour plane</h2><span>${state.planeSpace.toUpperCase()}</span></div>
      <div class="segmented" role="group" aria-label="Colour space"><button type="button" data-plane-space="hsl" class="${state.planeSpace === 'hsl' ? 'is-active' : ''}" aria-pressed="${state.planeSpace === 'hsl'}">HSL</button><button type="button" data-plane-space="rgb" class="${state.planeSpace === 'rgb' ? 'is-active' : ''}" aria-pressed="${state.planeSpace === 'rgb'}">RGB</button></div>
      <p>Drag the field to rotate. Use arrow keys when the field is focused. Select a point to inspect it.</p>${selected ? `<button class="colour-hero" type="button" data-plane-use style="--swatch:${selected.hex};--swatch-text:${contrastText(selected.hex)}"><span>${selected.kanji}</span><strong>${selected.romaji}</strong><code>${selected.hex}</code><small>Use in maker</small></button>` : '<p class="plane-empty">No point selected.</p>'}</div>`;
  } else if (state.mode === 'catalogue') {
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Catalogue</h2><span>${COLORS.length}</span></div><label>Search<input id="colour-search" type="search" value="${colourQuery}" placeholder="kanji, romaji or #hex" autocomplete="off"></label>
      <label>Sort<select data-state="catalogueSort">${SORT_ORDERS.map((order) => `<option value="${order}" ${state.catalogueSort === order ? 'selected' : ''}>${order}</option>`).join('')}</select></label>
      <label class="check-row"><input id="favourites-only" type="checkbox" ${favouriteOnly ? 'checked' : ''}> Favourites only</label></div>`;
  } else if (state.mode === 'harmony') {
    const colour = COLORS[state.monoBase];
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Harmony</h2><span>${colour.kanji}</span></div>
      <button class="colour-hero" data-open-harmony type="button" style="--swatch:${colour.hex};--swatch-text:${contrastText(colour.hex)}"><strong>${colour.romaji}</strong><code>${colour.hex}</code></button>
      <label>Scheme<select data-state="harmonyScheme">${HARMONY_SCHEMES.map((scheme) => `<option value="${scheme}" ${state.harmonyScheme === scheme ? 'selected' : ''}>${scheme}</option>`).join('')}</select></label>
      <label>Hue spread <output>${state.harmonySpread}°</output><input type="range" min="10" max="90" value="${state.harmonySpread}" data-state="harmonySpread"></label></div>${commonGeometry()}`;
  } else if (state.mode === 'bands') {
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Repeat field</h2><span>${state.angle}°</span></div>
      <label>Angle <output>${state.angle}°</output><input type="range" min="0" max="360" value="${state.angle}" data-state="angle"></label>
      <label>Band scale <output>${state.bandScale}px</output><input type="range" min="4" max="96" value="${state.bandScale}" data-state="bandScale"></label>
      <label>Paper gap <output>${state.bandGap}%</output><input type="range" min="0" max="80" value="${state.bandGap}" data-state="bandGap"></label>
      <label>Phase <output>${state.bandOffset}%</output><input type="range" min="0" max="100" value="${state.bandOffset}" data-state="bandOffset"></label></div>
      <div class="control-group"><div class="section-heading"><h2>Band colours</h2><button type="button" data-add-stop ${state.stops.length >= 5 ? 'disabled' : ''}>+ add</button></div><div class="button-pair"><button type="button" data-reverse-stops>Reverse</button><button type="button" data-distribute-stops>Distribute</button></div><div class="stop-list">${stopRows(undefined, { positions: false })}</div></div>`;
  } else {
    const [foreground, background] = [state.stops[0], state.stops.at(-1)].map((stop) => COLORS[stop.color]);
    const ratio = contrastRatio(foreground.hex, background.hex);
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Contrast proof</h2><span>${ratio.toFixed(2)}:1</span></div>
      <div class="contrast-verdict"><strong>${ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'LARGE ONLY' : 'FAIL'}</strong><span>normal ${ratio >= 4.5 ? 'pass' : 'fail'} · large ${ratio >= 3 ? 'pass' : 'fail'}</span></div>
      <div class="stop-list">${stopRows([0, state.stops.length - 1], { positions: false })}</div><button type="button" data-swap-contrast>Swap foreground / background</button></div>`;
  }
  bindControlInputs();
  if (focusSelector) requestAnimationFrame(() => (controls.querySelector(focusSelector) || controls.querySelector('[data-add-stop]'))?.focus());
}

function renderLedger(filter = '') {
  document.querySelector('#workspace').classList.toggle('has-ledger', ['traditional', 'catalogue'].includes(state.mode));
  if (state.mode === 'traditional') {
    ledger.hidden = false;
    const matches = RECIPES.map((recipe, index) => ({ recipe, index })).filter(({ recipe }) => (
      (recipeFilters.family === 'all' || recipe.family === recipeFilters.family)
      && (recipeFilters.type === 'all' || recipe.type === recipeFilters.type)
    ));
    ledger.innerHTML = `<div class="ledger-head"><h2>Generated recipe ledger</h2><p>${matches.length} of ${RECIPES.length} deterministic studies shown. Open any recipe, then edit it freely.</p></div><div class="recipe-ledger" tabindex="0" aria-label="Scrollable generated recipe ledger">${matches.map(({ recipe, index }) => {
      const css = recipe.type === 'linear'
        ? `linear-gradient(${recipe.angle}deg, ${recipe.stops.map((stop) => `${COLORS[stop.color].hex} ${stop.position}%`).join(',')})`
        : recipe.type === 'radial'
          ? `radial-gradient(circle, ${recipe.stops.map((stop) => `${COLORS[stop.color].hex} ${stop.position}%`).join(',')})`
          : `conic-gradient(from ${recipe.angle}deg, ${recipe.stops.map((stop) => `${COLORS[stop.color].hex} ${stop.position}%`).join(',')})`;
      return `<button type="button" data-recipe="${index}" class="${index === state.recipe ? 'is-selected' : ''}"><span>${recipe.id}</span><i style="background:${css}"></i><strong>${recipe.family}</strong><small>${recipe.type}</small></button>`;
    }).join('') || '<p class="ledger-empty">No recipes match these filters.</p>'}</div>`;
    document.querySelector('#ledger-status').textContent = `${matches.length} recipes shown. Recipe ${state.recipe + 1} selected.`;
  } else if (state.mode === 'catalogue') {
    ledger.hidden = false;
    const query = colourQuery.trim().toLowerCase();
    const orderedIndices = sortColourIndices(state.catalogueSort);
    const matches = orderedIndices.map((index) => ({ colour: COLORS[index], index })).filter(({ colour, index }) => {
      if (favouriteOnly && !favourites.has(index)) return false;
      return !query || `${colour.romaji} ${colour.kanji} ${colour.hex}`.toLowerCase().includes(query);
    });
    ledger.innerHTML = `<div class="ledger-head"><h2>Colour register</h2><p>${matches.length} of ${COLORS.length} shown. Open a colour in Make or copy its hex value.</p></div><div class="colour-ledger" tabindex="0" aria-label="Scrollable colour register">${matches.map(({ colour, index }) => `<div class="colour-row"><button type="button" data-colour="${index}"><i style="--swatch:${colour.hex}"></i><span>${colour.kanji}</span><strong>${colour.romaji}</strong><code>${colour.hex}</code></button><button type="button" data-copy-colour="${index}" aria-label="Copy ${colour.romaji} ${colour.hex}">⌘</button><button type="button" data-favourite="${index}" aria-label="${favourites.has(index) ? 'Remove' : 'Add'} ${colour.romaji} ${favourites.has(index) ? 'from' : 'to'} favourites">${favourites.has(index) ? '★' : '☆'}</button></div>`).join('') || '<p class="ledger-empty">No colours match these filters.</p>'}</div>`;
    document.querySelector('#ledger-status').textContent = `${matches.length} colours found.`;
  } else {
    ledger.hidden = true;
    ledger.innerHTML = '';
    document.querySelector('#ledger-status').textContent = '';
  }
}

function specimenColours() {
  if (state.mode === 'plane') {
    if (state.planeSelected != null) return [COLORS[state.planeSelected]];
    return [22, 72, 122, 172, 222].map((index) => COLORS[index]);
  }
  return getModeStops(state).slice(0, 5).map((stop, index) => {
    if (stop.color != null) return COLORS[stop.color];
    return { kanji: String(index + 1).padStart(2, '0'), romaji: 'tonal value', hex: stop.hex };
  });
}

function renderSpecimenRegister(detail) {
  const register = document.querySelector('#specimen-register');
  const browseMode = ['traditional', 'catalogue'].includes(state.mode);
  register.hidden = browseMode;
  if (browseMode) { register.replaceChildren(); specimenSignature = ''; return; }
  const colours = specimenColours();
  const signature = `${state.mode}:${detail}:${colours.map((colour) => `${colour.kanji}:${colour.hex}`).join('|')}`;
  if (signature === specimenSignature) return;
  specimenSignature = signature;
  const modeNumber = String(MODES.indexOf(state.mode) + 1).padStart(2, '0');
  register.innerHTML = `<div class="register-lead"><span>${modeNumber}</span><div><strong>${MODE_LABELS[state.mode]}</strong><small>${detail} / ${MODE_NOTES[state.mode]}</small></div></div><div class="register-palette">${colours.map((colour, index) => `<div class="register-colour" style="--register-colour:${colour.hex}"><span>${colour.kanji}</span><div><strong>${colour.romaji}</strong><code>${colour.hex}</code></div><small>${String(index + 1).padStart(2, '0')}</small></div>`).join('')}</div>`;
}

function renderCaption() {
  const recipe = state.mode === 'traditional' ? RECIPES[state.recipe] : null;
  const detail = {
    traditional: recipe?.type,
    mono: 'TONAL SCALE',
    air: 'DIFFUSION',
    dither: state.pattern,
    cube: 'SEQUENCE',
    image: state.sourceType === 'image' && sampledImage ? 'SAMPLED IMAGE' : `${state.sourceType.toUpperCase()} → PALETTE`,
    plane: `${state.planeSpace.toUpperCase()} SPACE`,
    catalogue: `${state.catalogueSort.toUpperCase()} MOSAIC`,
    harmony: `${state.harmonyScheme.toUpperCase()} HARMONY`,
    bands: 'REPEAT FIELD',
    contrast: `${contrastRatio(COLORS[state.stops[0].color].hex, COLORS[state.stops.at(-1).color].hex).toFixed(2)}:1`,
  }[state.mode] || state.gradientType;
  renderSpecimenRegister(detail.toUpperCase());
  document.querySelector('#caption-mode').textContent = `${MODE_LABELS[state.mode].toUpperCase()} / ${detail.toUpperCase()}`;
  const stopText = state.mode === 'plane'
    ? (state.planeSelected == null ? 'NO SELECTION' : COLORS[state.planeSelected].romaji.toUpperCase())
    : state.mode === 'catalogue'
      ? `${favourites.size} SAVED`
      : state.mode === 'dither'
        ? '2 ENDPOINTS'
        : `${getModeStops(state).length} ${state.mode === 'contrast' ? 'COLOURS' : 'STOPS'}`;
  document.querySelector('#caption-stops').textContent = stopText;
  document.querySelector('#caption-size').textContent = `${canvas.width} × ${canvas.height}`;
  previewStage.dataset.mode = state.mode;
  previewStage.closest('.stage-column').classList.toggle('is-browse', ['traditional', 'catalogue'].includes(state.mode));
  const planeLegend = document.querySelector('#plane-legend');
  planeLegend.hidden = state.mode !== 'plane';
  planeLegend.querySelector('span:last-child').textContent = state.planeSpace === 'hsl' ? 'HUE / SATURATION / LIGHTNESS' : 'RED / GREEN / BLUE';
  previewStage.tabIndex = state.mode === 'plane' ? 0 : -1;
  previewStage.setAttribute('aria-label', state.mode === 'plane'
    ? `Interactive ${state.planeSpace.toUpperCase()} colour plane. Arrow keys rotate, Enter selects the nearest central point, and N or P cycles colours.`
    : state.mode === 'catalogue'
      ? 'Interactive catalogue mosaic. Select any cell to open that colour in the maker.'
      : `Current ${MODE_LABELS[state.mode]} preview`);
  const effectiveColours = state.mode === 'plane'
    ? (state.planeSelected == null ? `${COLORS.length} catalogue points` : COLORS[state.planeSelected].hex)
    : state.mode === 'catalogue'
      ? `${COLORS.length} catalogue colours`
      : state.mode === 'dither'
        ? [state.stops[0], state.stops.at(-1)].map((stop) => COLORS[stop.color].hex).join(', ')
        : getModeStops(state).map((stop) => stop.hex ?? COLORS[stop.color].hex).join(', ');
  const parameters = state.mode === 'plane'
    ? `${state.planeSpace.toUpperCase()} rotation ${state.planeRotation.x.toFixed(2)} by ${state.planeRotation.y.toFixed(2)}${state.planeSelected == null ? ', no colour selected' : `, ${COLORS[state.planeSelected].romaji} selected`}`
    : state.mode === 'catalogue'
      ? `${COLORS.length} colour mosaic sorted by ${state.catalogueSort}, ${favourites.size} favourites`
      : state.mode === 'air'
        ? `diffusion ${state.blur} pixels, spread ${state.airSpread} percent, strength ${state.airStrength} percent, origin ${Math.round(state.centerX)} by ${Math.round(state.centerY)} percent`
        : state.mode === 'dither'
          ? `${state.pattern} pattern at ${state.angle} degrees, cell scale ${state.ditherScale}, bias ${state.ditherBias}`
          : state.mode === 'cube'
            ? `${state.cubeCount} deterministic layers ${state.cubeDirection === 1 ? 'outward' : 'inward'}, phase ${Math.round(state.cubePhase * 100)} percent at ${state.cubeSpeed.toFixed(2)} times`
            : state.mode === 'harmony'
              ? `${state.harmonyScheme} from ${COLORS[state.monoBase].romaji}, spread ${state.harmonySpread} degrees`
              : state.mode === 'bands'
                ? `${state.bandScale} pixel scale, ${state.bandGap} percent gap, ${state.bandOffset} percent phase at ${state.angle} degrees`
                : state.mode === 'contrast'
                  ? `contrast ratio ${detail}`
                  : state.mode === 'mono'
                    ? `shadow ${state.monoDark} percent, paper lift ${state.monoLight} percent, ${state.angle} degrees`
                    : `${detail}, ${state.mode === 'traditional' ? recipe.angle : state.angle} degrees`;
  const summary = `${MODE_LABELS[state.mode]} output. ${parameters}. Colours: ${effectiveColours}.`;
  const summaryNode = document.querySelector('#preview-summary');
  if (summaryNode.textContent !== summary) summaryNode.textContent = summary;
}

function renderStageDirectControls() {
  const host = document.querySelector('#stage-direct-controls');
  if (state.mode === 'air') {
    host.hidden = false;
    host.innerHTML = `<button class="stage-center-handle" type="button" data-stage-center style="left:${state.centerX}%;top:${state.centerY}%" aria-label="Atmosphere origin at ${Math.round(state.centerX)} by ${Math.round(state.centerY)} percent. Drag to reposition."><span></span></button>`;
    return;
  }
  const editable = ['make', 'image'].includes(state.mode);
  if (!editable) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  const indices = state.stops.map((_, index) => index);
  const handles = [...new Set(indices)].map((index, order) => {
    const stop = state.stops[index];
    const colour = COLORS[stop.color];
    const label = state.mode === 'dither' ? 'Endpoint' : 'Stop';
    return `<button class="stage-stop-handle" type="button" data-stage-stop="${index}" style="left:${stop.position}%;--swatch:${colour.hex};--swatch-text:${contrastText(colour.hex)}" aria-label="${label} ${order + 1}, ${colour.romaji} at ${Math.round(stop.position)} percent. Drag horizontally to reposition." title="${colour.romaji} · ${Math.round(stop.position)}%"><span>${order + 1}</span></button>`;
  }).join('');
  const center = state.gradientType === 'linear' ? '' : `<button class="stage-center-handle" type="button" data-stage-center style="left:${state.centerX}%;top:${state.centerY}%" aria-label="Gradient centre at ${Math.round(state.centerX)} by ${Math.round(state.centerY)} percent. Drag to reposition."><span></span></button>`;
  host.innerHTML = `<div class="stage-stop-track" aria-label="Gradient stop rail"><div class="stage-stop-line"></div>${handles}</div>${center}`;
}

function renderSourceEvidence() {
  const host = document.querySelector('#source-evidence');
  if (state.mode !== 'image' || !sampledImage) { host.hidden = true; host.replaceChildren(); return; }
  const image = document.createElement('img');
  image.src = sampledImage.url;
  image.alt = '';
  const copy = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = sampledImage.name;
  const span = document.createElement('span');
  span.textContent = `${sampledImage.width} × ${sampledImage.height} · source sampled locally`;
  copy.append(strong, span);
  host.replaceChildren(image, copy);
  host.hidden = false;
}

function resizeCanvas() {
  const rect = previewStage.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  renderCanvas();
}

function renderCanvas() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  planePoints = renderPreview(ctx, state, canvas.width, canvas.height) || [];
  renderCaption();
}

function commit({ controlsOnly = false, ledgerOnly = false, record = true } = {}) {
  if (record) recordHistory();
  persist();
  updateNav();
  if (!ledgerOnly) renderControls();
  renderLedger();
  if (!controlsOnly) renderCanvas();
  renderStageDirectControls();
  renderSourceEvidence();
  updateHistoryButtons();
  updateExportAvailability();
}

function colourPicker(title, onChoose) {
  const returnFocus = focusSelectorForControl(document.activeElement);
  const dialog = document.createElement('dialog');
  dialog.className = 'colour-dialog';
  dialog.innerHTML = `<form method="dialog"><div class="dialog-head"><h2>${title}</h2><button value="cancel" aria-label="Close">×</button></div><label>Search<input type="search" placeholder="name, kanji, hex" autofocus></label><div class="dialog-colours">${COLORS.map((colour, index) => `<button type="button" data-pick="${index}" style="--swatch:${colour.hex};--swatch-text:${contrastText(colour.hex)}"><span>${colour.kanji}</span><strong>${colour.romaji}</strong><code>${colour.hex}</code></button>`).join('')}</div></form>`;
  document.body.append(dialog);
  const search = dialog.querySelector('input');
  search.addEventListener('input', () => {
    const query = search.value.toLowerCase();
    dialog.querySelectorAll('[data-pick]').forEach((button) => {
      button.hidden = !button.textContent.toLowerCase().includes(query);
    });
  });
  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pick]');
    if (!button) return;
    onChoose(Number(button.dataset.pick));
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (returnFocus) requestAnimationFrame(() => controls.querySelector(returnFocus)?.focus());
  });
  dialog.showModal();
}

function bindControlInputs() {
  controls.querySelectorAll('[data-state]').forEach((input) => {
    input.addEventListener('input', () => {
      const field = input.dataset.state;
      if (STATE_LIMITS[field]) {
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;
        const limits = STATE_LIMITS[field];
        state[field] = clamp(value, limits[0], limits[1]);
        input.value = String(state[field]);
      } else state[field] = input.value;
      if ((field === 'imagePaletteCount' || field === 'imageSort') && sampledPaletteCandidates.length >= 2) {
        applySampledImagePalette();
        return;
      }
      persist();
      renderCanvas();
      renderStageDirectControls();
      if (field === 'catalogueSort') renderLedger();
      const output = input.closest('label')?.querySelector('output');
      if (output) {
        const unit = { angle: '°', harmonySpread: '°', blur: 'px', bandScale: 'px', airSpread: '%', airStrength: '%', monoDark: '%', monoLight: '%', bandGap: '%', bandOffset: '%', cubeSpeed: '×', cubePhase: '%', ditherScale: '×' }[field] || '';
        output.textContent = `${field === 'cubePhase' ? Math.round(Number(input.value) * 100) : input.value}${unit}`;
      }
    });
    input.addEventListener('change', () => { recordHistory(); renderControls(); });
  });
  controls.querySelectorAll('[data-stop-position]').forEach((input) => {
    input.addEventListener('change', () => {
      state.stops[Number(input.dataset.stopPosition)].position = clamp(input.value, 0, 100);
      state.stops.sort((a, b) => a.position - b.position);
      commit();
    });
  });
  controls.querySelector('#image-input')?.addEventListener('change', handleImage);
  controls.querySelector('#audio-input')?.addEventListener('change', handleAudio);
  controls.querySelectorAll('[data-drop-kind]').forEach((zone) => {
    zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('is-dragging'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault(); zone.classList.remove('is-dragging');
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      if (zone.dataset.dropKind === 'image') handleImage({ target: { files: [file] } });
      else handleAudio({ target: { files: [file] } });
    });
  });
  controls.querySelector('#clear-source')?.addEventListener('click', () => {
    if (sampledImage?.url) URL.revokeObjectURL(sampledImage.url);
    sampledImage = null;
    sampledPaletteCandidates = [];
    analysisStatus.image = '';
    renderControls(); renderSourceEvidence();
  });
  controls.querySelector('#generate-feeling')?.addEventListener('click', () => {
    const input = controls.querySelector('#feeling-input');
    const status = controls.querySelector('#feeling-status');
    if (!input.value.trim()) {
      status.textContent = 'Describe a feeling before generating a palette.';
      input.focus();
      return;
    }
    const indices = feelingPalette(input.value);
    applyPalette(indices);
    showToast('Feeling mapped to colour');
  });
  controls.querySelector('#colour-search')?.addEventListener('input', (event) => {
    colourQuery = event.target.value;
    renderLedger();
  });
  controls.querySelector('#favourites-only')?.addEventListener('change', (event) => {
    favouriteOnly = event.target.checked;
    renderLedger();
  });
  controls.querySelector('#recipe-family')?.addEventListener('change', (event) => {
    recipeFilters.family = event.target.value;
    renderLedger();
  });
  controls.querySelector('#recipe-type')?.addEventListener('change', (event) => {
    recipeFilters.type = event.target.value;
    renderLedger();
  });
}

function applyPalette(indices) {
  const unique = [...new Set(indices)].slice(0, 5);
  if (unique.length < 2) return 0;
  state.stops = unique.map((color, index) => ({ color, position: Math.round(index / (unique.length - 1) * 100) }));
  state.gradientType = unique.length > 3 ? 'conic' : 'linear';
  commit();
  return unique.length;
}

function applySampledImagePalette() {
  let indices = [...sampledPaletteCandidates];
  if (state.imageSort === 'luminance') indices.sort((a, b) => luminance(COLORS[a].hex) - luminance(COLORS[b].hex));
  const selected = [...new Set(indices)].slice(0, state.imagePaletteCount);
  if (sampledImage) analysisStatus.image = `${selected.length} matched colours extracted from ${sampledImage.name}.`;
  return applyPalette(selected);
}

async function decodeImageFile(file) {
  try { return await createImageBitmap(file); }
  catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('decode failed'));
        element.src = url;
      });
      return image;
    } finally { URL.revokeObjectURL(url); }
  }
}

async function handleImage(event) {
  const file = event.target.files?.[0];
  const status = controls.querySelector('#image-status');
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    analysisStatus.image = 'Choose a PNG, JPG, WebP, GIF, AVIF, or SVG image.';
    status.textContent = analysisStatus.image;
    return;
  }
  status.textContent = 'Sampling image…';
  let bitmap;
  try {
    if (file.size > 30 * 1024 * 1024) throw new Error('image too large');
    bitmap = await decodeImageFile(file);
    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    if (!width || !height || width * height > 50_000_000) throw new Error('image dimensions too large');
    const sample = document.createElement('canvas');
    const ratio = Math.min(1, 180 / Math.max(width, height));
    sample.width = Math.max(1, Math.round(width * ratio));
    sample.height = Math.max(1, Math.round(height * ratio));
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(bitmap, 0, 0, sample.width, sample.height);
    const candidates = extractPaletteFromImage(sampleCtx.getImageData(0, 0, sample.width, sample.height), 5);
    if (candidates.length < 2) throw new Error('not enough opaque colour data');
    if (sampledImage?.url) URL.revokeObjectURL(sampledImage.url);
    sampledImage = { url: URL.createObjectURL(file), name: file.name, width, height };
    sampledPaletteCandidates = candidates;
    const applied = applySampledImagePalette();
    analysisStatus.image = `${applied} matched colours extracted from ${file.name}.`;
    renderControls();
  } catch {
    analysisStatus.image = 'That image could not be sampled. Try a supported image smaller than 30 MB and 50 megapixels.';
    if (status) status.textContent = analysisStatus.image;
  } finally {
    bitmap?.close?.();
  }
}

async function handleAudio(event) {
  const file = event.target.files?.[0];
  const status = controls.querySelector('#audio-status');
  if (!file) return;
  status.textContent = 'Analysing waveform…';
  let audioContext;
  try {
    if (file.size > 50 * 1024 * 1024) throw new Error('audio too large');
    audioContext = new AudioContext();
    const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    let energy = 0; let crossings = 0; let peak = 0; let samples = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      const stride = Math.max(1, Math.floor(data.length / 80000));
      let previous = data[0] || 0;
      for (let index = 0; index < data.length; index += stride) {
        const value = data[index];
        energy += value * value;
        peak = Math.max(peak, Math.abs(value));
        if ((value >= 0) !== (previous >= 0)) crossings += 1;
        previous = value;
        samples += 1;
      }
    }
    if (!samples) throw new Error('empty audio');
    const rms = Math.sqrt(energy / samples);
    const density = crossings / samples;
    const base = Math.floor(clamp(rms * 900, 0, 249));
    const spread = Math.max(17, Math.floor(density * 9000));
    analysisStatus.audio = `${file.name}: ${buffer.numberOfChannels} channel${buffer.numberOfChannels === 1 ? '' : 's'} · RMS ${rms.toFixed(3)} · peak ${peak.toFixed(3)} · density ${density.toFixed(3)}.`;
    applyPalette([base, (base + spread) % 250, Math.floor(peak * 249), (base + spread * 2) % 250]);
  } catch {
    analysisStatus.audio = 'That audio file could not be decoded. Try a supported file smaller than 50 MB.';
    if (status) status.textContent = analysisStatus.audio;
  } finally {
    if (audioContext && audioContext.state !== 'closed') await audioContext.close();
  }
}

controls.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.gradientType) { state.gradientType = target.dataset.gradientType; commit(); }
  if (target.hasAttribute('data-add-stop')) {
    const middle = state.stops[Math.floor(state.stops.length / 2)];
    state.stops.push({ color: (middle.color + 37) % COLORS.length, position: 50 });
    state.stops.sort((a, b) => a.position - b.position); commit();
  }
  if (target.dataset.removeStop != null && state.stops.length > 2) { state.stops.splice(Number(target.dataset.removeStop), 1); commit(); }
  if (target.dataset.openColour != null) {
    const stopIndex = Number(target.dataset.openColour);
    colourPicker(`Stop ${stopIndex + 1}`, (colour) => { state.stops[stopIndex].color = colour; commit(); });
  }
  if (target.hasAttribute('data-open-mono')) colourPicker('Monochrome base', (colour) => { state.monoBase = colour; commit(); });
  if (target.hasAttribute('data-open-harmony')) colourPicker('Harmony base', (colour) => { state.monoBase = colour; commit(); });
  if (target.hasAttribute('data-reverse-stops')) {
    state.stops = state.stops.map((stop) => ({ ...stop, position: 100 - stop.position })).reverse();
    commit();
  }
  if (target.hasAttribute('data-distribute-stops')) {
    state.stops = state.stops.map((stop, index) => ({ ...stop, position: Math.round(index / Math.max(1, state.stops.length - 1) * 100) }));
    commit();
  }
  if (target.dataset.cubeDirection) { state.cubeDirection = Number(target.dataset.cubeDirection); commit(); }
  if (target.dataset.sourceType) { state.sourceType = target.dataset.sourceType; commit(); }
  if (target.dataset.planeSpace) { state.planeSpace = target.dataset.planeSpace; state.planeSelected = null; commit(); }
  if (target.hasAttribute('data-swap-contrast')) {
    const first = state.stops[0].color;
    state.stops[0].color = state.stops.at(-1).color;
    state.stops.at(-1).color = first;
    commit();
  }
  if (target.dataset.recipeStep) { state.recipe = (state.recipe + Number(target.dataset.recipeStep) + RECIPES.length) % RECIPES.length; commit(); }
  if (target.hasAttribute('data-use-recipe')) {
    const recipe = RECIPES[state.recipe];
    state.stops = structuredClone(recipe.stops); state.gradientType = recipe.type; state.angle = recipe.angle; state.centerX = recipe.centerX; state.centerY = recipe.centerY; state.mode = 'make'; commit();
  }
  if (target.hasAttribute('data-plane-use') && state.planeSelected != null) { state.stops[1].color = state.planeSelected; state.mode = 'make'; commit(); }
});

document.querySelector('.mode-rail').addEventListener('click', (event) => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  state.mode = button.dataset.mode;
  commit();
  animateStageChange();
});
const modeRail = document.querySelector('.mode-list');
const modeIndexDialog = document.querySelector('#mode-index-dialog');
document.querySelector('#open-mode-index').addEventListener('click', () => modeIndexDialog.showModal());
document.querySelector('#close-mode-index').addEventListener('click', () => modeIndexDialog.close());
modeIndexDialog.addEventListener('click', (event) => {
  if (event.target === modeIndexDialog) { modeIndexDialog.close(); return; }
  const button = event.target.closest('[data-mode-index]');
  if (!button) return;
  state.mode = button.dataset.modeIndex;
  modeIndexDialog.close();
  commit();
  animateStageChange();
});
function revealActiveMode() {
  const active = modeRail.querySelector('.is-active');
  if (!active) return;
  const railRect = modeRail.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  if (innerWidth <= 680) {
    if (activeRect.left < railRect.left) modeRail.scrollLeft = Math.floor(modeRail.scrollLeft + activeRect.left - railRect.left);
    else if (activeRect.right > railRect.right) modeRail.scrollLeft = Math.ceil(modeRail.scrollLeft + activeRect.right - railRect.right);
  } else {
    if (activeRect.top < railRect.top) modeRail.scrollTop = Math.floor(modeRail.scrollTop + activeRect.top - railRect.top);
    else if (activeRect.bottom > railRect.bottom) modeRail.scrollTop = Math.ceil(modeRail.scrollTop + activeRect.bottom - railRect.bottom);
  }
  updateModeContinuation();
}
function updateModeContinuation() {
  const remaining = innerWidth <= 680
    ? modeRail.scrollWidth - modeRail.clientWidth - modeRail.scrollLeft
    : modeRail.scrollHeight - modeRail.clientHeight - modeRail.scrollTop;
  modeRail.classList.toggle('at-end', remaining <= 4);
}
modeRail.addEventListener('scroll', updateModeContinuation, { passive: true });
window.addEventListener('resize', updateModeContinuation);

ledger.addEventListener('click', (event) => {
  const recipeButton = event.target.closest('[data-recipe]');
  if (recipeButton) { state.recipe = Number(recipeButton.dataset.recipe); commit(); return; }
  const colourButton = event.target.closest('[data-colour]');
  if (colourButton) { state.stops[1].color = Number(colourButton.dataset.colour); state.mode = 'make'; commit(); return; }
  const copyButton = event.target.closest('[data-copy-colour]');
  if (copyButton) {
    const colour = COLORS[Number(copyButton.dataset.copyColour)];
    navigator.clipboard.writeText(colour.hex).then(() => showToast(`${colour.hex} copied`)).catch(() => showToast('Copy blocked'));
    return;
  }
  const favouriteButton = event.target.closest('[data-favourite]');
  if (favouriteButton) {
    const index = Number(favouriteButton.dataset.favourite);
    if (favourites.has(index)) favourites.delete(index); else favourites.add(index);
    persist(); renderLedger();
  }
});

function mutate() {
  const seed = (Date.now() >>> 5) % RECIPES.length;
  if (state.mode === 'catalogue') return;
  if (state.mode === 'traditional') {
    const matches = RECIPES.map((recipe, index) => ({ recipe, index })).filter(({ recipe }) => (
      (recipeFilters.family === 'all' || recipe.family === recipeFilters.family)
      && (recipeFilters.type === 'all' || recipe.type === recipeFilters.type)
    ));
    if (matches.length) state.recipe = matches[(seed + state.recipe) % matches.length].index;
  } else if (state.mode === 'mono') {
    state.monoBase = (state.monoBase + seed + 17) % COLORS.length;
    state.monoDark = 35 + seed % 45;
    state.monoLight = 35 + (seed * 3) % 50;
  } else if (state.mode === 'plane') {
    state.planeRotation.x = clamp(state.planeRotation.x + ((seed % 9) - 4) * 0.11, -1.4, 1.4);
    state.planeRotation.y += 0.37 + (seed % 7) * 0.09;
    state.planeSelected = null;
  } else if (state.mode === 'harmony') {
    state.monoBase = (state.monoBase + seed * 7 + 29) % COLORS.length;
    state.harmonyScheme = HARMONY_SCHEMES[(HARMONY_SCHEMES.indexOf(state.harmonyScheme) + 1 + seed) % HARMONY_SCHEMES.length];
    state.harmonySpread = 18 + seed % 65;
  } else if (state.mode === 'contrast') {
    const baseIndex = (seed * 17 + state.stops[0].color) % COLORS.length;
    const base = COLORS[baseIndex];
    const opposite = COLORS.reduce((best, colour, index) => {
      const ratio = contrastRatio(base.hex, colour.hex);
      return ratio > best.ratio ? { index, ratio } : best;
    }, { index: 0, ratio: 0 });
    state.stops[0].color = baseIndex;
    state.stops.at(-1).color = opposite.index;
  } else {
    const recipe = RECIPES[(seed + state.angle) % RECIPES.length];
    state.stops = structuredClone(recipe.stops);
    state.angle = recipe.angle;
    state.centerX = recipe.centerX;
    state.centerY = recipe.centerY;
    if (state.mode === 'make' || state.mode === 'image') state.gradientType = recipe.type;
    if (state.mode === 'air') {
      state.airSpread = 40 + seed % 55;
      state.airStrength = 45 + (seed * 3) % 50;
    }
    if (state.mode === 'dither') {
      state.pattern = DITHER_PATTERNS[seed % DITHER_PATTERNS.length];
      state.ditherScale = 1 + seed % 8;
      state.ditherBias = seed % 31 - 15;
    }
    if (state.mode === 'cube') {
      state.cubeCount = 7 + seed % 17;
      state.cubeDirection *= -1;
      state.cubePhase = (state.cubePhase + 0.17 + seed / 100) % 1;
    }
    if (state.mode === 'bands') {
      state.bandScale = 10 + seed % 50;
      state.bandGap = seed % 45;
      state.bandOffset = (state.bandOffset + 17 + seed) % 101;
    }
  }
  commit();
  animateStageChange();
  showToast(`${MODE_LABELS[state.mode]} mutated`);
}

document.querySelector('#randomise').addEventListener('click', mutate);
document.querySelector('#undo').addEventListener('click', () => travelHistory(-1));
document.querySelector('#redo').addEventListener('click', () => travelHistory(1));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && mobileExportQuery.matches && !exportPanel.hidden && !exportPanel.inert) {
    const focusable = [...exportPanel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !exportPanel.contains(document.activeElement))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !exportPanel.contains(document.activeElement))) {
      event.preventDefault();
      first?.focus();
    }
    return;
  }
  if (event.key === 'Escape' && !document.querySelector('#export-panel').hidden) {
    event.preventDefault();
    toggleExport(false);
    return;
  }
  const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); travelHistory(event.shiftKey ? 1 : -1); return;
  }
  if (editing || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key.toLowerCase() === 'm') { event.preventDefault(); mutate(); }
  if (event.key.toLowerCase() === 'e') { event.preventDefault(); toggleExport(true); }
  if (/^[1-9]$/.test(event.key)) {
    state.mode = MODES[Number(event.key) - 1];
    commit();
    animateStageChange();
  }
  if (event.key === '[' || event.key === ']') {
    const direction = event.key === '[' ? -1 : 1;
    state.mode = MODES[(MODES.indexOf(state.mode) + direction + MODES.length) % MODES.length];
    commit();
    animateStageChange();
  }
});
document.querySelector('#share-state').addEventListener('click', async () => {
  persist();
  try { await navigator.clipboard.writeText(location.href); showToast('State URL copied'); }
  catch { showToast('Copy blocked — use the address bar'); }
});

function updateExportAvailability() {
  const cssButton = document.querySelector('[data-export="css"]');
  const cssSupported = !['air', 'dither', 'cube', 'plane', 'catalogue'].includes(state.mode);
  cssButton.disabled = !cssSupported;
  cssButton.title = cssSupported ? 'Copy CSS background' : `${MODE_LABELS[state.mode]} has no faithful CSS equivalent`;
  const rasterBackedSvg = ['dither', 'air', 'cube', 'plane', 'catalogue', 'bands', 'contrast'].includes(state.mode) || state.gradientType === 'conic';
  document.querySelector('#export-note').textContent = rasterBackedSvg
    ? 'Raster exports render locally. SVG embeds the current rendered frame for this mode. No source leaves this browser.'
    : 'Raster and vector exports render locally. No source leaves this browser.';
}

function lockExportBackground() {
  if (document.body.classList.contains('export-sheet-open')) return;
  const lockedScroll = window.scrollY;
  document.body.dataset.exportScroll = String(lockedScroll);
  document.body.style.setProperty('--export-lock-y', `${-lockedScroll}px`);
  document.body.classList.add('export-sheet-open');
}

function unlockExportBackground() {
  if (!document.body.classList.contains('export-sheet-open')) return;
  const lockedScroll = Number(document.body.dataset.exportScroll) || 0;
  document.body.classList.remove('export-sheet-open');
  document.body.style.removeProperty('--export-lock-y');
  delete document.body.dataset.exportScroll;
  window.scrollTo(0, lockedScroll);
}

function finishExportClose(transitionId) {
  if (transitionId !== exportTransitionId || exportTrigger.getAttribute('aria-expanded') === 'true') return;
  unlockExportBackground();
  exportPanel.hidden = true;
  exportPanel.inert = false;
  exportScrim.hidden = true;
  exportPanel.removeAttribute('role');
  exportPanel.removeAttribute('aria-modal');
}

function toggleExport(open) {
  const mobile = mobileExportQuery.matches;
  const transitionId = ++exportTransitionId;
  exportPanel.getAnimations().forEach((animation) => animation.cancel());
  exportScrim.getAnimations().forEach((animation) => animation.cancel());
  exportTrigger.setAttribute('aria-expanded', String(open));

  if (open) {
    exportPanel.hidden = false;
    exportPanel.inert = false;
    updateExportAvailability();
    if (mobile) {
      exportPanel.setAttribute('role', 'dialog');
      exportPanel.setAttribute('aria-modal', 'true');
      exportScrim.hidden = false;
      lockExportBackground();
    } else {
      exportPanel.removeAttribute('role');
      exportPanel.removeAttribute('aria-modal');
      exportScrim.hidden = true;
      unlockExportBackground();
    }
    if (!reducedMotionQuery.matches) {
      exportPanel.animate([
        { opacity: 0, transform: mobile ? 'translateY(12px)' : 'translateY(-6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: mobile ? 200 : 180, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      if (mobile) exportScrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' });
    }
    const focusTarget = mobile ? document.querySelector('#close-export') : exportPanel.querySelector('input');
    focusTarget.focus({ preventScroll: true });
    return;
  }

  exportPanel.inert = true;
  exportTrigger.focus({ preventScroll: true });
  if (mobile && !exportPanel.hidden && !reducedMotionQuery.matches) {
    const panelAnimation = exportPanel.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(12px)' },
    ], { duration: 140, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'both' });
    const scrimAnimation = exportScrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'linear', fill: 'both' });
    Promise.allSettled([panelAnimation.finished, scrimAnimation.finished]).then(() => finishExportClose(transitionId));
  } else finishExportClose(transitionId);
}

document.querySelector('#open-export').addEventListener('click', () => toggleExport(exportTrigger.getAttribute('aria-expanded') !== 'true'));
document.querySelector('#close-export').addEventListener('click', () => toggleExport(false));
exportScrim.addEventListener('click', () => toggleExport(false));
mobileExportQuery.addEventListener('change', () => {
  if (!exportPanel.hidden) toggleExport(false);
});
function fitPreviewFrame() {
  const stageColumn = previewStage.closest('.stage-column');
  const stageStyle = getComputedStyle(stageColumn);
  const availableWidth = stageColumn.clientWidth - parseFloat(stageStyle.paddingLeft) - parseFloat(stageStyle.paddingRight);
  const specimenRegister = document.querySelector('#specimen-register');
  const occupiedHeight = document.querySelector('.stage-caption').offsetHeight + (specimenRegister.hidden ? 0 : specimenRegister.offsetHeight);
  const availableHeight = stageColumn.clientHeight - parseFloat(stageStyle.paddingTop) - parseFloat(stageStyle.paddingBottom) - occupiedHeight;
  const widthInput = Number(document.querySelector('#export-width').value);
  const heightInput = Number(document.querySelector('#export-height').value);
  const ratio = Number.isFinite(widthInput / heightInput) && heightInput > 0 ? widthInput / heightInput : 16 / 9;
  const width = Math.max(120, Math.min(availableWidth, Math.max(80, availableHeight) * ratio));
  const height = width / ratio;
  previewStage.style.width = `${Math.floor(width)}px`;
  previewStage.style.height = `${Math.floor(height)}px`;
}

function updatePreviewAspect() {
  const width = Number(document.querySelector('#export-width').value);
  const height = Number(document.querySelector('#export-height').value);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  previewStage.style.setProperty('--frame-ratio', `${clamp(width, 64, 4096)} / ${clamp(height, 64, 4096)}`);
  fitPreviewFrame();
}
document.querySelectorAll('#export-width, #export-height').forEach((input) => input.addEventListener('input', updatePreviewAspect));
document.querySelectorAll('[data-export-size]').forEach((button) => {
  button.addEventListener('click', () => {
    const [width, height] = button.dataset.exportSize.split('x');
    document.querySelector('#export-width').value = width;
    document.querySelector('#export-height').value = height;
    updatePreviewAspect();
    showToast(`${button.textContent.trim()} export size selected`);
  });
});

function renderExportCanvas(width, height, labels) {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const outputCtx = output.getContext('2d', { willReadFrequently: true });
  renderPreview(outputCtx, state, width, labels ? height - Math.max(54, height * 0.08) : height, performance.now());
  if (labels) {
    const labelHeight = Math.max(54, height * 0.08);
    outputCtx.fillStyle = '#F1EFE8';
    outputCtx.fillRect(0, height - labelHeight, width, labelHeight);
    outputCtx.fillStyle = '#171714';
    outputCtx.font = `${Math.max(13, width * 0.012)}px ui-monospace, monospace`;
    outputCtx.textBaseline = 'middle';
    const cssSupported = !['air', 'dither', 'cube', 'plane', 'catalogue'].includes(state.mode);
    const descriptor = cssSupported ? cssForState(state).slice(0, 110) : document.querySelector('#caption-mode').textContent;
    outputCtx.fillText(`BOKASHI / ${MODE_LABELS[state.mode].toUpperCase()} / ${descriptor}`, width * 0.025, height - labelHeight / 2);
  }
  return output;
}

function downloadBlob(blob, extension) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `bokashi-${MODE_LABELS[state.mode].toLowerCase().replaceAll(' ', '-')}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function svgForCurrent(canvasOutput, width, height, labels) {
  const recipe = state.mode === 'traditional' ? RECIPES[state.recipe] : state;
  const type = recipe.type ?? state.gradientType;
  const standard = !labels && !['dither', 'air', 'cube', 'plane', 'catalogue', 'bands', 'contrast'].includes(state.mode) && type !== 'conic';
  if (!standard) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="100%" height="100%" href="${canvasOutput.toDataURL('image/png')}"/></svg>`;
  const stops = getModeStops(state).map((stop) => `<stop offset="${stop.position}%" stop-color="${stop.hex ?? COLORS[stop.color].hex}"/>`).join('');
  const centerX = width * ((recipe.centerX ?? state.centerX) / 100);
  const centerY = height * ((recipe.centerY ?? state.centerY) / 100);
  if (type === 'radial') {
    const radius = Math.max(
      Math.hypot(centerX, centerY), Math.hypot(width - centerX, centerY),
      Math.hypot(centerX, height - centerY), Math.hypot(width - centerX, height - centerY),
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${centerX}" cy="${centerY}" r="${radius}">${stops}</radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  }
  const radians = ((recipe.angle ?? state.angle) - 90) * Math.PI / 180;
  const directionX = Math.cos(radians); const directionY = Math.sin(radians);
  const length = Math.abs(width * directionX) + Math.abs(height * directionY);
  const x = directionX * length / 2; const y = directionY * length / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${width / 2 - x}" y1="${height / 2 - y}" x2="${width / 2 + x}" y2="${height / 2 + y}">${stops}</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
}

document.querySelector('.export-grid').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-export]');
  if (!button) return;
  const width = clamp(document.querySelector('#export-width').value, 64, 4096);
  const height = clamp(document.querySelector('#export-height').value, 64, 4096);
  const labels = document.querySelector('#export-labels').checked;
  const format = button.dataset.export;
  const pixelCount = width * height;
  const heavyRaster = format === 'tiff' || ['air', 'dither', 'cube', 'plane', 'catalogue'].includes(state.mode);
  if (heavyRaster && pixelCount > 8_500_000) {
    showToast('This mode is capped at roughly 4K to prevent tab exhaustion');
    return;
  }
  button.disabled = true;
  button.textContent = '…';
  try {
    if (format === 'css') {
      await navigator.clipboard.writeText(`background: ${cssForState(state)};`);
      showToast('CSS copied');
    } else if (format === 'json') {
      const cssSupported = !['air', 'dither', 'cube', 'plane', 'catalogue'].includes(state.mode);
      downloadBlob(new Blob([JSON.stringify({ app: 'BOKASHI', version: 1, state, css: cssSupported ? cssForState(state) : null, cssSupported, source: 'xiaohk/nippon-colors MIT' }, null, 2)], { type: 'application/json' }), 'json');
    } else {
      const output = renderExportCanvas(width, height, labels);
      if (format === 'svg') downloadBlob(new Blob([svgForCurrent(output, width, height, labels)], { type: 'image/svg+xml' }), 'svg');
      else if (format === 'tiff') downloadBlob(rgbaToTiff(output.getContext('2d').getImageData(0, 0, width, height)), 'tiff');
      else {
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise((resolve) => output.toBlob(resolve, mime, 0.94));
        downloadBlob(blob, format);
      }
      showToast(`${format.toUpperCase()} exported`);
    }
  } catch { showToast(`${format.toUpperCase()} export failed`); }
  finally { button.disabled = false; button.textContent = format.toUpperCase(); }
});

previewStage.addEventListener('pointerdown', (event) => {
  const stopHandle = event.target.closest('[data-stage-stop]');
  const centerHandle = event.target.closest('[data-stage-center]');
  if (stopHandle || centerHandle) {
    event.preventDefault();
    stageDrag = stopHandle
      ? { type: 'stop', index: Number(stopHandle.dataset.stageStop) }
      : { type: 'center' };
    previewStage.setPointerCapture(event.pointerId);
    return;
  }
  if (state.mode !== 'plane') return;
  dragStart = { x: event.clientX, y: event.clientY, rotation: { ...state.planeRotation } };
  previewStage.setPointerCapture(event.pointerId);
});
previewStage.addEventListener('pointermove', (event) => {
  if (stageDrag) {
    const rect = previewStage.getBoundingClientRect();
    if (stageDrag.type === 'center') {
      state.centerX = Math.round(clamp((event.clientX - rect.left) / rect.width * 100, 0, 100));
      state.centerY = Math.round(clamp((event.clientY - rect.top) / rect.height * 100, 0, 100));
    } else {
      const index = stageDrag.index;
      const trackRect = previewStage.querySelector('.stage-stop-track').getBoundingClientRect();
      const minimum = index > 0 ? state.stops[index - 1].position : 0;
      const maximum = index < state.stops.length - 1 ? state.stops[index + 1].position : 100;
      state.stops[index].position = Math.round(clamp((event.clientX - trackRect.left) / trackRect.width * 100, minimum, maximum));
    }
    persist(); renderCanvas(); renderStageDirectControls();
    return;
  }
  if (!dragStart || state.mode !== 'plane') return;
  state.planeRotation.y = dragStart.rotation.y + (event.clientX - dragStart.x) * 0.008;
  state.planeRotation.x = clamp(dragStart.rotation.x + (event.clientY - dragStart.y) * 0.008, -1.4, 1.4);
  renderCanvas();
});
previewStage.addEventListener('pointerup', (event) => {
  if (stageDrag) {
    stageDrag = null;
    recordHistory(); persist(); renderControls(); renderStageDirectControls();
    return;
  }
  if (state.mode === 'catalogue') {
    const rect = canvas.getBoundingClientRect();
    const columns = canvas.width >= canvas.height ? 25 : 10;
    const rows = Math.ceil(COLORS.length / columns);
    const column = clamp(Math.floor((event.clientX - rect.left) / rect.width * columns), 0, columns - 1);
    const row = clamp(Math.floor((event.clientY - rect.top) / rect.height * rows), 0, rows - 1);
    const gridIndex = row * columns + column;
    const index = sortColourIndices(state.catalogueSort)[gridIndex];
    if (index != null) {
      state.stops[1].color = index;
      state.mode = 'make';
      commit();
      showToast(`${COLORS[index].romaji} opened in maker`);
    }
    return;
  }
  if (state.mode !== 'plane') return;
  const moved = dragStart && Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 5;
  dragStart = null;
  if (!moved) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    const nearest = planePoints.reduce((best, point) => {
      const distance = Math.hypot(point.x - x, point.y - y);
      return distance < best.distance ? { index: point.index, distance } : best;
    }, { index: null, distance: Infinity });
    if (nearest.distance < 28 * (canvas.width / rect.width)) state.planeSelected = nearest.index;
  }
  recordHistory(); persist(); renderCanvas(); renderControls();
});
document.querySelector('#stage-direct-controls').addEventListener('keydown', (event) => {
  const stopHandle = event.target.closest('[data-stage-stop]');
  const centerHandle = event.target.closest('[data-stage-center]');
  if (!stopHandle && !centerHandle) return;
  const delta = event.shiftKey ? 5 : 1;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  if (stopHandle) {
    const index = Number(stopHandle.dataset.stageStop);
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -delta : delta;
    const minimum = index > 0 ? state.stops[index - 1].position : 0;
    const maximum = index < state.stops.length - 1 ? state.stops[index + 1].position : 100;
    state.stops[index].position = clamp(state.stops[index].position + direction, minimum, maximum);
  } else {
    if (event.key === 'ArrowLeft') state.centerX = clamp(state.centerX - delta, 0, 100);
    if (event.key === 'ArrowRight') state.centerX = clamp(state.centerX + delta, 0, 100);
    if (event.key === 'ArrowUp') state.centerY = clamp(state.centerY - delta, 0, 100);
    if (event.key === 'ArrowDown') state.centerY = clamp(state.centerY + delta, 0, 100);
  }
  commit();
});
previewStage.addEventListener('keydown', (event) => {
  if (event.target.closest('[data-stage-stop], [data-stage-center]') || state.mode !== 'plane') return;
  const delta = event.shiftKey ? 0.2 : 0.08;
  if (event.key === 'ArrowLeft') state.planeRotation.y -= delta;
  else if (event.key === 'ArrowRight') state.planeRotation.y += delta;
  else if (event.key === 'ArrowUp') state.planeRotation.x = clamp(state.planeRotation.x - delta, -1.4, 1.4);
  else if (event.key === 'ArrowDown') state.planeRotation.x = clamp(state.planeRotation.x + delta, -1.4, 1.4);
  else if (event.key.toLowerCase() === 'n') state.planeSelected = ((state.planeSelected ?? -1) + 1) % COLORS.length;
  else if (event.key.toLowerCase() === 'p') state.planeSelected = ((state.planeSelected ?? 0) - 1 + COLORS.length) % COLORS.length;
  else if (event.key === 'Enter' || event.key === ' ') {
    const nearest = planePoints.reduce((best, point) => {
      const distance = Math.hypot(point.x - canvas.width / 2, point.y - canvas.height / 2);
      return distance < best.distance ? { index: point.index, distance } : best;
    }, { index: null, distance: Infinity });
    state.planeSelected = nearest.index;
  } else return;
  event.preventDefault();
  commit();
});

window.addEventListener('hashchange', () => {
  const next = location.hash.startsWith('#s=') ? tokenToState(location.hash.slice(3)) : null;
  if (next) { state = next; commit(); }
});
new ResizeObserver(resizeCanvas).observe(previewStage);
new ResizeObserver(fitPreviewFrame).observe(previewStage.closest('.stage-column'));
window.addEventListener('resize', fitPreviewFrame);
updateNav();
renderControls();
renderLedger();
renderStageDirectControls();
renderSourceEvidence();
updateHistoryButtons();
updateExportAvailability();
updatePreviewAspect();
updateModeContinuation();
resizeCanvas();
