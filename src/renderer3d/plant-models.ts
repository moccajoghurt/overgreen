import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ── Helpers (ported from plant-gallery.html) ──

export function jitter(geo: THREE.BufferGeometry, amount: number): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * amount);
    pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * amount);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

export function grassBlade(h: number, w: number, bend: number, twist = 0): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(w, h, 1, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + h / 2) / h;
    pos.setZ(i, bend * t * t);
    pos.setX(i, pos.getX(i) * (1 - 0.6 * t) + twist * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Radial density/height falloff for ground-cover models. Returns 1.0 at center, 0.0 at edge. */
function gcFalloff(x: number, z: number, radius: number): number {
  const d2 = (x * x + z * z) / (radius * radius);
  return d2 >= 1.0 ? 0.0 : 1 - d2;
}

/** Material helper — roughness is cosmetic for gallery; sim only reads color channel. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mat(color: number, extra?: Record<string, any>): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(Object.assign(
    { color, roughness: 0.85, flatShading: true }, extra,
  ));
}

export function matDS(color: number): THREE.MeshStandardMaterial {
  return mat(color, { side: THREE.DoubleSide });
}

export function addCanopy(group: THREE.Group, x: number, y: number, z: number, radius: number, color = 0x2d5a1e): THREE.Mesh {
  const geo = jitter(new THREE.IcosahedronGeometry(radius, 1), radius * 0.15);
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

export function addTrunk(group: THREE.Group, x: number, y: number, z: number, rBot: number, rTop: number, h: number, color = 0x6a4a2a): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 7);
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y + h / 2, z);
  group.add(m);
  return m;
}

// ── Builders (24 subtypes) ──

/** Placeholder for grass subtypes 0-4: tiny invisible quad.
 *  These subtypes are rendered entirely by the shader grass field.
 *  The InstancedMesh still exists (for count bookkeeping) but is never populated. */
function buildGrassPlaceholder(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.01, 0.01);
  const m = new THREE.Mesh(geo, mat(0x88cc44));
  m.position.set(0, 0.005, 0);
  m.rotation.x = -Math.PI / 2;
  g.add(m);
  return g;
}

function buildTurfgrass(): THREE.Group { return buildGrassPlaceholder(); }

function buildTallgrass(): THREE.Group { return buildGrassPlaceholder(); }

function buildBunchgrass(): THREE.Group { return buildGrassPlaceholder(); }
function buildBamboo(): THREE.Group { return buildGrassPlaceholder(); }
function buildSpreading(): THREE.Group { return buildGrassPlaceholder(); }

function buildSedge(): THREE.Group {
  const g = new THREE.Group();
  const stemColors = [mat(0x77bb55), mat(0x88cc66), mat(0x66aa44)];
  const umbColors = [matDS(0x55aa44), matDS(0x66bb55), matDS(0x77cc66)];
  const half = 0.50;

  // Stems with umbel crowns — no carpet (shader grass field covers ground)
  const step = 0.20;
  for (let gx = -half; gx <= half; gx += step) {
    for (let gz = -half; gz <= half; gz += step) {
      if (Math.random() > 0.90) continue;
      const sx = gx + (Math.random() - 0.5) * step * 0.5;
      const sz = gz + (Math.random() - 0.5) * step * 0.5;
      const edgeDist = Math.max(Math.abs(sx), Math.abs(sz)) / half;
      const tierScale = edgeDist < 0.35 ? 1.0 : edgeDist < 0.7 ? 0.70 : 0.45;
      const h = (1.3 + Math.random() * 0.5) * tierScale;
      const stemR = 0.025 + Math.random() * 0.008;
      const sm = stemColors[Math.floor(Math.random() * stemColors.length)];
      const stemGeo = new THREE.CylinderGeometry(stemR * 0.7, stemR, h, 3, 1);
      const stem = new THREE.Mesh(stemGeo, sm);
      stem.position.set(sx, h / 2, sz);
      stem.rotation.z = (Math.random() - 0.5) * 0.06;
      stem.rotation.x = (Math.random() - 0.5) * 0.06;
      g.add(stem);

      // Papyrus-like drooping umbel crown — long arcing spokes
      const um = umbColors[Math.floor(Math.random() * umbColors.length)];
      const spokeCount = 4 + Math.floor(Math.random() * 2);
      const spokeLen = h * (0.25 + Math.random() * 0.08);
      for (let j = 0; j < spokeCount; j++) {
        const ba = j * Math.PI * 2 / spokeCount + Math.random() * 0.3;
        const spokeGeo = new THREE.PlaneGeometry(0.022, spokeLen, 1, 2);
        // Simple bend
        const spos = spokeGeo.attributes.position;
        for (let si = 0; si < spos.count; si++) {
          const sy = spos.getY(si);
          const st = (sy + spokeLen / 2) / spokeLen;
          spos.setZ(si, spokeLen * 0.15 * st * st);
        }
        spokeGeo.computeVertexNormals();
        const spoke = new THREE.Mesh(spokeGeo, um);
        spoke.position.set(sx + Math.cos(ba) * 0.02, h, sz + Math.sin(ba) * 0.02);
        spoke.rotation.y = ba;
        // Droop 30-50 degrees below horizontal
        spoke.rotation.z = -(0.5 + Math.random() * 0.35);
        g.add(spoke);
      }
    }
  }
  return g;
}

function buildOak(): THREE.Group {
  const g = new THREE.Group();

  // Stout gnarled trunk with prominent root flare
  const trunkMat = mat(0x5a3a1a);
  // Root flare — wide at base
  const flareGeo = new THREE.CylinderGeometry(0.18, 0.35, 0.25, 8);
  const flare = new THREE.Mesh(flareGeo, mat(0x4a2a10));
  flare.position.y = 0.125;
  g.add(flare);
  // Short thick trunk
  addTrunk(g, 0, 0.25, 0, 0.18, 0.13, 0.45, 0x5a3a1a);

  // Major fork — trunk splits into 2-3 heavy limbs visible below canopy
  const branchMat = mat(0x5a3a1a);
  const forks = [
    { a: 0.4, tilt: 0.7, len: 0.5, rBot: 0.1, rTop: 0.06 },
    { a: 2.5, tilt: 0.6, len: 0.45, rBot: 0.09, rTop: 0.055 },
    { a: 4.2, tilt: 0.65, len: 0.4, rBot: 0.08, rTop: 0.05 },
  ];
  for (const f of forks) {
    const geo = new THREE.CylinderGeometry(f.rTop, f.rBot, f.len, 6);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(f.a) * 0.08, 0.65, Math.sin(f.a) * 0.08);
    m.rotation.z = Math.cos(f.a) * f.tilt;
    m.rotation.x = Math.sin(f.a) * f.tilt;
    g.add(m);
  }

  // Canopy palette — warm olive-greens for oak character
  const canopyColors = [0x66bb44, 0x5aaa3a, 0x77cc55, 0x6ab844, 0x55a033];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // 4 distinct lobe clusters — arranged asymmetrically for organic feel
  // Each lobe = 3-4 overlapping canopy spheres
  const lobes = [
    { cx: 0.55, cz: 0.15, cy: 1.1, size: 0.4 },  // right lobe
    { cx: -0.5, cz: -0.2, cy: 1.15, size: 0.38 }, // left lobe
    { cx: 0.1, cz: 0.5, cy: 1.05, size: 0.35 },   // front lobe
    { cx: -0.15, cz: -0.5, cy: 1.1, size: 0.36 },  // back lobe
    { cx: 0.0, cz: 0.0, cy: 1.2, size: 0.45 },     // center mass
  ];
  for (const lobe of lobes) {
    // Core of each lobe
    addCanopy(g, lobe.cx, lobe.cy, lobe.cz, lobe.size, cc());
    // 3 satellite spheres around lobe center for roundedness
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2 + Math.random() * 0.5;
      const d = lobe.size * 0.5;
      addCanopy(g,
        lobe.cx + Math.cos(a) * d,
        lobe.cy + (Math.random() - 0.3) * 0.15,
        lobe.cz + Math.sin(a) * d,
        lobe.size * (0.55 + Math.random() * 0.15), cc());
    }
  }

  // Outer reach — additional spheres pushed far out for wide spread
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dist = 0.7 + Math.random() * 0.15;
    addCanopy(g, Math.cos(a) * dist, 1.0 + Math.random() * 0.2, Math.sin(a) * dist,
      0.28 + Math.random() * 0.1, cc());
  }

  // Top cap — low and flat, oak crown is broad not pointy
  addCanopy(g, 0, 1.4, 0, 0.35, cc());
  addCanopy(g, 0.15, 1.35, -0.1, 0.28, cc());

  // Dense inner fill — seal all gaps, no sky visible through canopy
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const dist = 0.2 + Math.random() * 0.3;
    const y = 0.95 + Math.random() * 0.3;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.25 + Math.random() * 0.1, cc());
  }

  // Bottom skirt — close gap between branches and canopy
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.35, 0.85, Math.sin(a) * 0.35, 0.22, cc());
  }

  return g;
}

