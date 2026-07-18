import { COLORS } from './colors.js';

export const MODES = ['make', 'traditional', 'mono', 'air', 'dither', 'cube', 'image', 'plane', 'catalogue', 'harmony', 'bands', 'contrast'];
export const DITHER_PATTERNS = ['bayer-2', 'bayer-4', 'bayer-8', 'lines', 'cross', 'noise'];
export const HARMONY_SCHEMES = ['analogous', 'complement', 'split', 'triad', 'tetrad'];
export const SORT_ORDERS = ['source', 'hue', 'lightness', 'name'];

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
  cubeCount: 14,
  cubeDirection: 1,
  monoDark: 56,
  monoLight: 70,
  airSpread: 62,
  airStrength: 78,
  ditherScale: 1,
  ditherBias: 0,
  imagePaletteCount: 5,
  imageSort: 'dominance',
  planeRotation: { x: -0.28, y: 0.62 },
  planeSelected: null,
  planeSpace: 'hsl',
  catalogueSort: 'source',
  harmonyScheme: 'analogous',
  harmonySpread: 30,
  bandScale: 24,
  bandGap: 12,
  bandOffset: 0,
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
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const state = structuredClone(DEFAULT_STATE);
  const finite = (value, fallback) => {
    if (value === null || value === '' || typeof value === 'boolean') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  state.mode = MODES.includes(source.mode) ? source.mode : DEFAULT_STATE.mode;
  state.gradientType = ['linear', 'radial', 'conic'].includes(source.gradientType) ? source.gradientType : DEFAULT_STATE.gradientType;
  state.angle = clamp(finite(source.angle, DEFAULT_STATE.angle), 0, 360);
  state.centerX = clamp(finite(source.centerX, DEFAULT_STATE.centerX), 0, 100);
  state.centerY = clamp(finite(source.centerY, DEFAULT_STATE.centerY), 0, 100);
  state.blur = clamp(finite(source.blur, DEFAULT_STATE.blur), 0, 180);
  state.pattern = DITHER_PATTERNS.includes(source.pattern) ? source.pattern : DEFAULT_STATE.pattern;
  state.recipe = clamp(Math.floor(finite(source.recipe, DEFAULT_STATE.recipe)), 0, RECIPES.length - 1);
  state.monoBase = clamp(Math.floor(finite(source.monoBase, DEFAULT_STATE.monoBase)), 0, COLORS.length - 1);
  state.cubeSpeed = clamp(finite(source.cubeSpeed, DEFAULT_STATE.cubeSpeed), 0.1, 1.5);
  state.cubeCount = clamp(Math.round(finite(source.cubeCount, DEFAULT_STATE.cubeCount)), 4, 24);
  state.cubeDirection = Number(source.cubeDirection) === -1 ? -1 : 1;
  state.monoDark = clamp(Math.round(finite(source.monoDark, DEFAULT_STATE.monoDark)), 10, 90);
  state.monoLight = clamp(Math.round(finite(source.monoLight, DEFAULT_STATE.monoLight)), 5, 90);
  state.airSpread = clamp(Math.round(finite(source.airSpread, DEFAULT_STATE.airSpread)), 20, 100);
  state.airStrength = clamp(Math.round(finite(source.airStrength, DEFAULT_STATE.airStrength)), 10, 100);
  state.ditherScale = clamp(Math.round(finite(source.ditherScale, DEFAULT_STATE.ditherScale)), 1, 12);
  state.ditherBias = clamp(Math.round(finite(source.ditherBias, DEFAULT_STATE.ditherBias)), -45, 45);
  state.imagePaletteCount = clamp(Math.round(finite(source.imagePaletteCount, DEFAULT_STATE.imagePaletteCount)), 2, 5);
  state.imageSort = ['dominance', 'luminance'].includes(source.imageSort) ? source.imageSort : DEFAULT_STATE.imageSort;
  state.planeSpace = ['hsl', 'rgb'].includes(source.planeSpace) ? source.planeSpace : DEFAULT_STATE.planeSpace;
  state.catalogueSort = SORT_ORDERS.includes(source.catalogueSort) ? source.catalogueSort : DEFAULT_STATE.catalogueSort;
  state.harmonyScheme = HARMONY_SCHEMES.includes(source.harmonyScheme) ? source.harmonyScheme : DEFAULT_STATE.harmonyScheme;
  state.harmonySpread = clamp(Math.round(finite(source.harmonySpread, DEFAULT_STATE.harmonySpread)), 10, 90);
  state.bandScale = clamp(Math.round(finite(source.bandScale, DEFAULT_STATE.bandScale)), 4, 96);
  state.bandGap = clamp(Math.round(finite(source.bandGap, DEFAULT_STATE.bandGap)), 0, 80);
  state.bandOffset = clamp(Math.round(finite(source.bandOffset, DEFAULT_STATE.bandOffset)), 0, 100);
  const planeRotation = source.planeRotation && typeof source.planeRotation === 'object' && !Array.isArray(source.planeRotation)
    ? source.planeRotation
    : DEFAULT_STATE.planeRotation;
  state.planeRotation = {
    x: clamp(finite(planeRotation.x, DEFAULT_STATE.planeRotation.x), -1.4, 1.4),
    y: finite(planeRotation.y, DEFAULT_STATE.planeRotation.y),
  };
  const planeSelected = Number(source.planeSelected);
  state.planeSelected = source.planeSelected == null || !Number.isInteger(planeSelected) || planeSelected < 0 || planeSelected >= COLORS.length
    ? null
    : planeSelected;
  if (Array.isArray(source.stops)) {
    const stops = source.stops.slice(0, 5).filter((stop) => stop && typeof stop === 'object');
    if (stops.length >= 2) {
      state.stops = stops.map((stop, index, all) => ({
        color: clamp(Math.floor(finite(stop.color, DEFAULT_STATE.stops[Math.min(index, DEFAULT_STATE.stops.length - 1)].color)), 0, COLORS.length - 1),
        position: clamp(finite(stop.position, (index / (all.length - 1)) * 100), 0, 100),
      })).sort((a, b) => a.position - b.position);
    }
  }
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
    cd: state.cubeCount,
    cr: state.cubeDirection,
    md: state.monoDark,
    ml: state.monoLight,
    as: state.airSpread,
    ai: state.airStrength,
    ds: state.ditherScale,
    db: state.ditherBias,
    ic: state.imagePaletteCount,
    is: state.imageSort,
    ps: state.planeSpace,
    cs: state.catalogueSort,
    hs: state.harmonyScheme,
    hp: state.harmonySpread,
    bs: state.bandScale,
    bg: state.bandGap,
    bo: state.bandOffset,
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
      cubeCount: compact.cd,
      cubeDirection: compact.cr,
      monoDark: compact.md,
      monoLight: compact.ml,
      airSpread: compact.as,
      airStrength: compact.ai,
      ditherScale: compact.ds,
      ditherBias: compact.db,
      imagePaletteCount: compact.ic,
      imageSort: compact.is,
      planeSpace: compact.ps,
      catalogueSort: compact.cs,
      harmonyScheme: compact.hs,
      harmonySpread: compact.hp,
      bandScale: compact.bs,
      bandGap: compact.bg,
      bandOffset: compact.bo,
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
    const dark = rgbToHex(mixRgb(base, [10, 10, 9], state.monoDark / 100));
    const pale = rgbToHex(mixRgb(base, [246, 244, 236], state.monoLight / 100));
    return [{ hex: dark, position: 0 }, { hex: COLORS[state.monoBase].hex, position: 48 }, { hex: pale, position: 100 }];
  }
  if (state.mode === 'harmony') {
    const indices = harmonyPalette(state);
    return indices.map((color, index) => ({ color, hex: COLORS[color].hex, position: Math.round(index / Math.max(1, indices.length - 1) * 100) }));
  }
  if (state.mode === 'contrast') {
    const endpoints = [state.stops[0], state.stops.at(-1)];
    return endpoints.map((stop, index) => ({ ...stop, hex: COLORS[stop.color].hex, position: index * 100 }));
  }
  return state.stops.map((stop) => ({ ...stop, hex: COLORS[stop.color].hex }));
}

