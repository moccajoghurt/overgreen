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
  const geo = jitter(new THREE.IcosahedronGeometry(radius, 0), radius * 0.15);
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

// ── Low-mesh builders (LOD versions, 8–12 meshes each) ──

function buildSedgeLow(): THREE.Group {
  const g = new THREE.Group();
  const stemColors = [mat(0x77bb55), mat(0x88cc66), mat(0x66aa44)];
  const umbColors = [matDS(0x55aa44), matDS(0x66bb55)];
  // Very dense stem grid — packed tight so ground is occluded from typical camera angles
  const half = 0.46;
  const step = 0.15;
  let si = 0;
  for (let gx = -half; gx <= half; gx += step) {
    for (let gz = -half; gz <= half; gz += step) {
      if (Math.random() > 0.95) continue;
      const sx = gx + (Math.random() - 0.5) * step * 0.35;
      const sz = gz + (Math.random() - 0.5) * step * 0.35;
      const edgeDist = Math.max(Math.abs(sx), Math.abs(sz)) / half;
      const tierScale = edgeDist < 0.35 ? 1.0 : edgeDist < 0.7 ? 0.75 : 0.5;
      const h = (1.2 + Math.random() * 0.4) * tierScale;
      // Slightly wider stems for better occlusion
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.030, h, 3), stemColors[si % 3]);
      stem.position.set(sx, h / 2, sz);
      g.add(stem);
      // Drooping spoke plane — papyrus umbel hint
      const spokeLen = h * 0.17;
      const spokeGeo = new THREE.PlaneGeometry(0.022, spokeLen, 1, 2);
      const spos = spokeGeo.attributes.position;
      for (let vi = 0; vi < spos.count; vi++) {
        const sy = spos.getY(vi);
        const t = (sy + spokeLen / 2) / spokeLen;
        spos.setZ(vi, spokeLen * 0.2 * t * t);
      }
      spokeGeo.computeVertexNormals();
      const spoke = new THREE.Mesh(spokeGeo, umbColors[si % 2]);
      spoke.position.set(sx, h, sz);
      spoke.rotation.y = si * 0.7;
      spoke.rotation.z = -0.5;
      g.add(spoke);
      si++;
    }
  }
  return g;
}

function buildOakLow(): THREE.Group {
  const g = new THREE.Group();
  // Trunk + flare
  addTrunk(g, 0, 0, 0, 0.18, 0.13, 0.6, 0x5a3a1a);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.2, 6), mat(0x4a2a10));
  flare.position.y = 0.1;
  g.add(flare);
  // Broad canopy — 6 large spheres for lobe silhouette
  const cc = [0x66bb44, 0x5aaa3a, 0x77cc55, 0x6ab844, 0x55a033, 0x66bb44];
  const lobes: [number, number, number, number][] = [
    [0.45, 1.1, 0.15, 0.45], [-0.4, 1.15, -0.2, 0.42],
    [0.1, 1.2, 0.4, 0.4], [-0.15, 1.1, -0.4, 0.38],
    [0.0, 1.25, 0.0, 0.5], [0.0, 0.9, 0.0, 0.4],
  ];
  for (let i = 0; i < lobes.length; i++) {
    const [x, y, z, r] = lobes[i];
    addCanopy(g, x, y, z, r, cc[i]);
  }
  return g;
}

function buildMagnoliaLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.16, 0.11, 0.5, 0xbbaa99);
  // Egg-shaped crown — 4 spheres
  const cc = [0x44aa55, 0x55bb66, 0x3d9e48, 0x66cc77];
  addCanopy(g, 0, 1.15, 0, 0.55, cc[0]);
  addCanopy(g, 0, 1.4, 0, 0.48, cc[1]);
  addCanopy(g, 0, 0.9, 0, 0.45, cc[2]);
  addCanopy(g, 0, 1.55, 0, 0.35, cc[3]);
  // 6 bloom spheres distributed around canopy — magnolia's defining feature
  const bloomMats = [
    mat(0xfff0dd, { roughness: 0.3 }),
    mat(0xffccdd, { roughness: 0.3 }),
    mat(0xffe8d0, { roughness: 0.3 }),
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const y = 0.85 + (i % 3) * 0.25;
    const dist = 0.45 + (i % 2) * 0.05;
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.10, 0),
      bloomMats[i % 3],
    );
    m.position.set(Math.cos(a) * dist, y, Math.sin(a) * dist);
    g.add(m);
  }
  return g;
}

function buildConiferLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.08, 0.05, 0.35, 0x8a5a3a);
  // 7 stacked cones — defining tier silhouette
  const palette = [0x2d7744, 0x338850, 0x3a9955, 0x44aa60, 0x4ebb6a, 0x55cc77, 0x66dd88];
  for (let i = 0; i < 7; i++) {
    const y = 0.3 + i * 0.28;
    const r = 0.8 - i * 0.1;
    const h = 0.35 + (1 - i / 6) * 0.1;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat(palette[i]));
    cone.position.set(0, y, 0);
    g.add(cone);
  }
  return g;
}

function buildTropicalLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.16, 0.1, 1.1, 0x7a6a5a);
  // 2 buttress roots
  const buttMat = mat(0x6a5a4a);
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + 0.4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.22), buttMat);
    m.position.set(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18);
    m.rotation.y = a;
    g.add(m);
  }
  // Canopy — 5 large spheres
  const cc = [0x44bb55, 0x55cc66, 0x3aaa44, 0x66dd77, 0x88dd55];
  addCanopy(g, 0, 1.55, 0, 0.65, cc[0]);
  addCanopy(g, 0.4, 1.4, 0.2, 0.45, cc[1]);
  addCanopy(g, -0.3, 1.35, -0.3, 0.4, cc[2]);
  addCanopy(g, 0, 1.75, 0, 0.4, cc[3]);
  addCanopy(g, 0, 1.1, 0, 0.35, cc[4]);
  return g;
}

function buildPalmLow(): THREE.Group {
  const g = new THREE.Group();
  // Curved trunk — fewer segments
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.5, 0.03),
    new THREE.Vector3(0.1, 1.1, 0),
    new THREE.Vector3(0.07, 1.6, -0.02),
    new THREE.Vector3(0.04, 2.0, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.065, 4, false), mat(0x9a8a7a)));
  // Crown shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.15, 5), mat(0x55aa44));
  shaft.position.set(0.04, 2.05, 0);
  g.add(shaft);
  // 10 wider fronds — single blade each but wider for coverage
  const frondColors = [matDS(0x55bb44), matDS(0x66cc55), matDS(0x44aa33), matDS(0x77dd66)];
  const topY = 2.1, topX = 0.04;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const fLen = 1.0 + Math.random() * 0.25;
    const fWidth = 0.35;
    const fGeo = new THREE.PlaneGeometry(fWidth, fLen, 1, 8);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.65 * t));
      fPos.setY(vi, t * 0.3 - t * t * t * fLen * 0.55);
      fPos.setZ(vi, t * fLen * 0.8);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, frondColors[i % frondColors.length]);
    frond.position.set(topX, topY, 0);
    frond.rotation.y = a;
    g.add(frond);
  }
  return g;
}

function buildBirchLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.06, 0.035, 0.9, 0xf8f4ee);
  // Narrow tall crown — 7 spheres
  const cc = [0x99dd44, 0xaaee55, 0xbbee66, 0x88cc33, 0xaadd44, 0x99dd44, 0xaaee55];
  addCanopy(g, 0, 1.15, 0, 0.38, cc[0]);
  addCanopy(g, 0, 0.95, 0, 0.35, cc[1]);
  addCanopy(g, 0, 1.35, 0, 0.32, cc[2]);
  addCanopy(g, 0, 1.55, 0, 0.28, cc[3]);
  addCanopy(g, 0.15, 1.1, 0.1, 0.25, cc[4]);
  addCanopy(g, -0.1, 1.0, -0.15, 0.25, cc[5]);
  addCanopy(g, 0, 1.7, 0, 0.2, cc[6]);
  return g;
}

function buildEvergreenShrubLow(): THREE.Group {
  const g = new THREE.Group();
  // Opaque core
  const coreGeo = new THREE.SphereGeometry(0.5, 10, 8);
  coreGeo.scale(1.0, 0.65, 1.0);
  const core = new THREE.Mesh(coreGeo, mat(0x2d6633));
  core.position.set(0, 0.34, 0);
  g.add(core);
  // 7 canopy blobs forming wide flat dome
  const cc = [0x55bb55, 0x77dd66, 0x4daa4d, 0x66cc66, 0x338833, 0x88ee77, 0x3a9944];
  addCanopy(g, 0, 0.38, 0, 0.45, cc[0]);
  addCanopy(g, 0.35, 0.32, 0, 0.3, cc[1]);
  addCanopy(g, -0.35, 0.32, 0.1, 0.3, cc[2]);
  addCanopy(g, 0, 0.32, 0.35, 0.3, cc[3]);
  addCanopy(g, 0, 0.32, -0.35, 0.28, cc[4]);
  addCanopy(g, 0, 0.55, 0, 0.32, cc[5]);
  addCanopy(g, 0, 0.15, 0, 0.4, cc[6]);
  return g;
}

function buildDeciduousShrubLow(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a6a55);
  const leafColors = [0xbbff44, 0xccff55, 0xaaee33, 0xddff77];
  // 4 arching stems — vase/fountain shape
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4 + 0.2;
    const h = 1.0 + i * 0.12;
    const spread = 0.55 + Math.random() * 0.1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.18, h * 0.5, Math.sin(a) * 0.18),
      new THREE.Vector3(Math.cos(a) * spread * 0.7, h * 0.85, Math.sin(a) * spread * 0.7),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.75, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.028, 4, false), stemMat));
    // LARGE canopy blob at tip — 40% bigger, overlapping with neighbors
    const tip = curve.getPoint(0.82);
    addCanopy(g, tip.x, tip.y, tip.z, 0.30, leafColors[i]);
  }
  // Central fill canopy — hides interior branches
  addCanopy(g, 0, 0.90, 0, 0.28, leafColors[0]);
  addCanopy(g, 0, 1.0, 0, 0.22, leafColors[2]);
  // 3 yellow forsythia flower clusters — defining feature
  const flowerColors = [0xffdd33, 0xffcc22, 0xffee55];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.7;
    const fl = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(0.10, 0), 0.012),
      mat(flowerColors[i]),
    );
    fl.position.set(Math.cos(a) * 0.40, 0.82 + i * 0.1, Math.sin(a) * 0.40);
    g.add(fl);
  }
  return g;
}

function buildMediterraneanLow(): THREE.Group {
  const g = new THREE.Group();
  // Opaque flat core
  const coreGeo = new THREE.SphereGeometry(0.55, 10, 8);
  coreGeo.scale(1.0, 0.3, 1.0);
  const core = new THREE.Mesh(coreGeo, mat(0x6a7a5a));
  core.position.set(0, 0.20, 0);
  g.add(core);
  // 4 canopy blobs — flat cushion
  const cc = [0x99aa88, 0xaabb99, 0x8a9a78, 0xbbccaa];
  addCanopy(g, 0, 0.24, 0, 0.48, cc[0]);
  addCanopy(g, 0.3, 0.20, 0.2, 0.3, cc[1]);
  addCanopy(g, -0.3, 0.20, -0.2, 0.3, cc[2]);
  addCanopy(g, 0, 0.32, 0, 0.3, cc[3]);
  // 4 lavender spikes — defining feature
  const lavColors = [0xcc88ee, 0xdd99ff, 0xbb77dd, 0xeeaaff];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const r = 0.3 + Math.random() * 0.1;
    const spikeH = 0.28;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, spikeH, 4), mat(lavColors[i]));
    spike.position.set(Math.cos(a) * r, 0.30 + spikeH / 2, Math.sin(a) * r);
    g.add(spike);
  }
  return g;
}

