#!/usr/bin/env node
/**
 * Summarizes an overgreen diagnostic JSON file into concise text.
 * Usage: node scripts/summarize-diagnostic.js [path-to-diagnostic.json]
 *   If no path given, uses the most recent overgreen-diagnostic-*.json in cwd.
 */

const fs = require('fs');
const path = require('path');

// ── Resolve file ──

let filePath = process.argv[2];
if (!filePath) {
  const files = fs.readdirSync('.').filter(f => f.startsWith('overgreen-diagnostic-') && f.endsWith('.json'));
  if (files.length === 0) { console.error('No diagnostic files found.'); process.exit(1); }
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  filePath = files[0];
}

const d = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const snaps = d.snapshots;
const out = [];
const p = (...a) => out.push(a.join(' '));

// ── Metadata ──

p(`# Diagnostic: ${path.basename(filePath)}`);
p(`Generated: ${d.generatedAt}`);
p(`Grid: ${d.gridSize.width}x${d.gridSize.height}  |  Snapshot interval: ${d.config.snapshotInterval} ticks  |  Snapshots: ${snaps.length}`);
p();

// ── Terrain ──

const ts = d.terrainSummary;
p(`## Terrain`);
p(`Plantable: ${ts.plantableCells}  (soil:${ts.soilCells} hill:${ts.hillCells} wetland:${ts.wetlandCells} arid:${ts.aridCells})  river:${ts.riverCells} rock:${ts.rockCells}`);
p();

// ── Season transitions ──

if (d.seasonTransitions && d.seasonTransitions.length > 0) {
  const names = ['Spring', 'Summer', 'Autumn', 'Winter'];
  p(`## Season Transitions`);
  for (const st of d.seasonTransitions) {
    p(`  tick ${String(st.tick).padStart(4)}: ${names[st.fromSeason]} → ${names[st.toSeason]}  pop ${st.populationBefore}→${st.populationAfter}  (${st.speciesCountBefore} species)`);
  }
  p();
}

// ── Timeline table ──

p(`## Timeline`);
p(`tick |  sea | pop  | spp | births | deaths | prod   | maint  | net_e  | water | w_occ | w_str% | shaded | x_spp% | seed%`);
p(`-----|------|------|-----|--------|--------|--------|--------|--------|-------|-------|--------|--------|--------|------`);
for (const s of snaps) {
  const row = [
    String(s.tick).padStart(4),
    ['Spr','Sum','Aut','Win'][s.season].padStart(4),
    String(s.population).padStart(5),
    String(s.speciesCount).padStart(3),
    String(s.birthsInPeriod).padStart(6),
    String(s.deathsInPeriod.total).padStart(6),
    s.energy.avgProduction.toFixed(3).padStart(6),
    s.energy.avgMaintenance.toFixed(3).padStart(6),
    s.energy.avgNetEnergy.toFixed(3).padStart(6),
    s.resources.avgWater.toFixed(1).padStart(5),
    (s.resources.avgWaterOnOccupied !== undefined ? s.resources.avgWaterOnOccupied.toFixed(1) : '  n/a').padStart(5),
    (s.competition.pctWaterStressed.toFixed(0) + '%').padStart(6),
    (s.competition.pctShaded.toFixed(0) + '%').padStart(6),
    (s.competition.crossSpeciesNeighborPct !== undefined ? (s.competition.crossSpeciesNeighborPct.toFixed(0) + '%').padStart(6) : '   n/a'),
    (s.reproduction.seedSuccessRate * 100).toFixed(0).padStart(4) + '%',
  ];
  p(row.join(' | '));
}
p();

// ── Death breakdown ──

const hasMultipleCauses = snaps.some(s => s.deathsInPeriod.age > 0 || s.deathsInPeriod.fire > 0);
if (hasMultipleCauses) {
  p(`## Death Causes`);
  for (const s of snaps) {
    const dd = s.deathsInPeriod;
    if (dd.total === 0) continue;
    const parts = [];
    if (dd.starvation) parts.push(`starve:${dd.starvation}`);
    if (dd.age) parts.push(`age:${dd.age}`);
    if (dd.fire) parts.push(`fire:${dd.fire}`);
    p(`  tick ${String(s.tick).padStart(4)}: ${parts.join(' ')} (${dd.total})`);
  }
  p();
}

// ── Top species at key points ──

p(`## Species Evolution`);
const keyTicks = [];
if (snaps.length <= 8) {
  keyTicks.push(...snaps.map(s => s.tick));
} else {
  // First, last, and ~5 evenly spaced
  const step = Math.floor(snaps.length / 5);
  for (let i = 0; i < snaps.length; i += step) keyTicks.push(snaps[i].tick);
  const lastTick = snaps[snaps.length - 1].tick;
  if (!keyTicks.includes(lastTick)) keyTicks.push(lastTick);
}

