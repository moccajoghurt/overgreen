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

function buildTurfgrass(): THREE.Group {
  const g = new THREE.Group();
  // Very bright palette — ACES tonemapping will knock these down
  const bladeColors = [
    matDS(0xccff88), // bright yellow-green highlight
    matDS(0xaaee66), // lime
    matDS(0x99dd55), // light grass
    matDS(0x88cc44), // mid grass
    matDS(0x77bb33), // deeper green
  ];
  const carpetColors = [
    mat(0x77bb44), mat(0x66aa33), mat(0x88cc44),
  ];
  const half = 0.50;

  // Layer 1: low carpet fill — small flat quads covering the ground
  const carpetStep = 0.09;
  for (let gx = -half; gx <= half; gx += carpetStep) {
    for (let gz = -half; gz <= half; gz += carpetStep) {
      const ox = gx + (Math.random() - 0.5) * carpetStep * 0.3;
      const oz = gz + (Math.random() - 0.5) * carpetStep * 0.3;
      const size = carpetStep * (0.9 + Math.random() * 0.3);
      const geo = new THREE.PlaneGeometry(size, size);
      const m = new THREE.Mesh(geo, carpetColors[Math.floor(Math.random() * carpetColors.length)]);
      m.position.set(ox, 0.005, oz);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI * 0.5;
      g.add(m);
    }
  }

  // Layer 2: upright grass blades for silhouette
  const bladeStep = 0.065;
  for (let gx = -half; gx <= half; gx += bladeStep) {
    for (let gz = -half; gz <= half; gz += bladeStep) {
      const ox = gx + (Math.random() - 0.5) * bladeStep * 0.5;
      const oz = gz + (Math.random() - 0.5) * bladeStep * 0.5;
      const isHero = Math.random() < 0.1;
      const h = isHero ? (0.18 + Math.random() * 0.05) : (0.07 + Math.random() * 0.11);
      const w = 0.03 + Math.random() * 0.01; // min 0.03 to avoid edge-on vanishing
      const bend = 0.008 + Math.random() * 0.012;
      const baseAngle = Math.random() * Math.PI * 2;
      for (let cross = 0; cross < 2; cross++) {
        const geo = grassBlade(h, w, bend);
        const m = new THREE.Mesh(geo, bladeColors[Math.floor(Math.random() * bladeColors.length)]);
        m.position.set(ox, h * 0.5, oz);
        const lean = 0.05 + Math.random() * 0.12;
        const leanDir = Math.random() * Math.PI * 2;
        m.rotation.set(
          lean * Math.cos(leanDir),
          baseAngle + cross * Math.PI / 2,
          lean * Math.sin(leanDir),
        );
        g.add(m);
      }
    }
  }
  return g;
}

function buildTallgrass(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [
    matDS(0x88bb55), matDS(0x7aaa44), matDS(0x99cc66),
    matDS(0x6a9938), matDS(0xa0bb66), // warm golden-green
  ];
  const carpetColors = [mat(0x6a9938), mat(0x7aaa44), mat(0x5a8830)];
  const half = 0.50;

  // Carpet fill
  const carpetStep = 0.12;
  for (let gx = -half; gx <= half; gx += carpetStep) {
    for (let gz = -half; gz <= half; gz += carpetStep) {
      const size = carpetStep * (0.9 + Math.random() * 0.3);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        carpetColors[Math.floor(Math.random() * carpetColors.length)],
      );
      m.position.set(gx + (Math.random() - 0.5) * 0.03, 0.005, gz + (Math.random() - 0.5) * 0.03);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI * 0.5;
      g.add(m);
    }
  }

  // Tall arching blades
  const bladeStep = 0.10;
  for (let gx = -half; gx <= half; gx += bladeStep) {
    for (let gz = -half; gz <= half; gz += bladeStep) {
      const ox = gx + (Math.random() - 0.5) * bladeStep * 0.6;
      const oz = gz + (Math.random() - 0.5) * bladeStep * 0.6;
      const h = 0.5 + Math.random() * 0.5;
      const w = 0.04 + Math.random() * 0.02;
      const bend = 0.08 + Math.random() * 0.15;
      const twist = (Math.random() - 0.5) * 0.04;
      const baseAngle = Math.random() * Math.PI * 2;
      for (let cross = 0; cross < 2; cross++) {
        const geo = grassBlade(h, w, bend, twist);
        const m = new THREE.Mesh(geo, bladeColors[Math.floor(Math.random() * bladeColors.length)]);
        m.position.set(ox, h * 0.5, oz);
        const lean = 0.05 + Math.random() * 0.15;
        const leanDir = Math.random() * Math.PI * 2;
        m.rotation.set(
          lean * Math.cos(leanDir),
          baseAngle + cross * Math.PI / 2,
          lean * Math.sin(leanDir),
        );
        g.add(m);
      }
    }
  }

  // Seed heads on thin stalks
  const stalkMat = mat(0x8a7a55);
  const seedMat = mat(0xbbaa77);
  for (let i = 0; i < 12; i++) {
    const sx = (Math.random() - 0.5) * 0.8;
    const sz = (Math.random() - 0.5) * 0.8;
    const sh = 0.85 + Math.random() * 0.3;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, sh, 3), stalkMat);
    stalk.position.set(sx, sh / 2, sz);
    const lean = (Math.random() - 0.5) * 0.15;
    stalk.rotation.z = lean;
    stalk.rotation.x = (Math.random() - 0.5) * 0.15;
    g.add(stalk);
    // Seed cluster at top
    const seed = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.10, 4), seedMat);
    seed.position.set(sx + lean * 0.3, sh + 0.03, sz);
    g.add(seed);
  }
  return g;
}

