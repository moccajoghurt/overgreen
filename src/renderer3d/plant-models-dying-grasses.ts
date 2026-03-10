import * as THREE from 'three';
import { mat, matDS } from './plant-models';

// ── Dying grass variants: sparse, brown/grey, collapsed blades ──
// Slots: Bunchgrass(2), PampasGrass(30)

// ── Hi-LOD dying builders ──

function buildBunchgrassDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying: ~60% fewer blades, brown/grey, collapsed outward, sparse gaps
  const bladeColors = [matDS(0x8a7a55), matDS(0x7a6a45), matDS(0x6a5a3a), matDS(0x9a8a60)];
  const bc = () => bladeColors[Math.floor(Math.random() * bladeColors.length)];

  const crownR = 0.03;
  // Only 2 sparse rings
  const rings = [
    { count: 8, hMin: 0.30, hVar: 0.10, sweep: 0.12, sweepVar: 0.08 },  // inner — fewer, shorter
    { count: 10, hMin: 0.18, hVar: 0.06, sweep: 0.30, sweepVar: 0.10 }, // outer — collapsed flat
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const bx = Math.cos(angle) * crownR * (0.3 + Math.random() * 0.7);
      const bz = Math.sin(angle) * crownR * (0.3 + Math.random() * 0.7);

      const h = ring.hMin + Math.random() * ring.hVar;
      const w = 0.035 + Math.random() * 0.02;
      const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 4);

      const pos = bladeGeo.attributes.position;
      const sweep = ring.sweep + Math.random() * ring.sweepVar;
      for (let vi = 0; vi < pos.count; vi++) {
        const vy = pos.getY(vi);
        const t = (vy + h / 2) / h;
        // Heavy droop — blades sag outward and down
        pos.setZ(vi, sweep * t * t);
        if (t > 0.3) {
          const sx = pos.getX(vi);
          pos.setX(vi, sx * (1.0 - (t - 0.3) * 0.7));
        }
      }
      bladeGeo.computeVertexNormals();

      const blade = new THREE.Mesh(bladeGeo, bc());
      blade.position.set(bx, 0, bz);
      blade.rotation.y = angle + (Math.random() - 0.5) * 0.4;
      g.add(blade);
    }
  }

  // Exposed brown crown
  const coreGeo = new THREE.SphereGeometry(0.05, 4, 3);
  coreGeo.scale(1, 0.3, 1);
  const core = new THREE.Mesh(coreGeo, mat(0x5a4a30));
  core.position.y = 0.01;
  g.add(core);

  return g;
}

