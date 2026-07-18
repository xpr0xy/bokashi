import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS } from '../src/colors.js';
import {
  DEFAULT_STATE, MODES, RECIPES, clamp, contrastRatio, createRecipes, cssForState, extractPaletteFromImage,
  feelingPalette, harmonyPalette, nearestColour, normaliseState, renderPreview, rgbaToTiff, stateToToken, tokenToState,
} from '../src/core.js';

test('catalogue and recipe inventory are complete', () => {
  assert.equal(COLORS.length, 250);
  assert.equal(RECIPES.length, 120);
  assert.deepEqual(createRecipes(3), createRecipes(3));
});

test('state tokens round-trip core controls and plane state', () => {
  const state = normaliseState({
    ...DEFAULT_STATE,
    mode: 'plane',
    angle: 277,
    pattern: 'cross',
    planeRotation: { x: 0.417, y: -1.205 },
    planeSelected: 143,
  });
  const restored = tokenToState(stateToToken(state));
  assert.equal(restored.mode, 'plane');
  assert.equal(restored.angle, 277);
  assert.equal(restored.pattern, 'cross');
  assert.deepEqual(restored.stops, state.stops);
  assert.deepEqual(restored.planeRotation, state.planeRotation);
  assert.equal(restored.planeSelected, 143);
});

test('state tokens round-trip expanded renderer controls', () => {
  const state = normaliseState({
    ...DEFAULT_STATE,
    mode: 'bands',
    monoDark: 72,
    monoLight: 41,
    airSpread: 88,
    airStrength: 63,
    ditherScale: 7,
    ditherBias: -18,
    cubeCount: 21,
    cubeDirection: -1,
    cubePhase: 0.73,
    imagePaletteCount: 3,
    imageSort: 'luminance',
    sourceType: 'audio',
    planeSpace: 'rgb',
    catalogueSort: 'hue',
    harmonyScheme: 'split',
    harmonySpread: 42,
    bandScale: 27,
    bandGap: 19,
    bandOffset: 64,
  });
  const restored = tokenToState(stateToToken(state));
  for (const key of ['mode', 'monoDark', 'monoLight', 'airSpread', 'airStrength', 'ditherScale', 'ditherBias', 'cubeCount', 'cubeDirection', 'cubePhase', 'imagePaletteCount', 'imageSort', 'sourceType', 'planeSpace', 'catalogueSort', 'harmonyScheme', 'harmonySpread', 'bandScale', 'bandGap', 'bandOffset']) {
    assert.equal(restored[key], state[key], key);
  }
});

test('expanded controls clamp and enum values recover safely', () => {
  const state = normaliseState({
    monoDark: 200, monoLight: -2, airSpread: 0, airStrength: 999,
    ditherScale: 99, ditherBias: -999, cubeCount: 2, cubeDirection: 7, cubePhase: 9,
    imagePaletteCount: 19, imageSort: 'garbage', sourceType: 'garbage', planeSpace: 'lab', catalogueSort: 'garbage',
    harmonyScheme: 'garbage', harmonySpread: 500, bandScale: 0, bandGap: 100, bandOffset: -5,
  });
  assert.deepEqual({ monoDark: state.monoDark, monoLight: state.monoLight }, { monoDark: 90, monoLight: 5 });
  assert.deepEqual({ airSpread: state.airSpread, airStrength: state.airStrength }, { airSpread: 20, airStrength: 100 });
  assert.deepEqual({ ditherScale: state.ditherScale, ditherBias: state.ditherBias }, { ditherScale: 12, ditherBias: -45 });
  assert.equal(state.cubeCount, 4);
  assert.equal(state.cubeDirection, 1);
  assert.equal(state.cubePhase, 1);
  assert.equal(state.imagePaletteCount, 5);
  assert.equal(state.imageSort, DEFAULT_STATE.imageSort);
  assert.equal(state.sourceType, DEFAULT_STATE.sourceType);
  assert.equal(state.planeSpace, DEFAULT_STATE.planeSpace);
  assert.equal(state.catalogueSort, DEFAULT_STATE.catalogueSort);
  assert.equal(state.harmonyScheme, DEFAULT_STATE.harmonyScheme);
  assert.equal(state.harmonySpread, 90);
  assert.deepEqual({ bandScale: state.bandScale, bandGap: state.bandGap, bandOffset: state.bandOffset }, { bandScale: 4, bandGap: 80, bandOffset: 0 });
});

test('new instrument inventory and colour calculations are deterministic', () => {
  assert.deepEqual(MODES.slice(-3), ['harmony', 'bands', 'contrast']);
  const state = normaliseState({ mode: 'harmony', monoBase: 72, harmonyScheme: 'triad', harmonySpread: 60 });
  const first = harmonyPalette(state);
  const second = harmonyPalette(state);
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(new Set(first).size, first.length);
  first.forEach((index) => assert.ok(index >= 0 && index < COLORS.length));
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
});

