// Comprehensive niche checker: reads all 4 experiment results and checks against target matrix
const fs = require('fs');

const experiments = [
  { file: 'exp-temperate.json', climate: 'Temperate' },
  { file: 'exp-tropical.json', climate: 'Tropical' },
  { file: 'exp-med.json', climate: 'Mediterranean' },
  { file: 'exp-desert.json', climate: 'Desert' },
];

const targets = {
  'Soil+Temperate': { dominant: ['Oak','Birch','Hazel'], common: ['Holly','Bramble','Wildflower','Fern','Clover','Moss','Tallgrass'] },
  'Soil+Tropical': { dominant: ['Tropical','Palm','Magnolia','Tropical Herb','Fern'], common: ['Vine','Bamboo','Flowering Shrub','Tall Herb','Moss','Epiphytic'] },
  'Soil+Mediterranean': { dominant: ['Mediterranean','Aromatic','Cypress','Oak'], common: ['Holly','Wildflower','Clover','Turfgrass','Ryegrass'] },
  'Soil+Desert': { dominant: ['Saltbush','Acacia','Desert Grass','Desert Annual'], common: ['Saguaro','Barrel Cactus','Aloe','Euphorbia','Jade','Aromatic'] },
  'Hill+Temperate': { dominant: ['Bunchgrass','Turfgrass','Wildflower','Clover'], common: ['Ryegrass','Moss','Tallgrass','Holly'] },
  'Hill+Tropical': { dominant: ['Bunchgrass','Tropical Herb','Fern','Conifer'], common: ['Wildflower','Moss','Flowering Shrub','Epiphytic','Bamboo'] },
  'Hill+Mediterranean': { dominant: ['Bunchgrass','Mediterranean','Aromatic'], common: ['Wildflower','Turfgrass','Clover','Cypress'] },
  'Hill+Desert': { dominant: ['Saguaro','Barrel Cactus','Desert Grass','Bunchgrass'], common: ['Desert Annual','Euphorbia','Saltbush','Aloe'] },
  'Wetland+Temperate': { dominant: ['Birch','Cypress','Sedge','Fern'], common: ['Oak','Mangrove','Hazel','Moss','Tall Herb','Wildflower','Tallgrass'] },
  'Wetland+Tropical': { dominant: ['Tropical','Palm','Mangrove','Fern','Bamboo'], common: ['Magnolia','Vine','Tropical Herb','Sedge','Moss','Tall Herb'] },
  'Wetland+Mediterranean': { dominant: ['Cypress','Mangrove','Sedge','Fern'], common: ['Birch','Wildflower','Ryegrass','Tallgrass','Moss'] },
  'Wetland+Desert': { dominant: ['Palm','Acacia','Sedge','Tallgrass'], common: ['Fern','Ryegrass','Mangrove','Moss'] },
  'Arid+Temperate': { dominant: ['Saltbush','Aromatic','Desert Grass','Bunchgrass'], common: ['Aloe','Jade','Euphorbia','Ryegrass','Desert Annual','Holly'] },
  'Arid+Tropical': { dominant: ['Acacia','Aloe','Euphorbia','Pampas'], common: ['Saltbush','Desert Grass','Saguaro','Jade','Desert Annual','Tropical Herb'] },
  'Arid+Mediterranean': { dominant: ['Barrel Cactus','Saguaro','Aromatic','Mediterranean'], common: ['Aloe','Euphorbia','Desert Grass','Desert Annual','Saltbush'] },
  'Arid+Desert': { dominant: ['Saguaro','Barrel Cactus'], common: ['Desert Grass','Desert Annual'] },
};

const terrains = ['soil', 'hill', 'wetland', 'arid'];
const terrainLabel = { soil: 'Soil', hill: 'Hill', wetland: 'Wetland', arid: 'Arid' };

let totalPass = 0;
let totalFail = 0;

for (const exp of experiments) {
  const path = process.cwd() + '/' + exp.file;
  if (!fs.existsSync(path)) {
    console.log(`\n*** MISSING: ${exp.file} ***`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const snap = data.snapshots[data.snapshots.length - 1];
  const sd = snap.speciesDetail;

  for (const t of terrains) {
    const nicheKey = terrainLabel[t] + '+' + exp.climate;
    const target = targets[nicheKey];
    if (!target) continue;

    const species = sd.filter(s => (s.terrain[t] || 0) > 0)
      .map(s => ({ name: s.name, count: s.terrain[t] }))
      .sort((a, b) => b.count - a.count);
    const total = species.reduce((s, x) => s + x.count, 0);
    let H = 0;
    for (const s of species) {
      const p = s.count / total;
      if (p > 0) H -= p * Math.log(p);
    }

    const allNames = species.map(s => s.name);
    const top4 = species.slice(0, 4).map(s => s.name);
    const domPresent = target.dominant.filter(d => allNames.some(n => n.includes(d)));
    const comPresent = target.common.filter(d => allNames.some(n => n.includes(d)));

    // Check if at least half of target dominants are in top 6
    const top6Names = species.slice(0, 6).map(s => s.name);
    const domInTop6 = target.dominant.filter(d => top6Names.some(n => n.includes(d)));

    const hPass = H >= 2.5;
    const sppPass = species.length >= 8;
    const domMatch = domInTop6.length >= Math.ceil(target.dominant.length / 2);
    const allPass = hPass && sppPass && domMatch;

    if (allPass) totalPass++; else totalFail++;

    const status = allPass ? 'PASS' : 'FAIL';
    console.log(`\n${status} ${nicheKey} — ${species.length} spp, H=${H.toFixed(2)}, total=${total}`);
    console.log(`  Top 6: ${species.slice(0, 6).map(s => s.name + ' (' + (100*s.count/total).toFixed(0) + '%)').join(', ')}`);
    console.log(`  Target dominant: ${target.dominant.join(', ')}`);
    console.log(`  Dom in top6: ${domInTop6.join(', ')} (${domInTop6.length}/${target.dominant.length})`);
    if (!hPass) console.log(`  ** H=${H.toFixed(2)} < 2.5`);
    if (!sppPass) console.log(`  ** Only ${species.length} species < 8`);
    if (!domMatch) console.log(`  ** Only ${domInTop6.length}/${Math.ceil(target.dominant.length / 2)} target dominants in top 6`);
  }
}

console.log(`\n========================================`);
console.log(`TOTAL: ${totalPass} PASS, ${totalFail} FAIL out of ${totalPass + totalFail} niches`);
