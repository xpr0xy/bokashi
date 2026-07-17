import './style.css';
import { COLORS } from './colors.js';
import {
  DEFAULT_STATE, MODES, DITHER_PATTERNS, RECIPES, clamp, contrastText, cssForState,
  extractPaletteFromImage, feelingPalette, normaliseState, renderPreview, rgbaToTiff,
  stateToToken, tokenToState,
} from './core.js';

const MODE_LABELS = {
  make: 'Make', traditional: 'Recipes', mono: 'Mono', air: 'Air', dither: 'Dither',
  cube: 'Cube', image: 'Image', plane: '3D plane', catalogue: 'Colours',
};

const app = document.querySelector('#app');
const fromHash = location.hash.startsWith('#s=') ? tokenToState(location.hash.slice(3)) : null;
const fromStorage = (() => {
  try { return JSON.parse(localStorage.getItem('bokashi-state') || 'null'); } catch { return null; }
})();
let state = normaliseState(fromHash || fromStorage || DEFAULT_STATE);
let favourites = new Set(JSON.parse(localStorage.getItem('bokashi-favourites') || '[]'));
let selectedPlanePoint = null;
let planePoints = [];
let animationFrame = null;
let dragStart = null;
let toastTimer = null;

app.innerHTML = `
  <header class="masthead">
    <div class="brand-block">
      <p class="eyebrow">ぼかし / colour instrument</p>
      <h1>BOKASHI</h1>
    </div>
    <p class="masthead-note">Build, inspect, sample and export gradients from a source-attributed Japanese colour catalogue.</p>
    <div class="masthead-actions">
      <button class="quiet-button" id="randomise" type="button">Mutate</button>
      <button class="quiet-button" id="share-state" type="button">Copy state URL</button>
      <button class="ink-button" id="open-export" type="button" aria-expanded="false" aria-controls="export-panel">Export</button>
    </div>
  </header>
  <main id="workspace" class="workspace">
    <nav class="mode-rail" aria-label="Instrument modes">
      <p class="rail-index">MODE</p>
      ${MODES.map((mode, index) => `<button type="button" data-mode="${mode}"><span>${String(index + 1).padStart(2, '0')}</span>${MODE_LABELS[mode]}</button>`).join('')}
    </nav>
    <section class="stage-column" aria-label="Gradient output">
      <div class="preview-stage" id="preview-stage">
        <canvas id="preview" aria-label="Current gradient preview"></canvas>
        <div class="stage-crosshair" aria-hidden="true"></div>
      </div>
      <div class="stage-caption">
        <span id="caption-mode">MAKE / LINEAR</span>
        <span id="caption-stops">3 STOPS</span>
        <span id="caption-size">LIVE CANVAS</span>
      </div>
      <section class="ledger" id="ledger" aria-live="polite"></section>
    </section>
    <aside class="inspector" aria-label="Gradient controls">
      <div class="inspector-head">
        <p>CONTROL</p>
        <span id="mode-readout">MAKE</span>
      </div>
      <div id="controls"></div>
      <section class="export-panel" id="export-panel" hidden>
        <div class="section-heading"><h2>Export</h2><button type="button" id="close-export" aria-label="Close export panel">×</button></div>
        <div class="field-pair">
          <label>Width<input id="export-width" type="number" min="64" max="4096" step="64" value="1600"></label>
          <label>Height<input id="export-height" type="number" min="64" max="4096" step="64" value="1000"></label>
        </div>
        <label class="check-row"><input id="export-labels" type="checkbox"> Add specimen label</label>
        <div class="export-grid">
          ${['png', 'jpg', 'tiff', 'svg', 'css', 'json'].map((format) => `<button type="button" data-export="${format}">${format.toUpperCase()}</button>`).join('')}
        </div>
        <p class="microcopy">Raster exports render locally. No image leaves this browser.</p>
      </section>
    </aside>
  </main>
  <footer class="site-footer">
    <p>250 colours · 120 recipes · 9 instruments · 6 export formats</p>
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
}

function persist() {
  try {
    localStorage.setItem('bokashi-state', JSON.stringify(state));
    localStorage.setItem('bokashi-favourites', JSON.stringify([...favourites]));
  } catch {}
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${stateToToken(state)}`);
}

