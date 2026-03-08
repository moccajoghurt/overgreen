import * as THREE from 'three';

/**
 * Procedural terrain detail texture — multiplied over vertex colors
 * to add organic surface variation without changing the color pipeline.
 *
 * Uses larger 512px texture at lower tile count for natural-looking
 * clumpy variation rather than fine uniform grain.
 */

const TEX_SIZE = 512;
const TILE_REPEAT = 6; // fewer repeats = larger features, less visible tiling

// ── Noise primitives ──

function hash2(x: number, y: number): number {
  let h = (x * 2654435761 + y * 340573) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  return ((h >> 16) ^ h & 0x7FFFFFFF) / 0x7FFFFFFF;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(px: number, py: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = smoothstep(px - ix);
  const fy = smoothstep(py - iy);

  const v00 = hash2(ix, iy);
  const v10 = hash2(ix + 1, iy);
  const v01 = hash2(ix, iy + 1);
  const v11 = hash2(ix + 1, iy + 1);

  const top = v00 + (v10 - v00) * fx;
  const bot = v01 + (v11 - v01) * fx;
  return top + (bot - top) * fy;
}

/** fBm with rotated octaves to reduce grid-axis alignment artifacts */
function fbm(x: number, y: number, octaves: number): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;
  let cx = x, cy = y;
  // Rotation per octave (~37°) breaks axis-aligned patterns
  const cos37 = 0.7986;
  const sin37 = 0.6018;
  for (let i = 0; i < octaves; i++) {
    val += valueNoise(cx * freq, cy * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2.0;
    // Rotate domain
    const rx = cx * cos37 + cy * sin37;
    const ry = -cx * sin37 + cy * cos37;
    cx = rx;
    cy = ry;
  }
  return val / max;
}

// ── Texture generation ──

export function createTerrainDetailTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const data = imageData.data;

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      // Large soft blobs (broad variation like soil patches)
      const broad = fbm(x * 0.012, y * 0.012, 3);
      // Medium clumps (pebbles, grass tufts)
      const medium = fbm(x * 0.035 + 50, y * 0.035 + 50, 3);
      // Fine speckle (individual grains, very subtle)
      const fine = fbm(x * 0.09 + 100, y * 0.09 + 100, 2);

      // Blend: mostly broad + medium, just a touch of fine
      const n = broad * 0.5 + medium * 0.35 + fine * 0.15;

      // Subtle contrast: ±8% brightness variation around neutral (200)
      // This is gentler than before — adds depth without washing out vertex colors
      const brightness = Math.floor(200 + (n - 0.5) * 50);
      const clamped = Math.max(170, Math.min(230, brightness));

      const idx = (y * TEX_SIZE + x) * 4;
      data[idx] = clamped;
      data[idx + 1] = clamped;
      data[idx + 2] = clamped;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(TILE_REPEAT, TILE_REPEAT);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.colorSpace = THREE.NoColorSpace; // raw multiply — not sRGB
  return texture;
}