function buildMagnolia(): THREE.Group {
  const g = new THREE.Group();

  // Pale silvery-gray bark — magnolia's signature smooth bark
  const barkColor = 0xbbaa99;
  const barkDark = 0xaa9988;
  // Root flare — stout base
  const flareGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.2, 8);
  const flareMesh = new THREE.Mesh(flareGeo, mat(barkDark));
  flareMesh.position.y = 0.1;
  g.add(flareMesh);
  // Short thick trunk
  addTrunk(g, 0, 0.2, 0, 0.16, 0.11, 0.45, barkColor);

  // Low branching — magnolia branches start very low
  const branchMat = mat(barkColor);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const geo = new THREE.CylinderGeometry(0.025, 0.06, 0.35, 5);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(a) * 0.08, 0.6, Math.sin(a) * 0.08);
    m.rotation.z = Math.cos(a) * 0.45;
    m.rotation.x = Math.sin(a) * 0.45;
    g.add(m);
  }

  // Dense egg-shaped crown — glossy magnolia foliage
  // Multiple green shades: dark interior, bright highlights for glossy look
  const canopyColors = [0x44aa55, 0x55bb66, 0x3d9e48, 0x4aaa55, 0x66cc77];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // Core mass — egg shape, slightly taller than wide
  addCanopy(g, 0, 1.15, 0, 0.55, cc());
  addCanopy(g, 0, 1.35, 0, 0.5, cc());
  addCanopy(g, 0, 0.95, 0, 0.5, cc());

  // Dense layered rings — 3 tiers with lots of overlap
  for (let tier = 0; tier < 3; tier++) {
    const y = 0.85 + tier * 0.25;
    const tierR = 0.5 - tier * 0.05;
    const count = 7;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + tier * 0.4;
      const dist = tierR * (0.5 + Math.random() * 0.35);
      const r = 0.25 + Math.random() * 0.1;
      addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, r, cc());
    }
  }

  // Inner fill — seal all gaps
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const dist = 0.15 + Math.random() * 0.2;
    const y = 0.9 + Math.random() * 0.4;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.22 + Math.random() * 0.08, cc());
  }

  // Top cap — smooth rounded peak
  addCanopy(g, 0, 1.55, 0, 0.38, cc());
  addCanopy(g, 0.08, 1.5, -0.05, 0.3, cc());

  // Bottom skirt — canopy starts low on this tree
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.3, 0.75, Math.sin(a) * 0.3, 0.22, cc());
  }

  // Large showy magnolia blooms — the defining feature
  // Warm whites and soft pinks that pop against green canopy
  const bloomMats = [
    mat(0xfff0dd, { roughness: 0.3 }),  // warm cream
    mat(0xffccdd, { roughness: 0.3 }),  // soft pink
    mat(0xffe8d0, { roughness: 0.3 }),  // peachy cream
  ];
  // 18 blooms on OUTER canopy surface, distributed for all-angle visibility
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    // Place on outer surface of egg-shaped crown
    const y = 0.85 + (i % 3) * 0.3 + Math.random() * 0.1;
    const dist = 0.45 + Math.random() * 0.1;
    const size = 0.1 + Math.random() * 0.05; // large: 0.10-0.15
    const geo = new THREE.IcosahedronGeometry(size, 1);
    const m = new THREE.Mesh(geo, bloomMats[Math.floor(Math.random() * bloomMats.length)]);
    m.position.set(Math.cos(a) * dist, y, Math.sin(a) * dist);
    g.add(m);
  }
  // A few smaller buds (pointed, cone-shaped) for variety
  const budMat = mat(0xeedd99, { roughness: 0.5 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const y = 1.0 + Math.random() * 0.5;
    const dist = 0.5 + Math.random() * 0.08;
    const geo = new THREE.ConeGeometry(0.03, 0.08, 5);
    const bud = new THREE.Mesh(geo, budMat);
    bud.position.set(Math.cos(a) * dist, y, Math.sin(a) * dist);
    g.add(bud);
  }

  return g;
}

function buildConifer(): THREE.Group {
  const g = new THREE.Group();

  // Reddish-brown trunk — barely visible, hidden by lowest tier
  addTrunk(g, 0, 0, 0, 0.08, 0.05, 0.4, 0x8a5a3a);

  // Tier-based color gradient: dark at bottom → bright at top
  // Bottom tiers are deep forest, top tiers are sunlit fresh green
  const tierPalette = [
    0x2d7744, // tier 0 — darkest, interior shadow
    0x338850, // tier 1
    0x3a9955, // tier 2
    0x44aa60, // tier 3 — mid
    0x4ebb6a, // tier 4
    0x55cc77, // tier 5
    0x66dd88, // tier 6 — brightest, sunlit top
  ];
  // Undersides are darker variant for depth
  const undersidePalette = [
    0x225533, 0x286640, 0x2d7744, 0x338850, 0x3a9955, 0x44aa60, 0x4ebb6a,
  ];

  const tierCount = 7;
  for (let i = 0; i < tierCount; i++) {
    const t = i / (tierCount - 1); // 0=bottom, 1=top
    const y = 0.3 + i * 0.28;
    const r = 0.8 - i * 0.1;
    const h = 0.35 + (1 - t) * 0.1;
    const tierColor = tierPalette[i];
    const underColor = undersidePalette[i];

    // Main tier cone
    const coneGeo = new THREE.ConeGeometry(r, h, 8);
    const cone = new THREE.Mesh(coneGeo, mat(tierColor));
    cone.position.set(0, y, 0);
    g.add(cone);

    // Droop cones around edge — use darker underside color
    const droopCount = Math.max(5, 8 - i);
    for (let j = 0; j < droopCount; j++) {
      const a = (j / droopCount) * Math.PI * 2 + i * 0.4;
      const droopR = r * 0.38;
      const droopH = h * 0.65;
      const droopGeo = new THREE.ConeGeometry(droopR, droopH, 5);
      const droop = new THREE.Mesh(droopGeo, mat(underColor));
      droop.position.set(
        Math.cos(a) * r * 0.5,
        y - h * 0.2,
        Math.sin(a) * r * 0.5,
      );
      droop.rotation.z = Math.cos(a) * 0.3;
      droop.rotation.x = Math.sin(a) * 0.3;
      g.add(droop);
    }

    // Inner fill cones — match tier color
    if (i > 0 && i < tierCount - 1) {
      const innerCount = 5;
      for (let j = 0; j < innerCount; j++) {
        const a = (j / innerCount) * Math.PI * 2 + i * 0.7;
        const innerGeo = new THREE.ConeGeometry(r * 0.28, h * 0.55, 5);
        const inner = new THREE.Mesh(innerGeo, mat(tierColor));
        inner.position.set(
          Math.cos(a) * r * 0.25,
          y + h * 0.05,
          Math.sin(a) * r * 0.25,
        );
        g.add(inner);
      }
    }
  }

  // Top spire — brightest green, sits flush
  const topY = 0.3 + (tierCount - 1) * 0.28;
  const spireGeo = new THREE.ConeGeometry(0.15, 0.35, 6);
  const spire = new THREE.Mesh(spireGeo, mat(0x77eebb));
  spire.position.set(0, topY + 0.15, 0);
  g.add(spire);

  return g;
}

function buildTropical(): THREE.Group {
  const g = new THREE.Group();

  // Smooth columnar trunk with buttress roots — tropical hardwood
  const trunkColor = 0x7a6a5a;
  // Prominent buttress roots — large fin-like structures radiating from base
  const buttMat = mat(0x6a5a4a);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.2;
    const geo = new THREE.BoxGeometry(0.08, 0.5, 0.22);
    const m = new THREE.Mesh(geo, buttMat);
    m.position.set(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18);
    m.rotation.y = a;
    g.add(m);
  }
  // Main trunk — moderate height
  addTrunk(g, 0, 0, 0, 0.16, 0.1, 1.1, trunkColor);

  // Lush tropical canopy — impenetrable mass of foliage, wider than tall
  // Vivid tropical greens — bright for ACES, with sun-bleached top accent
  const canopyColors = [0x44bb55, 0x55cc66, 0x3aaa44, 0x66dd77, 0x4abc55];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];
  const sunTop = 0x88dd55; // yellow-green sun-bleached upper canopy

  // Core mass — large, broad
  addCanopy(g, 0, 1.55, 0, 0.65, cc());
  addCanopy(g, 0, 1.4, 0, 0.6, cc());
  addCanopy(g, 0, 1.7, 0, 0.5, cc());

  // Wide spreading lobes — pushed far out, bigger radius for overlap
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const dist = 0.6 + Math.random() * 0.15;
    const y = 1.35 + Math.random() * 0.3;
    const r = 0.38 + Math.random() * 0.12;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, r, cc());
  }

  // Dense fill layer — intermediate angles
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const dist = 0.3 + Math.random() * 0.25;
    const y = 1.35 + Math.random() * 0.3;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.3 + Math.random() * 0.1, cc());
  }

  // Sun-bleached top cap
  addCanopy(g, 0, 1.8, 0, 0.4, sunTop);
  addCanopy(g, 0.1, 1.75, -0.08, 0.3, sunTop);

  // Heavy hanging bottom skirt — tropical canopy droops low
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.35, 1.1, Math.sin(a) * 0.35, 0.25, cc());
  }
  // Second lower ring
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    addCanopy(g, Math.cos(a) * 0.25, 1.0, Math.sin(a) * 0.25, 0.2, cc());
  }

  // Epiphyte / aerial root accents — hanging vines or moss
  const vineMat = mat(0x55aa44);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const dist = 0.4 + Math.random() * 0.1;
    const len = 0.2 + Math.random() * 0.15;
    const vine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.015, len, 3),
      vineMat,
    );
    vine.position.set(Math.cos(a) * dist, 1.2 - len / 2, Math.sin(a) * dist);
    g.add(vine);
  }

  return g;
}