function buildBunchgrass(): THREE.Group {
  const g = new THREE.Group();
  // Bright sage-green palette
  const bladeColors = [
    matDS(0xaacc88), matDS(0x99bb77), matDS(0xbbdd99),
    matDS(0x88aa66), matDS(0xccddaa),
  ];
  const carpetColors = [mat(0x88aa66), mat(0x99bb77), mat(0x77aa55)];
  const half = 0.50;

  // Dense overlapping carpet fill
  const carpetStep = 0.08;
  for (let gx = -half; gx <= half; gx += carpetStep) {
    for (let gz = -half; gz <= half; gz += carpetStep) {
      const size = carpetStep * (1.2 + Math.random() * 0.4);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        carpetColors[Math.floor(Math.random() * carpetColors.length)],
      );
      m.position.set(gx + (Math.random() - 0.5) * 0.03, 0.005 + Math.random() * 0.003, gz + (Math.random() - 0.5) * 0.03);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI;
      g.add(m);
    }
  }

  // Dense tussocks distributed across cell
  const tussocks = [
    { x: 0, z: 0, blades: 16 },
    { x: -0.30, z: -0.25, blades: 12 },
    { x: 0.28, z: 0.22, blades: 11 },
    { x: 0.25, z: -0.30, blades: 10 },
    { x: -0.28, z: 0.28, blades: 11 },
    { x: -0.05, z: -0.40, blades: 8 },
    { x: 0.05, z: 0.40, blades: 8 },
  ];
  for (const tus of tussocks) {
    const tR = 0.08 + Math.random() * 0.04;
    for (let i = 0; i < tus.blades; i++) {
      const a = (i / tus.blades) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = Math.random() * tR;
      const ox = tus.x + Math.cos(a) * dist;
      const oz = tus.z + Math.sin(a) * dist;
      const h = 0.25 + Math.random() * 0.20;
      const w = 0.03 + Math.random() * 0.012;
      const bend = 0.04 + Math.random() * 0.06;
      const outAngle = Math.atan2(oz - tus.z, ox - tus.x) || Math.random() * Math.PI * 2;
      for (let cross = 0; cross < 2; cross++) {
        const geo = grassBlade(h, w, bend);
        const m = new THREE.Mesh(geo, bladeColors[Math.floor(Math.random() * bladeColors.length)]);
        m.position.set(ox, h * 0.45, oz);
        const lean = 0.15 + Math.random() * 0.30;
        m.rotation.set(
          lean * Math.cos(outAngle + cross * 0.3),
          a + cross * Math.PI / 2,
          lean * Math.sin(outAngle + cross * 0.3),
        );
        g.add(m);
      }
    }
  }
  return g;
}

