import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlas, ATLAS_CELLS, ATLAS_RADIUS, LAND_TARGET, FRESH_TARGET, OCEAN_TARGET, CONTINENTS, ARCHIPELAGOS, BIOMES, CULTURES, FAUNA, FLORA, SITE_QUOTAS, atlasDistance, generatedHex } from '../world-geography.mjs';
import { visibleHexes, knownEnvironment, discoverySummary } from '../world-view.mjs';
const w=buildAtlas('ermo-001');
test('atlas com 10.981 células e quotas exatas',()=>{
 assert.equal(w.statistics.total,ATLAS_CELLS);
 assert.equal(w.statistics.land,LAND_TARGET);
 assert.equal(w.statistics.fresh,FRESH_TARGET);
 assert.equal(w.statistics.ocean,OCEAN_TARGET);
 assert.equal(CONTINENTS.length,4);
 assert.equal(ARCHIPELAGOS.length,6);
 for (const g of [...CONTINENTS,...ARCHIPELAGOS])assert.equal(w.statistics.regionLand[g.id],g.land);
});
test('a região original de 91 células é mantida sem alterações de relevo',()=>{
 const core=w.cells.filter(c=>atlasDistance(c,{q:0,r:0})<=5);
 assert.equal(core.length,91);
 assert.ok(core.every(c=>c.region==='origem'));
 assert.equal(w.get(0,0).terrain,'campina');
});
test('12 biomas, oito matrizes culturais e catálogo de 36/60 espécies',()=>{
 assert.equal(BIOMES.length,12);
 assert.equal(CULTURES.length,8);
 assert.equal(FAUNA.length,36);
 assert.equal(FLORA.length,60);
 const names=new Set([...FAUNA,...FLORA].map(x=>x.id));assert.equal(names.size,96);
});
test('362 pontos únicos ou regionais sem duplicação de coordenadas',()=>{
 assert.equal(w.sites.length,362);
 assert.equal(new Set(w.sites.map(s=>`${s.q},${s.r}`)).size,w.sites.length);
 for (const [kind,n] of Object.entries(SITE_QUOTAS)) assert.equal(w.statistics.sites[kind],n);
 assert.ok(w.sites.every(s=>atlasDistance(s,{q:0,r:0})>5));
});
test('geografia é determinística e conserva proporções',()=>{
 const b=buildAtlas('ermo-001');assert.strictEqual(w,b);
 for(const [q,r] of [[60,0],[-59,1],[2,-60],[-10,12],[33,25]]){
  assert.deepEqual(generatedHex('ermo-001',q,r),generatedHex('ermo-001',q,r));
 }
 assert.equal(generatedHex('ermo-001',61,0),null);
});
test('camada de leitura não revela bioma ou relíquia de terra oculta',()=>{
 const world={seed:'ermo-001',player:{position:{q:0,r:0}},hexes:[{q:0,r:0,terrain:'campina',visited:true,discovered:true}]};
 const view=visibleHexes(world,9);
 assert.ok(view.length>91);
 assert.ok(view.some(t=>!t.discovered));
 assert.equal(knownEnvironment(world,10,5),null);
 assert.equal(discoverySummary(world).charted,1);
 assert.equal(discoverySummary(world).total,10981);
});