function buildPalm(): THREE.Group {
  const g = new THREE.Group();

  // Curved trunk with slight lean — CatmullRom spline
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.5, 0.03),
    new THREE.Vector3(0.1, 1.1, 0),
    new THREE.Vector3(0.07, 1.6, -0.02),
    new THREE.Vector3(0.04, 2.0, 0),
  ]);
  // Trunk tube — warm brown
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.065, 6, false), mat(0x9a8a7a)));
  // Rings / scars along trunk
  const ringMat = mat(0x8a7a6a);
  for (let ri = 1; ri < 10; ri++) {
    const pt = curve.getPoint(ri / 10);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 4, 8), ringMat);
    ring.position.copy(pt);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }

  // Crown shaft — green cylinder at top where fronds emerge
  const shaftGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.15, 6);
  const shaft = new THREE.Mesh(shaftGeo, mat(0x55aa44));
  shaft.position.set(0.04, 2.05, 0);
  g.add(shaft);

  // Fronds — 12 broad arching fronds with graceful droop
  // Per-frond color variation for depth
  const frondColors = [matDS(0x55bb44), matDS(0x66cc55), matDS(0x44aa33), matDS(0x77dd66)];
  const fc = () => frondColors[Math.floor(Math.random() * frondColors.length)];
  const topY = 2.1, topX = 0.04;
  const frondCount = 12;

  for (let i = 0; i < frondCount; i++) {
    const a = (i / frondCount) * Math.PI * 2;
    const fLen = 1.0 + Math.random() * 0.3;
    const fWidth = 0.3 + Math.random() * 0.08; // wider fronds

    // Main blade + angled cross blade for V-shape volume
    for (let cross = 0; cross < 2; cross++) {
      const w = cross === 0 ? fWidth : fWidth * 0.7;
      const fGeo = new THREE.PlaneGeometry(w, fLen, 2, 12);
      const fPos = fGeo.attributes.position;
      for (let vi = 0; vi < fPos.count; vi++) {
        const origY = fPos.getY(vi);
        const t = (origY + fLen / 2) / fLen; // 0=base, 1=tip
        // Taper toward tip
        fPos.setX(vi, fPos.getX(vi) * (1 - 0.65 * t));
        // Arch up then droop hard — more droop at tip
        fPos.setY(vi, t * 0.3 - t * t * t * fLen * 0.55);
        // Extend outward
        fPos.setZ(vi, t * fLen * 0.8);
      }
      fGeo.computeVertexNormals();
      const frond = new THREE.Mesh(fGeo, fc());
      frond.position.set(topX, topY, 0);
      // V-angle: cross blade tilted slightly for volume
      frond.rotation.y = a + cross * 0.12;
      if (cross === 1) frond.rotation.z = 0.1;
      g.add(frond);
    }
  }

  // Dead/brown fronds hanging below — 3 drooping old fronds for realism
  const deadMat = matDS(0x998844);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 1.0;
    const fLen = 0.6;
    const fGeo = new THREE.PlaneGeometry(0.15, fLen, 1, 6);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.5 * t));
      fPos.setY(vi, -t * fLen * 0.7); // hang straight down
      fPos.setZ(vi, t * fLen * 0.3);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, deadMat);
    frond.position.set(topX, topY - 0.1, 0);
    frond.rotation.y = a;
    g.add(frond);
  }

  // Coconut cluster at crown base
  const coconutMat = mat(0x88aa44, { roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const ca = (i / 4) * Math.PI * 2 + 0.5;
    const nut = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 5, 4),
      coconutMat,
    );
    nut.position.set(topX + Math.cos(ca) * 0.06, topY - 0.08, Math.sin(ca) * 0.06);
    g.add(nut);
  }

  return g;
}

function buildBirch(): THREE.Group {
  const g = new THREE.Group();

  // Bright white bark — must pop, pushed very bright for ACES
  const barkWhite = 0xf8f4ee;
  addTrunk(g, 0, 0, 0, 0.06, 0.035, 0.9, barkWhite);

  // Bold dark lenticular patches — birch's signature, large enough to read
  const lenticelMat = mat(0x443322);
  for (let pi = 0; pi < 8; pi++) {
    const pa = (pi / 8) * Math.PI * 2 + Math.random() * 0.3;
    const py = 0.15 + pi * 0.1 + Math.random() * 0.05;
    const pw = 0.06 + Math.random() * 0.04;
    const ph = 0.018 + Math.random() * 0.01;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), lenticelMat);
    patch.position.set(Math.cos(pa) * 0.05, py, Math.sin(pa) * 0.05);
    patch.rotation.y = pa;
    g.add(patch);
  }

  // Visible branches in exposed trunk section — white bark branches
  const brMat = mat(0xe8e0d8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.random() * 0.4;
    const y = 0.5 + i * 0.12;
    const len = 0.25 + Math.random() * 0.15;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.02, len, 4), brMat);
    branch.position.set(Math.cos(a) * 0.06, y + len * 0.3, Math.sin(a) * 0.06);
    branch.rotation.z = Math.cos(a) * 0.5;
    branch.rotation.x = Math.sin(a) * 0.5;
    g.add(branch);
  }

  // Canopy — bright warm yellow-green, birch's signature spring foliage
  const canopyColors = [0x99dd44, 0xaaee55, 0xbbee66, 0x88cc33, 0xaadd44];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // Tall narrow crown — 1.3:1 height:width ratio
  // Canopy starts lower (y=0.7) to fill more of the tree
  // Core column
  addCanopy(g, 0, 1.15, 0, 0.4, cc());
  addCanopy(g, 0, 0.95, 0, 0.38, cc());
  addCanopy(g, 0, 1.35, 0, 0.35, cc());
  addCanopy(g, 0, 1.5, 0, 0.3, cc());

  // Narrow mid ring — tight, not wide
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const dist = 0.25 + Math.random() * 0.08;
    const y = 0.95 + Math.random() * 0.4;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.22 + Math.random() * 0.06, cc());
  }

  // Fill layer
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const dist = 0.12 + Math.random() * 0.15;
    const y = 0.9 + Math.random() * 0.5;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.2 + Math.random() * 0.06, cc());
  }

  // Prominent tapered apex — birch crown peaks upward
  addCanopy(g, 0, 1.65, 0, 0.25, cc());
  addCanopy(g, 0.03, 1.75, -0.02, 0.18, cc());

  // Lower fringe — canopy starts at branch zone
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.2;
    addCanopy(g, Math.cos(a) * 0.2, 0.75, Math.sin(a) * 0.2, 0.18, cc());
  }

  return g;
}

function buildEvergreenShrub(): THREE.Group {
  const g = new THREE.Group();
  // Dense boxwood/holly hedge — wide pillowy dome, vivid multi-tone greens
  const stemMat = mat(0x5a3a1a);
  // Top/outer = bright warm green, body = saturated mid, underside = deep cool
  const topColors = [0x77dd66, 0x88ee77, 0x6acc55];     // sun-facing — bright
  const midColors = [0x55bb55, 0x4daa4d, 0x66cc66];     // body mass
  const botColors = [0x338833, 0x2d7a2d, 0x3a9944];     // shadow/underside — dark cool

  // Short multi-stem base (barely visible under foliage)
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6 + 0.3;
    const r = 0.08 + Math.random() * 0.04;
    const h = 0.25 + Math.random() * 0.1;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, h, 4), stemMat);
    stem.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    stem.rotation.z = Math.cos(a) * 0.15;
    stem.rotation.x = Math.sin(a) * 0.15;
    g.add(stem);
  }

  // Opaque core ellipsoid — extends past leaf envelope to catch ALL edge leaks
  const coreGeo = new THREE.SphereGeometry(0.52, 14, 10);
  coreGeo.scale(1.0, 0.65, 1.0); // wide oblate dome
  const coreMesh = new THREE.Mesh(coreGeo, mat(0x2d6633));
  coreMesh.position.set(0, 0.34, 0);
  g.add(coreMesh);

  // Core mass — wide flat dome (boxwood: significantly wider than tall)
  addCanopy(g, 0, 0.38, 0, 0.45, midColors[0]);
  addCanopy(g, 0, 0.48, 0, 0.40, midColors[1]);
  addCanopy(g, 0, 0.30, 0, 0.42, midColors[2]);

  // Wide equatorial ring — 12 large blobs, pushed further out
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI * 2 / 12 + 0.15;
    const r = 0.36 + Math.random() * 0.05;
    addCanopy(g, Math.cos(a) * r, 0.32 + Math.random() * 0.06, Math.sin(a) * r,
      0.28 + Math.random() * 0.04, midColors[i % midColors.length]);
  }

  // Inner fill shell
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8 + 0.4;
    const r = 0.24 + Math.random() * 0.06;
    addCanopy(g, Math.cos(a) * r, 0.36 + Math.random() * 0.08, Math.sin(a) * r,
      0.24 + Math.random() * 0.03, midColors[(i + 1) % midColors.length]);
  }

  // Upper dome — flat pillowy lumps with plateau top
  const topOffsets: [number, number, number, number][] = [
    [0.0, 0.56, 0.0, 0.30], [-0.15, 0.58, 0.12, 0.24], [0.16, 0.57, -0.10, 0.23],
    [-0.08, 0.59, -0.15, 0.22], [0.12, 0.58, 0.14, 0.22], [0.0, 0.61, 0.0, 0.20],
    [-0.22, 0.54, 0.0, 0.21], [0.0, 0.55, -0.22, 0.21],
    [0.18, 0.55, 0.18, 0.19], [-0.18, 0.56, -0.18, 0.19],
  ];
  for (let i = 0; i < topOffsets.length; i++) {
    const [x, y, z, r] = topOffsets[i];
    addCanopy(g, x, y, z, r, topColors[i % topColors.length]);
  }

  // Bottom skirt — dark cool greens, large overlapping
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10;
    const r = 0.32 + Math.random() * 0.06;
    addCanopy(g, Math.cos(a) * r, 0.18 + Math.random() * 0.04, Math.sin(a) * r,
      0.24 + Math.random() * 0.03, botColors[i % botColors.length]);
  }

  // Ground-level fill — seal bottom completely
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8 + 0.3;
    const r = 0.22 + Math.random() * 0.05;
    addCanopy(g, Math.cos(a) * r, 0.10, Math.sin(a) * r, 0.20, botColors[2]);
  }

  return g;
}