function updateNav() {
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelector('#mode-readout').textContent = MODE_LABELS[state.mode].toUpperCase();
}

function stopRows() {
  return state.stops.map((stop, index) => {
    const colour = COLORS[stop.color];
    return `<div class="stop-row" data-stop="${index}">
      <button class="swatch-button" type="button" data-open-colour="${index}" style="--swatch:${colour.hex};--swatch-text:${contrastText(colour.hex)}" aria-label="${colour.kanji}, choose colour for stop ${index + 1}">${colour.kanji}</button>
      <div><strong>${colour.romaji}</strong><code>${colour.hex}</code></div>
      <label>POS<input type="number" min="0" max="100" value="${Math.round(stop.position)}" data-stop-position="${index}"></label>
      <button type="button" data-remove-stop="${index}" aria-label="Remove stop ${index + 1}" ${state.stops.length <= 2 ? 'disabled' : ''}>×</button>
    </div>`;
  }).join('');
}

function commonGeometry() {
  return `<div class="control-group">
    <div class="section-heading"><h2>Geometry</h2><span>${state.angle}°</span></div>
    <div class="segmented" role="group" aria-label="Gradient type">
      ${['linear', 'radial', 'conic'].map((type) => `<button type="button" data-gradient-type="${type}" class="${state.gradientType === type ? 'is-active' : ''}">${type}</button>`).join('')}
    </div>
    <label>Angle <output>${state.angle}°</output><input type="range" min="0" max="360" value="${state.angle}" data-state="angle"></label>
    ${state.gradientType !== 'linear' ? `<div class="field-pair"><label>Center X<input type="number" min="0" max="100" value="${state.centerX}" data-state="centerX"></label><label>Center Y<input type="number" min="0" max="100" value="${state.centerY}" data-state="centerY"></label></div>` : ''}
  </div>`;
}

function makerControls(extra = '') {
  return `${commonGeometry()}
    <div class="control-group">
      <div class="section-heading"><h2>Stops</h2><button type="button" data-add-stop ${state.stops.length >= 5 ? 'disabled' : ''}>+ add</button></div>
      <div class="stop-list">${stopRows()}</div>
    </div>${extra}`;
}