function buildThornyLow(): THREE.Group {
  const g = new THREE.Group();
  const woodMat = mat(0x7a5533);
  const thornMat = mat(0xddeecc);
  const flowerColors = [0xff66aa, 0xff5599, 0xee4488];
  // 6 branches — wider spread to match high-mesh volume envelope
  const branchData = [
    { a: 0.0, h: 1.15, spread: 0.62 },
    { a: 1.05, h: 0.65, spread: 0.58 },
    { a: 2.10, h: 1.25, spread: 0.65 },
    { a: 3.14, h: 1.05, spread: 0.60 },
    { a: 4.20, h: 0.70, spread: 0.62 },
    { a: 5.25, h: 1.20, spread: 0.58 },
  ];
  for (let i = 0; i < branchData.length; i++) {
    const { a, h, spread } = branchData[i];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.14, h * 0.35, Math.sin(a) * 0.14),
      new THREE.Vector3(Math.cos(a) * spread * 0.6, h * 0.7, Math.sin(a) * spread * 0.6),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.6, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.032, 4, false), woodMat));
    // Big visible thorn
    const tPt = curve.getPoint(0.45);
    const side = i % 2 === 0 ? 1 : -1;
    const perpDir = a + side * Math.PI / 2;
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.25, 3), thornMat);
    spine.position.set(tPt.x, tPt.y, tPt.z);
    spine.lookAt(tPt.x + Math.cos(perpDir) * 0.4, tPt.y - 0.1, tPt.z + Math.sin(perpDir) * 0.4);
    g.add(spine);
    // Pink bract + small leaf on alternating branches
    if (i % 2 === 0) {
      const tip = curve.getPoint(0.8);
      addCanopy(g, tip.x, tip.y, tip.z, 0.07, 0x55aa44);
      const fl = new THREE.Mesh(
        jitter(new THREE.IcosahedronGeometry(0.06, 0), 0.008),
        mat(flowerColors[i % 3]),
      );
      fl.position.set(tip.x, tip.y + 0.06, tip.z);
      g.add(fl);
    }
  }
  return g;
}

function buildDesertShrubLow(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x8a7a66);
  const leafMat = mat(0x99a888);
  const flowerMat = mat(0xffdd44);
  // 5 wiry stems with fork sub-branches
  const stemData = [
    { a: 0.0, h: 0.85, lean: 0.42, flower: true },
    { a: 1.3, h: 0.60, lean: 0.50, flower: false },
    { a: 2.5, h: 0.90, lean: 0.38, flower: true },
    { a: 3.8, h: 0.65, lean: 0.48, flower: false },
    { a: 5.1, h: 0.80, lean: 0.44, flower: true },
  ];
  for (const s of stemData) {
    const spread = s.lean * s.h * 0.8;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(s.a) * 0.03, 0, Math.sin(s.a) * 0.03),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.4, s.h * 0.45, Math.sin(s.a) * spread * 0.4),
      new THREE.Vector3(Math.cos(s.a) * spread, s.h * 0.7, Math.sin(s.a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.020, 3, false), stemMat));
    // Tiny leaf tuft at tip
    const tip = curve.getPoint(0.85);
    const tuft = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(0.028, 0), 0.004), leafMat);
    tuft.position.set(tip.x, tip.y, tip.z);
    g.add(tuft);
    // Yellow daisy at marked tips
    if (s.flower) {
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), flowerMat);
      fl.position.set(tip.x, tip.y + 0.04, tip.z);
      g.add(fl);
    }
  }
  return g;
}

function buildMangroveLow(): THREE.Group {
  const g = new THREE.Group();
  const rootMat = mat(0x7a4030);
  // Trunk
  addTrunk(g, 0, 0.40, 0, 0.07, 0.06, 0.20, 0x7a4030);
  // 4 stilt roots
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4 + 0.3;
    const sp = 0.5;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.48, 0),
      new THREE.Vector3(Math.cos(a) * sp * 0.4, 0.25, Math.sin(a) * sp * 0.4),
      new THREE.Vector3(Math.cos(a) * sp, -0.04, Math.sin(a) * sp),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.026, 4, false), rootMat));
  }
  // Core + canopy
  const coreGeo = new THREE.SphereGeometry(0.35, 8, 6);
  coreGeo.scale(1.3, 0.7, 1.3);
  const core = new THREE.Mesh(coreGeo, mat(0x2d6633));
  core.position.set(0, 0.72, 0);
  g.add(core);
  addCanopy(g, 0, 0.78, 0, 0.36, 0x44aa44);
  addCanopy(g, 0.2, 0.72, 0.15, 0.25, 0x55bb55);
  addCanopy(g, -0.15, 0.7, -0.2, 0.25, 0x3d9d3d);
  addCanopy(g, 0, 0.85, 0, 0.25, 0x66cc66);
  return g;
}

function buildCaudiciformLow(): THREE.Group {
  const g = new THREE.Group();
  // Big caudex — defining feature
  const caudexGeo = new THREE.SphereGeometry(0.30, 8, 6);
  caudexGeo.scale(1.0, 0.75, 0.9);
  const caudex = new THREE.Mesh(jitter(caudexGeo, 0.02), mat(0x9a8870));
  caudex.position.set(0, 0.20, 0);
  g.add(caudex);
  // 2 root flanges
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI;
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.18, 3), mat(0x887766));
    root.position.set(Math.cos(a) * 0.18, 0.02, Math.sin(a) * 0.18);
    root.rotation.z = -Math.cos(a) * 0.5;
    root.rotation.x = -Math.sin(a) * 0.5;
    g.add(root);
  }
  // 3 short branches with leaf tips
  const branchMat = mat(0x7a6a55);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.3;
    const cx = Math.cos(a), cz = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.08, 0.35, cz * 0.08),
      new THREE.Vector3(cx * 0.12, 0.65, cz * 0.12),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.025, 3, false), branchMat));
    const tip = curve.getPoint(0.9);
    addCanopy(g, tip.x, tip.y, tip.z, 0.09, [0x5aaa44, 0x66bb55, 0x4d9d3d][i]);
  }
  // 2 pink flowers
  const flowerMat = mat(0xff6699);
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.5;
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), flowerMat);
    fl.position.set(Math.cos(a) * 0.12, 0.72, Math.sin(a) * 0.12);
    g.add(fl);
  }
  return g;
}

function buildEuphorbiaLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.10, 0.08, 0.55, 0x6a5535);
  // Central stem
  const centerGeo = new THREE.CylinderGeometry(0.05, 0.065, 1.05, 5);
  const center = new THREE.Mesh(centerGeo, mat(0x5a8a4a));
  center.position.set(0, 0.55 + 0.525, 0);
  g.add(center);
  // 4 candelabra arms
  const armData = [
    { a: 0.5, startY: 0.50, spread: 0.28, topY: 1.35, thick: 0.046 },
    { a: 2.1, startY: 0.55, spread: 0.26, topY: 1.20, thick: 0.042 },
    { a: 3.7, startY: 0.48, spread: 0.30, topY: 1.45, thick: 0.048 },
    { a: 5.3, startY: 0.58, spread: 0.25, topY: 1.25, thick: 0.042 },
  ];
  for (const arm of armData) {
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.08, arm.startY, cz * 0.08),
      new THREE.Vector3(cx * arm.spread * 0.9, arm.startY - 0.05, cz * arm.spread * 0.9),
      new THREE.Vector3(cx * arm.spread, arm.startY + (arm.topY - arm.startY) * 0.5, cz * arm.spread),
      new THREE.Vector3(cx * arm.spread * 0.95, arm.topY, cz * arm.spread * 0.95),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, arm.thick, 4, false), mat(0x5a8a4a)));
    // Dome cap
    const tip = curve.getPoint(1);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(arm.thick, 4, 3, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6a9a55));
    cap.position.copy(tip);
    g.add(cap);
  }
  return g;
}

function buildIcePlantLow(): THREE.Group {
  const g = new THREE.Group();
  const leafMats = [mat(0x77bb55), mat(0x66aa44), mat(0x559933)];
  // 9 large overlapping flattened blobs — continuous ground-hugging mat
  // Packed tight to eliminate gaps, matching high-mesh coverage footprint
  const blobs: [number, number, number][] = [
    // Core coverage
    [0.0, 0.0, 0.32], [-0.35, 0.0, 0.28], [0.35, 0.0, 0.28],
    [0.0, 0.35, 0.28], [0.0, -0.35, 0.28],
    // Diagonal fill — overlap with core
    [-0.30, 0.30, 0.25], [0.30, -0.30, 0.25],
    [-0.30, -0.28, 0.24], [0.28, 0.30, 0.24],
  ];
  for (let i = 0; i < blobs.length; i++) {
    const [bx, bz, r] = blobs[i];
    const blob = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.06),
      leafMats[i % 3],
    );
    blob.position.set(bx, 0.08, bz);
    blob.scale.set(1.0, 0.35, 1.0); // low mound shape
    g.add(blob);
  }
  // 3 daisy flowers — defining vivid magenta with yellow centers
  const flowerPositions: [number, number][] = [[0.0, 0.0], [-0.35, 0.20], [0.25, 0.30]];
  for (let i = 0; i < 3; i++) {
    const [fx, fz] = flowerPositions[i];
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 3), mat(0xeeaa22));
    center.position.set(fx, 0.20, fz);
    g.add(center);
    const petalMat = mat([0xff44aa, 0xff66bb, 0xee3399][i]);
    const petal = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(0.08, 0), 0.006), petalMat);
    petal.position.set(fx, 0.18, fz);
    petal.scale.set(1.3, 0.3, 1.3);
    g.add(petal);
  }
  return g;
}

function buildEpiphyticLow(): THREE.Group {
  const g = new THREE.Group();
  // Central base
  const base = new THREE.Mesh(
    jitter(new THREE.SphereGeometry(0.24, 6, 4), 0.02),
    mat(0x338822),
  );
  base.position.y = 0.22;
  base.scale.y = 0.65;
  g.add(base);
  // 7 arching stems — wider spread matching high-mesh volume
  const segMats = [mat(0x55aa44), mat(0x449933), mat(0x338822)];
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + 0.15;
    const spread = 0.65 + Math.random() * 0.18;
    const archH = 0.28 + Math.random() * 0.12;
    const droop = 0.10 + Math.random() * 0.12;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.10, 0.25, Math.sin(a) * 0.10),
      new THREE.Vector3(Math.cos(a) * spread * 0.35, 0.28 + archH, Math.sin(a) * spread * 0.35),
      new THREE.Vector3(Math.cos(a) * spread * 0.65, 0.25 + archH * 0.5, Math.sin(a) * spread * 0.65),
      new THREE.Vector3(Math.cos(a) * spread, 0.15 - droop, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.022, 3, false), mat(0x449933)));
    // Leaf-segment blob at mid-point
    const midPt = curve.getPoint(0.5);
    const blob = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(0.06, 0), 0.005),
      segMats[i % 3],
    );
    blob.position.copy(midPt);
    blob.scale.set(1.3, 0.6, 1.0);
    g.add(blob);
    // Flower at every 3rd stem tip
    if (i % 3 === 0) {
      const tip = curve.getPoint(0.9);
      const fl = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.04, 0),
        mat(i === 0 ? 0xee3355 : 0xff6688),
      );
      fl.position.set(tip.x, tip.y + 0.02, tip.z);
      g.add(fl);
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