function buildDeciduousShrub(): THREE.Group {
  const g = new THREE.Group();
  // Multi-stemmed deciduous shrub — vase/fountain shape, exposed stems, warm yellow-green
  const stemMat = mat(0x7a6a55);
  const leafColors = [0xbbff44, 0xccff55, 0xaaee33, 0xddff77, 0xbbee44]; // very warm yellow-green
  const darkLeaf = [0x77aa22, 0x88bb33, 0x669920];

  // 7 arching stems — tall, wide spread, asymmetric heights
  const stemHeights = [1.3, 1.1, 1.4, 1.0, 1.25, 0.95, 1.35]; // varied
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + (Math.random() - 0.5) * 0.45;
    const h = stemHeights[i];
    const spread = 0.65 + Math.random() * 0.15;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.18, h * 0.5, Math.sin(a) * 0.18),
      new THREE.Vector3(Math.cos(a) * spread * 0.7, h * 0.85, Math.sin(a) * spread * 0.7),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.75, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.028, 5, false), stemMat));

    // Foliage only at upper part of branch — tip + upper mid
    const tip = curve.getPoint(0.88);
    addCanopy(g, tip.x, tip.y, tip.z, 0.22 + Math.random() * 0.05, leafColors[i % leafColors.length]);
    const upper = curve.getPoint(0.72);
    addCanopy(g, upper.x, upper.y + 0.06, upper.z, 0.17 + Math.random() * 0.04, leafColors[(i + 1) % leafColors.length]);
  }

  // Crown fill — high up only, keeping lower stems exposed
  const crownGeo = new THREE.SphereGeometry(0.20, 8, 6);
  const crownMesh = new THREE.Mesh(crownGeo, mat(darkLeaf[0]));
  crownMesh.position.set(0, 0.90, 0);
  g.add(crownMesh);

  addCanopy(g, 0, 0.95, 0, 0.26, leafColors[0]);
  addCanopy(g, 0.10, 0.90, -0.08, 0.20, leafColors[3]);
  addCanopy(g, -0.08, 0.92, 0.10, 0.20, leafColors[1]);

  // Upper canopy ring connecting branch tips
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8 + 0.2;
    const r = 0.35 + Math.random() * 0.08;
    addCanopy(g, Math.cos(a) * r, 0.82 + Math.random() * 0.1, Math.sin(a) * r,
      0.18 + Math.random() * 0.04, leafColors[i % leafColors.length]);
  }

  // Bright top
  addCanopy(g, 0, 1.05, 0, 0.18, leafColors[3]);

  // HERO: Large forsythia flower clusters — the defining feature
  const flowerColors = [0xffdd33, 0xffcc22, 0xffee55, 0xffbb11];
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI * 2 / 20 + Math.random() * 0.2;
    const r = 0.32 + Math.random() * 0.25;
    const fy = 0.70 + Math.random() * 0.30;
    const fl = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(0.10 + Math.random() * 0.06, 1), 0.015),
      mat(flowerColors[i % flowerColors.length]),
    );
    fl.position.set(Math.cos(a) * r, fy, Math.sin(a) * r);
    g.add(fl);
  }

  return g;
}

function buildMediterranean(): THREE.Group {
  const g = new THREE.Group();
  // Mediterranean maquis — compact, woody, silvery olive-green foliage, lavender flowers
  const woodMat = mat(0x8a7a66);
  // Silvery sage/dusty grey-green palette — desaturated, Mediterranean feel
  const leafColors = [0x99aa88, 0xaabb99, 0x8a9a78, 0xbbccaa, 0x96a882];
  const darkLeaf = [0x6a7a5a, 0x5e6e4e, 0x788868];

  // Gnarled woody base — thick twisted stems
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + (Math.random() - 0.5) * 0.4;
    const h = 0.35 + Math.random() * 0.15;
    const spread = 0.12 + Math.random() * 0.08;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03),
      new THREE.Vector3(Math.cos(a) * spread * 0.5, h * 0.5, Math.sin(a) * spread * 0.5),
      new THREE.Vector3(Math.cos(a) * spread, h, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.025 + Math.random() * 0.01, 5, false), woodMat));
  }

  // Opaque core — extremely flat pancake
  const coreGeo = new THREE.SphereGeometry(0.58, 14, 10);
  coreGeo.scale(1.0, 0.30, 1.0);
  g.add(new THREE.Mesh(coreGeo, mat(darkLeaf[0])));
  (g.children[g.children.length - 1] as THREE.Mesh).position.set(0, 0.20, 0);

  // Very flat cushion foliage (target 2:1 width:height)
  addCanopy(g, 0, 0.22, 0, 0.50, leafColors[0]);
  addCanopy(g, 0, 0.28, 0, 0.42, leafColors[2]);
  addCanopy(g, 0, 0.16, 0, 0.45, darkLeaf[0]);

  // Very wide equatorial ring — 12 blobs, very low
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI * 2 / 12 + 0.15;
    const r = 0.44 + Math.random() * 0.06;
    addCanopy(g, Math.cos(a) * r, 0.18 + Math.random() * 0.04, Math.sin(a) * r,
      0.24 + Math.random() * 0.04, leafColors[i % leafColors.length]);
  }

  // Irregular bumpy mounding — varied heights for organic top surface
  const bumpHeights = [0.34, 0.28, 0.36, 0.26, 0.32, 0.30, 0.38, 0.27];
  const bumpSizes = [0.22, 0.18, 0.24, 0.16, 0.20, 0.19, 0.21, 0.17];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8 + 0.3;
    const r = 0.18 + Math.random() * 0.14;
    addCanopy(g, Math.cos(a) * r, bumpHeights[i], Math.sin(a) * r,
      bumpSizes[i], leafColors[(i + 1) % leafColors.length]);
  }

  // Low flat top — gentle undulation only
  addCanopy(g, 0, 0.32, 0, 0.26, leafColors[3]);
  addCanopy(g, 0.12, 0.30, -0.10, 0.18, leafColors[1]);
  addCanopy(g, -0.10, 0.31, 0.12, 0.17, leafColors[4]);

  // Bottom skirt — wide coverage
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10;
    const r = 0.38 + Math.random() * 0.06;
    addCanopy(g, Math.cos(a) * r, 0.10 + Math.random() * 0.03, Math.sin(a) * r,
      0.20, darkLeaf[i % darkLeaf.length]);
  }

  // HERO: Tall thick lavender flower spikes projecting well above foliage
  const lavenderColors = [0xcc88ee, 0xdd99ff, 0xbb77dd, 0xeeaaff];
  for (let i = 0; i < 22; i++) {
    const a = i * Math.PI * 2 / 22 + Math.random() * 0.15;
    const r = 0.28 + Math.random() * 0.22; // mostly at outer radii
    const spikeH = 0.25 + Math.random() * 0.12;
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.05 + Math.random() * 0.02, spikeH, 5),
      mat(lavenderColors[i % lavenderColors.length]),
    );
    spike.position.set(Math.cos(a) * r, 0.30 + spikeH / 2, Math.sin(a) * r);
    g.add(spike);
  }

  return g;
}

