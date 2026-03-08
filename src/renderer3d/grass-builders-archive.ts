/**
 * ARCHIVED: Dense instanced grass builders (subtypes 0-5).
 *
 * These were replaced by the continuous shader grass field (grass-layer.ts).
 * Kept here in case we need to restore instanced grass meshes.
 *
 * To restore: copy the desired builder back into plant-models.ts,
 * re-add the subtype to the scene in renderer3d.ts, and un-skip it
 * in plants.ts updatePlants().
 *
 * Requires these imports from plant-models.ts:
 *   import { grassBlade, mat, matDS } from './plant-models';
 */

import * as THREE from 'three';

// These are typed but NOT exported — this file is purely an archive.
// The imports below would need to be uncommented if actually using these.
//
// import { grassBlade, mat, matDS } from './plant-models';

// Stub types so the file parses without imports
type MatFn = (color: number, extra?: Record<string, unknown>) => THREE.MeshStandardMaterial;
type MatDSFn = (color: number) => THREE.MeshStandardMaterial;
type GrassBladeFn = (h: number, w: number, bend: number, twist?: number) => THREE.BufferGeometry;
declare const mat: MatFn;
declare const matDS: MatDSFn;
declare const grassBlade: GrassBladeFn;

// ── Subtype 0: Turfgrass ──

function buildTurfgrass(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [
    matDS(0xccff88),
    matDS(0xaaee66),
    matDS(0x99dd55),
    matDS(0x88cc44),
    matDS(0x77bb33),
  ];
  const carpetColors = [
    mat(0x77bb44), mat(0x66aa33), mat(0x88cc44),
  ];
  const half = 0.50;

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

  const bladeStep = 0.065;
  for (let gx = -half; gx <= half; gx += bladeStep) {
    for (let gz = -half; gz <= half; gz += bladeStep) {
      const ox = gx + (Math.random() - 0.5) * bladeStep * 0.5;
      const oz = gz + (Math.random() - 0.5) * bladeStep * 0.5;
      const isHero = Math.random() < 0.1;
      const h = isHero ? (0.18 + Math.random() * 0.05) : (0.07 + Math.random() * 0.11);
      const w = 0.03 + Math.random() * 0.01;
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

// ── Subtype 1: Tallgrass ──

function buildTallgrass(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [
    matDS(0x88bb55), matDS(0x7aaa44), matDS(0x99cc66),
    matDS(0x6a9938), matDS(0xa0bb66),
  ];
  const carpetColors = [mat(0x6a9938), mat(0x7aaa44), mat(0x5a8830)];
  const half = 0.50;

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
    const seed = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.10, 4), seedMat);
    seed.position.set(sx + lean * 0.3, sh + 0.03, sz);
    g.add(seed);
  }
  return g;
}

// ── Subtype 2: Bunchgrass ──

function buildBunchgrass(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [
    matDS(0xaacc88), matDS(0x99bb77), matDS(0xbbdd99),
    matDS(0x88aa66), matDS(0xccddaa),
  ];
  const carpetColors = [mat(0x88aa66), mat(0x99bb77), mat(0x77aa55)];
  const half = 0.50;

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

// ── Subtype 3: Bamboo ──

function buildBamboo(): THREE.Group {
  const g = new THREE.Group();
  const culmMat = mat(0xaacc55);
  const culmMat2 = mat(0x99bb44);
  const leafMat = matDS(0x77bb44);
  const leafMat2 = matDS(0x88cc55);
  const nodeMat = mat(0x88aa33);
  const carpetColors = [mat(0x66aa33), mat(0x77aa44), mat(0x559928)];
  const half = 0.50;

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

  const culmMats = [culmMat, culmMat2, mat(0xbbdd66), mat(0x8abb44)];
  const culmStep = 0.13;
  for (let gx = -half; gx <= half; gx += culmStep) {
    for (let gz = -half; gz <= half; gz += culmStep) {
      if (Math.random() > 0.85) continue;
      const cx = gx + (Math.random() - 0.5) * culmStep * 0.6;
      const cz = gz + (Math.random() - 0.5) * culmStep * 0.6;
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

// ── Subtype 4: Spreading ──

function buildSpreading(): THREE.Group {
  const g = new THREE.Group();
  const bladeColors = [
    matDS(0xaadd66), matDS(0x99cc55), matDS(0xbbee77),
    matDS(0x88bb44), matDS(0x77aa33),
  ];
  const carpetColors = [mat(0x88bb44), mat(0x77aa33), mat(0x99cc55)];
  const stolonMat = mat(0x77aa44);
  const half = 0.50;

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

// ── Subtype 5: Sedge (old version with carpet + twisted stems) ──

function buildSedge(): THREE.Group {
  const g = new THREE.Group();
  const stemColors = [mat(0x77bb55), mat(0x88cc66), mat(0x66aa44)];
  const umbColors = [matDS(0x55aa44), matDS(0x66bb55), matDS(0x77cc66)];
  const carpetColors = [mat(0x66aa44), mat(0x77aa55), mat(0x559933)];
  const half = 0.50;

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

  const step = 0.15;
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

      const um = umbColors[Math.floor(Math.random() * umbColors.length)];
      const spokeCount = 5 + Math.floor(Math.random() * 3);
      const spokeLen = h * (0.25 + Math.random() * 0.08);
      for (let j = 0; j < spokeCount; j++) {
        const ba = j * Math.PI * 2 / spokeCount + Math.random() * 0.3;
        const spoke = new THREE.Mesh(grassBlade(spokeLen, 0.018, spokeLen * 0.15), um);
        spoke.position.set(sx + Math.cos(ba) * 0.02, h, sz + Math.sin(ba) * 0.02);
        spoke.rotation.y = ba;
        spoke.rotation.z = -(0.5 + Math.random() * 0.35);
        g.add(spoke);
      }
    }
  }
  return g;
}

// Suppress unused warnings — this file is an archive, not imported anywhere
void buildTurfgrass;
void buildTallgrass;
void buildBunchgrass;
void buildBamboo;
void buildSpreading;
void buildSedge;