// ── Forb Builders (24-29) ──

function buildWildflower(): THREE.Group {
  const g = new THREE.Group();
  // Wildflower meadow patch — flowers are the star, minimal foliage underneath

  const stemMat = mat(0x5a8a30);
  const leafMat = matDS(0x4a8a2a);

  // Sparse low leaves — just a few tufts, NOT a solid carpet
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
    const r = 0.08 + Math.random() * 0.30;
    const leafLen = 0.08 + Math.random() * 0.04;
    const leafW = 0.03 + Math.random() * 0.02;
    const geo = new THREE.PlaneGeometry(leafW, leafLen, 1, 2);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getY(vi) + leafLen / 2) / leafLen;
      pos.setX(vi, pos.getX(vi) * (1 - t * 0.6));
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMat);
    leaf.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = -a;
    g.add(leaf);
  }

  // Abundant colorful flowers — the main visual
  const flowerColors = [
    mat(0xffdd22), mat(0xffee44), // bright yellow
    mat(0xff6699), mat(0xff88aa), // pink
    mat(0xeeeeff), mat(0xffffff), // white
    mat(0xbb66dd), mat(0xcc88ee), // purple
    mat(0xff7733), mat(0xffaa55), // orange
  ];
  const flowers = [
    { x: 0, z: 0, h: 0.28 }, { x: 0.14, z: 0.10, h: 0.24 },
    { x: -0.11, z: 0.13, h: 0.26 }, { x: -0.09, z: -0.12, h: 0.22 },
    { x: 0.16, z: -0.07, h: 0.20 }, { x: -0.18, z: -0.04, h: 0.18 },
    { x: 0.05, z: -0.18, h: 0.23 }, { x: -0.04, z: 0.20, h: 0.19 },
    { x: 0.20, z: 0.18, h: 0.16 }, { x: -0.22, z: 0.10, h: 0.21 },
    { x: 0.08, z: 0.25, h: 0.17 }, { x: -0.15, z: -0.20, h: 0.20 },
    { x: 0.24, z: -0.14, h: 0.15 }, { x: -0.06, z: -0.26, h: 0.18 },
    { x: 0.28, z: 0.04, h: 0.14 }, { x: -0.26, z: -0.15, h: 0.16 },
    { x: 0.12, z: -0.28, h: 0.13 }, { x: -0.28, z: 0.22, h: 0.15 },
    { x: 0.30, z: -0.25, h: 0.12 }, { x: -0.10, z: 0.32, h: 0.14 },
    { x: 0.18, z: 0.30, h: 0.11 }, { x: -0.32, z: -0.02, h: 0.13 },
    { x: 0.35, z: 0.12, h: 0.10 }, { x: -0.20, z: 0.35, h: 0.12 },
  ];
  for (let fi = 0; fi < flowers.length; fi++) {
    const fp = flowers[fi];
    // Thin stem
    const stemGeo = new THREE.CylinderGeometry(0.005, 0.008, fp.h, 3);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(fp.x, fp.h / 2, fp.z);
    g.add(stem);
    // Large flower head — prominent disc
    const cIdx = (fi * 2) % flowerColors.length;
    const headGeo = jitter(new THREE.SphereGeometry(0.06 + Math.random() * 0.02, 5, 3), 0.008);
    headGeo.scale(1, 0.35, 1);
    const head = new THREE.Mesh(headGeo, flowerColors[cIdx + (fi % 2)]);
    head.position.set(fp.x, fp.h + 0.015, fp.z);
    g.add(head);
  }

  return g;
}

function buildWildflowerLow(): THREE.Group {
  const g = new THREE.Group();
  // 10 colorful flower discs — flowers dominate, minimal leaves
  const flowerMats = [
    mat(0xffdd22), mat(0xff6699), mat(0xeeeeff), mat(0xbb66dd), mat(0xff7733),
    mat(0xffee44), mat(0xff88aa), mat(0xffffff), mat(0xcc88ee), mat(0xffaa55),
  ];
  const positions: [number, number, number][] = [
    [0, 0.22, 0], [0.14, 0.18, 0.10], [-0.11, 0.20, 0.13],
    [-0.09, 0.17, -0.12], [0.16, 0.16, -0.07], [-0.18, 0.15, -0.04],
    [0.05, 0.19, -0.18], [0.20, 0.14, 0.18], [-0.22, 0.16, 0.10],
    [0.08, 0.13, 0.25],
  ];
  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i];
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 4, 2), flowerMats[i]);
    head.position.set(x, y, z);
    head.scale.y = 0.35;
    g.add(head);
  }
  return g;
}

function buildTallHerb(): THREE.Group {
  const g = new THREE.Group();
  // Goldenrod — tall upright stems + dense flat basal rosette filling the cell

  const stemMat = mat(0x6a8a40);
  const leafMats = [matDS(0x558a35), matDS(0x4a7a2a), matDS(0x609040)];
  const flowerMat = mat(0xeebb22);
  const flowerBright = mat(0xffdd44);

  // Dense flat basal rosette — 5 rings + heavy edge fill
  for (let ring = 0; ring < 5; ring++) {
    const ringR = 0.06 + ring * 0.10;
    const count = 6 + ring * 5;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.37 + (Math.random() - 0.5) * 0.3;
      const ox = Math.cos(a) * (ringR + (Math.random() - 0.5) * 0.04);
      const oz = Math.sin(a) * (ringR + (Math.random() - 0.5) * 0.04);
      const leafLen = 0.22 + Math.random() * 0.06;
      const leafW = 0.07 + Math.random() * 0.03;
      const geo = new THREE.PlaneGeometry(leafW, leafLen, 2, 3);
      const pos = geo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const lx = pos.getX(vi);
        const ly = pos.getY(vi);
        const t = (ly + leafLen / 2) / leafLen;
        pos.setX(vi, lx * (1 - t * 0.6));
        pos.setZ(vi, Math.abs(lx / (leafW / 2)) * 0.012 + t * 0.01);
      }
      geo.computeVertexNormals();
      const leaf = new THREE.Mesh(geo, leafMats[(i + ring) % 3]);
      leaf.position.set(ox, 0.015 + ring * 0.003, oz);
      leaf.rotation.x = -Math.PI / 2;
      leaf.rotation.z = -a;
      g.add(leaf);
    }
  }
  // Heavy edge filler
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2 + Math.random() * 0.15;
    const r = 0.34 + Math.random() * 0.18;
    const leafLen = 0.16 + Math.random() * 0.06;
    const leafW = 0.06 + Math.random() * 0.02;
    const geo = new THREE.PlaneGeometry(leafW, leafLen, 1, 2);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getY(vi) + leafLen / 2) / leafLen;
      pos.setX(vi, pos.getX(vi) * (1 - t * 0.5));
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMats[i % 3]);
    leaf.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = -a;
    g.add(leaf);
  }

  // Dense upright flowering stems — thicker, more numerous
  const stems = [
    { x: 0.00, z: 0.00, h: 1.6 }, { x: -0.16, z: 0.12, h: 1.35 },
    { x: 0.18, z: -0.08, h: 1.45 }, { x: -0.10, z: -0.18, h: 1.15 },
    { x: 0.14, z: 0.16, h: 1.25 }, { x: -0.25, z: -0.02, h: 1.05 },
    { x: 0.03, z: -0.25, h: 0.95 }, { x: 0.25, z: 0.03, h: 1.05 },
    { x: -0.06, z: 0.25, h: 0.90 }, { x: -0.28, z: 0.20, h: 0.85 },
    { x: 0.28, z: -0.20, h: 0.80 }, { x: 0.10, z: 0.28, h: 0.75 },
    { x: -0.20, z: -0.25, h: 0.70 }, { x: 0.30, z: 0.15, h: 0.65 },
  ];
  for (const s of stems) {
    // Thicker stem
    const stemGeo = new THREE.CylinderGeometry(0.014, 0.020, s.h, 5);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(s.x, s.h / 2, s.z);
    g.add(stem);
    // Stem leaves — larger, visible
    for (let li = 0; li < 5; li++) {
      const ly = 0.12 + (li / 5) * s.h * 0.55;
      const side = li % 2 === 0 ? 1 : -1;
      const lLen = 0.12 - li * 0.012;
      const lGeo = new THREE.PlaneGeometry(0.035, lLen, 1, 2);
      const leaf = new THREE.Mesh(lGeo, leafMats[li % 3]);
      leaf.position.set(s.x + side * 0.018, ly, s.z);
      leaf.rotation.z = side * 0.5;
      leaf.rotation.y = Math.atan2(s.z, s.x) + side * 0.8;
      g.add(leaf);
    }
    // Flower plume — larger, denser cone
    const pBase = s.h * 0.70;
    const pTop = s.h * 1.02;
    for (let di = 0; di < 14; di++) {
      const dt = di / 14;
      const dy = pBase + dt * (pTop - pBase);
      const da = Math.random() * Math.PI * 2;
      const dr = 0.055 * (1 - dt * 0.7);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.020 + Math.random() * 0.012, 4, 2),
        di % 2 === 0 ? flowerMat : flowerBright,
      );
      dot.position.set(s.x + Math.cos(da) * dr, dy, s.z + Math.sin(da) * dr);
      g.add(dot);
    }
  }

  return g;
}

function buildTallHerbLow(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x6a8a40);
  const leafMat = matDS(0x558a35);
  const flowerMat = mat(0xeebb22);
  // 4 large flat basal leaves + 4 stems + 4 flower heads = 12 meshes
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const r = 0.22;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.28, 1, 1), leafMat);
    leaf.position.set(Math.cos(a) * r, 0.015, Math.sin(a) * r);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = -a;
    g.add(leaf);
  }
  // 4 flowering stems
  const stemData = [
    { x: 0, z: 0, h: 1.5 }, { x: 0.14, z: 0.10, h: 1.3 },
    { x: -0.12, z: -0.08, h: 1.2 }, { x: -0.06, z: 0.16, h: 1.1 },
  ];
  for (const s of stemData) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, s.h, 3), stemMat);
    stem.position.set(s.x, s.h / 2, s.z);
    g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 4, 2), flowerMat);
    head.position.set(s.x, s.h * 0.9, s.z);
    head.scale.y = 1.5;
    g.add(head);
  }
  return g;
}