function buildPampasGrassDying(): THREE.Group {
  const g = new THREE.Group();

  // Dying leaf palette — brown/grey
  const leafColors = [matDS(0x7a6a45), matDS(0x6a5a3a), matDS(0x8a7a50), matDS(0x5a4a30)];
  const lc = () => leafColors[Math.floor(Math.random() * leafColors.length)];

  // Dying plume — grey-brown, tattered
  const plumeMats = [0xb0a898, 0xa89888, 0xc0b8a8, 0xb8a898].map(c =>
    new THREE.MeshStandardMaterial({
      color: c, roughness: 0.95, flatShading: true,
      emissive: c, emissiveIntensity: 0.05,
    }),
  );
  const pm = () => plumeMats[Math.floor(Math.random() * plumeMats.length)];

  // Sparse drooping leaves (~25) — droop nearly to ground
  const leafCount = 25;
  const crownR = 0.06;
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = Math.random() * crownR;
    const bx = Math.cos(angle) * dist;
    const bz = Math.sin(angle) * dist;

    const h = 0.28 + Math.random() * 0.2;
    const w = 0.03 + Math.random() * 0.015;
    const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 5);

    const pos = bladeGeo.attributes.position;
    const sweep = 0.40 + Math.random() * 0.25; // extreme droop — nearly horizontal
    for (let vi = 0; vi < pos.count; vi++) {
      const vy = pos.getY(vi);
      const t = (vy + h / 2) / h;
      // Cubic curve pushes tips nearly flat to ground
      pos.setZ(vi, sweep * t * t * t + sweep * 0.2 * t * t);
      // Narrow tips more aggressively
      if (t > 0.3) {
        pos.setX(vi, pos.getX(vi) * (1.0 - (t - 0.3) * 1.1));
      }
      // Push upper verts downward so blades sag below horizontal
      if (t > 0.5) {
        pos.setY(vi, pos.getY(vi) - (t - 0.5) * h * 0.25);
      }
    }
    bladeGeo.computeVertexNormals();

    const blade = new THREE.Mesh(bladeGeo, lc());
    blade.position.set(bx, 0, bz);
    blade.rotation.y = angle + (Math.random() - 0.5) * 0.3;
    g.add(blade);
  }

  // Only 2-3 plumes, broken/bent stalks, tattered remnant plumes
  const plumeCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < plumeCount; i++) {
    const angle = (i / plumeCount) * Math.PI * 2 + Math.random() * 0.6;
    const px = Math.cos(angle) * 0.03;
    const pz = Math.sin(angle) * 0.03;

    // Bent/kinked stalk — leans 25-40 degrees off vertical
    const stalkH = 0.50 + Math.random() * 0.12;
    const stalkGeo = new THREE.CylinderGeometry(0.003, 0.006, stalkH, 3, 6);
    const spos = stalkGeo.attributes.position;
    const leanAmt = 0.18 + Math.random() * 0.12; // strong lean
    const kinkAt = 0.4 + Math.random() * 0.2; // kink point along stalk
    for (let vi = 0; vi < spos.count; vi++) {
      const sy = spos.getY(vi);
      const t = (sy + stalkH / 2) / stalkH;
      // Smooth lean with a kink
      const bend = t < kinkAt
        ? leanAmt * 0.3 * t / kinkAt
        : leanAmt * 0.3 + leanAmt * 0.7 * ((t - kinkAt) / (1 - kinkAt));
      spos.setZ(vi, spos.getZ(vi) + bend);
      // Slight sideways wobble
      spos.setX(vi, spos.getX(vi) + leanAmt * 0.15 * Math.sin(t * 3.0));
    }
    stalkGeo.computeVertexNormals();
    const stalk = new THREE.Mesh(stalkGeo, mat(0x6a5a30));
    stalk.position.set(px, stalkH / 2, pz);
    stalk.rotation.y = angle;
    g.add(stalk);

    // Tattered remnant plume — wider, deflated, ragged shape (not a spike)
    const plumeH = 0.15 + Math.random() * 0.06;
    const plumeBaseY = stalkH * 0.75;
    const plumeR = 0.025 + Math.random() * 0.015;

    // Main deflated cone
    const coneGeo = new THREE.ConeGeometry(plumeR, plumeH, 6, 3);
    const cp = coneGeo.attributes.position;
    for (let vi = 0; vi < cp.count; vi++) {
      const cy = cp.getY(vi);
      const t = (cy + plumeH / 2) / plumeH;
      // Deflated bulge shape — wider at base, ragged
      const bulge = t < 0.5 ? (0.7 + t * 0.6) : Math.max(0.15, 1.0 - (t - 0.5) * 1.5);
      const fuzz = 1.0 + (Math.random() - 0.5) * 0.6;
      cp.setX(vi, cp.getX(vi) * bulge * fuzz);
      cp.setZ(vi, cp.getZ(vi) * bulge * fuzz);
    }
    coneGeo.computeVertexNormals();
    const cone = new THREE.Mesh(coneGeo, pm());
    // Tilt the plume to follow stalk lean
    cone.position.set(px + leanAmt * 0.2, plumeBaseY + plumeH * 0.3, pz + leanAmt * 0.15);
    cone.rotation.z = -0.2 - Math.random() * 0.3; // tilt with the lean
    cone.rotation.y = angle;
    g.add(cone);

    // Add 2-3 wisps hanging off the plume for tattered look
    for (let w = 0; w < 2 + Math.floor(Math.random() * 2); w++) {
      const wAngle = Math.random() * Math.PI * 2;
      const wH = 0.06 + Math.random() * 0.04;
      const wGeo = new THREE.PlaneGeometry(0.012, wH, 1, 2);
      const wp = wGeo.attributes.position;
      for (let wvi = 0; wvi < wp.count; wvi++) {
        const wt = (wp.getY(wvi) + wH / 2) / wH;
        wp.setZ(wvi, 0.02 * wt * wt); // slight droop
      }
      wGeo.computeVertexNormals();
      const wisp = new THREE.Mesh(wGeo, pm());
      wisp.position.set(
        px + leanAmt * 0.2 + Math.cos(wAngle) * plumeR * 0.5,
        plumeBaseY + plumeH * (0.1 + Math.random() * 0.4),
        pz + leanAmt * 0.15 + Math.sin(wAngle) * plumeR * 0.5,
      );
      wisp.rotation.y = wAngle;
      wisp.rotation.x = 0.3 + Math.random() * 0.5; // drooping wisps
      g.add(wisp);
    }
  }

  return g;
}