function buildThorny(): THREE.Group {
  const g = new THREE.Group();
  // Thorny shrub — branch skeleton dominant, big visible thorns, sparse bracts
  const woodMat = mat(0x7a5533);
  const leafColors = [0x55aa44, 0x66bb55, 0x4d9d3d];
  const flowerColors = [0xff66aa, 0xff5599, 0xee4488, 0xff88bb, 0xdd3377];
  const thornMat = mat(0xddeecc); // pale green-white for contrast against brown

  // 8 branches — varied heights, distributed in all directions for 3D depth
  const branchData = [
    { a: 0.0, h: 1.20, spread: 0.55, bracts: true },   // front
    { a: 0.78, h: 0.55, spread: 0.60, bracts: false },  // bare, front-right
    { a: 1.57, h: 1.30, spread: 0.65, bracts: true },   // right (depth axis)
    { a: 2.35, h: 0.50, spread: 0.58, bracts: false },  // bare, back-right
    { a: 3.14, h: 1.10, spread: 0.58, bracts: true },   // back
    { a: 3.93, h: 0.65, spread: 0.70, bracts: true },   // back-left
    { a: 4.71, h: 1.25, spread: 0.62, bracts: false },  // bare, left (depth axis)
    { a: 5.50, h: 0.70, spread: 0.55, bracts: true },   // front-left
  ];
  for (let i = 0; i < branchData.length; i++) {
    const { a, h, spread, bracts } = branchData[i];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.14, h * 0.35, Math.sin(a) * 0.14),
      new THREE.Vector3(Math.cos(a) * spread * 0.6, h * 0.7, Math.sin(a) * spread * 0.6),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.6, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.032, 5, false), woodMat));

    // Fork on every other branch
    if (i % 2 === 0) {
      const forkPt = curve.getPoint(0.50);
      const forkA = a + (i % 4 === 0 ? 0.6 : -0.6);
      const forkCurve = new THREE.CatmullRomCurve3([
        forkPt,
        new THREE.Vector3(Math.cos(forkA) * spread * 0.5, h * 0.8, Math.sin(forkA) * spread * 0.5),
        new THREE.Vector3(Math.cos(forkA) * spread * 0.85, h * 0.65, Math.sin(forkA) * spread * 0.85),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 6, 0.020, 4, false), woodMat));
    }

    // Small leaf + bract only on branches marked true
    if (bracts) {
      const tip = curve.getPoint(0.82);
      addCanopy(g, tip.x, tip.y, tip.z, 0.08, leafColors[i % leafColors.length]);
      // 2 small bracts per branch
      for (const t of [0.65, 0.85]) {
        const pt = curve.getPoint(t);
        const fl = new THREE.Mesh(
          jitter(new THREE.IcosahedronGeometry(0.06 + Math.random() * 0.02, 0), 0.008),
          mat(flowerColors[i % flowerColors.length]),
        );
        fl.position.set(pt.x + (Math.random() - 0.5) * 0.04, pt.y + 0.03, pt.z + (Math.random() - 0.5) * 0.04);
        g.add(fl);
      }
    }

    // BIG visible thorns — 4 per branch, including on upper sections
    for (let t = 0; t < 4; t++) {
      const tPt = curve.getPoint(0.20 + t * 0.20);
      const outDir = Math.atan2(tPt.z, tPt.x);
      const side = (t % 2 === 0) ? 1 : -1; // alternate sides
      const perpDir = outDir + side * Math.PI / 2;
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.30, 3), thornMat);
      spine.position.set(tPt.x, tPt.y, tPt.z);
      spine.lookAt(
        tPt.x + Math.cos(perpDir) * 0.4,
        tPt.y - 0.1,
        tPt.z + Math.sin(perpDir) * 0.4,
      );
      g.add(spine);
    }
  }

  // Minimal center — 1 tiny leaf cluster
  addCanopy(g, 0, 0.40, 0, 0.10, leafColors[0]);

  return g;
}

function buildDesertShrub(): THREE.Group {
  const g = new THREE.Group();
  // Creosote / brittlebush — wiry skeleton dominant, tiny leaf tufts, yellow daisy flowers at tips
  const stemMat = mat(0x8a7a66);
  // Very desaturated grey-silver-sage leaves
  const leafMat = mat(0x99a888);
  const leafMat2 = mat(0xaab898);
  const flowerMat = mat(0xffdd44);

  // 8 wiry stems — visible skeleton, varied heights
  const stemData = [
    { a: 0.0, h: 0.85, lean: 0.42, flower: true },
    { a: 0.78, h: 0.60, lean: 0.52, flower: false },
    { a: 1.57, h: 0.95, lean: 0.38, flower: true },
    { a: 2.35, h: 0.55, lean: 0.56, flower: false },
    { a: 3.14, h: 0.80, lean: 0.44, flower: true },
    { a: 3.93, h: 0.68, lean: 0.50, flower: true },
    { a: 4.71, h: 0.92, lean: 0.40, flower: false },
    { a: 5.50, h: 0.58, lean: 0.54, flower: true },
  ];
  for (let i = 0; i < stemData.length; i++) {
    const s = stemData[i];
    const spread = s.lean * s.h * 0.85;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(s.a) * 0.03, 0, Math.sin(s.a) * 0.03),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.35, s.h * 0.4, Math.sin(s.a) * spread * 0.35),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.75, s.h * 0.8, Math.sin(s.a) * spread * 0.75),
      new THREE.Vector3(Math.cos(s.a) * spread, s.h * 0.68, Math.sin(s.a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.022, 4, false), stemMat));

    // 2-3 forking sub-branches — thin
    const forkCount = 2 + (i % 2);
    for (let f = 0; f < forkCount; f++) {
      const forkT = 0.50 + f * 0.18;
      const forkPt = curve.getPoint(forkT);
      const forkA = s.a + (f - forkCount / 2) * 0.45;
      const forkLen = 0.15 + Math.random() * 0.10;
      const forkCurve = new THREE.CatmullRomCurve3([
        forkPt,
        new THREE.Vector3(
          Math.cos(forkA) * (spread + forkLen * 0.6),
          forkPt.y + forkLen * 0.35,
          Math.sin(forkA) * (spread + forkLen * 0.6),
        ),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 4, 0.010, 3, false), stemMat));

      // Tiny leaf tuft at some fork tips only (not all)
      if (f === 0) {
        const ft = forkCurve.getPoint(0.9);
        const tuft = new THREE.Mesh(
          jitter(new THREE.IcosahedronGeometry(0.025, 0), 0.004),
          i % 2 === 0 ? leafMat : leafMat2,
        );
        tuft.position.set(ft.x, ft.y, ft.z);
        g.add(tuft);
      }
    }

    // Tiny leaf tuft at main stem tip
    const tip = curve.getPoint(0.85);
    const tipTuft = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(0.03, 0), 0.005),
      i % 2 === 0 ? leafMat : leafMat2,
    );
    tipTuft.position.set(tip.x, tip.y, tip.z);
    g.add(tipTuft);

    // Yellow daisy flower at tip — only on marked branches
    if (s.flower) {
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), flowerMat);
      fl.position.set(tip.x, tip.y + 0.04, tip.z);
      g.add(fl);
    }
  }

  // NO base mound — bare ground visible beneath the wiry structure

  return g;
}

function buildMangrove(): THREE.Group {
  const g = new THREE.Group();
  // Red mangrove — stilt roots, dense tropical canopy, aerial drop roots
  const rootMat = mat(0x7a4030);
  const rootMat2 = mat(0x6a3525);

  // Central trunk — short, thick, quickly branching
  addTrunk(g, 0, 0.40, 0, 0.07, 0.06, 0.20, 0x7a4030);

  // 9 prop/stilt roots — arching curves from trunk to ground
  const roots = [
    { a: 0.0, spread: 0.58, thick: 0.030, startY: 0.50 },
    { a: 0.70, spread: 0.48, thick: 0.022, startY: 0.42 },
    { a: 1.20, spread: 0.62, thick: 0.028, startY: 0.48 },
    { a: 1.85, spread: 0.44, thick: 0.020, startY: 0.38 },
    { a: 2.50, spread: 0.55, thick: 0.026, startY: 0.46 },
    { a: 3.30, spread: 0.60, thick: 0.028, startY: 0.50 },
    { a: 4.10, spread: 0.42, thick: 0.022, startY: 0.40 },
    { a: 4.90, spread: 0.56, thick: 0.027, startY: 0.47 },
    { a: 5.60, spread: 0.50, thick: 0.024, startY: 0.44 },
  ];
  for (let i = 0; i < roots.length; i++) {
    const rt = roots[i];
    const a = rt.a;
    const sp = rt.spread;
    const midOff = (Math.random() - 0.5) * 0.12;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, rt.startY, 0),
      new THREE.Vector3(Math.cos(a + midOff) * sp * 0.35, rt.startY * 0.55, Math.sin(a + midOff) * sp * 0.35),
      new THREE.Vector3(Math.cos(a) * sp * 0.75, 0.04, Math.sin(a) * sp * 0.75),
      new THREE.Vector3(Math.cos(a) * sp, -0.06, Math.sin(a) * sp),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, rt.thick, 5, false), i % 2 === 0 ? rootMat : rootMat2));

    // Secondary drop-root from some main roots
    if (i % 2 === 0) {
      const dropA = a + (Math.random() - 0.5) * 0.4;
      const dropR = sp * 0.45;
      const dropCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * sp * 0.40, 0.20, Math.sin(a) * sp * 0.40),
        new THREE.Vector3(Math.cos(dropA) * dropR, -0.03, Math.sin(dropA) * dropR),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(dropCurve, 5, 0.012, 4, false), rootMat2));
    }
  }

  // Canopy colors — tropical bright greens, multi-tone for depth
  const topGreens = [0x55bb55, 0x66cc66, 0x5dbe50];     // bright sun-facing
  const midGreens = [0x44aa44, 0x3d9d3d, 0x4daa50];     // body mass
  const darkGreens = [0x338833, 0x2d7a2d, 0x357a40];    // underside shadow

  // Opaque core — prevents see-through gaps
  const coreGeo = new THREE.SphereGeometry(0.38, 12, 8);
  coreGeo.scale(1.3, 0.7, 1.3); // wide flat dome
  const coreMesh = new THREE.Mesh(coreGeo, mat(0x2d6633));
  coreMesh.position.set(0, 0.72, 0);
  g.add(coreMesh);

  // Central dome — 3 large overlapping masses
  addCanopy(g, 0, 0.75, 0, 0.38, midGreens[0]);
  addCanopy(g, 0.05, 0.82, 0.05, 0.32, topGreens[0]);
  addCanopy(g, -0.05, 0.68, -0.05, 0.34, midGreens[1]);

  // Wide equatorial ring — 10 blobs spread out for breadth
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10 + 0.2;
    const r = 0.30 + Math.random() * 0.06;
    const y = 0.68 + Math.random() * 0.08;
    addCanopy(g, Math.cos(a) * r, y, Math.sin(a) * r,
      0.22 + Math.random() * 0.04, midGreens[i % midGreens.length]);
  }

  // Upper dome highlights — bright top
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6 + 0.5;
    const r = 0.18 + Math.random() * 0.06;
    addCanopy(g, Math.cos(a) * r, 0.84 + Math.random() * 0.06, Math.sin(a) * r,
      0.18 + Math.random() * 0.03, topGreens[i % topGreens.length]);
  }

  // Lower fringe — dark shadow masses hanging below main canopy
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6;
    const r = 0.28 + Math.random() * 0.05;
    addCanopy(g, Math.cos(a) * r, 0.58 + Math.random() * 0.04, Math.sin(a) * r,
      0.16 + Math.random() * 0.03, darkGreens[i % darkGreens.length]);
  }

  // Aerial roots — thin tubes dropping from canopy edge toward ground
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.8;
    const edgeR = 0.32 + Math.random() * 0.08;
    const dropCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * edgeR, 0.60, Math.sin(a) * edgeR),
      new THREE.Vector3(Math.cos(a) * edgeR * 1.05, 0.30, Math.sin(a) * edgeR * 1.05),
      new THREE.Vector3(Math.cos(a) * edgeR * 0.95, 0.02, Math.sin(a) * edgeR * 0.95),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(dropCurve, 6, 0.008, 3, false), rootMat2));
  }

  return g;
}