function buildFern(): THREE.Group {
  const g = new THREE.Group();
  // Fern — wide feathery fronds as single tapered planes, radiating flat from center

  const frondMats = [matDS(0x3a7a2a), matDS(0x448a30), matDS(0x357020), matDS(0x508a38)];

  // Central crown
  const crownGeo = jitter(new THREE.SphereGeometry(0.06, 5, 4), 0.015);
  const crown = new THREE.Mesh(crownGeo, mat(0x5a4a2a));
  crown.position.y = 0.04;
  crown.scale.y = 0.6;
  g.add(crown);

  // Each frond is a single wide plane with serrated edges, laid flat
  const tiers = [
    { count: 5, len: 0.28, w: 0.12, yBase: 0.06, offset: 0.3 },
    { count: 7, len: 0.38, w: 0.15, yBase: 0.04, offset: 0.0 },
    { count: 9, len: 0.48, w: 0.18, yBase: 0.025, offset: 0.15 },
  ];

  for (let ti = 0; ti < tiers.length; ti++) {
    const tier = tiers[ti];
    for (let fi = 0; fi < tier.count; fi++) {
      const a = (fi / tier.count) * Math.PI * 2 + tier.offset;
      const frondMat = frondMats[(fi + ti) % frondMats.length];
      const len = tier.len + (Math.random() - 0.5) * 0.06;
      const w = tier.w + (Math.random() - 0.5) * 0.03;

      // Wide plane tapered to tip with serrated edges
      const geo = new THREE.PlaneGeometry(w, len, 6, 8);
      const pos = geo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const lx = pos.getX(vi);
        const ly = pos.getY(vi);
        const t = (ly + len / 2) / len; // 0 at base, 1 at tip
        // Diamond taper — widest at 30%
        const widthMult = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
        pos.setX(vi, lx * widthMult);
        // Serrated/pinnate edge — zigzag along length
        const xNorm = Math.abs(lx) / (w / 2);
        if (xNorm > 0.3) {
          const serration = Math.sin(t * 14) * 0.012 * xNorm;
          pos.setX(vi, pos.getX(vi) + serration);
        }
        // Slight midrib lift for 3D
        pos.setZ(vi, (1 - xNorm) * 0.012 + t * 0.008);
      }
      geo.computeVertexNormals();

      const frond = new THREE.Mesh(geo, frondMat);
      // Position at center, lay flat on XZ, point outward
      frond.position.set(0, 0, len / 2);
      frond.rotation.x = -Math.PI / 2;

      const frondGroup = new THREE.Group();
      frondGroup.add(frond);
      frondGroup.position.set(Math.cos(a) * 0.04, tier.yBase, Math.sin(a) * 0.04);
      frondGroup.rotation.y = a;
      g.add(frondGroup);
    }
  }

  return g;
}

function buildFernLow(): THREE.Group {
  const g = new THREE.Group();
  const frondMat = matDS(0x3a7a2a);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const len = 0.42;
    const w = 0.14;
    const geo = new THREE.PlaneGeometry(w, len, 2, 4);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getY(vi) + len / 2) / len;
      const widthMult = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
      pos.setX(vi, pos.getX(vi) * widthMult);
    }
    geo.computeVertexNormals();
    const frond = new THREE.Mesh(geo, frondMat);
    frond.position.set(0, 0, len / 2);
    frond.rotation.x = -Math.PI / 2;
    const fg = new THREE.Group();
    fg.add(frond);
    fg.position.set(Math.cos(a) * 0.04, 0.02, Math.sin(a) * 0.04);
    fg.rotation.y = a;
    g.add(fg);
  }
  return g;
}

function buildVine(): THREE.Group {
  const g = new THREE.Group();
  // English ivy — crawling stems with overlapping heart-shaped leaves flat on ground

  const stemMat = mat(0x5a4a2a);
  const leafMats = [matDS(0x2a6a1a), matDS(0x358020), matDS(0x3a7528)];

  // 12 radiating vine arms with visible stems
  const armCount = 12;
  for (let ai = 0; ai < armCount; ai++) {
    const baseA = (ai / armCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const armLen = 0.42 + Math.random() * 0.12;
    const segments = 6;
    let cx = 0, cz = 0;
    let dir = baseA;
    const stepLen = armLen / segments;

    for (let si = 0; si < segments; si++) {
      dir += (Math.random() - 0.5) * 0.25;
      const nx = cx + Math.cos(dir) * stepLen;
      const nz = cz + Math.sin(dir) * stepLen;

      // Visible stem segment
      const segLen = Math.sqrt((nx - cx) ** 2 + (nz - cz) ** 2);
      const segGeo = new THREE.CylinderGeometry(0.008, 0.012, segLen, 4);
      const seg = new THREE.Mesh(segGeo, stemMat);
      seg.position.set((cx + nx) / 2, 0.012, (cz + nz) / 2);
      seg.rotation.z = Math.PI / 2;
      seg.rotation.y = Math.atan2(nz - cz, nx - cx);
      g.add(seg);

      // Leaf at each node — larger near center
      const dist = Math.sqrt(nx * nx + nz * nz);
      const sizeFactor = Math.max(0.7, 1.3 - dist * 0.8);
      const leafSize = (0.07 + Math.random() * 0.03) * sizeFactor;
      const lGeo = new THREE.PlaneGeometry(leafSize, leafSize * 1.1);
      const leaf = new THREE.Mesh(lGeo, leafMats[si % 3]);
      const leafSide = si % 2 === 0 ? 1 : -1;
      const off = leafSize * 0.3;
      leaf.position.set(
        nx + Math.cos(dir + leafSide * Math.PI / 2) * off,
        0.020,
        nz + Math.sin(dir + leafSide * Math.PI / 2) * off,
      );
      leaf.rotation.x = -Math.PI / 2;
      leaf.rotation.z = dir + leafSide * 0.4 + Math.random() * 0.3;
      g.add(leaf);

      // Second leaf on opposite side for denser coverage
      if (si > 0 && si < segments - 1) {
        const ls2 = leafSize * 0.8;
        const geo2 = new THREE.PlaneGeometry(ls2, ls2 * 1.1);
        const leaf2 = new THREE.Mesh(geo2, leafMats[(si + 1) % 3]);
        leaf2.position.set(
          nx + Math.cos(dir - leafSide * Math.PI / 2) * off * 0.6,
          0.018,
          nz + Math.sin(dir - leafSide * Math.PI / 2) * off * 0.6,
        );
        leaf2.rotation.x = -Math.PI / 2;
        leaf2.rotation.z = dir - leafSide * 0.3 + Math.random() * 0.3;
        g.add(leaf2);
      }

      cx = nx;
      cz = nz;
    }
  }

  // Dense center mound — large overlapping leaves
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = 0.02 + Math.random() * 0.12;
    const leafSize = 0.08 + Math.random() * 0.05;
    const geo = new THREE.PlaneGeometry(leafSize, leafSize * 1.1);
    const leaf = new THREE.Mesh(geo, leafMats[i % 3]);
    leaf.position.set(Math.cos(a) * r, 0.025 + Math.random() * 0.01, Math.sin(a) * r);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = a + Math.random() * 0.5;
    g.add(leaf);
  }

  // Heavy gap fill — especially edges and corners
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 0.95;
    const z = (Math.random() - 0.5) * 0.95;
    const leafSize = 0.05 + Math.random() * 0.04;
    const geo = new THREE.PlaneGeometry(leafSize, leafSize * 1.1);
    const leaf = new THREE.Mesh(geo, leafMats[i % 3]);
    leaf.position.set(x, 0.015, z);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = Math.random() * Math.PI * 2;
    g.add(leaf);
  }

  return g;
}

function buildVineLow(): THREE.Group {
  const g = new THREE.Group();
  const leafMats = [matDS(0x2a6a1a), matDS(0x357a22)];
  // 10 large overlapping heart-shaped leaves covering the cell = 10 meshes
  const positions = [
    [0, 0], [0.22, 0.18], [-0.20, 0.22], [0.25, -0.16], [-0.18, -0.22],
    [0.38, 0.02], [-0.36, 0.05], [0.05, 0.36], [0.10, -0.35], [-0.30, -0.18],
  ];
  for (let i = 0; i < positions.length; i++) {
    const [x, z] = positions[i];
    const geo = new THREE.PlaneGeometry(0.18, 0.20, 1, 1);
    const leaf = new THREE.Mesh(geo, leafMats[i % 2]);
    leaf.position.set(x, 0.018 + i * 0.001, z);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = i * 0.7;
    g.add(leaf);
  }
  return g;
}

function buildClover(): THREE.Group {
  const g = new THREE.Group();
  // White clover — abundant fluffy flower globes with sparse trifoliate leaves

  const petioleMat = mat(0x5a8a35);
  const leafMats = [matDS(0x3a7a25), matDS(0x448830), matDS(0x2d6a1a)];
  const flowerMat = mat(0xffeedd);
  const flowerPink = mat(0xffaacc);
  const flowerWhite = mat(0xffffff);

  // Sparse trifoliate clusters — just enough to suggest clover without a carpet
  const cloverSpots = [
    { x: 0, z: 0 }, { x: 0.20, z: 0.15 }, { x: -0.18, z: 0.20 },
    { x: -0.15, z: -0.18 }, { x: 0.22, z: -0.12 }, { x: -0.28, z: 0.0 },
    { x: 0.28, z: 0.06 }, { x: 0.0, z: -0.26 }, { x: 0.0, z: 0.28 },
    { x: -0.30, z: -0.22 }, { x: 0.30, z: 0.24 }, { x: 0.14, z: -0.30 },
  ];
  for (let ci = 0; ci < cloverSpots.length; ci++) {
    const cs = cloverSpots[ci];
    const petioleH = 0.03 + Math.random() * 0.02;
    const pGeo = new THREE.CylinderGeometry(0.003, 0.004, petioleH, 3);
    const petiole = new THREE.Mesh(pGeo, petioleMat);
    petiole.position.set(cs.x, petioleH / 2, cs.z);
    g.add(petiole);
    const baseAngle = ci * 1.3;
    for (let li = 0; li < 3; li++) {
      const la = baseAngle + (li / 3) * Math.PI * 2;
      const lGeo = new THREE.CircleGeometry(0.028, 5);
      const leaf = new THREE.Mesh(lGeo, leafMats[li]);
      leaf.position.set(cs.x + Math.cos(la) * 0.018, petioleH + 0.002, cs.z + Math.sin(la) * 0.018);
      leaf.rotation.x = -Math.PI / 2;
      g.add(leaf);
    }
  }

  // Abundant fluffy white/pink flower globes — the main visual
  const flowerSpots = [
    { x: 0.02, z: 0.04 }, { x: -0.16, z: 0.18 }, { x: 0.22, z: -0.10 },
    { x: -0.08, z: -0.22 }, { x: 0.28, z: 0.16 }, { x: -0.26, z: -0.06 },
    { x: 0.10, z: 0.28 }, { x: -0.28, z: 0.28 }, { x: 0.06, z: -0.34 },
    { x: -0.34, z: 0.08 }, { x: 0.34, z: -0.26 }, { x: -0.02, z: -0.02 },
    { x: 0.16, z: 0.12 }, { x: -0.14, z: 0.08 }, { x: 0.08, z: -0.16 },
    { x: -0.22, z: -0.24 }, { x: 0.32, z: 0.30 }, { x: -0.36, z: -0.20 },
    { x: 0.20, z: -0.32 }, { x: -0.10, z: 0.36 }, { x: 0.36, z: 0.02 },
    { x: -0.32, z: 0.34 }, { x: 0.26, z: 0.34 }, { x: -0.20, z: -0.36 },
  ];
  const flowerMats = [flowerMat, flowerPink, flowerWhite];
  for (let fi = 0; fi < flowerSpots.length; fi++) {
    const fp = flowerSpots[fi];
    const stemH = 0.08 + Math.random() * 0.06;
    const stemGeo = new THREE.CylinderGeometry(0.004, 0.005, stemH, 3);
    const stem = new THREE.Mesh(stemGeo, petioleMat);
    stem.position.set(fp.x, stemH / 2, fp.z);
    g.add(stem);
    // Larger fluffy globe
    const headGeo = jitter(new THREE.SphereGeometry(0.035 + Math.random() * 0.01, 5, 4), 0.006);
    const head = new THREE.Mesh(headGeo, flowerMats[fi % 3]);
    head.position.set(fp.x, stemH + 0.02, fp.z);
    g.add(head);
  }

  return g;
}

