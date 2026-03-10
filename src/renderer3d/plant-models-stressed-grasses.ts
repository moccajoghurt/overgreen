import * as THREE from 'three';
import { mat, matDS } from './plant-models';

// ── Stressed grass variants: reduced density, yellow-olive palette, more droop ──
// Slots: Bunchgrass(2), PampasGrass(30)

// ── Hi-LOD stressed builders ──

function buildBunchgrassStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed: ~30% fewer blades, more droop, yellow-olive palette, some dead tips
  const bladeColors = [matDS(0x99aa44), matDS(0x88993a), matDS(0xa0a840), matDS(0x7a8a30)];
  const deadColors = [matDS(0xaa9955), matDS(0x998844)];
  const bc = () => bladeColors[Math.floor(Math.random() * bladeColors.length)];
  const dc = () => deadColors[Math.floor(Math.random() * deadColors.length)];

  const crownR = 0.03;
  const rings = [
    { count: 14, hMin: 0.42, hVar: 0.10, sweep: 0.06, sweepVar: 0.04 }, // inner — droopier
    { count: 16, hMin: 0.30, hVar: 0.08, sweep: 0.15, sweepVar: 0.06 }, // mid
    { count: 16, hMin: 0.20, hVar: 0.06, sweep: 0.25, sweepVar: 0.08 }, // outer — sagging
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const bx = Math.cos(angle) * crownR * (0.3 + Math.random() * 0.7);
      const bz = Math.sin(angle) * crownR * (0.3 + Math.random() * 0.7);

      const h = ring.hMin + Math.random() * ring.hVar;
      const w = 0.04 + Math.random() * 0.02;
      const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 5);

      const pos = bladeGeo.attributes.position;
      const sweep = ring.sweep + Math.random() * ring.sweepVar;
      for (let vi = 0; vi < pos.count; vi++) {
        const vy = pos.getY(vi);
        const t = (vy + h / 2) / h;
        // More droop than thriving
        pos.setZ(vi, sweep * t * t);
        if (t > 0.4) {
          const sx = pos.getX(vi);
          pos.setX(vi, sx * (1.0 - (t - 0.4) * 0.8));
        }
      }
      bladeGeo.computeVertexNormals();

      // Some blades are dead/brown
      const isDead = Math.random() < 0.2;
      const blade = new THREE.Mesh(bladeGeo, isDead ? dc() : bc());
      blade.position.set(bx, 0, bz);
      blade.rotation.y = angle + (Math.random() - 0.5) * 0.3;
      g.add(blade);
    }
  }

  const coreGeo = new THREE.SphereGeometry(0.04, 4, 3);
  coreGeo.scale(1, 0.3, 1);
  const core = new THREE.Mesh(coreGeo, mat(0x6a7a30));
  core.position.y = 0.01;
  g.add(core);

  return g;
}