function buildSaguaro(): THREE.Group {
  const g = new THREE.Group();
  // Saguaro cactus — tall ribbed column with 3D-distributed arms, multi-tone greens
  const bodyGreen = mat(0x6a9a55);
  const lightGreen = mat(0x7aaa65);
  const darkGreen = mat(0x4a7a3a);

  // Main column — slightly tapered
  const mainH = 2.0;
  const mainGeo = new THREE.CylinderGeometry(0.13, 0.17, mainH, 8);
  const mainMesh = new THREE.Mesh(mainGeo, bodyGreen);
  mainMesh.position.set(0, mainH / 2, 0);
  g.add(mainMesh);

  // Dome cap on main column
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), lightGreen);
  cap.position.set(0, mainH, 0);
  g.add(cap);

  // 4 arms distributed around the trunk in 3D
  const armData = [
    { a: 0.4, startY: 0.85, spread: 0.48, topY: 1.35, thick: 0.075 },
    { a: 2.0, startY: 1.05, spread: 0.42, topY: 1.60, thick: 0.065 },
    { a: 3.5, startY: 0.65, spread: 0.52, topY: 1.10, thick: 0.070 },
    { a: 5.2, startY: 1.20, spread: 0.38, topY: 1.75, thick: 0.060 },
  ];
  for (let i = 0; i < armData.length; i++) {
    const arm = armData[i];
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.17, arm.startY, cz * 0.17),
      new THREE.Vector3(cx * arm.spread, arm.startY - 0.08, cz * arm.spread),
      new THREE.Vector3(cx * (arm.spread + 0.04), arm.startY + (arm.topY - arm.startY) * 0.5, cz * (arm.spread + 0.04)),
      new THREE.Vector3(cx * arm.spread * 0.92, arm.topY, cz * arm.spread * 0.92),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, arm.thick, 6, false), i % 2 === 0 ? bodyGreen : lightGreen));
    const tip = curve.getPoint(1);
    const armCap = new THREE.Mesh(
      new THREE.SphereGeometry(arm.thick, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2),
      lightGreen,
    );
    armCap.position.copy(tip);
    g.add(armCap);
  }

  // Vertical rib accents — thin ridges on main column
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6;
    const ribGeo = new THREE.BoxGeometry(0.015, mainH * 0.9, 0.015);
    const rib = new THREE.Mesh(ribGeo, darkGreen);
    rib.position.set(Math.cos(a) * 0.155, mainH * 0.48, Math.sin(a) * 0.155);
    g.add(rib);
  }

  return g;
}

function buildAloe(): THREE.Group {
  const g = new THREE.Group();
  // Agave/Aloe rosette — big thick fleshy 3D leaves, multi-tone greens
  const leafBright = mat(0x77aa55);
  const leafGreen = mat(0x6a9a50);
  const leafDark = mat(0x558844);

  // 3 rings of thick triangular leaves — LARGE dimensions
  const rings = [
    { count: 11, offset: 0.0, lean: 1.05, len: 1.4, thick: 0.08, baseR: 0.18 },
    { count: 8, offset: 0.28, lean: 0.7, len: 1.1, thick: 0.07, baseR: 0.12 },
    { count: 5, offset: 0.55, lean: 0.4, len: 0.75, thick: 0.06, baseR: 0.06 },
  ];

  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    const ringMats = [leafBright, leafGreen, leafDark];
    for (let i = 0; i < ring.count; i++) {
      const a = i * Math.PI * 2 / ring.count + ring.offset;

      // Thick fleshy leaf — tapered cross-section
      const leafGeo = new THREE.BoxGeometry(ring.thick * 2.5, ring.len, ring.thick, 1, 6, 1);
      const pos = leafGeo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const origY = pos.getY(vi);
        const t = (origY + ring.len / 2) / ring.len;
        pos.setX(vi, pos.getX(vi) * (1 - 0.75 * t));
        pos.setZ(vi, pos.getZ(vi) * (1 - 0.5 * t));
        const curveY = t * ring.len * 0.65 + 0.05;
        const curveOut = t * t * ring.len * 0.5;
        pos.setY(vi, curveY);
        pos.setZ(vi, pos.getZ(vi) + curveOut);
      }
      leafGeo.computeVertexNormals();

      const leafMesh = new THREE.Mesh(leafGeo, ringMats[ri]);
      leafMesh.position.set(Math.cos(a) * ring.baseR, 0, Math.sin(a) * ring.baseR);
      leafMesh.rotation.y = -a + Math.PI / 2;
      leafMesh.rotation.x = -ring.lean;
      g.add(leafMesh);

    }
  }

  return g;
}

function buildCaudiciform(): THREE.Group {
  const g = new THREE.Group();
  // Desert rose / Adenium — big swollen caudex, short branches, pink flowers
  const caudexMat = mat(0x9a8870);
  const caudexDark = mat(0x887766);
  const branchMat = mat(0x7a6a55);

  // BIG bulbous caudex — the defining feature
  const caudexGeo = new THREE.SphereGeometry(0.30, 10, 8);
  caudexGeo.scale(1.0, 0.75, 0.9); // slightly squashed
  const caudex = new THREE.Mesh(jitter(caudexGeo, 0.02), caudexMat);
  caudex.position.set(0, 0.20, 0);
  g.add(caudex);

  // Surface texture bumps on caudex
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8 + 0.3;
    const bumpR = 0.06 + Math.random() * 0.03;
    const bump = new THREE.Mesh(
      jitter(new THREE.SphereGeometry(bumpR, 5, 4), 0.008),
      i % 2 === 0 ? caudexMat : caudexDark,
    );
    bump.position.set(Math.cos(a) * 0.22, 0.16 + Math.random() * 0.08, Math.sin(a) * 0.22);
    g.add(bump);
  }

  // Exposed root flanges at base
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const rootGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.18, 4);
    const root = new THREE.Mesh(rootGeo, caudexDark);
    root.position.set(Math.cos(a) * 0.18, 0.02, Math.sin(a) * 0.18);
    root.rotation.z = -Math.cos(a) * 0.5;
    root.rotation.x = -Math.sin(a) * 0.5;
    g.add(root);
  }

  // 5 short stubby branches from top of caudex
  const leafColors = [0x5aaa44, 0x66bb55, 0x4d9d3d];
  const flowerMat = mat(0xff6699);
  const flowerMat2 = mat(0xff88aa);

  const branches = [
    { a: 0.3, h: 0.50, spread: 0.12, flower: true },
    { a: 1.5, h: 0.42, spread: 0.14, flower: false },
    { a: 2.8, h: 0.55, spread: 0.10, flower: true },
    { a: 4.2, h: 0.38, spread: 0.13, flower: true },
    { a: 5.4, h: 0.48, spread: 0.11, flower: false },
  ];
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    const cx = Math.cos(b.a), cz = Math.sin(b.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.08, 0.35, cz * 0.08),
      new THREE.Vector3(cx * b.spread, 0.35 + b.h * 0.6, cz * b.spread),
      new THREE.Vector3(cx * (b.spread + 0.04), 0.35 + b.h, cz * (b.spread + 0.04)),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.025, 4, false), branchMat));

    // Leaf cluster at tip
    const tip = curve.getPoint(0.9);
    addCanopy(g, tip.x, tip.y, tip.z, 0.10, leafColors[i % leafColors.length]);
    addCanopy(g, tip.x + 0.02, tip.y + 0.04, tip.z, 0.07, leafColors[(i + 1) % leafColors.length]);

    // Pink flowers on marked branches
    if (b.flower) {
      for (let fi = 0; fi < 3; fi++) {
        const fa = b.a + (fi - 1) * 0.4;
        const fl = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.035, 0),
          fi % 2 === 0 ? flowerMat : flowerMat2,
        );
        fl.position.set(tip.x + Math.cos(fa) * 0.04, tip.y + 0.06, tip.z + Math.sin(fa) * 0.04);
        g.add(fl);
      }
    }
  }

  return g;
}