function buildCloverLow(): THREE.Group {
  const g = new THREE.Group();
  // 12 meshes: 4 small leaf discs + 8 white/pink flower globes
  const leafMat = matDS(0x3a7a25);
  const flowerMats = [mat(0xffeedd), mat(0xffccdd), mat(0xffffff)];
  // 4 small leaf discs
  const leafPos: [number, number][] = [[0, 0], [0.20, 0.15], [-0.18, 0.20], [-0.15, -0.18]];
  for (const [x, z] of leafPos) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.06, 5), leafMat);
    leaf.position.set(x, 0.02, z);
    leaf.rotation.x = -Math.PI / 2;
    g.add(leaf);
  }
  // 8 flower globes — dominant visual
  const flowerPos: [number, number][] = [
    [0.02, 0.04], [-0.16, 0.18], [0.22, -0.10], [-0.08, -0.22],
    [0.28, 0.16], [-0.26, -0.06], [0.10, 0.28], [-0.28, 0.28],
  ];
  for (let i = 0; i < flowerPos.length; i++) {
    const [x, z] = flowerPos[i];
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), flowerMats[i % 3]);
    head.position.set(x, 0.09, z);
    g.add(head);
  }
  return g;
}

function buildMoss(): THREE.Group {
  const g = new THREE.Group();
  // Cushion moss — dense overlapping mounds covering entire cell

  const mossMats = [mat(0x3a7a25), mat(0x4a8a30), mat(0x2d6a1a), mat(0x558a38), mat(0x3d8a2d)];

  // Large overlapping cushion mounds — tall domed hemispheres
  const mounds = [
    { x: 0.00, z: 0.00, r: 0.20 }, { x: -0.25, z: 0.20, r: 0.17 },
    { x: 0.28, z: -0.15, r: 0.16 }, { x: -0.15, z: -0.28, r: 0.18 },
    { x: 0.20, z: 0.25, r: 0.15 }, { x: -0.35, z: -0.05, r: 0.14 },
    { x: 0.35, z: 0.08, r: 0.15 }, { x: -0.05, z: 0.38, r: 0.14 },
    { x: 0.10, z: -0.38, r: 0.15 }, { x: -0.38, z: 0.35, r: 0.13 },
    { x: 0.38, z: -0.35, r: 0.13 }, { x: -0.30, z: -0.35, r: 0.12 },
    { x: 0.30, z: 0.35, r: 0.12 }, { x: -0.42, z: 0.10, r: 0.11 },
    { x: 0.42, z: -0.10, r: 0.11 }, { x: 0.00, z: -0.42, r: 0.11 },
  ];

  // Color variety — some yellower, some darker
  const mossVariety = [mat(0x3a7a25), mat(0x4a8a30), mat(0x2d6a1a), mat(0x558a38), mat(0x3d8a2d),
    mat(0x4a8528), mat(0x357a20), mat(0x488a35)];

  for (let mi = 0; mi < mounds.length; mi++) {
    const m = mounds[mi];
    const geo = jitter(new THREE.SphereGeometry(m.r, 7, 5), m.r * 0.12);
    // Dome shape — visible height, nearly flat bottom
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const y = pos.getY(vi);
      if (y < 0) pos.setY(vi, y * 0.1); // Flat bottom
      else pos.setY(vi, y * 0.65); // Taller dome — ~65% of radius
    }
    geo.computeVertexNormals();
    const bump = new THREE.Mesh(geo, mossVariety[mi % mossVariety.length]);
    bump.position.set(m.x, 0, m.z);
    g.add(bump);
  }

  // Medium filler mounds between large ones
  const fillerPositions = [
    [-0.12, 0.10], [0.12, -0.10], [-0.08, -0.12], [0.08, 0.12],
    [-0.30, 0.10], [0.30, -0.10], [0.15, 0.35], [-0.15, -0.35],
    [0.42, 0.20], [-0.42, -0.20], [-0.20, 0.42], [0.20, -0.42],
  ];
  for (let fi = 0; fi < fillerPositions.length; fi++) {
    const [fx, fz] = fillerPositions[fi];
    const r = 0.08 + Math.random() * 0.04;
    const geo = jitter(new THREE.SphereGeometry(r, 5, 4), r * 0.1);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const y = pos.getY(vi);
      if (y < 0) pos.setY(vi, y * 0.1);
      else pos.setY(vi, y * 0.55);
    }
    geo.computeVertexNormals();
    const bump = new THREE.Mesh(geo, mossVariety[(fi + 3) % mossVariety.length]);
    bump.position.set(fx, 0, fz);
    g.add(bump);
  }

  // Sporophyte stalks — thin reddish-brown stems with tiny capsules
  const sporeMat = mat(0x8a5533);
  const capMat = mat(0x6a4422);
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.35;
    const sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r;
    const h = 0.10 + Math.random() * 0.08;
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.004, h, 3),
      sporeMat,
    );
    stalk.position.set(sx, h / 2, sz);
    g.add(stalk);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.010, 3, 2), capMat);
    cap.position.set(sx, h, sz);
    cap.scale.y = 1.5;
    g.add(cap);
  }

  return g;
}

function buildMossLow(): THREE.Group {
  const g = new THREE.Group();
  const mossMats = [mat(0x3a7a25), mat(0x4a8a30), mat(0x2d6a1a)];
  // 10 large overlapping cushion domes = 10 meshes
  const positions = [
    [0, 0], [-0.22, 0.18], [0.24, -0.12], [-0.12, -0.24],
    [0.18, 0.22], [-0.34, -0.06], [0.34, 0.10], [-0.06, 0.36],
    [0.08, -0.34], [-0.28, 0.32],
  ];
  for (let i = 0; i < positions.length; i++) {
    const [x, z] = positions[i];
    const geo = new THREE.SphereGeometry(0.20, 5, 3);
    geo.scale(1, 0.3, 1);
    const bump = new THREE.Mesh(geo, mossMats[i % 3]);
    bump.position.set(x, 0.01, z);
    g.add(bump);
  }
  return g;
}

// ── New climate-zone subtypes (30-39) ──

function buildPampasGrass(): THREE.Group { return buildGrassPlaceholder(); }
function buildDesertGrass(): THREE.Group { return buildGrassPlaceholder(); }

function buildCypress(): THREE.Group {
  const g = new THREE.Group();
  // Italian cypress — tall narrow columnar flame shape, bumpy organic surface

  // Trunk — thin, barely visible behind foliage
  addTrunk(g, 0, 0, 0, 0.07, 0.04, 0.5, 0x6a4a30);

  // Dark-to-light green palette for depth
  const darkColors = [0x2a5e2a, 0x2d6630, 0x275528];
  const midColors = [0x336633, 0x3a7a3a, 0x357a35];
  const lightColors = [0x4a8a4a, 0x55994a, 0x4d9040];
  const dark = () => darkColors[Math.floor(Math.random() * darkColors.length)];
  const mid = () => midColors[Math.floor(Math.random() * midColors.length)];
  const light = () => lightColors[Math.floor(Math.random() * lightColors.length)];

  // NO smooth cylinder core — build entirely from overlapping canopy blobs
  // Vertical stack of 12 tiers with irregular radii to break the silhouette
  for (let tier = 0; tier < 12; tier++) {
    const t = tier / 11; // 0=bottom, 1=top
    const y = 0.30 + tier * 0.20;
    const baseR = 0.28 - t * 0.08; // taper toward top
    // Color gradient: dark at bottom, lighter at top
    const tierColor = t < 0.3 ? dark : t < 0.7 ? mid : light;

    // 5 blobs per tier at irregular radii to create bumpy surface
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 + tier * 0.63;
      const rOff = baseR * (0.35 + Math.random() * 0.35);
      const blobR = baseR * (0.45 + Math.random() * 0.15);
      addCanopy(g, Math.cos(a) * rOff, y + (Math.random() - 0.5) * 0.06,
        Math.sin(a) * rOff, blobR, tierColor());
    }
    // Center fill blob per tier
    addCanopy(g, 0, y, 0, baseR * 0.5, tierColor());
  }

  // Pointed tip — flame shape
  addCanopy(g, 0, 2.65, 0, 0.15, light());
  const tipGeo = new THREE.ConeGeometry(0.12, 0.25, 5);
  const tip = new THREE.Mesh(tipGeo, mat(0x4a8a4a));
  tip.position.set(0, 2.80, 0);
  g.add(tip);

  // Bottom skirt — foliage touches ground
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.15, 0.25, Math.sin(a) * 0.15, 0.20, dark());
  }

  return g;
}

function buildAcacia(): THREE.Group {
  const g = new THREE.Group();
  // Umbrella thorn acacia — flat-topped wide spreading canopy, visible forking branches

  const barkColor = 0x7a5a3a;
  const barkDark = 0x5a3a1a;

  // Root flare
  const flareGeo = new THREE.CylinderGeometry(0.10, 0.18, 0.15, 7);
  const flare = new THREE.Mesh(flareGeo, mat(barkDark));
  flare.position.y = 0.075;
  g.add(flare);

  // Main trunk — leaning slightly, characteristic of acacia
  addTrunk(g, 0, 0.15, 0, 0.10, 0.07, 0.6, barkColor);

  // Major forking branches spreading wide and low
  const branchMat = mat(barkColor);
  const forks = [
    { a: 0.3, tilt: 0.9, len: 0.55, rBot: 0.05, rTop: 0.025 },
    { a: 1.8, tilt: 0.85, len: 0.50, rBot: 0.045, rTop: 0.022 },
    { a: 3.2, tilt: 0.95, len: 0.58, rBot: 0.05, rTop: 0.025 },
    { a: 4.6, tilt: 0.80, len: 0.48, rBot: 0.04, rTop: 0.020 },
    { a: 5.8, tilt: 0.88, len: 0.52, rBot: 0.045, rTop: 0.022 },
  ];
  for (const f of forks) {
    const geo = new THREE.CylinderGeometry(f.rTop, f.rBot, f.len, 5);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(f.a) * 0.06, 0.7, Math.sin(f.a) * 0.06);
    m.rotation.z = Math.cos(f.a) * f.tilt;
    m.rotation.x = Math.sin(f.a) * f.tilt;
    g.add(m);
  }

  // Flat umbrella canopy — WIDE and FLAT, defining silhouette
  const canopyColors = [0x6aaa44, 0x5d9a3a, 0x78bb50, 0x55883a, 0x6ab848];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // Flat opaque disk as canopy base
  const diskGeo = new THREE.CylinderGeometry(0.75, 0.80, 0.15, 12);
  const disk = new THREE.Mesh(diskGeo, mat(0x3a6622));
  disk.position.set(0, 0.92, 0);
  g.add(disk);

  // Wide ring of canopy blobs — flat crown
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const dist = 0.55 + Math.random() * 0.15;
    addCanopy(g, Math.cos(a) * dist, 0.95 + Math.random() * 0.06, Math.sin(a) * dist,
      0.25 + Math.random() * 0.06, cc());
  }

  // Inner fill — keep canopy opaque
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const dist = 0.25 + Math.random() * 0.2;
    addCanopy(g, Math.cos(a) * dist, 0.95, Math.sin(a) * dist,
      0.22 + Math.random() * 0.05, cc());
  }

  // Top cap — flat, not domed
  addCanopy(g, 0, 1.02, 0, 0.35, cc());
  addCanopy(g, 0.1, 1.0, -0.05, 0.28, cc());

  return g;
}