for (const tick of keyTicks) {
  const snap = snaps.find(s => s.tick === tick);
  if (!snap) continue;
  const names = ['Spring','Summer','Autumn','Winter'];
  p(`### Tick ${tick} (${names[snap.season]}, pop=${snap.population}, ${snap.speciesCount} spp)`);
  for (const sp of snap.topSpecies.slice(0, 3)) {
    const g = sp.avgGenome;
    const terrain = Object.entries(sp.terrain).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(' ');
    p(`  ${sp.name} (#${sp.speciesId}): n=${sp.count} e=${sp.avgEnergy.toFixed(2)} [r:${g.root.toFixed(2)} h:${g.height.toFixed(2)} l:${g.leaf.toFixed(2)} s:${g.seed.toFixed(2)} sz:${(g.sz ?? 0.5).toFixed(2)} d:${g.def.toFixed(2)} w:${(g.wood ?? 0).toFixed(2)} wst:${(g.wst ?? 0).toFixed(2)}] {${terrain}}`);
  }
  p();
}

// ── Lineage Stats ──

const lastSnapForLineage = snaps[snaps.length - 1];
if (lastSnapForLineage.speciesLineage && lastSnapForLineage.speciesDetail) {
  const lineageMap = new Map(Object.entries(lastSnapForLineage.speciesLineage).map(([k,v]) => [Number(k), Number(v)]));
  function getLineageRoot(id) { let c = id; while (lineageMap.has(c)) c = lineageMap.get(c); return c; }

  // Group species by root
  const groups = new Map();
  for (const sp of lastSnapForLineage.speciesDetail) {
    const root = getLineageRoot(sp.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(sp);
  }

  const sorted = [...groups.entries()].map(([rootId, members]) => {
    const totalPop = members.reduce((s, m) => s + m.count, 0);
    const rootMember = members.find(m => m.id === rootId);
    return { rootId, members, totalPop, name: rootMember ? rootMember.name : members[0].name };
  }).sort((a, b) => b.totalPop - a.totalPop);

  p(`## Lineage Stats (tick ${lastSnapForLineage.tick})`);
  p(`Total: ${lastSnapForLineage.speciesDetail.length} species in ${groups.size} lineages (${lineageMap.size} speciation events)`);
  p();
  for (const g of sorted) {
    const top3 = g.members.sort((a,b) => b.count - a.count).slice(0, 3);
    p(`  ${g.name} (#${g.rootId}): ${g.totalPop} plants, ${g.members.length} species`);
    for (const m of top3) {
      p(`    ${m.name} (#${m.id}): ${m.count}`);
    }
    if (g.members.length > 3) p(`    ...and ${g.members.length - 3} more`);
  }
  p();

  // Lineage depth distribution
  const depths = new Map();
  for (const sp of lastSnapForLineage.speciesDetail) {
    let d = 0, cur = sp.id;
    while (lineageMap.has(cur)) { cur = lineageMap.get(cur); d++; }
    depths.set(sp.id, d);
  }
  const maxDepth = Math.max(...depths.values(), 0);
  if (maxDepth > 0) {
    const depthCounts = new Array(maxDepth + 1).fill(0);
    for (const dd of depths.values()) depthCounts[dd]++;
    p(`Lineage depth: ${depthCounts.map((c, i) => `d${i}:${c}`).join(' ')}`);
    p();
  }

  // Lineage count over time
  p(`Lineages over time:`);
  for (const snap of snaps) {
    if (!snap.speciesLineage || !snap.speciesDetail) continue;
    const lin = new Map(Object.entries(snap.speciesLineage).map(([k,v]) => [Number(k), Number(v)]));
    function gr(id) { let c = id; while (lin.has(c)) c = lin.get(c); return c; }
    const roots = new Set();
    for (const sp of snap.speciesDetail) roots.add(gr(sp.id));
    p(`  tick ${String(snap.tick).padStart(4)}: ${String(snap.speciesDetail.length).padStart(3)} species, ${roots.size} lineages`);
  }
  p();

  // Per-terrain genome evolution (using topSpecies which has genome data)
  p(`## Genome by Terrain`);
  const terrainNames = ['soil', 'hill', 'wetland', 'arid'];
  for (const terrain of terrainNames) {
    const rows = [];
    for (const snap of snaps) {
      // Find topSpecies entries whose terrain is predominantly this one
      const matches = snap.topSpecies.filter(sp => {
        const t = sp.terrain;
        const total = (t.soil || 0) + (t.hill || 0) + (t.wetland || 0) + (t.arid || 0);
        return total > 0 && (t[terrain] || 0) / total > 0.7;
      });
      if (matches.length === 0) { rows.push(null); continue; }
      let wTotal = 0;
      const sums = { root:0, height:0, leaf:0, seed:0, sz:0, def:0, wood:0, wst:0, lon:0 };
      for (const sp of matches) {
        for (const k of Object.keys(sums)) sums[k] += (sp.avgGenome[k] || 0) * sp.count;
        wTotal += sp.count;
      }
      for (const k of Object.keys(sums)) sums[k] /= wTotal;
      rows.push({ tick: snap.tick, pop: matches.reduce((s,m) => s+m.count, 0), genome: sums });
    }

    const valid = rows.filter(r => r !== null);
    if (valid.length < 2) continue;

    p(`### ${terrain.charAt(0).toUpperCase() + terrain.slice(1)}`);
    p(`tick  | pop  |  root |  hgt  |  leaf |  seed |  sz   |  def  |  wood |  wst  |  lon`);
    p(`------|------|-------|-------|-------|-------|-------|-------|-------|-------|------`);
    for (const r of rows) {
      if (!r) continue;
      const g = r.genome;
      const f = v => v.toFixed(3).padStart(5);
      p(`${String(r.tick).padStart(4)}  | ${String(r.pop).padStart(4)} | ${f(g.root)} | ${f(g.height)} | ${f(g.leaf)} | ${f(g.seed)} | ${f(g.sz)} | ${f(g.def)} | ${f(g.wood)} | ${f(g.wst)} | ${f(g.lon)}`);
    }

    // Drift summary
    const first = valid[0].genome;
    const last = valid[valid.length - 1].genome;
    const traitLabels = { root:'Root', height:'Hgt', leaf:'Leaf', seed:'Seed', sz:'SdSz', def:'Def', wood:'Wood', wst:'WStr', lon:'Lon' };
    const drifts = Object.keys(traitLabels).map(k => {
      const delta = last[k] - first[k];
      return `${traitLabels[k]}:${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`;
    });
    p(`Drift: ${drifts.join('  ')}`);
    p();
  }
}

// ── Key insights (auto-detected) ──

p(`## Auto-detected Patterns`);

// Population trend
const firstPop = snaps[0].population;
const lastPop = snaps[snaps.length - 1].population;
const peakSnap = snaps.reduce((a, b) => b.population > a.population ? b : a);
const troughSnap = snaps.reduce((a, b) => b.population < a.population ? b : a);
p(`- Population: start=${firstPop} → end=${lastPop} (peak=${peakSnap.population}@t${peakSnap.tick}, trough=${troughSnap.population}@t${troughSnap.tick})`);

// Species loss
const firstSpp = snaps[0].speciesCount;
const lastSpp = snaps[snaps.length - 1].speciesCount;
if (lastSpp < firstSpp) {
  p(`- Species: ${firstSpp} → ${lastSpp} (lost ${firstSpp - lastSpp} species)`);
}

// Shannon diversity trend
const firstShannon = snaps[0].diversity.shannonIndex;
const lastShannon = snaps[snaps.length - 1].diversity.shannonIndex;
p(`- Shannon diversity: ${firstShannon.toFixed(2)} → ${lastShannon.toFixed(2)}`);

// Dominant species
const lastSnap = snaps[snaps.length - 1];
if (lastSnap.topSpecies.length > 0) {
  const dom = lastSnap.topSpecies[0];
  const pct = (dom.count / lastSnap.population * 100).toFixed(0);
  p(`- Dominant: ${dom.name} (#${dom.speciesId}) = ${pct}% of population`);
}

// Seasonal die-off
const autumnSnaps = snaps.filter(s => s.season === 2);
if (autumnSnaps.length > 0) {
  const noSeedSnaps = autumnSnaps.filter(s => s.birthsInPeriod === 0);
  if (noSeedSnaps.length > 0) {
    p(`- Autumn die-offs: zero births at ticks ${noSeedSnaps.map(s => s.tick).join(', ')}`);
  }
}

// Water stress
const highStressSnaps = snaps.filter(s => s.competition.pctWaterStressed > 40);
if (highStressSnaps.length > 0) {
  p(`- High water stress (>40%): at ticks ${highStressSnaps.map(s => s.tick).join(', ')}`);
}

// Shading
const fullShadeSnaps = snaps.filter(s => s.competition.pctShaded === 100);
if (fullShadeSnaps.length > 0) {
  p(`- 100% shading at ticks: ${fullShadeSnaps.map(s => s.tick).join(', ')}`);
}

p();

// ── SIM constants that differ from common defaults (just flag non-obvious ones) ──

p(`## Key SIM Constants`);
const important = [
  'BASE_WATER_RECHARGE', 'PHOTOSYNTHESIS_RATE', 'MAINTENANCE_BASE', 'SEED_ENERGY_COST',
  'MUTATION_RATE', 'MAX_AGE', 'SHADOW_REDUCTION', 'DISEASE_SPAWN_CHANCE',
];
for (const k of important) {
  if (d.simConstants[k] !== undefined) {
    p(`  ${k}: ${d.simConstants[k]}`);
  }
}

console.log(out.join('\n'));
