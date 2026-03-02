// Moore neighborhood offsets (8 directions)
export const NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

export function parseKey(key: string): [number, number] {
  const i = key.indexOf(',');
  return [Number(key.slice(0, i)), Number(key.slice(i + 1))];
}

export function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && x < w && y >= 0 && y < h;
}

export function randomIntRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

export function decayMap(map: Map<string, number>): void {
  for (const [key, remaining] of map) {
    if (remaining <= 1) map.delete(key);
    else map.set(key, remaining - 1);
  }
}