function buildFloweringShrub(): THREE.Group {
  const g = new THREE.Group();
  // Hibiscus — dense green dome with large showy red/pink flowers

  // Multi-stem base — 5 thin stems emerging from soil
  const stemMat = mat(0x5a4a30);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = 0.04 + Math.random() * 0.02;
    addTrunk(g, Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05, r, r * 0.7, 0.3, 0x5a4a30);
  }

  // Dense leafy dome
  const leafColors = [0x44aa44, 0x55bb55, 0x3d9d3d, 0x4daa50, 0x66cc66];
  const cc = () => leafColors[Math.floor(Math.random() * leafColors.length)];

  // Opaque core
  const coreGeo = new THREE.SphereGeometry(0.35, 10, 8);
  coreGeo.scale(1.2, 0.9, 1.2);
  const core = new THREE.Mesh(coreGeo, mat(0x2d6633));
  core.position.set(0, 0.55, 0);
  g.add(core);

  // Canopy dome layers
  for (let tier = 0; tier < 3; tier++) {
    const y = 0.40 + tier * 0.15;
    const count = 7;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + tier * 0.3;
      const dist = 0.25 + Math.random() * 0.10;
      addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist,
        0.20 + Math.random() * 0.05, cc());
    }
  }

  // Top + bottom fill
  addCanopy(g, 0, 0.72, 0, 0.30, cc());
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.20, 0.32, Math.sin(a) * 0.20, 0.18, cc());
  }

  // Large showy hibiscus flowers — big and prominent
  const flowerColors = [0xff3344, 0xff5566, 0xee2255, 0xff4455, 0xcc1133];
  const centerMat = mat(0xffee44);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.1;
    const y = 0.38 + (i % 3) * 0.16;
    const dist = 0.36 + Math.random() * 0.08;
    const size = 0.12 + Math.random() * 0.04; // 2x bigger
    // Flower head — flat disc shape
    const flGeo = jitter(new THREE.SphereGeometry(size, 5, 3), size * 0.08);
    flGeo.scale(1, 0.35, 1);
    const fl = new THREE.Mesh(flGeo, mat(flowerColors[i % flowerColors.length]));
    fl.position.set(Math.cos(a) * dist, y, Math.sin(a) * dist);
    g.add(fl);
    // Yellow center stamen
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(size * 0.3, 4, 2), centerMat);
    ctr.position.set(Math.cos(a) * dist, y + size * 0.2, Math.sin(a) * dist);
    g.add(ctr);
  }

  return g;
}

function buildAromatic(): THREE.Group {
  const g = new THREE.Group();
  // Lavender — low silver-green mound with purple flower spikes

  // Dense silver-green foliage mound
  const leafColors = [0x88aa77, 0x99bb88, 0x7a9a6a, 0x8aaa7a];
  const cc = () => leafColors[Math.floor(Math.random() * leafColors.length)];

  // Opaque core mound — low and wide
  const coreGeo = new THREE.SphereGeometry(0.35, 10, 6);
  coreGeo.scale(1.3, 0.5, 1.3);
  const core = new THREE.Mesh(coreGeo, mat(0x667755));
  core.position.set(0, 0.18, 0);
  g.add(core);

  // Mound surface blobs
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const dist = 0.25 + Math.random() * 0.10;
    addCanopy(g, Math.cos(a) * dist, 0.18 + Math.random() * 0.05, Math.sin(a) * dist,
      0.18, cc());
  }
  // Inner fill
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    addCanopy(g, Math.cos(a) * 0.12, 0.22, Math.sin(a) * 0.12, 0.15, cc());
  }

  // Purple flower spikes — short stems, tall dense spike heads
  const spikeMats = [mat(0x8855bb), mat(0x9966cc), mat(0x7744aa), mat(0xaa77dd)];
  const stemMat = mat(0x8a9a7a); // grey-green stems
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.random() * 0.15;
    const dist = 0.08 + Math.random() * 0.25;
    const stemH = 0.18 + Math.random() * 0.08; // much shorter stems
    // Short grey-green stem
    const stemGeo = new THREE.CylinderGeometry(0.007, 0.009, stemH, 3);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(Math.cos(a) * dist, stemH / 2 + 0.22, Math.sin(a) * dist);
    stem.rotation.z = (Math.random() - 0.5) * 0.12;
    stem.rotation.x = (Math.random() - 0.5) * 0.12;
    g.add(stem);
    // Tall flower spike head — elongated cylinder, 3x taller
    const spikeH = 0.10 + Math.random() * 0.05;
    const spikeGeo = new THREE.CylinderGeometry(0.025, 0.020, spikeH, 5);
    const spike = new THREE.Mesh(spikeGeo, spikeMats[i % spikeMats.length]);
    spike.position.set(Math.cos(a) * dist, stemH + 0.22 + spikeH / 2, Math.sin(a) * dist);
    spike.rotation.z = (Math.random() - 0.5) * 0.12;
    g.add(spike);
  }

  return g;
}

function buildBarrelCactus(): THREE.Group {
  const g = new THREE.Group();
  // Barrel cactus — squat globular body, prominent ribs, flower crown

  const bodyGreen = mat(0x7aaa55); // lighter, more yellow-green
  const darkGreen = mat(0x6a9a45);
  const lightGreen = mat(0x8abb65);

  // Squat barrel body — wider than tall
  const bodyR = 0.40;
  const bodyH = 0.50; // squashed: ratio ~1.25:1 (w:h)
  const bodyGeo = new THREE.SphereGeometry(bodyR, 12, 8);
  bodyGeo.scale(1, bodyH / bodyR, 1);
  const body = new THREE.Mesh(bodyGeo, bodyGreen);
  body.position.set(0, bodyH * 0.9, 0);
  g.add(body);

  // Vertical ribs — short ridges contained within the body sphere
  const ribCount = 12;
  const spineMat = mat(0xccbb77); // tan/yellow spines
  for (let i = 0; i < ribCount; i++) {
    const a = (i / ribCount) * Math.PI * 2;
    // Rib as a thin box — shorter than body, no overhang
    const ribH = bodyH * 0.9; // contained within sphere
    const ribGeo = new THREE.BoxGeometry(0.025, ribH, 0.018);
    const pos = ribGeo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const y = pos.getY(vi);
      const t = (y + ribH / 2) / ribH;
      const bulge = Math.sin(t * Math.PI) * bodyR * 0.10;
      pos.setZ(vi, pos.getZ(vi) + bulge);
    }
    ribGeo.computeVertexNormals();
    const rib = new THREE.Mesh(ribGeo, darkGreen);
    rib.position.set(Math.cos(a) * bodyR * 0.88, bodyH * 0.9, Math.sin(a) * bodyR * 0.88);
    rib.rotation.y = -a;
    g.add(rib);

    // Short spine nubs along each rib — 3 per rib, distributed across surface
    for (let si = 0; si < 3; si++) {
      const t = 0.25 + si * 0.25;
      const sy = bodyH * 0.5 + t * bodyH * 0.8;
      const sphereT = Math.sin(t * Math.PI);
      const sr = bodyR * 0.95 + sphereT * 0.02;
      const spineGeo = new THREE.CylinderGeometry(0.002, 0.004, 0.018, 3);
      const spine = new THREE.Mesh(spineGeo, spineMat);
      spine.position.set(Math.cos(a) * sr, sy, Math.sin(a) * sr);
      spine.rotation.z = Math.cos(a) * 0.5;
      spine.rotation.x = Math.sin(a) * 0.5;
      g.add(spine);
    }
  }

  // Dome cap — woolly top
  const capGeo = new THREE.SphereGeometry(bodyR * 0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, lightGreen);
  cap.position.set(0, bodyH * 1.7, 0);
  g.add(cap);

  // Crown ring of flowers — prominent yellow/orange/pink
  const flowerMats = [mat(0xffcc22), mat(0xff8844), mat(0xffdd44), mat(0xff6688)];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const fr = bodyR * 0.30;
    const fl = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(0.055, 0), 0.008),
      flowerMats[i % flowerMats.length],
    );
    fl.position.set(Math.cos(a) * fr, bodyH * 1.65 + Math.random() * 0.03, Math.sin(a) * fr);
    g.add(fl);
  }

  return g;
}

function buildJade(): THREE.Group {
  const g = new THREE.Group();
  // Jade plant / Crassula — thick stubby trunk forking into chunky branches, fleshy leaf pads

  const barkColor = 0x9a8a7a; // grey-brown succulent bark
  const barkMat = mat(barkColor);

  // Thick stubby main trunk — nearly as wide as tall
  addTrunk(g, 0, 0, 0, 0.12, 0.10, 0.22, barkColor);

  // Glossy yellow-green for fleshy jade leaves
  const leafColors = [0x6abb55, 0x78cc66, 0x5daa48, 0x88dd77, 0x6ab850];
  const lc = () => leafColors[Math.floor(Math.random() * leafColors.length)];

  // 3 major forking branches — thick, almost as wide as trunk
  const forks = [
    { a: 0.5, tilt: 0.50, len: 0.20, thick: 0.07 },
    { a: 2.6, tilt: 0.45, len: 0.18, thick: 0.065 },
    { a: 4.5, tilt: 0.55, len: 0.22, thick: 0.07 },
  ];

  for (const f of forks) {
    const cx = Math.cos(f.a), cz = Math.sin(f.a);
    // Thick primary branch
    const brGeo = new THREE.CylinderGeometry(f.thick * 0.75, f.thick, f.len, 6);
    const br = new THREE.Mesh(brGeo, barkMat);
    br.position.set(cx * 0.04, 0.22 + f.len * 0.3, cz * 0.04);
    br.rotation.z = cx * f.tilt;
    br.rotation.x = cz * f.tilt;
    g.add(br);

    // Tip of primary branch
    const tipX = cx * (0.04 + Math.sin(f.tilt) * f.len);
    const tipY = 0.22 + Math.cos(f.tilt) * f.len;
    const tipZ = cz * (0.04 + Math.sin(f.tilt) * f.len);

    // 2 secondary forks from each primary — also thick
    for (let si = 0; si < 2; si++) {
      const sa = f.a + (si === 0 ? -0.6 : 0.6);
      const sTilt = 0.45 + Math.random() * 0.15;
      const sLen = 0.12 + Math.random() * 0.04;
      const sThick = f.thick * 0.6;
      const scx = Math.cos(sa), scz = Math.sin(sa);

      const sGeo = new THREE.CylinderGeometry(sThick * 0.7, sThick, sLen, 5);
      const sBr = new THREE.Mesh(sGeo, barkMat);
      sBr.position.set(tipX, tipY, tipZ);
      sBr.rotation.z = scx * sTilt;
      sBr.rotation.x = scz * sTilt;
      g.add(sBr);

      // Tight fleshy leaf pad at each sub-branch tip — small round clusters
      const stX = tipX + scx * Math.sin(sTilt) * sLen;
      const stY = tipY + Math.cos(sTilt) * sLen;
      const stZ = tipZ + scz * Math.sin(sTilt) * sLen;

      // Compact leaf cluster — 1 core + 3 small satellites
      addCanopy(g, stX, stY, stZ, 0.08, lc());
      for (let li = 0; li < 3; li++) {
        const la = (li / 3) * Math.PI * 2 + sa;
        addCanopy(g, stX + Math.cos(la) * 0.05, stY + (Math.random() - 0.3) * 0.03,
          stZ + Math.sin(la) * 0.05, 0.06, lc());
      }
    }

    // Leaf cluster at primary branch tip too
    addCanopy(g, tipX, tipY + 0.02, tipZ, 0.07, lc());
  }

  // Central top crown — small cluster where branches meet
  addCanopy(g, 0, 0.40, 0, 0.08, lc());
  addCanopy(g, 0.03, 0.44, -0.02, 0.06, lc());

  return g;
}

