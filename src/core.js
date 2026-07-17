import { COLORS } from './colors.js';

export const MODES = ['make', 'traditional', 'mono', 'air', 'dither', 'cube', 'image', 'plane', 'catalogue'];
export const DITHER_PATTERNS = ['bayer-2', 'bayer-4', 'bayer-8', 'lines', 'cross', 'noise'];

export const DEFAULT_STATE = {
  mode: 'make',
  gradientType: 'linear',
  stops: [
    { color: 162, position: 0 },
    { color: 139, position: 48 },
    { color: 8, position: 100 },
  ],
  angle: 132,
  centerX: 50,
  centerY: 48,
  blur: 78,
  pattern: 'bayer-4',
  recipe: 0,
  monoBase: 162,
  cubeSpeed: 0.45,
  planeRotation: { x: -0.28, y: 0.62 },
  planeSelected: null,
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
}

export function rgbToHex(rgb) {
  return `#${rgb.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function mixRgb(a, b, amount) {
  return a.map((value, index) => value + (b[index] - value) * amount);
}

export function luminance(hex) {
  const channels = hexToRgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastText(hex) {
  return luminance(hex) > 0.38 ? '#171714' : '#F7F5EE';
}

export function nearestColour(rgb) {
  let best = 0;
  let bestDistance = Infinity;
  COLORS.forEach((colour, index) => {
    const distance = colour.rgb.reduce((sum, value, channel) => sum + (value - rgb[channel]) ** 2, 0);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function createRecipes(count = 120) {
  const families = ['dawn', 'ink', 'moss', 'mineral', 'plum', 'water', 'ember', 'paper'];
  return Array.from({ length: count }, (_, index) => {
    const random = mulberry32(9041 + index * 7919);
    const stopCount = index % 5 === 0 ? 4 : 3;
    const stops = Array.from({ length: stopCount }, (_, stopIndex) => ({
      color: Math.floor(random() * COLORS.length),
      position: Math.round((stopIndex / (stopCount - 1)) * 100),
    }));
    return {
      id: `R${String(index + 1).padStart(3, '0')}`,
      family: families[index % families.length],
      type: ['linear', 'linear', 'radial', 'conic'][index % 4],
      angle: Math.floor(random() * 360),
      centerX: 25 + Math.floor(random() * 50),
      centerY: 25 + Math.floor(random() * 50),
      stops,
    };
  });
}

export const RECIPES = createRecipes();

export function normaliseState(input = {}) {
  const state = structuredClone(DEFAULT_STATE);
  Object.assign(state, input);
  state.mode = MODES.includes(state.mode) ? state.mode : DEFAULT_STATE.mode;
  state.gradientType = ['linear', 'radial', 'conic'].includes(state.gradientType) ? state.gradientType : 'linear';
  state.angle = clamp(state.angle, 0, 360);
  state.centerX = clamp(state.centerX, 0, 100);
  state.centerY = clamp(state.centerY, 0, 100);
  state.blur = clamp(state.blur, 0, 180);
  state.pattern = DITHER_PATTERNS.includes(state.pattern) ? state.pattern : DEFAULT_STATE.pattern;
  state.recipe = clamp(Math.floor(state.recipe), 0, RECIPES.length - 1);
  state.monoBase = clamp(Math.floor(state.monoBase), 0, COLORS.length - 1);
  state.cubeSpeed = clamp(state.cubeSpeed, 0.1, 1.5);
  const planeRotation = input.planeRotation && typeof input.planeRotation === 'object' ? input.planeRotation : DEFAULT_STATE.planeRotation;
  state.planeRotation = {
    x: clamp(planeRotation.x, -1.4, 1.4),
    y: Number.isFinite(Number(planeRotation.y)) ? Number(planeRotation.y) : DEFAULT_STATE.planeRotation.y,
  };
  const planeSelected = Number(input.planeSelected);
  state.planeSelected = input.planeSelected == null || !Number.isInteger(planeSelected) || planeSelected < 0 || planeSelected >= COLORS.length
    ? null
    : planeSelected;
  state.stops = Array.isArray(input.stops) && input.stops.length >= 2
    ? input.stops.slice(0, 5).map((stop, index, all) => ({
      color: clamp(Math.floor(stop.color), 0, COLORS.length - 1),
      position: clamp(stop.position ?? (index / (all.length - 1)) * 100, 0, 100),
    })).sort((a, b) => a.position - b.position)
    : state.stops;
  return state;
}

export function stateToToken(state) {
  const compact = {
    m: state.mode,
    t: state.gradientType,
    s: state.stops.map((stop) => [stop.color, Math.round(stop.position)]),
    a: Math.round(state.angle),
    x: Math.round(state.centerX),
    y: Math.round(state.centerY),
    b: Math.round(state.blur),
    p: state.pattern,
    r: state.recipe,
    o: state.monoBase,
    v: Number(state.cubeSpeed.toFixed(2)),
    q: [Number(state.planeRotation.x.toFixed(3)), Number(state.planeRotation.y.toFixed(3))],
    z: state.planeSelected,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(compact)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function tokenToState(token) {
  try {
    const padded = token.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - token.length % 4) % 4);
    const compact = JSON.parse(decodeURIComponent(escape(atob(padded))));
    return normaliseState({
      mode: compact.m,
      gradientType: compact.t,
      stops: compact.s?.map(([color, position]) => ({ color, position })),
      angle: compact.a,
      centerX: compact.x,
      centerY: compact.y,
      blur: compact.b,
      pattern: compact.p,
      recipe: compact.r,
      monoBase: compact.o,
      cubeSpeed: compact.v,
      planeRotation: Array.isArray(compact.q) ? { x: compact.q[0], y: compact.q[1] } : undefined,
      planeSelected: compact.z,
    });
  } catch {
    return null;
  }
}

export function getModeStops(state) {
  if (state.mode === 'traditional') return RECIPES[state.recipe].stops;
  if (state.mode === 'mono') {
    const base = COLORS[state.monoBase].rgb;
    const dark = rgbToHex(mixRgb(base, [10, 10, 9], 0.56));
    const pale = rgbToHex(mixRgb(base, [246, 244, 236], 0.7));
    return [{ hex: dark, position: 0 }, { hex: COLORS[state.monoBase].hex, position: 48 }, { hex: pale, position: 100 }];
  }
  return state.stops.map((stop) => ({ ...stop, hex: COLORS[stop.color].hex }));
}

export function cssForState(state) {
  const recipe = state.mode === 'traditional' ? RECIPES[state.recipe] : state;
  const stops = getModeStops(state).map((stop) => `${stop.hex ?? COLORS[stop.color].hex} ${stop.position}%`).join(', ');
  if (state.mode === 'air') {
    const colours = getModeStops(state).map((stop, index) => {
      const x = (17 + index * 31 + state.centerX) % 100;
      const y = (23 + index * 27 + state.centerY) % 100;
      return `radial-gradient(circle at ${x}% ${y}%, ${stop.hex ?? COLORS[stop.color].hex} 0%, transparent 62%)`;
    });
    return `${colours.join(', ')}, #E7E3D8`;
  }
  const type = recipe.type ?? state.gradientType;
  if (type === 'radial') return `radial-gradient(circle at ${recipe.centerX ?? state.centerX}% ${recipe.centerY ?? state.centerY}%, ${stops})`;
  if (type === 'conic') return `conic-gradient(from ${recipe.angle ?? state.angle}deg at ${recipe.centerX ?? state.centerX}% ${recipe.centerY ?? state.centerY}%, ${stops})`;
  return `linear-gradient(${recipe.angle ?? state.angle}deg, ${stops})`;
}