export function cssForState(state) {
  if (state.mode === 'bands') {
    const stops = getModeStops(state);
    const scale = state.bandScale;
    const phase = state.bandOffset / 100 * scale * stops.length;
    const filled = scale * (1 - state.bandGap / 100);
    const bands = stops.flatMap((stop, index) => {
      const start = index * scale - phase;
      const end = start + filled;
      const next = (index + 1) * scale - phase;
      const colour = stop.hex ?? COLORS[stop.color].hex;
      return [`${colour} ${start}px`, `${colour} ${end}px`, `#E7E3D8 ${end}px`, `#E7E3D8 ${next}px`];
    }).join(', ');
    return `repeating-linear-gradient(${state.angle}deg, ${bands})`;
  }
  if (state.mode === 'contrast') {
    const [foreground, background] = getModeStops(state);
    return `linear-gradient(90deg, ${background.hex} 0%, ${background.hex} 50%, ${foreground.hex} 50%, ${foreground.hex} 100%)`;
  }
  const recipe = state.mode === 'traditional' ? RECIPES[state.recipe] : state;
  const stops = getModeStops(state).map((stop) => `${stop.hex ?? COLORS[stop.color].hex} ${stop.position}%`).join(', ');
  if (state.mode === 'air') {
    const colours = getModeStops(state).map((stop, index) => {
      const x = (17 + index * 31 + state.centerX) % 100;
      const y = (23 + index * 27 + state.centerY) % 100;
      const rgb = hexToRgb(stop.hex ?? COLORS[stop.color].hex);
      return `radial-gradient(circle at ${x}% ${y}%, rgba(${rgb.join(',')},${state.airStrength / 100}) 0%, transparent ${state.airSpread}%)`;
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
    const radius = Math.max(
      Math.hypot(x, y),
      Math.hypot(width - x, y),
      Math.hypot(x, height - y),
      Math.hypot(width - x, height - y),
    );
    gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  } else if (type === 'conic' && ctx.createConicGradient) {
    gradient = ctx.createConicGradient(angle, width * ((recipe.centerX ?? state.centerX) / 100), height * ((recipe.centerY ?? state.centerY) / 100));
  } else {
    const length = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
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
      const sampleX = Math.floor(x / state.ditherScale);
      const sampleY = Math.floor(y / state.ditherScale);
      const projected = ((x - width / 2) * dx + (y - height / 2) * dy) / scale + 0.5 + state.ditherBias / 100;
      const colour = projected > ditherThreshold(state.pattern, sampleX, sampleY) ? last : first;
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
    const radius = scale * (0.18 + state.airSpread / 100 * 0.45 + index * 0.03);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const rgb = hexToRgb(stop.hex ?? COLORS[stop.color].hex);
    gradient.addColorStop(0, `rgba(${rgb.join(',')},${state.airStrength / 100})`);
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
  const count = state.cubeCount;
  const pulse = ((time * 0.0001 * state.cubeSpeed * state.cubeDirection) % 1 + 1) % 1;
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

export function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs(sector % 2 - 1));
  const pairs = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
  const [r, g, b] = pairs[Math.floor(sector) % 6];
  const match = lightness - chroma / 2;
  return [r, g, b].map((channel) => Math.round((channel + match) * 255));
}

export function harmonyPalette(state) {
  const base = COLORS[state.monoBase];
  const [hue, saturation, lightness] = colourToHsl(base.rgb);
  const spread = state.harmonySpread;
  const offsets = {
    analogous: [-spread, 0, spread],
    complement: [0, 180],
    split: [0, 180 - spread, 180 + spread],
    triad: [0, 120, 240],
    tetrad: [0, 90, 180, 270],
  }[state.harmonyScheme] || [0, 180];
  const used = new Set();
  return offsets.map((offset) => {
    const target = hslToRgb(hue + offset, Math.max(0.18, saturation), lightness);
    let bestIndex = -1;
    let bestDistance = Infinity;
    COLORS.forEach((colour, index) => {
      if (used.has(index)) return;
      const distance = Math.hypot(colour.rgb[0] - target[0], colour.rgb[1] - target[1], colour.rgb[2] - target[2]);
      if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
    });
    used.add(bestIndex);
    return bestIndex;
  });
}

export function contrastRatio(first, second) {
  const bright = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return Number(((bright + 0.05) / (dark + 0.05)).toFixed(2));
}

export function projectColourPlane(width, height, rotation = DEFAULT_STATE.planeRotation, space = DEFAULT_STATE.planeSpace) {
  const cosY = Math.cos(rotation.y);
  const sinY = Math.sin(rotation.y);
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  return COLORS.map((colour, index) => {
    let x; let y; let z;
    if (space === 'rgb') {
      x = colour.rgb[0] / 255 - 0.5;
      y = colour.rgb[1] / 255 - 0.5;
      z = colour.rgb[2] / 255 - 0.5;
    } else {
      const [hue, saturation, light] = colourToHsl(colour.rgb);
      x = Math.cos(hue * Math.PI / 180) * saturation;
      z = Math.sin(hue * Math.PI / 180) * saturation;
      y = (light - 0.5) * 1.8;
    }
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
  const points = projectColourPlane(width, height, state.planeRotation, state.planeSpace);
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

export function sortColourIndices(order = 'source') {
  const indices = COLORS.map((_, index) => index);
  if (order === 'hue') return indices.sort((a, b) => colourToHsl(COLORS[a].rgb)[0] - colourToHsl(COLORS[b].rgb)[0]);
  if (order === 'lightness') return indices.sort((a, b) => luminance(COLORS[a].hex) - luminance(COLORS[b].hex));
  if (order === 'name') return indices.sort((a, b) => COLORS[a].romaji.localeCompare(COLORS[b].romaji));
  return indices;
}

export function renderCatalogue(ctx, state, width, height) {
  const sorted = sortColourIndices(state.catalogueSort);
  const columns = width >= height ? 25 : 10;
  const rows = Math.ceil(COLORS.length / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  sorted.forEach((colourIndex, index) => {
    const colour = COLORS[colourIndex];
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

function renderBands(ctx, state, width, height) {
  const stops = getModeStops(state);
  const diagonal = Math.hypot(width, height);
  const scale = Math.max(2, state.bandScale);
  const filled = scale * (1 - state.bandGap / 100);
  const phase = state.bandOffset / 100 * scale * stops.length;
  ctx.fillStyle = '#E7E3D8';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((state.angle - 90) * Math.PI / 180);
  const start = -diagonal - phase;
  for (let position = start; position < diagonal + scale; position += scale) {
    const sequence = Math.floor((position - start) / scale);
    const stop = stops[((sequence % stops.length) + stops.length) % stops.length];
    ctx.fillStyle = stop.hex ?? COLORS[stop.color].hex;
    ctx.fillRect(position, -diagonal, filled, diagonal * 2);
  }
  ctx.restore();
}

function renderContrast(ctx, state, width, height) {
  const [foreground, background] = getModeStops(state);
  const fg = foreground.hex;
  const bg = background.hex;
  const ratio = contrastRatio(fg, bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = fg;
  ctx.fillRect(width / 2, 0, width / 2, height);
  const padding = Math.max(22, width * 0.035);
  ctx.textBaseline = 'top';
  ctx.fillStyle = fg;
  ctx.font = `600 ${Math.max(20, width * 0.038)}px ui-monospace, monospace`;
  ctx.fillText(`${ratio.toFixed(2)}:1`, padding, padding);
  ctx.font = `500 ${Math.max(14, width * 0.018)}px ui-sans-serif, system-ui`;
  ctx.fillText('NORMAL TEXT / Aa', padding, padding + Math.max(48, width * 0.065));
  ctx.fillStyle = bg;
  ctx.font = `600 ${Math.max(20, width * 0.038)}px ui-monospace, monospace`;
  ctx.fillText('BOKASHI', width / 2 + padding, padding);
  ctx.font = `500 ${Math.max(14, width * 0.018)}px ui-sans-serif, system-ui`;
  ctx.fillText('LARGE TEXT / 色', width / 2 + padding, padding + Math.max(48, width * 0.065));
}

export function renderPreview(ctx, state, width, height, time = 0) {
  ctx.clearRect(0, 0, width, height);
  if (state.mode === 'dither') renderDither(ctx, state, width, height);
  else if (state.mode === 'air') renderAir(ctx, state, width, height);
  else if (state.mode === 'cube') renderCube(ctx, state, width, height, time);
  else if (state.mode === 'plane') return renderPlane(ctx, state, width, height);
  else if (state.mode === 'catalogue') renderCatalogue(ctx, state, width, height);
  else if (state.mode === 'bands') renderBands(ctx, state, width, height);
  else if (state.mode === 'contrast') renderContrast(ctx, state, width, height);
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