function buildTropicalHerb(): THREE.Group {
  const g = new THREE.Group();
  // Heliconia — upright stems with a few banana-like leaves + bold hanging flower bracts

  const leafMats = [matDS(0x338833), matDS(0x3d9d3d), matDS(0x2d7a2d)];
  const stemMat = mat(0x557744);

  // Heliconia flower stalks — spread across the cell, flowers are the main feature
  const bractColors = [mat(0xff2211), mat(0xff4422), mat(0xee1100), mat(0xff6622)];
  const bractYellow = mat(0xffcc22);
  const stalks = [
    { x: 0, z: 0, h: 0.52 },
    { x: 0.16, z: 0.12, h: 0.46 },
    { x: -0.14, z: 0.15, h: 0.48 },
    { x: -0.12, z: -0.14, h: 0.42 },
    { x: 0.18, z: -0.10, h: 0.40 },
    { x: -0.22, z: -0.02, h: 0.38 },
    { x: 0.06, z: -0.22, h: 0.44 },
    { x: 0.24, z: 0.22, h: 0.36 },
    { x: -0.24, z: 0.24, h: 0.34 },
  ];
  for (let si = 0; si < stalks.length; si++) {
    const fp = stalks[si];
    // Thick stem
    const sg = new THREE.CylinderGeometry(0.014, 0.018, fp.h, 4);
    const sm = new THREE.Mesh(sg, stemMat);
    sm.position.set(fp.x, fp.h / 2, fp.z);
    g.add(sm);

    // 1-2 upright leaves per stalk — narrow, pointing up at an angle
    const leafCount = si < 5 ? 2 : 1;
    for (let li = 0; li < leafCount; li++) {
      const la = (si * 1.7 + li * Math.PI) + Math.random() * 0.3;
      const leafLen = 0.20 + Math.random() * 0.08;
      const leafW = 0.08 + Math.random() * 0.03;
      const geo = new THREE.PlaneGeometry(leafW, leafLen, 2, 4);
      const pos = geo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const t = (pos.getY(vi) + leafLen / 2) / leafLen;
        pos.setX(vi, pos.getX(vi) * (1 - t * 0.5));
        pos.setZ(vi, (1 - Math.abs(pos.getX(vi)) / (leafW / 2)) * 0.01);
      }
      geo.computeVertexNormals();
      const leaf = new THREE.Mesh(geo, leafMats[si % leafMats.length]);
      // Attach leaf partway up the stem, angled outward
      const leafY = fp.h * (0.3 + li * 0.2);
      leaf.position.set(0, 0, leafLen / 2);
      leaf.rotation.x = -Math.PI / 4; // 45 degrees — mostly upright

      const leafGrp = new THREE.Group();
      leafGrp.add(leaf);
      leafGrp.position.set(fp.x, leafY, fp.z);
      leafGrp.rotation.y = la;
      g.add(leafGrp);
    }

    // Hanging bracts — large alternating lobster-claw flowers
    const bractCount = 3 + Math.floor(Math.random() * 3);
    for (let bi = 0; bi < bractCount; bi++) {
      const by = fp.h - 0.01 - bi * 0.06;
      const side = bi % 2 === 0 ? 1 : -1;
      const bractGeo = new THREE.ConeGeometry(0.045, 0.10, 4);
      const bract = new THREE.Mesh(bractGeo, bractColors[(si + bi) % bractColors.length]);
      bract.position.set(fp.x + side * 0.035, by, fp.z);
      bract.rotation.z = side * 0.8;
      bract.rotation.x = Math.PI;
      g.add(bract);
      const tipM = new THREE.Mesh(new THREE.SphereGeometry(0.018, 3, 2), bractYellow);
      tipM.position.set(fp.x + side * 0.06, by - 0.045, fp.z);
      g.add(tipM);
    }
  }

  return g;
}

function buildDesertAnnual(): THREE.Group {
  const g = new THREE.Group();
  // California poppy — bright orange cup-shaped flowers dominate, sparse feathery foliage

  const leafMat = matDS(0x6a9a7a);
  const stemMat = mat(0x6a8a5a);

  // Sparse feathery foliage tufts — just hints of blue-green
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
    const r = 0.06 + Math.random() * 0.32;
    const leafLen = 0.06 + Math.random() * 0.04;
    const leafW = 0.02 + Math.random() * 0.015;
    const geo = new THREE.PlaneGeometry(leafW, leafLen, 1, 2);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getY(vi) + leafLen / 2) / leafLen;
      pos.setX(vi, pos.getX(vi) * (1 - t * 0.7));
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMat);
    leaf.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = -a;
    g.add(leaf);
  }

  // Abundant bright orange poppies — spread across the whole cell
  const flowerMat = mat(0xff8822);
  const flowerBright = mat(0xffaa33);
  const flowerGold = mat(0xffcc44);
  const centerMat = mat(0xffee44);

  const poppies = [
    { x: 0, z: 0, h: 0.20 }, { x: 0.14, z: 0.10, h: 0.18 },
    { x: -0.11, z: 0.14, h: 0.17 }, { x: -0.09, z: -0.13, h: 0.19 },
    { x: 0.17, z: -0.07, h: 0.16 }, { x: -0.20, z: -0.04, h: 0.15 },
    { x: 0.05, z: -0.19, h: 0.18 }, { x: -0.04, z: 0.21, h: 0.14 },
    { x: 0.22, z: 0.18, h: 0.13 }, { x: -0.20, z: 0.20, h: 0.16 },
    { x: 0.26, z: -0.15, h: 0.12 }, { x: -0.26, z: -0.18, h: 0.14 },
    { x: 0.09, z: 0.28, h: 0.11 }, { x: -0.07, z: -0.28, h: 0.13 },
    { x: 0.30, z: 0.04, h: 0.11 }, { x: -0.28, z: 0.10, h: 0.12 },
    { x: 0.12, z: -0.30, h: 0.10 }, { x: -0.15, z: 0.32, h: 0.11 },
    { x: 0.32, z: -0.22, h: 0.09 }, { x: -0.32, z: -0.08, h: 0.10 },
    { x: 0.18, z: 0.32, h: 0.09 }, { x: -0.08, z: -0.35, h: 0.10 },
    { x: 0.35, z: 0.14, h: 0.08 }, { x: -0.35, z: 0.20, h: 0.09 },
  ];
  const flowerMats = [flowerMat, flowerBright, flowerGold];
  for (let fi = 0; fi < poppies.length; fi++) {
    const fp = poppies[fi];
    // Thin wiry stem
    const sg = new THREE.CylinderGeometry(0.004, 0.007, fp.h, 3);
    const sm = new THREE.Mesh(sg, stemMat);
    sm.position.set(fp.x, fp.h / 2, fp.z);
    g.add(sm);
    // Cup-shaped poppy flower — larger, prominent, with slight tilt for organic feel
    const headGeo = jitter(new THREE.SphereGeometry(0.055 + Math.random() * 0.02, 5, 3), 0.007);
    headGeo.scale(1, 0.4, 1);
    const head = new THREE.Mesh(headGeo, flowerMats[fi % 3]);
    head.position.set(fp.x, fp.h + 0.01, fp.z);
    head.rotation.x = (Math.random() - 0.5) * 0.3;
    head.rotation.z = (Math.random() - 0.5) * 0.3;
    g.add(head);
    // Yellow center
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.016, 3, 2), centerMat);
    ctr.position.set(fp.x, fp.h + 0.025, fp.z);
    g.add(ctr);
  }

  return g;
}

// ── Low-mesh builders for new climate-zone subtypes (30-39) ──

function buildCypressLow(): THREE.Group {
  const g = new THREE.Group();
  // 8 meshes: trunk + 7 heavily overlapping canopy tiers for solid column
  addTrunk(g, 0, 0, 0, 0.06, 0.04, 0.4, 0x6a4a30);
  const colors = [0x2a5e2a, 0x336633, 0x3a7a3a, 0x4a8a4a, 0x55994a, 0x4d9040, 0x4a8a4a];
  // Tight spacing (0.28) + large radii (0.36 base) = heavy overlap, no gaps
  for (let i = 0; i < 7; i++) {
    const y = 0.25 + i * 0.28;
    const r = 0.36 - i * 0.025; // gentle taper
    addCanopy(g, 0, y, 0, r, colors[i]);
  }
  return g;
}

function buildAcaciaLow(): THREE.Group {
  const g = new THREE.Group();
  // 10 meshes: flare + trunk + 2 branches + 6 canopy blobs
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, 0.15, 6), mat(0x5a3a1a));
  flare.position.y = 0.075;
  g.add(flare);
  addTrunk(g, 0, 0.15, 0, 0.10, 0.07, 0.6, 0x7a5a3a);
  // 2 visible branches
  for (const a of [1.0, 4.0]) {
    const geo = new THREE.CylinderGeometry(0.02, 0.04, 0.45, 4);
    const m = new THREE.Mesh(geo, mat(0x7a5a3a));
    m.position.set(Math.cos(a) * 0.06, 0.7, Math.sin(a) * 0.06);
    m.rotation.z = Math.cos(a) * 0.9;
    m.rotation.x = Math.sin(a) * 0.9;
    g.add(m);
  }
  // Flat canopy — 6 wide blobs
  const cc = [0x6aaa44, 0x5d9a3a, 0x78bb50, 0x55883a, 0x6ab848, 0x6aaa44];
  const lobes: [number, number, number, number][] = [
    [0.50, 0.95, 0.15, 0.30], [-0.45, 0.95, -0.15, 0.28],
    [0.10, 0.98, 0.45, 0.26], [-0.15, 0.95, -0.40, 0.25],
    [0.0, 1.0, 0.0, 0.35], [0.0, 0.92, 0.0, 0.30],
  ];
  for (let i = 0; i < lobes.length; i++) {
    const [x, y, z, r] = lobes[i];
    addCanopy(g, x, y, z, r, cc[i]);
  }
  return g;
}

function buildFloweringShrubLow(): THREE.Group {
  const g = new THREE.Group();
  // 12 meshes: 1 trunk + 5 canopy blobs + 6 flowers
  addTrunk(g, 0, 0, 0, 0.05, 0.04, 0.25, 0x5a4a30);
  const cc = [0x44aa44, 0x55bb55, 0x3d9d3d, 0x4daa50, 0x66cc66];
  addCanopy(g, 0, 0.55, 0, 0.40, cc[0]);
  addCanopy(g, 0.20, 0.50, 0.15, 0.28, cc[1]);
  addCanopy(g, -0.18, 0.48, -0.12, 0.26, cc[2]);
  addCanopy(g, 0.0, 0.68, 0.0, 0.30, cc[3]);
  addCanopy(g, 0.0, 0.38, 0.0, 0.30, cc[4]);
  // 6 large flowers
  const fc = [0xff3344, 0xff5566, 0xee2255, 0xff4455, 0xcc1133, 0xff3344];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const flGeo = new THREE.SphereGeometry(0.10, 4, 2);
    flGeo.scale(1, 0.35, 1);
    const fl = new THREE.Mesh(flGeo, mat(fc[i]));
    fl.position.set(Math.cos(a) * 0.35, 0.42 + (i % 3) * 0.14, Math.sin(a) * 0.35);
    g.add(fl);
  }
  return g;
}