function buildBamboo(): THREE.Group {
  const g = new THREE.Group();
  const culmMat = mat(0xaacc55); // bright bamboo green
  const culmMat2 = mat(0x99bb44);
  const leafMat = matDS(0x77bb44);
  const leafMat2 = matDS(0x88cc55);
  const nodeMat = mat(0x88aa33);
  const carpetColors = [mat(0x66aa33), mat(0x77aa44), mat(0x559928)];
  const half = 0.50;

  // Ground carpet
  const carpetStep = 0.10;
  for (let gx = -half; gx <= half; gx += carpetStep) {
    for (let gz = -half; gz <= half; gz += carpetStep) {
      const size = carpetStep * (1.1 + Math.random() * 0.3);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        carpetColors[Math.floor(Math.random() * carpetColors.length)],
      );
      m.position.set(gx + (Math.random() - 0.5) * 0.03, 0.005, gz + (Math.random() - 0.5) * 0.03);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI;
      g.add(m);
    }
  }

  // Spread culms across full cell with jittered grid — no center bias
  const culmMats = [culmMat, culmMat2, mat(0xbbdd66), mat(0x8abb44)];
  const culmStep = 0.13;
  for (let gx = -half; gx <= half; gx += culmStep) {
    for (let gz = -half; gz <= half; gz += culmStep) {
      if (Math.random() > 0.85) continue; // slight thinning for organic feel
      const cx = gx + (Math.random() - 0.5) * culmStep * 0.6;
      const cz = gz + (Math.random() - 0.5) * culmStep * 0.6;
      // Taller center, shorter edges
      const edgeDist = Math.max(Math.abs(cx), Math.abs(cz)) / half;
      const totalH = (1.2 + Math.random() * 0.8) * (0.6 + 0.4 * (1 - edgeDist));
      const r = 0.022 + Math.random() * 0.012;
      const cm = culmMats[Math.floor(Math.random() * culmMats.length)];

      const segH = totalH / 3;
      for (let s = 0; s < 3; s++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, segH, 6), cm);
        seg.position.set(cx, s * segH + segH / 2, cz);
        g.add(seg);
        if (s > 0) {
          const node = new THREE.Mesh(new THREE.TorusGeometry(r * 1.3, r * 0.3, 4, 6), nodeMat);
          node.position.set(cx, s * segH, cz);
          node.rotation.x = Math.PI / 2;
          g.add(node);
        }
      }

      // Crown leaves
      const leafCount = 5 + Math.floor(Math.random() * 3);
      for (let l = 0; l < leafCount; l++) {
        const la = l * Math.PI * 2 / leafCount + Math.random() * 0.4;
        const lm = Math.random() > 0.5 ? leafMat : leafMat2;
        const leaf = new THREE.Mesh(grassBlade(0.20 + Math.random() * 0.08, 0.035, 0.02), lm);
        leaf.position.set(cx + Math.cos(la) * 0.05, totalH - 0.03, cz + Math.sin(la) * 0.05);
        leaf.rotation.y = la;
        leaf.rotation.z = 0.3 + Math.random() * 0.4;
        g.add(leaf);
      }

      // Mid-height occluding leaf fans at nodes
      if (totalH > 1.0) {
        const nodeCount = totalH > 1.5 ? 2 : 1;
        for (let ni = 0; ni < nodeCount; ni++) {
          const midY = totalH * (0.4 + ni * 0.2) + Math.random() * 0.1;
          const fanCount = 3 + Math.floor(Math.random() * 2);
          for (let fl = 0; fl < fanCount; fl++) {
            const fla = fl * Math.PI * 2 / fanCount + Math.random() * 0.5;
            const leaf = new THREE.Mesh(grassBlade(0.15 + Math.random() * 0.06, 0.04, 0.015), leafMat2);
            leaf.position.set(cx + Math.cos(fla) * 0.04, midY, cz + Math.sin(fla) * 0.04);
            leaf.rotation.y = fla;
            leaf.rotation.z = 0.35 + Math.random() * 0.35;
            g.add(leaf);
          }
        }
      }
    }
  }
  return g;
}

function buildSpreading(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [
    matDS(0xaadd66), matDS(0x99cc55), matDS(0xbbee77),
    matDS(0x88bb44), matDS(0x77aa33),
  ];
  const carpetColors = [mat(0x88bb44), mat(0x77aa33), mat(0x99cc55)];
  const stolonMat = mat(0x77aa44);
  const half = 0.50;

  // Dense carpet fill
  const carpetStep = 0.08;
  for (let gx = -half; gx <= half; gx += carpetStep) {
    for (let gz = -half; gz <= half; gz += carpetStep) {
      const size = carpetStep * (1.2 + Math.random() * 0.3);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        carpetColors[Math.floor(Math.random() * carpetColors.length)],
      );
      m.position.set(gx + (Math.random() - 0.5) * 0.03, 0.005 + Math.random() * 0.002, gz + (Math.random() - 0.5) * 0.03);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI;
      g.add(m);
    }
  }

  // Short upright blades — very low profile
  const bladeStep = 0.07;
  for (let gx = -half; gx <= half; gx += bladeStep) {
    for (let gz = -half; gz <= half; gz += bladeStep) {
      const ox = gx + (Math.random() - 0.5) * bladeStep * 0.5;
      const oz = gz + (Math.random() - 0.5) * bladeStep * 0.5;
      const h = 0.06 + Math.random() * 0.05;
      const w = 0.025 + Math.random() * 0.01;
      const bend = 0.005 + Math.random() * 0.008;
      const baseAngle = Math.random() * Math.PI * 2;
      for (let cross = 0; cross < 2; cross++) {
        const geo = grassBlade(h, w, bend);
        const m = new THREE.Mesh(geo, bladeColors[Math.floor(Math.random() * bladeColors.length)]);
        m.position.set(ox, h * 0.5, oz);
        const lean = 0.05 + Math.random() * 0.1;
        const leanDir = Math.random() * Math.PI * 2;
        m.rotation.set(lean * Math.cos(leanDir), baseAngle + cross * Math.PI / 2, lean * Math.sin(leanDir));
        g.add(m);
      }
    }
  }

  // Visible stolon runners spreading across surface
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const startX = (Math.random() - 0.5) * 0.3;
    const startZ = (Math.random() - 0.5) * 0.3;
    const len = 0.3 + Math.random() * 0.3;
    const endX = startX + Math.cos(a) * len;
    const endZ = startZ + Math.sin(a) * len;
    const stolon = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, len, 3), stolonMat);
    stolon.position.set((startX + endX) / 2, 0.015, (startZ + endZ) / 2);
    stolon.rotation.z = Math.PI / 2;
    stolon.rotation.y = -a;
    g.add(stolon);
  }
  return g;
}