function buildEuphorbia(): THREE.Group {
  const g = new THREE.Group();
  // Candelabra euphorbia — woody trunk, multi-tone succulent stems, yellow-green cyathia tips
  const trunkMat = mat(0x6a5535);
  const stemDark = mat(0x4a7a3a);
  const stemMid = mat(0x5a8a4a);
  const stemLight = mat(0x6a9a55);
  const tipMat = mat(0xbbcc44); // yellow-green cyathia

  // Short woody trunk
  addTrunk(g, 0, 0, 0, 0.10, 0.08, 0.55, 0x6a5535);

  // Central stem continuing above trunk
  const centerH = 1.6;
  const centerGeo = new THREE.CylinderGeometry(0.05, 0.065, centerH - 0.55, 6);
  const center = new THREE.Mesh(centerGeo, stemMid);
  center.position.set(0, 0.55 + (centerH - 0.55) / 2, 0);
  g.add(center);
  const cCap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), stemLight);
  cCap.position.set(0, centerH, 0);
  g.add(cCap);
  // Cyathia at center tip
  const cFlower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), tipMat);
  cFlower.position.set(0, centerH + 0.03, 0);
  g.add(cFlower);

  // 7 candelabra arms — U-shaped curves from trunk to vertical tips
  const armData = [
    { a: 0.3, startY: 0.50, spread: 0.30, topY: 1.40, thick: 0.048 },
    { a: 1.2, startY: 0.58, spread: 0.26, topY: 1.20, thick: 0.042 },
    { a: 2.0, startY: 0.45, spread: 0.32, topY: 1.50, thick: 0.050 },
    { a: 2.9, startY: 0.55, spread: 0.24, topY: 1.15, thick: 0.040 },
    { a: 3.8, startY: 0.48, spread: 0.28, topY: 1.35, thick: 0.045 },
    { a: 4.8, startY: 0.60, spread: 0.25, topY: 1.25, thick: 0.042 },
    { a: 5.6, startY: 0.52, spread: 0.30, topY: 1.45, thick: 0.046 },
  ];
  for (let i = 0; i < armData.length; i++) {
    const arm = armData[i];
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.08, arm.startY, cz * 0.08),
      new THREE.Vector3(cx * arm.spread * 0.9, arm.startY - 0.06, cz * arm.spread * 0.9),
      new THREE.Vector3(cx * arm.spread, arm.startY + (arm.topY - arm.startY) * 0.4, cz * arm.spread),
      new THREE.Vector3(cx * arm.spread * 0.95, arm.topY, cz * arm.spread * 0.95),
    ]);
    const armMat = [stemDark, stemMid, stemLight][i % 3];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, arm.thick, 5, false), armMat));

    // Dome cap
    const tip = curve.getPoint(1);
    const armCap = new THREE.Mesh(
      new THREE.SphereGeometry(arm.thick, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2),
      stemLight,
    );
    armCap.position.copy(tip);
    g.add(armCap);

    // Cyathia at arm tip
    const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), tipMat);
    flower.position.set(tip.x, tip.y + 0.025, tip.z);
    g.add(flower);

    // Fork on some arms
    if (i % 3 === 0) {
      const forkA = arm.a + 0.5;
      const forkCurve = new THREE.CatmullRomCurve3([
        tip,
        new THREE.Vector3(Math.cos(forkA) * (arm.spread + 0.10), arm.topY + 0.20, Math.sin(forkA) * (arm.spread + 0.10)),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 5, arm.thick * 0.7, 4, false), stemMid));
      const fTip = forkCurve.getPoint(1);
      const fCap = new THREE.Mesh(
        new THREE.SphereGeometry(arm.thick * 0.7, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2),
        stemLight,
      );
      fCap.position.copy(fTip);
      g.add(fCap);
    }
  }

  return g;
}

function buildIcePlant(): THREE.Group {
  const g = new THREE.Group();
  // Ice plant / Delosperma — wide spreading succulent ground mat, vivid daisy flowers
  const leafBright = mat(0x77bb55);
  const leafMid = mat(0x66aa44);
  const leafDark = mat(0x559933);

  // 12 clumps spread wide — 3x scale from before
  const clumps = [
    { x: 0.00, z: 0.00, count: 16, r: 0.40, flower: true },
    { x: -0.55, z: 0.25, count: 14, r: 0.35, flower: true },
    { x: 0.50, z: -0.30, count: 13, r: 0.32, flower: false },
    { x: 0.25, z: 0.55, count: 12, r: 0.30, flower: true },
    { x: -0.30, z: -0.50, count: 12, r: 0.30, flower: true },
    { x: -0.60, z: -0.20, count: 11, r: 0.28, flower: false },
    { x: 0.60, z: 0.25, count: 11, r: 0.28, flower: true },
    { x: 0.00, z: -0.60, count: 10, r: 0.26, flower: false },
    { x: -0.10, z: 0.60, count: 10, r: 0.26, flower: true },
    { x: 0.45, z: 0.50, count: 9, r: 0.24, flower: false },
    { x: -0.50, z: 0.50, count: 9, r: 0.24, flower: true },
    { x: 0.40, z: -0.55, count: 8, r: 0.22, flower: false },
  ];

  const leafMats = [leafBright, leafMid, leafDark];
  for (let ci = 0; ci < clumps.length; ci++) {
    const cl = clumps[ci];

    for (let i = 0; i < cl.count; i++) {
      const a = i * Math.PI * 2 / cl.count + ci * 0.35;
      const lean = 0.5 + Math.random() * 0.3;
      const fLen = 0.14 + Math.random() * 0.06;
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.028, fLen, 3, 5),
        leafMats[(i + ci) % 3],
      );
      finger.position.set(
        cl.x + Math.cos(a) * cl.r * 0.4,
        fLen * 0.25,
        cl.z + Math.sin(a) * cl.r * 0.4,
      );
      finger.rotation.z = -Math.cos(a) * lean;
      finger.rotation.x = -Math.sin(a) * lean;
      g.add(finger);
    }

    // Vivid daisy flowers — magenta/pink with yellow centers
    if (cl.flower) {
      const centerMat = mat(0xeeaa22);
      const petalColors = [0xff44aa, 0xff66bb, 0xee3399, 0xff55cc, 0xdd2288];

      const center = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 3), centerMat);
      center.position.set(cl.x, 0.22, cl.z);
      g.add(center);

      const petalMat = mat(petalColors[ci % petalColors.length]);
      for (let pi = 0; pi < 14; pi++) {
        const pa = pi * Math.PI * 2 / 14;
        const petal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.045, 0.08),
          petalMat,
        );
        petal.position.set(
          cl.x + Math.cos(pa) * 0.06,
          0.22,
          cl.z + Math.sin(pa) * 0.06,
        );
        petal.rotation.y = -pa;
        petal.rotation.x = -0.5;
        g.add(petal);
      }
    }
  }

  return g;
}

