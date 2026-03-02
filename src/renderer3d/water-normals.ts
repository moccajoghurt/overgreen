import * as THREE from 'three';

/**
 * Generate a 512x512 procedural normal map for water ripples.
 * Uses 3 octaves of sine-based noise for varied wave scales.
 * Returns a CanvasTexture with RepeatWrapping.
 */
export function createWaterNormalMap(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // 3 octaves of sine-based noise for height
      // We compute height at (x, y) and neighbors to derive the normal
      const h = sampleHeight(u, v);
      const hR = sampleHeight(u + 1 / size, v);
      const hU = sampleHeight(u, v + 1 / size);

      // Tangent-space normal from height differences
      const dx = (h - hR) * 2.0;
      const dy = (h - hU) * 2.0;

      // Normal in tangent space: (dx, dy, 1) normalized
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const nx = dx / len;
      const ny = dy / len;
      const nz = 1 / len;

      // Encode to 0-255 (R=X, G=Y, B=Z pointing up)
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  return texture;
}

function sampleHeight(u: number, v: number): number {
  const TAU = Math.PI * 2;
  // Octave 1: large waves
  const o1 = Math.sin(u * TAU * 4 + v * TAU * 3) * 0.5
           + Math.sin(u * TAU * 3 - v * TAU * 5) * 0.3;
  // Octave 2: medium ripples
  const o2 = Math.sin(u * TAU * 8 + v * TAU * 10 + 0.7) * 0.25
           + Math.sin(u * TAU * 12 - v * TAU * 7 + 1.3) * 0.15;
  // Octave 3: fine detail
  const o3 = Math.sin(u * TAU * 20 + v * TAU * 18 + 2.1) * 0.1
           + Math.sin(u * TAU * 25 - v * TAU * 22 + 3.5) * 0.08;

  return o1 + o2 + o3;
}