function buildPampasGrassStressed(): THREE.Group {
  const g = new THREE.Group();

  // Stressed leaf palette — yellow-olive
  const leafColors = [matDS(0x8a9a44), matDS(0x7a8a38), matDS(0x99aa4a), matDS(0x6a7a30)];
  const lc = () => leafColors[Math.floor(Math.random() * leafColors.length)];

  // Stressed plume — duller, slightly browner
  const plumeMats = [0xd8d0c0, 0xddd5c5, 0xccc4b4, 0xd0c8b8].map(c =>
    new THREE.MeshStandardMaterial({
      color: c, roughness: 0.9, flatShading: true,
      emissive: c, emissiveIntensity: 0.08,
    }),
  );
  const pm = () => plumeMats[Math.floor(Math.random() * plumeMats.length)];

  // Fewer leaves (~40), more droop
  const leafCount = 40;
  const crownR = 0.06;
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = Math.random() * crownR;
    const bx = Math.cos(angle) * dist;
    const bz = Math.sin(angle) * dist;

    const h = 0.38 + Math.random() * 0.28;
    const w = 0.035 + Math.random() * 0.018;
    const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 5);

    const pos = bladeGeo.attributes.position;
    const sweep = 0.25 + Math.random() * 0.2; // more droop than thriving
    for (let vi = 0; vi < pos.count; vi++) {
      const vy = pos.getY(vi);
      const t = (vy + h / 2) / h;
      pos.setZ(vi, sweep * t * t - sweep * 0.15 * t * t * t);
      if (t > 0.5) {
        const sx = pos.getX(vi);
        pos.setX(vi, sx * (1.0 - (t - 0.5) * 0.9));
      }
    }
    bladeGeo.computeVertexNormals();

    const blade = new THREE.Mesh(bladeGeo, lc());
    blade.position.set(bx, 0, bz);
    blade.rotation.y = angle + (Math.random() - 0.5) * 0.3;
    g.add(blade);
  }

  // Fewer plumes (4), shorter stalks, smaller plumes
  const plumeCount = 4;
  for (let i = 0; i < plumeCount; i++) {
    const angle = (i / plumeCount) * Math.PI * 2 + Math.random() * 0.5;
    const dist = Math.random() * 0.04;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    const stalkH = 0.75 + Math.random() * 0.2;
    const stalkGeo = new THREE.CylinderGeometry(0.003, 0.006, stalkH, 3, 4);
    const spos = stalkGeo.attributes.position;
    const archAmt = 0.06 + Math.random() * 0.07; // more lean
    for (let vi = 0; vi < spos.count; vi++) {
      const sy = spos.getY(vi);
      const t = (sy + stalkH / 2) / stalkH;
      spos.setZ(vi, spos.getZ(vi) + archAmt * t * t);
    }
    stalkGeo.computeVertexNormals();
    const stalk = new THREE.Mesh(stalkGeo, mat(0x7a8a3a));
    stalk.position.set(px, stalkH / 2, pz);
    stalk.rotation.y = angle;
    g.add(stalk);

    // Smaller, less fluffy plumes
    const plumeH = 0.4 + Math.random() * 0.1;
    const plumeBaseY = stalkH * 0.85;
    const plumeR = 0.04 + Math.random() * 0.01;

    const coneGeo = new THREE.ConeGeometry(plumeR, plumeH, 6, 3);
    const cp = coneGeo.attributes.position;
    for (let vi = 0; vi < cp.count; vi++) {
      const cy = cp.getY(vi);
      const t = (cy + plumeH / 2) / plumeH;
      const bulge = t < 0.4 ? (0.5 + t * 0.8) : Math.max(0.05, 0.8 - (t - 0.4) * 1.2);
      const fuzz = 1.0 + (Math.random() - 0.5) * 0.3;
      cp.setX(vi, cp.getX(vi) * bulge * fuzz);
      cp.setZ(vi, cp.getZ(vi) * bulge * fuzz);
    }
    coneGeo.computeVertexNormals();
    const cone = new THREE.Mesh(coneGeo, pm());
    cone.position.set(px, plumeBaseY + plumeH * 0.4, pz);
    cone.rotation.y = angle;
    g.add(cone);

    // Fewer halo spheres
    for (let s = 0; s < 2; s++) {
      const sa = (s / 2) * Math.PI * 2 + Math.random() * 0.8;
      const sr = plumeR * (0.3 + Math.random() * 0.2);
      const sy = plumeBaseY + plumeH * (0.2 + Math.random() * 0.3);
      const haloGeo = new THREE.SphereGeometry(sr, 4, 3);
      haloGeo.scale(1, 1.3, 1);
      const hp = haloGeo.attributes.position;
      for (let vi = 0; vi < hp.count; vi++) {
        hp.setX(vi, hp.getX(vi) * (1 + (Math.random() - 0.5) * 0.3));
        hp.setZ(vi, hp.getZ(vi) * (1 + (Math.random() - 0.5) * 0.3));
      }
      haloGeo.computeVertexNormals();
      const halo = new THREE.Mesh(haloGeo, pm());
      halo.position.set(px + Math.cos(sa) * plumeR * 0.5, sy, pz + Math.sin(sa) * plumeR * 0.5);
      g.add(halo);
    }
  }

  return g;
}