function buildEpiphytic(): THREE.Group {
  const g = new THREE.Group();
  // Christmas/orchid cactus — smooth arching stems with leaf-segment blobs, showy flowers
  const segBright = mat(0x55aa44);
  const segMid = mat(0x449933);
  const segDark = mat(0x338822);
  const flowerRed = mat(0xee3355);
  const flowerPink = mat(0xff6688);

  // Chunky central base
  const base = new THREE.Mesh(
    jitter(new THREE.SphereGeometry(0.25, 7, 5), 0.02),
    segDark,
  );
  base.position.y = 0.22;
  base.scale.y = 0.65;
  g.add(base);

  // Upper base mass
  const baseTop = new THREE.Mesh(
    jitter(new THREE.SphereGeometry(0.18, 6, 4), 0.015),
    segMid,
  );
  baseTop.position.y = 0.35;
  baseTop.scale.y = 0.6;
  g.add(baseTop);

  // 10 arching stems — smooth tube with leaf-segment blobs
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10 + (Math.random() - 0.5) * 0.15;
    const spread = 0.65 + Math.random() * 0.20;
    const archH = 0.30 + Math.random() * 0.15;
    const droop = 0.10 + Math.random() * 0.15;
    const segCount = 5 + Math.floor(Math.random() * 2);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.12, 0.28, Math.sin(a) * 0.12),
      new THREE.Vector3(Math.cos(a) * spread * 0.35, 0.30 + archH, Math.sin(a) * spread * 0.35),
      new THREE.Vector3(Math.cos(a) * spread * 0.65, 0.25 + archH * 0.5, Math.sin(a) * spread * 0.65),
      new THREE.Vector3(Math.cos(a) * spread, 0.15 - droop, Math.sin(a) * spread),
    ]);

    // Thicker connecting stem
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.022, 4, false), segMid));

    // Flattened ellipsoid segments along stem — organic-looking
    const segMats = [segBright, segMid, segDark];
    for (let s = 0; s < segCount; s++) {
      const t = (s + 0.5) / segCount;
      const pt = curve.getPoint(t);

      // Use flattened icosahedrons instead of boxes — much smoother
      const blobSize = 0.06 + Math.random() * 0.02;
      const blobGeo = jitter(new THREE.IcosahedronGeometry(blobSize, 0), 0.006);
      const blob = new THREE.Mesh(blobGeo, segMats[(s + i) % 3]);
      blob.position.copy(pt);
      blob.scale.set(1.3, 0.6, 1.0); // flatten into leaf-pad shape
      g.add(blob);
    }

    // Showy tubular flowers at tips — every 3rd stem
    if (i % 3 === 0) {
      const tip = curve.getPoint(0.92);
      const fMat = i % 6 === 0 ? flowerRed : flowerPink;

      // Flower bloom — cluster of small spheres
      for (let fi = 0; fi < 4; fi++) {
        const fa = fi * Math.PI * 2 / 4;
        const fl = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.03, 0),
          fMat,
        );
        fl.position.set(
          tip.x + Math.cos(fa) * 0.02,
          tip.y + 0.03 + fi * 0.01,
          tip.z + Math.sin(fa) * 0.02,
        );
        g.add(fl);
      }
    }
  }

  return g;
}

// ── Merge utility ──

function mergeGroupGeometry(group: THREE.Group): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  group.updateMatrixWorld(true);

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry.clone();
    geo.applyMatrix4(child.matrixWorld);

    const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
    const pos = nonIndexed.attributes.position;
    const nor = nonIndexed.attributes.normal;
    const vertCount = pos.count;

    const m = child.material as THREE.MeshStandardMaterial;
    const c = m.color;

    for (let i = 0; i < vertCount; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(c.r, c.g, c.b);
    }

    if (nonIndexed !== geo) nonIndexed.dispose();
    geo.dispose();
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // Re-index to restore vertex sharing — cuts GPU vertex processing significantly
  const indexed = mergeVertices(merged, 1e-4);
  merged.dispose();
  return indexed;
}

// ── Public API ──

export interface SubtypeModel {
  geometry: THREE.BufferGeometry;
  maturityHeight: number;
  groundCover: boolean;
}

export const BUILDERS: (() => THREE.Group)[] = [
  // Grasses (0-5)
  buildTurfgrass, buildTallgrass, buildBunchgrass, buildBamboo, buildSpreading, buildSedge,
  // Trees (6-11)
  buildOak, buildMagnolia, buildConifer, buildTropical, buildPalm, buildBirch,
  // Shrubs (12-17)
  buildEvergreenShrub, buildDeciduousShrub, buildMediterranean, buildThorny, buildDesertShrub, buildMangrove,
  // Succulents (18-23)
  buildSaguaro, buildAloe, buildCaudiciform, buildEuphorbia, buildIcePlant, buildEpiphytic,
];

/**
 * Target game-world heights (units) for each model.
 * Based on real-world heights at 1m = 1/3 game unit, with a floor
 * of ~0.08 so ground-cover plants remain visible in the sim.
 */
/**
 * Proportional scale: 1 real meter = 1/3 game unit.
 * Small plants floored at ~0.08 so they stay visible in the sim.
 */
export const TARGET_MODEL_HEIGHTS: number[] = [
  // Grasses (0-5)          real → true scale (floor 0.08)
  0.08,   // 0: Turfgrass     0.10m → 0.033 (floored)
  0.67,   // 1: Tallgrass     2.0m  → 0.67
  0.17,   // 2: Bunchgrass    0.50m → 0.17
  2.67,   // 3: Bamboo        8.0m  → 2.67
  0.08,   // 4: Spreading     0.08m → 0.027 (floored)
  0.83,   // 5: Sedge         2.5m  → 0.83
  // Trees (6-11)
  5.00,   // 6: Oak           15m   → 5.0
  4.00,   // 7: Magnolia      12m   → 4.0
  6.67,   // 8: Conifer       20m   → 6.67
  6.67,   // 9: Tropical      20m   → 6.67
  6.00,   // 10: Palm         18m   → 6.0
  5.00,   // 11: Birch        15m   → 5.0
  // Shrubs (12-17)
  0.50,   // 12: Ev. Shrub    1.5m  → 0.50
  1.00,   // 13: Dec. Shrub   3.0m  → 1.0
  0.33,   // 14: Mediterranean 1.0m → 0.33
  0.67,   // 15: Thorny       2.0m  → 0.67
  0.67,   // 16: Desert Shrub 2.0m  → 0.67
  1.67,   // 17: Mangrove     5.0m  → 1.67
  // Succulents (18-23)
  4.00,   // 18: Saguaro      12m   → 4.0
  0.17,   // 19: Aloe         0.5m  → 0.17
  0.67,   // 20: Caudiciform  2.0m  → 0.67
  2.00,   // 21: Euphorbia    6.0m  → 2.0
  0.08,   // 22: Ice Plant    0.15m → 0.05 (floored)
  0.10,   // 23: Epiphytic    0.3m  → 0.10
];

/** Scale a model group to its target game-world height using Box3 measurement. */
export function scaleToTarget(group: THREE.Group, subtypeIndex: number): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const rawH = Math.max(0.01, box.max.y);
  group.scale.setScalar(TARGET_MODEL_HEIGHTS[subtypeIndex] / rawH);
}

/**
 * The simulation height at which each subtype renders at 1× authored model scale.
 * This is a design tuning knob, not derived from geometry.
 *
 * Instance scale: s = plant.height / MATURITY_HEIGHT[subtype]
 * Rendered height = authored_model_height × s
 *
 * Example: Oak (model ~2.75 units) at sim h=8 → 2.75 × (8/10) = 2.2 world units
 *          Turfgrass (model ~0.2 units) at sim h=1 → 0.2 × (1/1.5) = 0.13 world units
 */
const MATURITY_HEIGHT: number[] = [
  // Grasses (0-5)
  1.5,   // 0: Turfgrass — short lawn grass, full size at low sim height
  8.0,   // 1: Tallgrass — prairie grass
  4.0,   // 2: Bunchgrass — tussock
  8.0,   // 3: Bamboo — tall culm
  1.0,   // 4: Spreading — ground cover
  7.0,   // 5: Sedge — papyrus
  // Trees (6-11)
  10.0,  // 6: Oak — large broadleaf
  10.0,  // 7: Magnolia — medium tree
  10.0,  // 8: Conifer — tall conifer
  12.0,  // 9: Tropical — tall tropical
  9.0,   // 10: Palm — tall palm
  9.0,   // 11: Birch — medium tree
  // Shrubs (12-17)
  6.0,   // 12: Evergreen Shrub — hedge
  6.0,   // 13: Deciduous Shrub — multi-stem
  5.0,   // 14: Mediterranean — mound
  5.0,   // 15: Thorny — spiny shrub
  5.0,   // 16: Desert Shrub — open shrub
  7.0,   // 17: Mangrove — small tree
  // Succulents (18-23)
  8.0,   // 18: Saguaro — tall cactus
  2.0,   // 19: Aloe — rosette
  4.0,   // 20: Caudiciform — swollen-trunk
  9.0,   // 21: Euphorbia — candelabra
  1.0,   // 22: Ice Plant — ground-level
  1.5,   // 23: Epiphytic — trailing
];

/** Subtypes that act as ground cover — XZ always fills the cell, only Y scales. */
const GROUND_COVER = new Set([0, 1, 2, 3, 4, 5]); // turfgrass, tallgrass, bunchgrass, bamboo, spreading, sedge

/** Accent-only grass types — geometry is authored at world-unit scale, no model scaling.
 *  Carpet provides base coverage; these provide per-type visual identity. */
const GRASS_ACCENT = new Set([0, 1, 2, 4]); // turf, tall, bunch, spreading

export function buildSubtypeModels(): SubtypeModel[] {
  return BUILDERS.map((build, i) => {
    const group = build();
    const isGC = GROUND_COVER.has(i);
    const isAccent = GRASS_ACCENT.has(i);

    if (isAccent) {
      // Accent grass: geometry is at world-unit scale, no model-level scaling.
      // Instance Y-only scaling handles growth. Carpet provides base coverage.
    } else if (isGC) {
      // Full ground cover (bamboo, sedge): scale Y to target height, XZ to 1.5 units
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      const rawH = Math.max(0.01, box.max.y);
      const yScale = TARGET_MODEL_HEIGHTS[i] / rawH;
      const rawXZ = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      const xzScale = 1.5 / Math.max(0.01, rawXZ);
      group.scale.set(xzScale, yScale, xzScale);
    } else {
      scaleToTarget(group, i);
    }

    const merged = mergeGroupGeometry(group);

    // Dispose all source geometries/materials
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    });

    return { geometry: merged, maturityHeight: MATURITY_HEIGHT[i], groundCover: isGC };
  });
}