function buildSedge(): THREE.Group {
  const g = new THREE.Group();
  const stemColors = [mat(0x77bb55), mat(0x88cc66), mat(0x66aa44)];
  const umbColors = [matDS(0x55aa44), matDS(0x66bb55), matDS(0x77cc66)];
  const carpetColors = [mat(0x66aa44), mat(0x77aa55), mat(0x559933)];
  const half = 0.50;

  // Ground carpet
  const carpetStep = 0.10;
  for (let gx = -half; gx <= half; gx += carpetStep) {
    for (let gz = -half; gz <= half; gz += carpetStep) {
      const size = carpetStep * (1.1 + Math.random() * 0.3);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        carpetColors[Math.floor(Math.random() * carpetColors.length)],
      );
      m.position.set(gx + (Math.random() - 0.5) * 0.03, 0.005, gz + (Math.random() - 0.5) * 0.03);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI;
      g.add(m);
    }
  }

  // 3-tier height hierarchy: tall center, medium ring, short perimeter
  const step = 0.15;
  for (let gx = -half; gx <= half; gx += step) {
    for (let gz = -half; gz <= half; gz += step) {
      if (Math.random() > 0.90) continue;
      const sx = gx + (Math.random() - 0.5) * step * 0.5;
      const sz = gz + (Math.random() - 0.5) * step * 0.5;
      const edgeDist = Math.max(Math.abs(sx), Math.abs(sz)) / half;
      // Height tiers: center=100%, mid=70%, edge=45%
      const tierScale = edgeDist < 0.35 ? 1.0 : edgeDist < 0.7 ? 0.70 : 0.45;
      const h = (1.3 + Math.random() * 0.5) * tierScale;
      const stemR = 0.025 + Math.random() * 0.008;
      const sm = stemColors[Math.floor(Math.random() * stemColors.length)];
      // Triangular stem with subtle twist
      const stemGeo = new THREE.CylinderGeometry(stemR * 0.7, stemR, h, 3);
      const stemPos = stemGeo.attributes.position;
      for (let vi = 0; vi < stemPos.count; vi++) {
        const vy = stemPos.getY(vi);
        const t = (vy + h / 2) / h;
        const twist = t * 0.3;
        const vx = stemPos.getX(vi);
        const vz = stemPos.getZ(vi);
        stemPos.setX(vi, vx * Math.cos(twist) - vz * Math.sin(twist));
        stemPos.setZ(vi, vx * Math.sin(twist) + vz * Math.cos(twist));
      }
      stemGeo.computeVertexNormals();
      const stem = new THREE.Mesh(stemGeo, sm);
      stem.position.set(sx, h / 2, sz);
      stem.rotation.z = (Math.random() - 0.5) * 0.06;
      stem.rotation.x = (Math.random() - 0.5) * 0.06;
      g.add(stem);

      // Papyrus-like drooping umbel crown — long arcing spokes
      const um = umbColors[Math.floor(Math.random() * umbColors.length)];
      const spokeCount = 5 + Math.floor(Math.random() * 3);
      const spokeLen = h * (0.25 + Math.random() * 0.08);
      for (let j = 0; j < spokeCount; j++) {
        const ba = j * Math.PI * 2 / spokeCount + Math.random() * 0.3;
        // Arc outward then droop
        const spoke = new THREE.Mesh(grassBlade(spokeLen, 0.018, spokeLen * 0.15), um);
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
  const stemMat = mat(0x5a3a1a);
  const clusters: [number, number, number, number][] = [
    [0, 0, 0.45, 0.32],
    [-0.2, 0.1, 0.4, 0.25],
    [0.22, 0.05, 0.38, 0.24],
    [0.05, -0.18, 0.42, 0.26],
    [-0.1, 0.2, 0.35, 0.22],
    [0.15, -0.1, 0.5, 0.28],
  ];
  for (let i = 0; i < clusters.length; i++) {
    const [cx, cz, cy, cr] = clusters[i];
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, cy, 4), stemMat);
    stem.position.set(cx * 0.3, cy / 2, cz * 0.3);
    const lean = 0.2;
    stem.rotation.z = cx * lean;
    stem.rotation.x = cz * lean;
    g.add(stem);
    addCanopy(g, cx, cy, cz, cr, 0x2a5a2a + (i % 3) * 0x020200);
  }
  return g;
}