function renderControls() {
  if (state.mode === 'make') controls.innerHTML = makerControls();
  else if (state.mode === 'traditional') {
    const recipe = RECIPES[state.recipe];
    controls.innerHTML = `<div class="control-group recipe-control">
      <p class="specimen-number">${recipe.id}</p>
      <h2>${recipe.family}</h2>
      <p>${recipe.type} / ${recipe.stops.length} colours / ${recipe.angle}°</p>
      <div class="button-pair"><button type="button" data-recipe-step="-1">Previous</button><button type="button" data-recipe-step="1">Next</button></div>
      <button type="button" data-use-recipe>Open in maker</button>
    </div>`;
  } else if (state.mode === 'mono') {
    const colour = COLORS[state.monoBase];
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Monochrome</h2><span>${colour.kanji}</span></div>
      <button class="colour-hero" data-open-mono type="button" style="--swatch:${colour.hex};--swatch-text:${contrastText(colour.hex)}"><strong>${colour.romaji}</strong><code>${colour.hex}</code></button>
      ${commonGeometry()}</div>`;
  } else if (state.mode === 'air') {
    controls.innerHTML = makerControls(`<div class="control-group"><div class="section-heading"><h2>Atmosphere</h2><span>${state.blur}px</span></div><label>Diffusion<input type="range" min="0" max="180" value="${state.blur}" data-state="blur"></label></div>`);
  } else if (state.mode === 'dither') {
    controls.innerHTML = `${commonGeometry()}<div class="control-group"><div class="section-heading"><h2>Two-colour matrix</h2><span>${state.pattern}</span></div><div class="stop-list">${stopRows()}</div><label>Pattern<select data-state="pattern">${DITHER_PATTERNS.map((pattern) => `<option ${pattern === state.pattern ? 'selected' : ''}>${pattern}</option>`).join('')}</select></label></div>`;
  } else if (state.mode === 'cube') {
    controls.innerHTML = `${makerControls()}<div class="control-group"><div class="section-heading"><h2>Sequence</h2><span>${state.cubeSpeed.toFixed(2)}×</span></div><label>Speed<input type="range" min="0.1" max="1.5" step="0.05" value="${state.cubeSpeed}" data-state="cubeSpeed"></label></div>`;
  } else if (state.mode === 'image') {
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Image sampler</h2><span>LOCAL</span></div><label class="drop-zone">Choose image<input id="image-input" type="file" accept="image/*"></label><p class="microcopy" id="image-status">Extract six dominant colours and match them to the catalogue.</p></div>
      <div class="control-group"><div class="section-heading"><h2>Feeling</h2><span>TEXT → COLOUR</span></div><label>Describe a feeling<textarea id="feeling-input" rows="3" placeholder="cold rain over dark cedar"></textarea></label><button type="button" id="generate-feeling">Generate palette</button></div>
      <div class="control-group"><div class="section-heading"><h2>Audio tone</h2><span>WAVEFORM</span></div><label class="drop-zone">Choose audio<input id="audio-input" type="file" accept="audio/*"></label><p class="microcopy" id="audio-status">Maps amplitude, density and transient shape to colour indices.</p></div>
      ${makerControls()}`;
  } else if (state.mode === 'plane') {
    const selected = selectedPlanePoint == null ? null : COLORS[selectedPlanePoint];
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Colour plane</h2><span>H / S / L</span></div><p>Drag the field to rotate. Use arrow keys when the field is focused. Select a point to inspect it.</p>${selected ? `<button class="colour-hero" type="button" data-plane-use style="--swatch:${selected.hex};--swatch-text:${contrastText(selected.hex)}"><span>${selected.kanji}</span><strong>${selected.romaji}</strong><code>${selected.hex}</code><small>Use in maker</small></button>` : '<p class="plane-empty">No point selected.</p>'}</div>`;
  } else {
    controls.innerHTML = `<div class="control-group"><div class="section-heading"><h2>Catalogue</h2><span>${COLORS.length}</span></div><label>Search<input id="colour-search" type="search" placeholder="kanji, romaji or #hex" autocomplete="off"></label><label class="check-row"><input id="favourites-only" type="checkbox"> Favourites only</label></div>`;
  }
  bindControlInputs();
}

function renderLedger(filter = '') {
  if (state.mode === 'traditional') {
    ledger.hidden = false;
    ledger.innerHTML = `<div class="ledger-head"><h2>Recipe ledger</h2><p>120 deterministic combinations. Open any recipe, then edit it freely.</p></div><div class="recipe-ledger">${RECIPES.map((recipe, index) => {
      const css = recipe.type === 'linear'
        ? `linear-gradient(${recipe.angle}deg, ${recipe.stops.map((stop) => `${COLORS[stop.color].hex} ${stop.position}%`).join(',')})`
        : recipe.type === 'radial'
          ? `radial-gradient(circle, ${recipe.stops.map((stop) => `${COLORS[stop.color].hex} ${stop.position}%`).join(',')})`
          : `conic-gradient(from ${recipe.angle}deg, ${recipe.stops.map((stop) => `${COLORS[stop.color].hex} ${stop.position}%`).join(',')})`;
      return `<button type="button" data-recipe="${index}" class="${index === state.recipe ? 'is-selected' : ''}"><span>${recipe.id}</span><i style="background:${css}"></i><strong>${recipe.family}</strong><small>${recipe.type}</small></button>`;
    }).join('')}</div>`;
  } else if (state.mode === 'catalogue') {
    ledger.hidden = false;
    const query = filter.trim().toLowerCase();
    const favouriteOnly = document.querySelector('#favourites-only')?.checked;
    const matches = COLORS.map((colour, index) => ({ colour, index })).filter(({ colour, index }) => {
      if (favouriteOnly && !favourites.has(index)) return false;
      return !query || `${colour.romaji} ${colour.kanji} ${colour.hex}`.toLowerCase().includes(query);
    });
    ledger.innerHTML = `<div class="ledger-head"><h2>Colour register</h2><p>${matches.length} of ${COLORS.length} shown. Select a row to load the colour into the maker.</p></div><div class="colour-ledger">${matches.map(({ colour, index }) => `<div class="colour-row"><button type="button" data-colour="${index}"><i style="--swatch:${colour.hex}"></i><span>${colour.kanji}</span><strong>${colour.romaji}</strong><code>${colour.hex}</code></button><button type="button" data-favourite="${index}" aria-label="${favourites.has(index) ? 'Remove' : 'Add'} ${colour.romaji} ${favourites.has(index) ? 'from' : 'to'} favourites">${favourites.has(index) ? '★' : '☆'}</button></div>`).join('')}</div>`;
  } else {
    ledger.hidden = true;
    ledger.innerHTML = '';
  }
}

function renderCaption() {
  const type = state.mode === 'traditional' ? RECIPES[state.recipe].type : state.gradientType;
  document.querySelector('#caption-mode').textContent = `${MODE_LABELS[state.mode].toUpperCase()} / ${type.toUpperCase()}`;
  document.querySelector('#caption-stops').textContent = `${state.mode === 'traditional' ? RECIPES[state.recipe].stops.length : state.stops.length} STOPS`;
  document.querySelector('#caption-size').textContent = `${canvas.width} × ${canvas.height}`;
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

function renderCanvas(time = performance.now()) {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  planePoints = renderPreview(ctx, state, canvas.width, canvas.height, time) || [];
  renderCaption();
  if (state.mode === 'cube' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    animationFrame = requestAnimationFrame(renderCanvas);
  }
}

function commit({ controlsOnly = false, ledgerOnly = false } = {}) {
  persist();
  updateNav();
  if (!ledgerOnly) renderControls();
  renderLedger();
  if (!controlsOnly) renderCanvas();
}

function colourPicker(title, onChoose) {
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
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}

function bindControlInputs() {
  controls.querySelectorAll('[data-state]').forEach((input) => {
    input.addEventListener('input', () => {
      state[input.dataset.state] = input.type === 'range' || input.type === 'number' ? Number(input.value) : input.value;
      persist();
      renderCanvas();
      const output = input.closest('label')?.querySelector('output');
      if (output) output.textContent = `${input.value}°`;
    });
    input.addEventListener('change', () => renderControls());
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
  controls.querySelector('#generate-feeling')?.addEventListener('click', () => {
    const indices = feelingPalette(controls.querySelector('#feeling-input').value);
    applyPalette(indices);
    showToast('Feeling mapped to colour');
  });
  controls.querySelector('#colour-search')?.addEventListener('input', (event) => renderLedger(event.target.value));
  controls.querySelector('#favourites-only')?.addEventListener('change', () => renderLedger(controls.querySelector('#colour-search').value));
}

function applyPalette(indices) {
  const unique = [...new Set(indices)].slice(0, 5);
  if (unique.length < 2) return;
  state.stops = unique.map((color, index) => ({ color, position: Math.round(index / (unique.length - 1) * 100) }));
  state.gradientType = unique.length > 3 ? 'conic' : 'linear';
  commit();
}

async function handleImage(event) {
  const file = event.target.files?.[0];
  const status = controls.querySelector('#image-status');
  if (!file) return;
  if (!file.type.startsWith('image/')) { status.textContent = 'Choose a PNG, JPG, WebP, GIF, or other browser-readable image.'; return; }
  status.textContent = 'Sampling image…';
  try {
    const bitmap = await createImageBitmap(file);
    const sample = document.createElement('canvas');
    const ratio = Math.min(1, 180 / Math.max(bitmap.width, bitmap.height));
    sample.width = Math.max(1, Math.round(bitmap.width * ratio));
    sample.height = Math.max(1, Math.round(bitmap.height * ratio));
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(bitmap, 0, 0, sample.width, sample.height);
    const indices = extractPaletteFromImage(sampleCtx.getImageData(0, 0, sample.width, sample.height));
    applyPalette(indices);
    controls.querySelector('#image-status').textContent = `${indices.length} matched colours extracted from ${file.name}.`;
  } catch {
    status.textContent = 'The browser could not decode that image. The previous gradient is unchanged.';
  }
}

async function handleAudio(event) {
  const file = event.target.files?.[0];
  const status = controls.querySelector('#audio-status');
  if (!file) return;
  status.textContent = 'Analysing waveform…';
  try {
    const audioContext = new AudioContext();
    const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    const data = buffer.getChannelData(0);
    const stride = Math.max(1, Math.floor(data.length / 80000));
    let energy = 0; let crossings = 0; let peak = 0; let previous = 0;
    for (let index = 0; index < data.length; index += stride) {
      const value = data[index];
      energy += value * value;
      peak = Math.max(peak, Math.abs(value));
      if ((value >= 0) !== (previous >= 0)) crossings += 1;
      previous = value;
    }
    const samples = Math.ceil(data.length / stride);
    const rms = Math.sqrt(energy / samples);
    const density = crossings / samples;
    const base = Math.floor(clamp(rms * 900, 0, 249));
    const spread = Math.max(17, Math.floor(density * 9000));
    applyPalette([base, (base + spread) % 250, Math.floor(peak * 249), (base + spread * 2) % 250]);
    controls.querySelector('#audio-status').textContent = `${file.name}: RMS ${rms.toFixed(3)} / transient ${peak.toFixed(3)}.`;
    await audioContext.close();
  } catch {
    status.textContent = 'The browser could not decode that audio file. The previous gradient is unchanged.';
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
  if (target.dataset.recipeStep) { state.recipe = (state.recipe + Number(target.dataset.recipeStep) + RECIPES.length) % RECIPES.length; commit(); }
  if (target.hasAttribute('data-use-recipe')) {
    const recipe = RECIPES[state.recipe];
    state.stops = structuredClone(recipe.stops); state.gradientType = recipe.type; state.angle = recipe.angle; state.centerX = recipe.centerX; state.centerY = recipe.centerY; state.mode = 'make'; commit();
  }
  if (target.hasAttribute('data-plane-use') && selectedPlanePoint != null) { state.stops[1].color = selectedPlanePoint; state.mode = 'make'; commit(); }
});

document.querySelector('.mode-rail').addEventListener('click', (event) => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  state.mode = button.dataset.mode;
  commit();
});

ledger.addEventListener('click', (event) => {
  const recipeButton = event.target.closest('[data-recipe]');
  if (recipeButton) { state.recipe = Number(recipeButton.dataset.recipe); commit(); previewStage.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const colourButton = event.target.closest('[data-colour]');
  if (colourButton) { state.stops[1].color = Number(colourButton.dataset.colour); state.mode = 'make'; commit(); previewStage.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const favouriteButton = event.target.closest('[data-favourite]');
  if (favouriteButton) {
    const index = Number(favouriteButton.dataset.favourite);
    if (favourites.has(index)) favourites.delete(index); else favourites.add(index);
    persist(); renderLedger(controls.querySelector('#colour-search')?.value || '');
  }
});

function mutate() {
  const next = (Date.now() >>> 5) % RECIPES.length;
  const recipe = RECIPES[next];
  state.stops = structuredClone(recipe.stops);
  state.angle = recipe.angle;
  state.centerX = recipe.centerX;
  state.centerY = recipe.centerY;
  if (!['plane', 'catalogue', 'image'].includes(state.mode)) state.gradientType = recipe.type;
  commit();
  showToast('Gradient mutated');
}

document.querySelector('#randomise').addEventListener('click', mutate);
document.querySelector('#share-state').addEventListener('click', async () => {
  persist();
  try { await navigator.clipboard.writeText(location.href); showToast('State URL copied'); }
  catch { showToast('Copy blocked — use the address bar'); }
});

function toggleExport(open) {
  const panel = document.querySelector('#export-panel');
  panel.hidden = !open;
  document.querySelector('#open-export').setAttribute('aria-expanded', String(open));
  if (open) panel.querySelector('input').focus();
}

document.querySelector('#open-export').addEventListener('click', () => toggleExport(document.querySelector('#export-panel').hidden));
document.querySelector('#close-export').addEventListener('click', () => toggleExport(false));

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
    outputCtx.fillText(`BOKASHI / ${MODE_LABELS[state.mode].toUpperCase()} / ${cssForState(state).slice(0, 110)}`, width * 0.025, height - labelHeight / 2);
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

function svgForCurrent(canvasOutput, width, height) {
  const standard = !['dither', 'air', 'cube', 'plane'].includes(state.mode) && state.gradientType !== 'conic';
  if (!standard) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="100%" height="100%" href="${canvasOutput.toDataURL('image/png')}"/></svg>`;
  const stops = state.stops.map((stop) => `<stop offset="${stop.position}%" stop-color="${COLORS[stop.color].hex}"/>`).join('');
  if (state.gradientType === 'radial') return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><radialGradient id="g" cx="${state.centerX}%" cy="${state.centerY}%">${stops}</radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  const radians = (state.angle - 90) * Math.PI / 180;
  const x = Math.cos(radians) * 50; const y = Math.sin(radians) * 50;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="${50 - x}%" y1="${50 - y}%" x2="${50 + x}%" y2="${50 + y}%">${stops}</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
}

document.querySelector('.export-grid').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-export]');
  if (!button) return;
  const width = clamp(document.querySelector('#export-width').value, 64, 4096);
  const height = clamp(document.querySelector('#export-height').value, 64, 4096);
  const labels = document.querySelector('#export-labels').checked;
  const format = button.dataset.export;
  button.disabled = true;
  button.textContent = '…';
  try {
    if (format === 'css') {
      await navigator.clipboard.writeText(`background: ${cssForState(state)};`);
      showToast('CSS copied');
    } else if (format === 'json') {
      downloadBlob(new Blob([JSON.stringify({ app: 'BOKASHI', version: 1, state, css: cssForState(state), source: 'xiaohk/nippon-colors MIT' }, null, 2)], { type: 'application/json' }), 'json');
    } else {
      const output = renderExportCanvas(width, height, labels);
      if (format === 'svg') downloadBlob(new Blob([svgForCurrent(output, width, height)], { type: 'image/svg+xml' }), 'svg');
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

previewStage.tabIndex = 0;
previewStage.addEventListener('pointerdown', (event) => {
  if (state.mode !== 'plane') return;
  dragStart = { x: event.clientX, y: event.clientY, rotation: { ...state.planeRotation } };
  previewStage.setPointerCapture(event.pointerId);
});
previewStage.addEventListener('pointermove', (event) => {
  if (!dragStart || state.mode !== 'plane') return;
  state.planeRotation.y = dragStart.rotation.y + (event.clientX - dragStart.x) * 0.008;
  state.planeRotation.x = clamp(dragStart.rotation.x + (event.clientY - dragStart.y) * 0.008, -1.4, 1.4);
  renderCanvas();
});
previewStage.addEventListener('pointerup', (event) => {
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
    if (nearest.distance < 28 * (canvas.width / rect.width)) { selectedPlanePoint = nearest.index; renderControls(); }
  }
  persist();
});
previewStage.addEventListener('keydown', (event) => {
  if (state.mode !== 'plane') return;
  const delta = event.shiftKey ? 0.2 : 0.08;
  if (event.key === 'ArrowLeft') state.planeRotation.y -= delta;
  else if (event.key === 'ArrowRight') state.planeRotation.y += delta;
  else if (event.key === 'ArrowUp') state.planeRotation.x = clamp(state.planeRotation.x - delta, -1.4, 1.4);
  else if (event.key === 'ArrowDown') state.planeRotation.x = clamp(state.planeRotation.x + delta, -1.4, 1.4);
  else return;
  event.preventDefault(); renderCanvas(); persist();
});

window.addEventListener('hashchange', () => {
  const next = location.hash.startsWith('#s=') ? tokenToState(location.hash.slice(3)) : null;
  if (next) { state = next; commit(); }
});
new ResizeObserver(resizeCanvas).observe(previewStage);
updateNav();
renderControls();
renderLedger();
resizeCanvas();