// ── Low-LOD dying builders ──

function buildBunchgrassDyingLow(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [matDS(0x8a7a55), matDS(0x7a6a45), matDS(0x6a5a3a)];
  const bc = () => bladeColors[Math.floor(Math.random() * bladeColors.length)];

  const crownR = 0.03;
  // Very sparse — just 10 blades
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const h = 0.20 + Math.random() * 0.10;
    const w = 0.04 + Math.random() * 0.02;
    const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 3);
    const pos = bladeGeo.attributes.position;
    const sweep = 0.20 + Math.random() * 0.12;
    for (let vi = 0; vi < pos.count; vi++) {
      const vy = pos.getY(vi);
      const t = (vy + h / 2) / h;
      pos.setZ(vi, sweep * t * t);
      if (t > 0.4) pos.setX(vi, pos.getX(vi) * (1 - (t - 0.4) * 0.7));
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, bc());
    blade.position.set(Math.cos(angle) * crownR * Math.random(), 0, Math.sin(angle) * crownR * Math.random());
    blade.rotation.y = angle;
    g.add(blade);
  }
  return g;
}

function buildPampasGrassDyingLow(): THREE.Group {
  const g = new THREE.Group();
  const leafColors = [matDS(0x7a6a45), matDS(0x6a5a3a)];
  const lc = () => leafColors[Math.floor(Math.random() * leafColors.length)];
  const plumeMat = new THREE.MeshStandardMaterial({
    color: 0xb0a898, roughness: 0.95, flatShading: true,
    emissive: 0xb0a898, emissiveIntensity: 0.05,
  });

  // 8 sparse leaves — heavy droop, nearly flat
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const h = 0.22 + Math.random() * 0.12;
    const w = 0.04;
    const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 3);
    const pos = bladeGeo.attributes.position;
    const sweep = 0.35 + Math.random() * 0.15;
    for (let vi = 0; vi < pos.count; vi++) {
      const vy = pos.getY(vi);
      const t = (vy + h / 2) / h;
      pos.setZ(vi, sweep * t * t * t + sweep * 0.2 * t * t);
      if (t > 0.4) {
        pos.setY(vi, pos.getY(vi) - (t - 0.4) * h * 0.2);
      }
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, lc());
    blade.position.set(0, 0, 0);
    blade.rotation.y = angle;
    g.add(blade);
  }

  // 1 sad bent stalk with small tattered plume
  const stalkH = 0.40;
  const stalkGeo = new THREE.CylinderGeometry(0.003, 0.005, stalkH, 3, 4);
  const spos = stalkGeo.attributes.position;
  const lean = 0.22; // strong visible lean
  for (let vi = 0; vi < spos.count; vi++) {
    const sy = spos.getY(vi);
    const t = (sy + stalkH / 2) / stalkH;
    // Kink at 40% height for broken look
    const bend = t < 0.4 ? lean * 0.2 * t / 0.4 : lean * 0.2 + lean * 0.8 * ((t - 0.4) / 0.6);
    spos.setZ(vi, spos.getZ(vi) + bend);
  }
  stalkGeo.computeVertexNormals();
  const stalk = new THREE.Mesh(stalkGeo, mat(0x6a5a30));
  stalk.position.y = stalkH / 2;
  g.add(stalk);

  // Small deflated plume — squat ellipsoid, not a pointy cone
  const plumeGeo = new THREE.SphereGeometry(0.025, 5, 3);
  plumeGeo.scale(1.0, 1.6, 0.8); // squished ellipsoid
  const pp = plumeGeo.attributes.position;
  for (let vi = 0; vi < pp.count; vi++) {
    pp.setX(vi, pp.getX(vi) * (1 + (Math.random() - 0.5) * 0.4));
    pp.setZ(vi, pp.getZ(vi) * (1 + (Math.random() - 0.5) * 0.4));
  }
  plumeGeo.computeVertexNormals();
  const plume = new THREE.Mesh(plumeGeo, plumeMat);
  plume.position.set(lean * 0.6, stalkH * 0.72, lean * 0.4);
  plume.rotation.z = -0.35; // tilt following the lean
  g.add(plume);

  return g;
}

function buildDesertGrassDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying: brown/grey, very sparse, collapsed outward
  const bladeColors = [matDS(0x8a7a50), matDS(0x7a6a40), matDS(0x6a5a35), matDS(0x9a8a58)];
  const bc = () => bladeColors[Math.floor(Math.random() * bladeColors.length)];

  const crownR = 0.025;
  const rings = [
    { count: 7, hMin: 0.25, hVar: 0.08, sweep: 0.10, sweepVar: 0.06 },
    { count: 8, hMin: 0.14, hVar: 0.06, sweep: 0.25, sweepVar: 0.08 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const bx = Math.cos(angle) * crownR * (0.3 + Math.random() * 0.7);
      const bz = Math.sin(angle) * crownR * (0.3 + Math.random() * 0.7);
      const h = ring.hMin + Math.random() * ring.hVar;
      const w = 0.02 + Math.random() * 0.015;
      const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 4);
      const pos = bladeGeo.attributes.position;
      const sweep = ring.sweep + Math.random() * ring.sweepVar;
      for (let vi = 0; vi < pos.count; vi++) {
        const vy = pos.getY(vi);
        const t = (vy + h / 2) / h;
        pos.setZ(vi, sweep * t * t);
        if (t > 0.3) pos.setX(vi, pos.getX(vi) * (1.0 - (t - 0.3) * 0.8));
      }
      bladeGeo.computeVertexNormals();
      const blade = new THREE.Mesh(bladeGeo, bc());
      blade.position.set(bx, 0, bz);
      blade.rotation.y = angle + (Math.random() - 0.5) * 0.4;
      g.add(blade);
    }
  }

  // Exposed dry crown
  const coreGeo = new THREE.SphereGeometry(0.04, 4, 3);
  coreGeo.scale(1, 0.3, 1);
  const core = new THREE.Mesh(coreGeo, mat(0x5a5028));
  core.position.y = 0.01;
  g.add(core);

  return g;
}

function buildDesertGrassDyingLow(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [matDS(0x8a7a50), matDS(0x7a6a40), matDS(0x6a5a35)];
  const bc = () => bladeColors[Math.floor(Math.random() * bladeColors.length)];

  const crownR = 0.025;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const h = 0.16 + Math.random() * 0.08;
    const w = 0.03 + Math.random() * 0.015;
    const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 3);
    const pos = bladeGeo.attributes.position;
    const sweep = 0.18 + Math.random() * 0.10;
    for (let vi = 0; vi < pos.count; vi++) {
      const vy = pos.getY(vi);
      const t = (vy + h / 2) / h;
      pos.setZ(vi, sweep * t * t);
      if (t > 0.4) pos.setX(vi, pos.getX(vi) * (1 - (t - 0.4) * 0.7));
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, bc());
    blade.position.set(Math.cos(angle) * crownR * Math.random(), 0, Math.sin(angle) * crownR * Math.random());
    blade.rotation.y = angle;
    g.add(blade);
  }
  return g;
}

export const DYING_GRASSES: Record<number, () => THREE.Group> = {
  2: buildBunchgrassDying,
  30: buildPampasGrassDying,
  31: buildDesertGrassDying,
};

export const DYING_GRASSES_LOW: Record<number, () => THREE.Group> = {
  2: buildBunchgrassDyingLow,
  30: buildPampasGrassDyingLow,
  31: buildDesertGrassDyingLow,
};