function buildDeciduousShrub(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a6a5a);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + Math.random() * 0.2;
    const h = 0.8 + Math.random() * 0.4;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(a) * 0.2, h * 0.5, Math.sin(a) * 0.2),
      new THREE.Vector3(Math.cos(a) * 0.5, h * 0.8, Math.sin(a) * 0.5),
      new THREE.Vector3(Math.cos(a) * 0.6, h * 0.7, Math.sin(a) * 0.6),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.02, 4, false), stemMat));
    const tip = curve.getPoint(0.85);
    addCanopy(g, tip.x, tip.y, tip.z, 0.2, 0x4a7a3a);
    const mid = curve.getPoint(0.6);
    addCanopy(g, mid.x, mid.y + 0.05, mid.z, 0.12, 0x4a7a3a);
  }
  return g;
}

function buildMediterranean(): THREE.Group {
  const g = new THREE.Group();
  addCanopy(g, 0, 0.35, 0, 0.3, 0x4a6a4a);
  addCanopy(g, 0.1, 0.55, 0.05, 0.25, 0x4a6a4a);
  addCanopy(g, -0.08, 0.5, -0.06, 0.22, 0x486848);
  addCanopy(g, 0.05, 0.7, -0.04, 0.2, 0x4a6a4a);
  addCanopy(g, -0.05, 0.25, 0.1, 0.22, 0x486848);
  addCanopy(g, 0, 0.15, -0.05, 0.25, 0x4a6a4a);
  const stemMat = mat(0x6a5a4a);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.018, 0.2, 4), stemMat);
    stem.position.set(Math.cos(a) * 0.12, 0.08, Math.sin(a) * 0.12);
    stem.rotation.z = Math.cos(a) * 0.2;
    stem.rotation.x = Math.sin(a) * 0.2;
    g.add(stem);
  }
  return g;
}

function buildThorny(): THREE.Group {
  const g = new THREE.Group();
  const spineMat = mat(0x3a5a2a);
  const flowerMat = mat(0xddbb22);
  const woodMat = mat(0x6a4a2a);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    const h = 0.6 + Math.random() * 0.2;
    const lean = 0.35 + Math.random() * 0.2;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, h, 4), woodMat);
    branch.position.set(Math.cos(a) * 0.06, h / 2, Math.sin(a) * 0.06);
    branch.rotation.z = Math.cos(a) * lean;
    branch.rotation.x = Math.sin(a) * lean;
    g.add(branch);
  }
  const clumps: [number, number, number, number][] = [
    [0, 0.5, 0, 0.25], [-0.2, 0.55, 0.15, 0.2], [0.2, 0.5, -0.1, 0.2],
    [0, 0.7, 0.1, 0.18], [0.15, 0.65, 0.15, 0.17], [-0.15, 0.6, -0.15, 0.18],
    [0.05, 0.4, -0.2, 0.2], [-0.1, 0.45, 0.2, 0.17],
  ];
  for (const [cx, cy, cz, cr] of clumps) {
    addCanopy(g, cx, cy, cz, cr, 0x3a5a2a);
  }
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * Math.PI * 2;
    const elev = Math.random() * 0.8;
    const r = 0.3 + Math.random() * 0.15;
    const sx = Math.cos(a) * r;
    const sy = 0.35 + elev * 0.5;
    const sz = Math.sin(a) * r;
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.1, 3), spineMat);
    spine.position.set(sx, sy, sz);
    spine.lookAt(sx * 2.5, sy * 1.2, sz * 2.5);
    g.add(spine);
  }
  for (let i = 0; i < 15; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.2 + Math.random() * 0.2;
    const fy = 0.45 + Math.random() * 0.35;
    const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), flowerMat);
    flower.position.set(Math.cos(a) * r, fy, Math.sin(a) * r);
    g.add(flower);
  }
  return g;
}

