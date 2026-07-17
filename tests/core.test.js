import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS } from '../src/colors.js';
import {
  DEFAULT_STATE, RECIPES, clamp, createRecipes, cssForState, extractPaletteFromImage,
  feelingPalette, nearestColour, normaliseState, rgbaToTiff, stateToToken, tokenToState,
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