function buildAromaticLow(): THREE.Group {
  const g = new THREE.Group();
  // 12 meshes: 2 mound blobs + 10 tall flower spikes
  // Compact mound base
  addCanopy(g, 0, 0.20, 0, 0.34, 0x88aa77);
  addCanopy(g, 0.0, 0.24, 0.0, 0.28, 0x99bb88);
  // 10 tall flower spikes — spread across mound, height matches high mesh
  const sc = [0x8855bb, 0x9966cc, 0x7744aa, 0xaa77dd];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const dist = 0.05 + (i % 3) * 0.06;
    const h = 0.22 + (i % 2) * 0.04;
    const spikeGeo = new THREE.CylinderGeometry(0.028, 0.022, h, 4);
    const spike = new THREE.Mesh(spikeGeo, mat(sc[i % 4]));
    spike.position.set(Math.cos(a) * dist, 0.36 + h / 2, Math.sin(a) * dist);
    g.add(spike);
  }
  return g;
}

function buildBarrelCactusLow(): THREE.Group {
  const g = new THREE.Group();
  // 10 meshes: body + cap + 8 flower ring
  const bodyR = 0.40, bodyH = 0.50;
  const bodyGeo = new THREE.SphereGeometry(bodyR, 10, 6);
  bodyGeo.scale(1, bodyH / bodyR, 1);
  const body = new THREE.Mesh(bodyGeo, mat(0x7aaa55));
  body.position.set(0, bodyH * 0.9, 0);
  g.add(body);
  const capGeo = new THREE.SphereGeometry(bodyR * 0.35, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, mat(0x8abb65));
  cap.position.set(0, bodyH * 1.7, 0);
  g.add(cap);
  const fc = [0xffcc22, 0xff8844, 0xffdd44, 0xff6688];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(fc[i % 4]));
    fl.position.set(Math.cos(a) * bodyR * 0.30, bodyH * 1.65, Math.sin(a) * bodyR * 0.30);
    g.add(fl);
  }
  return g;
}

function buildJadeLow(): THREE.Group {
  const g = new THREE.Group();
  // 11 meshes: trunk + 3 thick branches + 7 leaf clusters
  addTrunk(g, 0, 0, 0, 0.12, 0.10, 0.22, 0x9a8a7a);
  const lc = [0x6abb55, 0x78cc66, 0x5daa48, 0x88dd77, 0x6ab850, 0x78cc66, 0x5daa48];
  const barkMat = mat(0x9a8a7a);
  const branches = [
    { a: 0.5, tilt: 0.50, tipX: 0.14, tipY: 0.38, tipZ: 0.10 },
    { a: 2.6, tilt: 0.45, tipX: -0.12, tipY: 0.36, tipZ: -0.09 },
    { a: 4.5, tilt: 0.55, tipX: 0.08, tipY: 0.40, tipZ: -0.14 },
  ];
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    const brGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.18, 5);
    const br = new THREE.Mesh(brGeo, barkMat);
    br.position.set(Math.cos(b.a) * 0.04, 0.28, Math.sin(b.a) * 0.04);
    br.rotation.z = Math.cos(b.a) * b.tilt;
    br.rotation.x = Math.sin(b.a) * b.tilt;
    g.add(br);
    // 2 leaf clusters per branch + 1 at tip
    addCanopy(g, b.tipX, b.tipY, b.tipZ, 0.09, lc[i * 2]);
    addCanopy(g, b.tipX + 0.05, b.tipY + 0.03, b.tipZ + 0.04, 0.07, lc[i * 2 + 1]);
  }
  addCanopy(g, 0, 0.42, 0, 0.08, lc[6]);
  return g;
}

function buildTropicalHerbLow(): THREE.Group {
  const g = new THREE.Group();
  // 12 meshes: 4 stems + 4 bract clusters + 4 leaves — flowers dominate
  const stemMat = mat(0x557744);
  const leafMat = matDS(0x338833);
  const bractColors = [mat(0xff2211), mat(0xff4422), mat(0xee1100), mat(0xff6622)];
  const bractYellow = mat(0xffcc22);
  // 4 flower stalks spread across cell
  const stalks: [number, number, number][] = [[0, 0.46, 0], [0.14, 0.40, 0.12], [-0.12, 0.42, 0.14], [-0.10, 0.38, -0.12]];
  for (let i = 0; i < 4; i++) {
    const [x, h, z] = stalks[i];
    // Stem
    const sg = new THREE.CylinderGeometry(0.014, 0.018, h, 3);
    const sm = new THREE.Mesh(sg, stemMat);
    sm.position.set(x, h / 2, z);
    g.add(sm);
    // Bract cluster at top
    const bract = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), bractColors[i]);
    bract.position.set(x, h - 0.02, z);
    bract.rotation.x = Math.PI;
    g.add(bract);
    // Yellow tip
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 3, 2), bractYellow);
    tip.position.set(x, h - 0.08, z);
    g.add(tip);
  }
  return g;
}

function buildDesertAnnualLow(): THREE.Group {
  const g = new THREE.Group();
  // 10 meshes: all orange poppy flower discs — flowers dominate
  const fMats = [mat(0xff8822), mat(0xffaa33), mat(0xffcc44)];
  const positions: [number, number][] = [
    [0, 0], [0.14, 0.10], [-0.11, 0.14], [-0.09, -0.13],
    [0.17, -0.07], [-0.20, -0.04], [0.05, -0.19], [-0.04, 0.21],
    [0.22, 0.18], [-0.20, 0.20],
  ];
  for (let i = 0; i < positions.length; i++) {
    const [x, z] = positions[i];
    const headGeo = new THREE.SphereGeometry(0.055, 4, 2);
    headGeo.scale(1, 0.35, 1);
    const head = new THREE.Mesh(headGeo, fMats[i % 3]);
    head.position.set(x, 0.06 + i * 0.005, z);
    g.add(head);
  }
  return g;
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
  // Forbs (24-29)
  buildWildflower, buildTallHerb, buildFern, buildVine, buildClover, buildMoss,
  // New climate-zone subtypes (30-39)
  buildPampasGrass, buildDesertGrass,         // Grasses 30-31
  buildCypress, buildAcacia,                   // Trees 32-33
  buildFloweringShrub, buildAromatic,          // Shrubs 34-35
  buildBarrelCactus, buildJade,                // Succulents 36-37
  buildTropicalHerb, buildDesertAnnual,        // Forbs 38-39
];

/** Low-mesh LOD builders — same indices as BUILDERS, 8-12 meshes each.
 *  Grass placeholders (0-4), Saguaro (18), Aloe (19) reuse the full builder. */
export const BUILDERS_LOW: (() => THREE.Group)[] = [
  // Grasses (0-5) — placeholders same, sedge has low version
  buildTurfgrass, buildTallgrass, buildBunchgrass, buildBamboo, buildSpreading, buildSedgeLow,
  // Trees (6-11)
  buildOakLow, buildMagnoliaLow, buildConiferLow, buildTropicalLow, buildPalmLow, buildBirchLow,
  // Shrubs (12-17)
  buildEvergreenShrubLow, buildDeciduousShrubLow, buildMediterraneanLow, buildThornyLow, buildDesertShrubLow, buildMangroveLow,
  // Succulents (18-23) — Saguaro & Aloe reuse full builder
  buildSaguaro, buildAloe, buildCaudiciformLow, buildEuphorbiaLow, buildIcePlantLow, buildEpiphyticLow,
  // Forbs (24-29)
  buildWildflowerLow, buildTallHerbLow, buildFernLow, buildVineLow, buildCloverLow, buildMossLow,
  // New climate-zone subtypes (30-39)
  buildPampasGrass, buildDesertGrass,
  buildCypressLow, buildAcaciaLow,
  buildFloweringShrubLow, buildAromaticLow,
  buildBarrelCactusLow, buildJadeLow,
  buildTropicalHerbLow, buildDesertAnnualLow,
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
  // Forbs (24-29)
  0.08,   // 24: Wildflower   0.20m → 0.067 (floored)
  0.33,   // 25: Tall Herb    1.0m  → 0.33
  0.20,   // 26: Fern         0.60m → 0.20
  0.08,   // 27: Vine         0.15m → 0.05 (floored)
  0.08,   // 28: Ground Cover 0.10m → 0.033 (floored)
  0.08,   // 29: Moss         0.05m → 0.017 (floored)
  // New climate-zone subtypes (30-39)
  0.67,   // 30: Pampas       2.0m  → 0.67
  0.17,   // 31: Desert Grass 0.5m  → 0.17
  6.67,   // 32: Cypress      20m   → 6.67
  4.00,   // 33: Acacia       12m   → 4.0
  1.00,   // 34: Flowering    3.0m  → 1.0
  0.25,   // 35: Aromatic     0.75m → 0.25
  0.50,   // 36: Barrel       1.5m  → 0.5
  0.33,   // 37: Jade         1.0m  → 0.33
  0.33,   // 38: Tropical Herb 1.0m → 0.33
  0.08,   // 39: Desert Annual 0.30m→ 0.10 (floored)
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
export const MATURITY_HEIGHT: number[] = [
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
  // Forbs (24-29)
  2.0,   // 24: Wildflower — low rosette
  5.0,   // 25: Tall Herb — upright herb
  3.0,   // 26: Fern — spreading fronds
  1.5,   // 27: Vine — ground creeper
  1.0,   // 28: Ground Cover — clover mat
  1.0,   // 29: Moss — ultra-low cushion
  // New climate-zone subtypes (30-39)
  8.0,   // 30: Pampas — tall ornamental grass
  4.0,   // 31: Desert Grass — tussock
  10.0,  // 32: Cypress — tall columnar
  10.0,  // 33: Acacia — wide flat-topped tree
  6.0,   // 34: Flowering Shrub — hibiscus
  4.0,   // 35: Aromatic — lavender
  4.0,   // 36: Barrel Cactus — squat
  3.0,   // 37: Jade — compact succulent tree
  3.0,   // 38: Tropical Herb — heliconia
  1.5,   // 39: Desert Annual — poppy
];

/** Subtypes that act as ground cover — XZ always fills the cell, only Y scales. */
const GROUND_COVER = new Set([0, 1, 2, 3, 4, 5, 24, 25, 26, 27, 28, 29, 30, 31, 38, 39]); // grasses + forbs

/** Accent-only grass types — geometry is authored at world-unit scale, no model scaling.
 *  Carpet provides base coverage; these provide per-type visual identity. */
const GRASS_ACCENT = new Set([0, 1, 2, 4, 30, 31]); // turf, tall, bunch, spreading, pampas, desert grass

function buildModelsFromBuilders(builders: (() => THREE.Group)[]): SubtypeModel[] {
  return builders.map((build, i) => {
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

export function buildSubtypeModels(): SubtypeModel[] {
  return buildModelsFromBuilders(BUILDERS);
}

export function buildSubtypeModelsLow(): SubtypeModel[] {
  return buildModelsFromBuilders(BUILDERS_LOW);
}