function buildDesertShrub(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a6a5a);
  const leafMat = mat(0x5a6a3a);
  const mainStems = [
    { a: 0.0, lean: 0.35, h: 0.65 },
    { a: 1.1, lean: 0.4, h: 0.55 },
    { a: 2.3, lean: 0.3, h: 0.7 },
    { a: 3.5, lean: 0.45, h: 0.5 },
    { a: 4.7, lean: 0.35, h: 0.6 },
    { a: 5.6, lean: 0.25, h: 0.55 },
  ];
  for (const s of mainStems) {
    const baseR = 0.03 + Math.random() * 0.03;
    const midR = baseR + s.lean * s.h * 0.35;
    const tipR = midR + s.lean * s.h * 0.25;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(s.a) * baseR, 0, Math.sin(s.a) * baseR),
      new THREE.Vector3(Math.cos(s.a) * midR, s.h * 0.5, Math.sin(s.a) * midR),
      new THREE.Vector3(Math.cos(s.a) * tipR, s.h * 0.85, Math.sin(s.a) * tipR),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.015, 4, false), stemMat));
    const forkCount = 2 + Math.floor(Math.random() * 2);
    for (let f = 0; f < forkCount; f++) {
      const forkA = s.a + (f - forkCount / 2) * 0.5;
      const forkLen = 0.15 + Math.random() * 0.12;
      const forkBase = new THREE.Vector3(Math.cos(s.a) * tipR, s.h * 0.85, Math.sin(s.a) * tipR);
      const forkTip = new THREE.Vector3(
        Math.cos(forkA) * (tipR + forkLen * 0.7),
        s.h * 0.85 + forkLen * 0.5,
        Math.sin(forkA) * (tipR + forkLen * 0.7),
      );
      const fCurve = new THREE.CatmullRomCurve3([forkBase, forkTip]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(fCurve, 4, 0.008, 3, false), stemMat));
      const lf = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(0.06 + Math.random() * 0.03, 0), 0.01), leafMat);
      lf.position.copy(forkTip);
      g.add(lf);
    }
  }
  return g;
}

function buildMangrove(): THREE.Group {
  const g = new THREE.Group();
  // Skip water surface (gallery-only)
  addTrunk(g, 0, 0.35, 0, 0.06, 0.05, 0.25, 0x6a3525);
  const rootMat = mat(0x6a3525);
  const roots = [
    { a: 0.2, spread: 0.55, thick: 0.028, startY: 0.48 },
    { a: 1.15, spread: 0.42, thick: 0.02, startY: 0.4 },
    { a: 1.9, spread: 0.6, thick: 0.025, startY: 0.45 },
    { a: 2.85, spread: 0.38, thick: 0.018, startY: 0.42 },
    { a: 3.4, spread: 0.52, thick: 0.027, startY: 0.47 },
    { a: 4.6, spread: 0.48, thick: 0.022, startY: 0.38 },
    { a: 5.5, spread: 0.44, thick: 0.024, startY: 0.44 },
  ];
  for (let i = 0; i < roots.length; i++) {
    const rt = roots[i];
    const a = rt.a;
    const sp = rt.spread;
    const midOff = (Math.random() - 0.5) * 0.15;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, rt.startY, 0),
      new THREE.Vector3(Math.cos(a + midOff) * sp * 0.4, 0.22 + Math.random() * 0.08, Math.sin(a + midOff) * sp * 0.4),
      new THREE.Vector3(Math.cos(a) * sp * 0.8, 0.02 + Math.random() * 0.05, Math.sin(a) * sp * 0.8),
      new THREE.Vector3(Math.cos(a) * sp, -0.06 - Math.random() * 0.05, Math.sin(a) * sp),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, rt.thick, 5, false), rootMat));
    if (i % 3 === 0) {
      const dropA = a + (Math.random() - 0.5) * 0.5;
      const dropR = sp * (0.35 + Math.random() * 0.2);
      const dropCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * sp * 0.45, 0.18, Math.sin(a) * sp * 0.45),
        new THREE.Vector3(Math.cos(dropA) * dropR, -0.02, Math.sin(dropA) * dropR),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(dropCurve, 5, 0.013, 4, false), rootMat));
    }
  }
  addCanopy(g, 0, 0.7, 0, 0.35, 0x2a5a2a);
  addCanopy(g, 0.2, 0.65, 0.15, 0.25, 0x2d5a25);
  addCanopy(g, -0.2, 0.68, -0.1, 0.25, 0x2a5a2a);
  addCanopy(g, -0.1, 0.63, 0.22, 0.2, 0x2d5a25);
  addCanopy(g, 0.15, 0.7, -0.2, 0.22, 0x2a5a2a);
  return g;
}