function canvasGradient(ctx, state, width, height) {
  const recipe = state.mode === 'traditional' ? RECIPES[state.recipe] : state;
  const type = recipe.type ?? state.gradientType;
  const angle = ((recipe.angle ?? state.angle) - 90) * Math.PI / 180;
  let gradient;
  if (type === 'radial') {
    const x = width * ((recipe.centerX ?? state.centerX) / 100);
    const y = height * ((recipe.centerY ?? state.centerY) / 100);
    gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.hypot(width, height) * 0.7);
  } else if (type === 'conic' && ctx.createConicGradient) {
    gradient = ctx.createConicGradient(angle, width * ((recipe.centerX ?? state.centerX) / 100), height * ((recipe.centerY ?? state.centerY) / 100));
  } else {
    const length = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
    const x = Math.cos(angle) * length / 2;
    const y = Math.sin(angle) * length / 2;
    gradient = ctx.createLinearGradient(width / 2 - x, height / 2 - y, width / 2 + x, height / 2 + y);
  }
  getModeStops(state).forEach((stop) => gradient.addColorStop(clamp(stop.position / 100, 0, 1), stop.hex ?? COLORS[stop.color].hex));
  return gradient;
}

const BAYER_2 = [[0, 2], [3, 1]];
const BAYER_4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const BAYER_8 = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => {
  const base = BAYER_4[y % 4][x % 4] * 4;
  return base + BAYER_2[Math.floor(y / 4)][Math.floor(x / 4)];
}));