// ── Low-LOD stressed builders ──

function buildBunchgrassStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [matDS(0x99aa44), matDS(0x88993a), matDS(0xa0a840)];
  const bc = () => bladeColors[Math.floor(Math.random() * bladeColors.length)];

  const crownR = 0.03;
  // Simplified: 2 rings, fewer blades
  const rings = [
    { count: 8, hMin: 0.40, hVar: 0.08, sweep: 0.06, sweepVar: 0.03 },
    { count: 10, hMin: 0.25, hVar: 0.06, sweep: 0.20, sweepVar: 0.06 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const bx = Math.cos(angle) * crownR * Math.random();
      const bz = Math.sin(angle) * crownR * Math.random();
      const h = ring.hMin + Math.random() * ring.hVar;
      const w = 0.05 + Math.random() * 0.025;
      const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 3);
      const pos = bladeGeo.attributes.position;
      const sweep = ring.sweep + Math.random() * ring.sweepVar;
      for (let vi = 0; vi < pos.count; vi++) {
        const vy = pos.getY(vi);
        const t = (vy + h / 2) / h;
        pos.setZ(vi, sweep * t * t);
        if (t > 0.5) pos.setX(vi, pos.getX(vi) * (1 - (t - 0.5) * 0.7));
      }
      bladeGeo.computeVertexNormals();
      g.add(new THREE.Mesh(bladeGeo, bc()));
      g.children[g.children.length - 1].position.set(bx, 0, bz);
      (g.children[g.children.length - 1] as THREE.Mesh).rotation.y = angle;
    }
  }
  return g;
}

function buildPampasGrassStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const leafColors = [matDS(0x8a9a44), matDS(0x7a8a38), matDS(0x99aa4a)];
  const lc = () => leafColors[Math.floor(Math.random() * leafColors.length)];
  const plumeMat = new THREE.MeshStandardMaterial({
    color: 0xd8d0c0, roughness: 0.9, flatShading: true,
    emissive: 0xd8d0c0, emissiveIntensity: 0.08,
  });

  // Sparse leaves
  const crownR = 0.05;
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const h = 0.35 + Math.random() * 0.2;
    const w = 0.04 + Math.random() * 0.02;
    const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 3);
    const pos = bladeGeo.attributes.position;
    const sweep = 0.25 + Math.random() * 0.15;
    for (let vi = 0; vi < pos.count; vi++) {
      const vy = pos.getY(vi);
      const t = (vy + h / 2) / h;
      pos.setZ(vi, sweep * t * t);
      if (t > 0.5) pos.setX(vi, pos.getX(vi) * (1 - (t - 0.5) * 0.8));
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, lc());
    blade.position.set(Math.cos(angle) * crownR * Math.random(), 0, Math.sin(angle) * crownR * Math.random());
    blade.rotation.y = angle;
    g.add(blade);
  }

  // 3 simple plume cones
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
    const stalkH = 0.7 + Math.random() * 0.15;
    const stalkGeo = new THREE.CylinderGeometry(0.003, 0.006, stalkH, 3);
    const stalk = new THREE.Mesh(stalkGeo, mat(0x7a8a3a));
    stalk.position.set(0, stalkH / 2, 0);
    stalk.rotation.y = angle;
    g.add(stalk);

    const plumeH = 0.35;
    const coneGeo = new THREE.ConeGeometry(0.04, plumeH, 5, 2);
    const cone = new THREE.Mesh(coneGeo, plumeMat);
    cone.position.set(0, stalkH * 0.85 + plumeH * 0.4, 0);
    g.add(cone);
  }
  return g;
}

function buildDesertGrassStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed: yellower, sparser, more droop
  const bladeColors = [matDS(0x99953a), matDS(0x8a8a35), matDS(0xa09540), matDS(0x7a7a30)];
  const deadColors = [matDS(0xaa9555), matDS(0x998a48)];
  const bc = () => bladeColors[Math.floor(Math.random() * bladeColors.length)];
  const dc = () => deadColors[Math.floor(Math.random() * deadColors.length)];

  const crownR = 0.025;
  const rings = [
    { count: 12, hMin: 0.35, hVar: 0.10, sweep: 0.05, sweepVar: 0.04 },
    { count: 14, hMin: 0.22, hVar: 0.08, sweep: 0.12, sweepVar: 0.05 },
    { count: 12, hMin: 0.15, hVar: 0.06, sweep: 0.20, sweepVar: 0.06 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const bx = Math.cos(angle) * crownR * (0.3 + Math.random() * 0.7);
      const bz = Math.sin(angle) * crownR * (0.3 + Math.random() * 0.7);
      const h = ring.hMin + Math.random() * ring.hVar;
      const w = 0.025 + Math.random() * 0.015;
      const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 5);
      const pos = bladeGeo.attributes.position;
      const sweep = ring.sweep + Math.random() * ring.sweepVar;
      for (let vi = 0; vi < pos.count; vi++) {
        const vy = pos.getY(vi);
        const t = (vy + h / 2) / h;
        pos.setZ(vi, sweep * t * t);
        if (t > 0.4) pos.setX(vi, pos.getX(vi) * (1.0 - (t - 0.4) * 0.9));
      }
      bladeGeo.computeVertexNormals();
      const isDead = Math.random() < 0.25;
      const blade = new THREE.Mesh(bladeGeo, isDead ? dc() : bc());
      blade.position.set(bx, 0, bz);
      blade.rotation.y = angle + (Math.random() - 0.5) * 0.3;
      g.add(blade);
    }
  }

  const coreGeo = new THREE.SphereGeometry(0.035, 4, 3);
  coreGeo.scale(1, 0.3, 1);
  const core = new THREE.Mesh(coreGeo, mat(0x6a6a28));
  core.position.y = 0.01;
  g.add(core);

  return g;
}

function buildDesertGrassStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [matDS(0x99953a), matDS(0x8a8a35), matDS(0xa09540)];
  const bc = () => bladeColors[Math.floor(Math.random() * bladeColors.length)];

  const crownR = 0.025;
  const rings = [
    { count: 6, hMin: 0.33, hVar: 0.08, sweep: 0.05, sweepVar: 0.03 },
    { count: 7, hMin: 0.20, hVar: 0.06, sweep: 0.15, sweepVar: 0.05 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const bx = Math.cos(angle) * crownR * Math.random();
      const bz = Math.sin(angle) * crownR * Math.random();
      const h = ring.hMin + Math.random() * ring.hVar;
      const w = 0.035 + Math.random() * 0.02;
      const bladeGeo = new THREE.PlaneGeometry(w, h, 1, 3);
      const pos = bladeGeo.attributes.position;
      const sweep = ring.sweep + Math.random() * ring.sweepVar;
      for (let vi = 0; vi < pos.count; vi++) {
        const vy = pos.getY(vi);
        const t = (vy + h / 2) / h;
        pos.setZ(vi, sweep * t * t);
        if (t > 0.4) pos.setX(vi, pos.getX(vi) * (1 - (t - 0.4) * 0.8));
      }
      bladeGeo.computeVertexNormals();
      const blade = new THREE.Mesh(bladeGeo, bc());
      blade.position.set(bx, 0, bz);
      blade.rotation.y = angle;
      g.add(blade);
    }
  }
  return g;
}

export const STRESSED_GRASSES: Record<number, () => THREE.Group> = {
  2: buildBunchgrassStressed,
  30: buildPampasGrassStressed,
  31: buildDesertGrassStressed,
};

export const STRESSED_GRASSES_LOW: Record<number, () => THREE.Group> = {
  2: buildBunchgrassStressedLow,
  30: buildPampasGrassStressedLow,
  31: buildDesertGrassStressedLow,
};