function buildSaguaro(): THREE.Group {
  const g = new THREE.Group();
  const cm = mat(0x5a8a4a);
  const main = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.0, 10), cm);
  main.position.set(0, 1.0, 0);
  g.add(main);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), cm);
  cap.position.set(0, 2.0, 0);
  g.add(cap);
  const arm1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.18, 0.8, 0),
    new THREE.Vector3(0.5, 0.7, 0),
    new THREE.Vector3(0.55, 1.0, 0),
    new THREE.Vector3(0.5, 1.3, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(arm1, 10, 0.08, 8, false), cm));
  const arm1Cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), cm);
  arm1Cap.position.set(0.5, 1.3, 0);
  g.add(arm1Cap);
  const arm2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 1.0, 0),
    new THREE.Vector3(-0.45, 0.95, 0),
    new THREE.Vector3(-0.48, 1.2, 0),
    new THREE.Vector3(-0.42, 1.55, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(arm2, 10, 0.07, 8, false), cm));
  const arm2Cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), cm);
  arm2Cap.position.set(-0.42, 1.55, 0);
  g.add(arm2Cap);
  return g;
}

function buildAloe(): THREE.Group {
  const g = new THREE.Group();
  const rings = [
    { count: 7, offset: 0, lean: 0.7, len: 0.55, baseR: 0.06 },
    { count: 5, offset: 0.45, lean: 0.4, len: 0.45, baseR: 0.04 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const a = i * Math.PI * 2 / ring.count + ring.offset;
      const lGeo = new THREE.PlaneGeometry(0.07, ring.len, 1, 6);
      const lPos = lGeo.attributes.position;
      for (let vi = 0; vi < lPos.count; vi++) {
        const origY = lPos.getY(vi);
        const t = (origY + ring.len / 2) / ring.len;
        lPos.setX(vi, lPos.getX(vi) * (1 - 0.7 * t));
        lPos.setY(vi, t * ring.len * 0.6 + 0.05);
        lPos.setZ(vi, t * t * ring.len * 0.5);
      }
      lGeo.computeVertexNormals();
      const leaf = new THREE.Mesh(lGeo, matDS(0x5a7a4a));
      leaf.position.set(Math.cos(a) * ring.baseR, 0, Math.sin(a) * ring.baseR);
      leaf.rotation.y = -a + Math.PI / 2;
      leaf.rotation.x = -ring.lean;
      g.add(leaf);
      const lGeo2 = lGeo.clone();
      const leaf2 = new THREE.Mesh(lGeo2, matDS(0x4a6a3a));
      leaf2.position.set(Math.cos(a) * ring.baseR, 0.015, Math.sin(a) * ring.baseR);
      leaf2.rotation.y = -a + Math.PI / 2;
      leaf2.rotation.x = -ring.lean;
      g.add(leaf2);
    }
  }
  return g;
}

function buildCaudiciform(): THREE.Group {
  const g = new THREE.Group();
  const brMat = mat(0x9a9080);
  const branches = [
    { a: 0.4, h: 0.4 },
    { a: 1.8, h: 0.35 },
    { a: 3.2, h: 0.45 },
    { a: 4.8, h: 0.38 },
  ];
  for (const b of branches) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(b.a) * 0.06, b.h * 0.4, Math.sin(b.a) * 0.06),
      new THREE.Vector3(Math.cos(b.a) * 0.18, b.h, Math.sin(b.a) * 0.18),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.03, 5, false), brMat));
    addCanopy(g, Math.cos(b.a) * 0.2, b.h + 0.02, Math.sin(b.a) * 0.2, 0.09, 0x4a7a3a);
  }
  for (let fi = 0; fi < 3; fi++) {
    const fa = branches[fi].a + 0.2;
    const fh = branches[fi].h;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), mat(0xcc4477));
    fl.position.set(Math.cos(fa) * 0.22, fh + 0.06, Math.sin(fa) * 0.22);
    g.add(fl);
  }
  return g;
}

function buildEuphorbia(): THREE.Group {
  const g = new THREE.Group();
  const em = mat(0x3a6a3a);
  addTrunk(g, 0.03, 0, -0.02, 0.1, 0.07, 0.7, 0x5a4a2a);
  const arms = [
    { a: 0.3, startY: 0.65, spread: 0.32, topY: 1.4, thick: 0.05 },
    { a: 1.5, startY: 0.55, spread: 0.28, topY: 1.15, thick: 0.045 },
    { a: 2.4, startY: 0.7, spread: 0.35, topY: 1.55, thick: 0.05 },
    { a: 3.8, startY: 0.6, spread: 0.25, topY: 1.25, thick: 0.04 },
    { a: 5.0, startY: 0.5, spread: 0.3, topY: 1.0, thick: 0.042 },
    { a: 5.8, startY: 0.68, spread: 0.22, topY: 1.35, thick: 0.038 },
  ];
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.03, arm.startY, -0.02),
      new THREE.Vector3(cx * arm.spread * 0.8, arm.startY - 0.1, cz * arm.spread * 0.8),
      new THREE.Vector3(cx * arm.spread, arm.topY, cz * arm.spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, arm.thick, 6, false), em));
    const armTop = curve.getPoint(1);
    const armCap = new THREE.Mesh(new THREE.SphereGeometry(arm.thick, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), em);
    armCap.position.copy(armTop);
    g.add(armCap);
    if (i % 2 === 0) {
      const forkA = arm.a + (Math.random() - 0.5) * 0.8;
      const forkCurve = new THREE.CatmullRomCurve3([
        armTop,
        new THREE.Vector3(Math.cos(forkA) * (arm.spread + 0.12), arm.topY + 0.25, Math.sin(forkA) * (arm.spread + 0.12)),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 5, arm.thick * 0.7, 5, false), em));
      const fTip = forkCurve.getPoint(1);
      const fCap = new THREE.Mesh(new THREE.SphereGeometry(arm.thick * 0.7, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), em);
      fCap.position.copy(fTip);
      g.add(fCap);
    }
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.8, 6), em);
  top.position.set(0.03, 1.1, -0.02);
  g.add(top);
  const centerCap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), em);
  centerCap.position.set(0.03, 1.5, -0.02);
  g.add(centerCap);
  return g;
}