test('cube frames are determined by shared phase rather than wall-clock time', () => {
  const draw = (time) => {
    const calls = [];
    const context = {
      clearRect() {},
      set fillStyle(value) { calls.push(['fill', value]); },
      fillRect(...args) { calls.push(['rect', ...args]); },
    };
    renderPreview(context, normaliseState({ mode: 'cube', cubePhase: 0.37, cubeSpeed: 0.8 }), 320, 180, time);
    return calls;
  };
  assert.deepEqual(draw(0), draw(987654));
});

test('CSS output covers bands, harmony, and contrast truthfully', () => {
  assert.match(cssForState(normaliseState({ mode: 'bands' })), /repeating-linear-gradient/);
  assert.match(cssForState(normaliseState({ mode: 'harmony' })), /gradient/);
  assert.match(cssForState(normaliseState({ mode: 'contrast' })), /linear-gradient\(90deg/);
});

test('invalid state is clamped without throwing', () => {
  const state = normaliseState({ mode: 'garbage', angle: 999, planeRotation: { x: 99, y: 'bad' }, planeSelected: 900, stops: [{ color: -2, position: -1 }, { color: 900, position: 600 }] });
  assert.equal(state.mode, 'make');
  assert.equal(state.angle, 360);
  assert.deepEqual(state.planeRotation, { x: 1.4, y: DEFAULT_STATE.planeRotation.y });
  assert.equal(state.planeSelected, null);
  assert.equal(state.stops[0].color, 0);
  assert.equal(state.stops[1].color, 249);
  assert.equal(clamp('7', 0, 5), 5);
});

test('invalid and partial state falls back without throwing or producing undefined fields', () => {
  const malformedStops = normaliseState({ stops: [null, null], angle: null, centerX: 'bad' });
  assert.deepEqual(malformedStops.stops, DEFAULT_STATE.stops);
  assert.equal(malformedStops.angle, DEFAULT_STATE.angle);
  assert.equal(malformedStops.centerX, DEFAULT_STATE.centerX);

  const compact = { m: 'mono', o: 12 };
  const token = btoa(JSON.stringify(compact)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const restored = tokenToState(token);
  assert.equal(restored.mode, 'mono');
  assert.deepEqual(restored.stops, DEFAULT_STATE.stops);
  assert.equal(restored.angle, DEFAULT_STATE.angle);
});

test('canvas gradient geometry spans rectangular frames and radial farthest corners', () => {
  const calls = {};
  const gradient = { addColorStop() {} };
  const context = {
    clearRect() {}, fillRect() {},
    createLinearGradient(...args) { calls.linear = args; return gradient; },
    createRadialGradient(...args) { calls.radial = args; return gradient; },
  };
  renderPreview(context, normaliseState({ gradientType: 'linear', angle: 0 }), 400, 200);
  assert.ok(Math.abs(calls.linear[0] - 200) < 1e-9);
  assert.ok(Math.abs(calls.linear[1] - 200) < 1e-9);
  assert.ok(Math.abs(calls.linear[2] - 200) < 1e-9);
  assert.ok(Math.abs(calls.linear[3]) < 1e-9);

  renderPreview(context, normaliseState({ gradientType: 'radial', centerX: 25, centerY: 25 }), 400, 200);
  assert.deepEqual(calls.radial.slice(0, 5), [100, 50, 0, 100, 50]);
  assert.ok(Math.abs(calls.radial[5] - Math.hypot(300, 150)) < 1e-9);
});

test('CSS output covers linear, radial, conic, and air', () => {
  for (const type of ['linear', 'radial', 'conic']) {
    assert.match(cssForState(normaliseState({ gradientType: type })), new RegExp(`${type}-gradient`));
  }
  assert.match(cssForState(normaliseState({ mode: 'air' })), /radial-gradient/);
});

test('nearest colour and feeling generation are deterministic', () => {
  assert.equal(nearestColour(COLORS[0].rgb), 0);
  assert.deepEqual(feelingPalette('quiet water at night'), feelingPalette('quiet water at night'));
  assert.equal(feelingPalette('quiet water at night').length, 4);
});

test('image palette extraction returns catalogue indices', () => {
  const data = new Uint8ClampedArray([
    238, 169, 169, 255, 238, 169, 169, 255,
    19, 69, 71, 255, 19, 69, 71, 255,
  ]);
  const palette = extractPaletteFromImage({ width: 2, height: 2, data }, 2);
  assert.ok(palette.length >= 1);
  palette.forEach((index) => assert.ok(index >= 0 && index < COLORS.length));
});

test('TIFF encoder writes a little-endian TIFF header and payload', async () => {
  const image = { width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) };
  const blob = rgbaToTiff(image);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x49);
  assert.equal(bytes[1], 0x49);
  assert.equal(bytes[2], 42);
  assert.ok(bytes.length > 100);
});