function ditherThreshold(pattern, x, y) {
  if (pattern === 'bayer-2') return (BAYER_2[y % 2][x % 2] + 0.5) / 4;
  if (pattern === 'bayer-4') return (BAYER_4[y % 4][x % 4] + 0.5) / 16;
  if (pattern === 'bayer-8') return (BAYER_8[y % 8][x % 8] + 0.5) / 64;
  if (pattern === 'lines') return ((x + y * 2) % 8) / 8;
  if (pattern === 'cross') return ((x % 5) + (y % 5)) / 10;
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function renderDither(ctx, state, width, height) {
  const stops = getModeStops(state);
  const first = hexToRgb(stops[0].hex ?? COLORS[stops[0].color].hex);
  const last = hexToRgb(stops.at(-1).hex ?? COLORS[stops.at(-1).color].hex);
  const image = ctx.createImageData(width, height);
  const angle = state.angle * Math.PI / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const scale = Math.abs(width * dx) + Math.abs(height * dy) || 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const projected = ((x - width / 2) * dx + (y - height / 2) * dy) / scale + 0.5;
      const colour = projected > ditherThreshold(state.pattern, x, y) ? last : first;
      const offset = (y * width + x) * 4;
      image.data[offset] = colour[0];
      image.data[offset + 1] = colour[1];
      image.data[offset + 2] = colour[2];
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function renderAir(ctx, state, width, height) {
  ctx.fillStyle = '#E7E3D8';
  ctx.fillRect(0, 0, width, height);
  const stops = getModeStops(state);
  const scale = Math.max(width, height);
  ctx.save();
  ctx.filter = `blur(${Math.max(1, state.blur * width / 1200)}px)`;
  stops.forEach((stop, index) => {
    const x = width * (((17 + index * 31 + state.centerX) % 100) / 100);
    const y = height * (((23 + index * 27 + state.centerY) % 100) / 100);
    const radius = scale * (0.33 + index * 0.06);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, stop.hex ?? COLORS[stop.color].hex);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(-radius, -radius, width + radius * 2, height + radius * 2);
  });
  ctx.restore();
}

function renderCube(ctx, state, width, height, time) {
  ctx.fillStyle = '#ECE9DF';
  ctx.fillRect(0, 0, width, height);
  const stops = getModeStops(state);
  const count = 14;
  const pulse = (time * 0.0001 * state.cubeSpeed) % 1;
  for (let index = count - 1; index >= 0; index -= 1) {
    const phase = (index / count + pulse) % 1;
    const size = Math.min(width, height) * (0.12 + phase * 1.15);
    const colour = stops[index % stops.length];
    ctx.fillStyle = colour.hex ?? COLORS[colour.color].hex;
    ctx.fillRect(width / 2 - size / 2, height / 2 - size / 2, size, size);
  }
}

export function colourToHsl(rgb) {
  const [r, g, b] = rgb.map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const delta = max - min;
  if (!delta) return [0, 0, light];
  const saturation = delta / (1 - Math.abs(2 * light - 1));
  let hue;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  return [(hue + 360) % 360, saturation, light];
}

export function projectColourPlane(width, height, rotation = DEFAULT_STATE.planeRotation) {
  const cosY = Math.cos(rotation.y);
  const sinY = Math.sin(rotation.y);
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  return COLORS.map((colour, index) => {
    const [hue, saturation, light] = colourToHsl(colour.rgb);
    let x = Math.cos(hue * Math.PI / 180) * saturation;
    let z = Math.sin(hue * Math.PI / 180) * saturation;
    let y = (light - 0.5) * 1.8;
    const rx = x * cosY - z * sinY;
    const rz = x * sinY + z * cosY;
    const ry = y * cosX - rz * sinX;
    const depth = y * sinX + rz * cosX;
    const perspective = 1 / (2.7 - depth);
    return { index, x: width / 2 + rx * width * 0.62 * perspective, y: height / 2 - ry * height * 0.84 * perspective, depth, radius: 2 + perspective * 7 };
  }).sort((a, b) => a.depth - b.depth);
}

export function renderPlane(ctx, state, width, height) {
  ctx.fillStyle = '#E8E5DC';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(23,23,20,.18)';
  ctx.lineWidth = 1;
  [
    [width / 2, height * 0.08, width / 2, height * 0.92],
    [width * 0.18, height * 0.68, width * 0.82, height * 0.32],
    [width * 0.18, height * 0.32, width * 0.82, height * 0.68],
  ].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  const points = projectColourPlane(width, height, state.planeRotation);
  points.forEach((point) => {
    ctx.fillStyle = COLORS[point.index].hex;
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
    ctx.fill();
    if (point.index === state.planeSelected) {
      ctx.strokeStyle = '#171714';
      ctx.lineWidth = Math.max(2, width / 600);
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.radius + Math.max(5, width / 180), 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(23,23,20,.18)';
      ctx.lineWidth = 1;
    }
  });
  return points;
}

export function renderCatalogue(ctx, width, height) {
  const columns = width >= height ? 25 : 10;
  const rows = Math.ceil(COLORS.length / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  COLORS.forEach((colour, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    ctx.fillStyle = colour.hex;
    ctx.fillRect(column * cellWidth, row * cellHeight, Math.ceil(cellWidth), Math.ceil(cellHeight));
  });
  ctx.strokeStyle = 'rgba(241,239,232,.48)';
  ctx.lineWidth = Math.max(1, width / 1100);
  for (let column = 1; column < columns; column += 1) {
    ctx.beginPath(); ctx.moveTo(column * cellWidth, 0); ctx.lineTo(column * cellWidth, height); ctx.stroke();
  }
  for (let row = 1; row < rows; row += 1) {
    ctx.beginPath(); ctx.moveTo(0, row * cellHeight); ctx.lineTo(width, row * cellHeight); ctx.stroke();
  }
}

export function renderPreview(ctx, state, width, height, time = 0) {
  ctx.clearRect(0, 0, width, height);
  if (state.mode === 'dither') renderDither(ctx, state, width, height);
  else if (state.mode === 'air') renderAir(ctx, state, width, height);
  else if (state.mode === 'cube') renderCube(ctx, state, width, height, time);
  else if (state.mode === 'plane') return renderPlane(ctx, state, width, height);
  else if (state.mode === 'catalogue') renderCatalogue(ctx, width, height);
  else {
    ctx.fillStyle = canvasGradient(ctx, state, width, height);
    ctx.fillRect(0, 0, width, height);
  }
  return null;
}

export function extractPaletteFromImage(imageData, count = 6) {
  const pixels = [];
  const stride = Math.max(1, Math.floor((imageData.width * imageData.height) / 12000));
  for (let index = 0; index < imageData.data.length; index += 4 * stride) {
    if (imageData.data[index + 3] < 200) continue;
    pixels.push([imageData.data[index], imageData.data[index + 1], imageData.data[index + 2]]);
  }
  if (!pixels.length) return [];
  let centroids = Array.from({ length: count }, (_, index) => pixels[Math.floor(index * (pixels.length - 1) / Math.max(1, count - 1))]);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const groups = Array.from({ length: count }, () => []);
    pixels.forEach((pixel) => {
      let best = 0;
      let distance = Infinity;
      centroids.forEach((centroid, centroidIndex) => {
        const next = centroid.reduce((sum, value, channel) => sum + (value - pixel[channel]) ** 2, 0);
        if (next < distance) { distance = next; best = centroidIndex; }
      });
      groups[best].push(pixel);
    });
    centroids = groups.map((group, index) => group.length
      ? [0, 1, 2].map((channel) => group.reduce((sum, pixel) => sum + pixel[channel], 0) / group.length)
      : centroids[index]);
  }
  return [...new Set(centroids.map(nearestColour))];
}

export function feelingPalette(text) {
  const words = text.toLowerCase();
  const anchors = [
    { terms: ['calm', 'quiet', 'water', 'cold', 'night'], indices: [139, 146, 231, 242] },
    { terms: ['warm', 'fire', 'energy', 'loud', 'sun'], indices: [1, 8, 56, 95] },
    { terms: ['forest', 'moss', 'earth', 'deep'], indices: [112, 124, 128, 238] },
    { terms: ['soft', 'romantic', 'spring', 'flower'], indices: [0, 186, 205, 212] },
    { terms: ['dark', 'ink', 'severe', 'industrial'], indices: [229, 243, 245, 249] },
  ];
  const match = anchors.find((entry) => entry.terms.some((term) => words.includes(term)));
  if (match) return match.indices;
  let hash = 2166136261;
  for (const character of words || 'bokashi') hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const random = mulberry32(hash >>> 0);
  return Array.from({ length: 4 }, () => Math.floor(random() * COLORS.length));
}

export function rgbaToTiff(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const pixelBytes = width * height * 4;
  const ifdOffset = 8;
  const entries = 11;
  const ifdSize = 2 + entries * 12 + 4;
  const bitsOffset = ifdOffset + ifdSize;
  const pixelOffset = bitsOffset + 8;
  const buffer = new ArrayBuffer(pixelOffset + pixelBytes);
  const view = new DataView(buffer);
  view.setUint8(0, 0x49); view.setUint8(1, 0x49); view.setUint16(2, 42, true); view.setUint32(4, ifdOffset, true);
  view.setUint16(ifdOffset, entries, true);
  let entry = ifdOffset + 2;
  const writeEntry = (tag, type, count, value) => {
    view.setUint16(entry, tag, true); view.setUint16(entry + 2, type, true); view.setUint32(entry + 4, count, true);
    if (type === 3 && count === 1) view.setUint16(entry + 8, value, true); else view.setUint32(entry + 8, value, true);
    entry += 12;
  };
  writeEntry(256, 4, 1, width); writeEntry(257, 4, 1, height); writeEntry(258, 3, 4, bitsOffset);
  writeEntry(259, 3, 1, 1); writeEntry(262, 3, 1, 2); writeEntry(273, 4, 1, pixelOffset);
  writeEntry(277, 3, 1, 4); writeEntry(278, 4, 1, height); writeEntry(279, 4, 1, pixelBytes);
  writeEntry(284, 3, 1, 1); writeEntry(338, 3, 1, 2); view.setUint32(entry, 0, true);
  [8, 8, 8, 8].forEach((bits, index) => view.setUint16(bitsOffset + index * 2, bits, true));
  new Uint8Array(buffer, pixelOffset).set(imageData.data);
  return new Blob([buffer], { type: 'image/tiff' });
}