function buildIcePlant(): THREE.Group {
  const g = new THREE.Group();
  const leafMat = mat(0x6a9a4a);
  const leafMat2 = mat(0x5a8a3a);
  const clumps = [
    { x: 0, z: 0, count: 12, r: 0.12, flower: true },
    { x: -0.18, z: 0.1, count: 10, r: 0.1, flower: true },
    { x: 0.16, z: -0.1, count: 9, r: 0.09, flower: false },
    { x: 0.1, z: 0.16, count: 8, r: 0.08, flower: true },
    { x: -0.12, z: -0.14, count: 7, r: 0.07, flower: false },
  ];
  for (let ci = 0; ci < clumps.length; ci++) {
    const cl = clumps[ci];
    for (let i = 0; i < cl.count; i++) {
      const a = i * Math.PI * 2 / cl.count + ci * 0.5;
      const lean = 0.4 + Math.random() * 0.3;
      const fLen = 0.06 + Math.random() * 0.03;
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.012, fLen, 3, 5),
        i % 2 === 0 ? leafMat : leafMat2,
      );
      finger.position.set(
        cl.x + Math.cos(a) * cl.r * 0.3,
        fLen * 0.4,
        cl.z + Math.sin(a) * cl.r * 0.3,
      );
      finger.rotation.z = -Math.cos(a) * lean;
      finger.rotation.x = -Math.sin(a) * lean;
      g.add(finger);
    }
    if (cl.flower) {
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.015, 5, 3), mat(0xdd8822));
      center.position.set(cl.x, 0.1, cl.z);
      g.add(center);
      const petalMat = matDS(0xeedd33);
      for (let pi = 0; pi < 10; pi++) {
        const pa = pi * Math.PI * 2 / 10;
        const petal = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.035), petalMat);
        petal.position.set(
          cl.x + Math.cos(pa) * 0.025,
          0.1,
          cl.z + Math.sin(pa) * 0.025,
        );
        petal.rotation.y = -pa;
        petal.rotation.x = -0.4;
        g.add(petal);
      }
    }
  }
  return g;
}

function buildEpiphytic(): THREE.Group {
  const g = new THREE.Group();
  const segMat = mat(0x2a6a3a);
  const base = new THREE.Mesh(jitter(new THREE.SphereGeometry(0.08, 5, 4), 0.01), mat(0x3a5a2a));
  base.position.y = 0.06;
  base.scale.y = 0.6;
  g.add(base);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + (Math.random() - 0.5) * 0.3;
    const spread = 0.25 + Math.random() * 0.15;
    const droop = 0.1 + Math.random() * 0.1;
    const segCount = 4 + Math.floor(Math.random() * 3);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(Math.cos(a) * spread * 0.4, 0.12, Math.sin(a) * spread * 0.4),
      new THREE.Vector3(Math.cos(a) * spread * 0.7, 0.06, Math.sin(a) * spread * 0.7),
      new THREE.Vector3(Math.cos(a) * spread, -droop, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.008, 3, false), segMat));
    for (let s = 0; s < segCount; s++) {
      const t = (s + 0.5) / segCount;
      const pt = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const geo = new THREE.PlaneGeometry(0.06, 0.035);
      jitter(geo, 0.003);
      const seg = new THREE.Mesh(geo, matDS(s % 2 === 0 ? 0x2a6a3a : 0x2a7a3a));
      seg.position.copy(pt);
      seg.rotation.y = Math.atan2(tangent.x, tangent.z);
      seg.rotation.x = Math.PI / 2 + Math.asin(Math.max(-1, Math.min(1, tangent.y)));
      g.add(seg);
    }
    if (i % 3 === 0) {
      const tip = curve.getPoint(1);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 3), mat(0xcc4466));
      flower.position.copy(tip);
      g.add(flower);
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
