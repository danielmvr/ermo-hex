import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, simulateJourney, applyProposal, validateWorld, ENERGY_MAX } from '../engine.mjs';
import { buildAtlas, generatedHex, atlasDistance } from '../world-geography.mjs';
const seed='ermo-001', atlas=buildAtlas(seed), directions=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const key=p=>`${p.q},${p.r}`;
const legacy=makeWorld();
const core=new Map(legacy.hexes.map(h=>[key(h),h]));
const terrain=(q,r)=>core.get(`${q},${r}`)?.terrain ?? atlas.get(q,r)?.terrain;
function pathOutside(){
 const nodes=[{q:0,r:0}],prev=new Map([[key(nodes[0]),null]]);
 let target;
 for(let i=0;i<nodes.length;i++){
  const p=nodes[i];
  if(atlasDistance(p,{q:0,r:0})>=6){target=p;break}
  for(const [dq,dr] of directions){
   const next={q:p.q+dq,r:p.r+dr}, k=key(next);
   if(!prev.has(k) && !['oceano','lago',undefined].includes(terrain(next.q,next.r))){prev.set(k,p);nodes.push(next)}
  }
 }
 assert.ok(target,'Esperava um caminho terrestre além da região histórica');
 const path=[];
 for(let p=target;prev.get(key(p));p=prev.get(key(p)))path.push({type:'mover',q:p.q,r:p.r});
 return path.reverse();
}
function startAt(pos){
 const world=structuredClone(legacy);
 const tile=generatedHex(seed,pos.q,pos.r);
 assert.ok(tile && atlasDistance(pos,{q:0,r:0})>5);
 tile.visited=true;tile.discovered=true;
 world.hexes.push(tile);world.player.position={q:pos.q,r:pos.r};
 assert.equal(validateWorld(world),true);
 return world;
}
const proposal=(w,journey,action={type:'observar'},id='world_test')=>({
 schema:'ermo.action.v2',baseRevision:w.revision,commandId:id,journey,action,
 story:'O Viajante avançou e observou o novo mundo.',commitMessage:'mundo: explorar nova região'
});
test('Viajante ultrapassa os 91 hexágonos sem perder a região histórica',()=>{
 const path=pathOutside();assert.ok(path.length<=ENERGY_MAX);
 const result=simulateJourney(legacy,path).world;
 assert.ok(result.hexes.length>91);
 assert.equal(result.player.energy,ENERGY_MAX-path.length);
 assert.equal(result.day,legacy.day);
 for(const old of legacy.hexes){
  const saved=result.hexes.find(h=>h.q===old.q&&h.r===old.r);
  assert.ok(saved);
  assert.equal(saved.terrain,old.terrain);
  assert.deepEqual(saved.resources,old.resources);
 }
 assert.equal(legacy.hexes.length,91);
 assert.equal(validateWorld(result),true);
});
test('travessia exige jangada e consome energia sem teletransporte',()=>{
 const coast=atlas.cells.find(c=>c.category==='terra'&&atlasDistance(c,{q:0,r:0})>6 && directions.some(([dq,dr])=>atlas.get(c.q+dq,c.r+dr)?.terrain==='oceano'));
 assert.ok(coast);
 const adjacent=directions.map(([dq,dr])=>atlas.get(coast.q+dq,coast.r+dr)).find(t=>t?.terrain==='oceano');
 const w=startAt(coast);
 assert.throws(()=>simulateJourney(w,[{type:'navegar',q:adjacent.q,r:adjacent.r}]),/Navegação exige jangada/);
 w.player.vessel='jangada';
 const traveled=simulateJourney(w,[{type:'navegar',q:adjacent.q,r:adjacent.r}]).world;
 assert.deepEqual(traveled.player.position,{q:adjacent.q,r:adjacent.r});
 assert.equal(traveled.player.energy,ENERGY_MAX-2);
 assert.equal(traveled.hexes.find(h=>h.q===adjacent.q&&h.r===adjacent.r)?.visited,true);
});
test('construir jangada perto da água preserva regras de custo',()=>{
 const coast=atlas.cells.find(c=>c.category==='terra'&&atlasDistance(c,{q:0,r:0})>6 && directions.some(([dq,dr])=>atlas.get(c.q+dq,c.r+dr)?.terrain==='oceano'));
 const w=startAt(coast);w.player.inventory.madeira=5;w.player.inventory.pedra=1;
 const r=applyProposal(w,proposal(w,[],{type:'construir',structure:'jangada'},'jangada_test'));
 assert.equal(r.player.vessel,'jangada');
 assert.equal(r.player.inventory.madeira,0);
 assert.equal(r.player.inventory.pedra,0);
 assert.equal(r.player.energy,ENERGY_MAX-2);
});
test('relíquia só entra no histórico após visitar seu hexágono',()=>{
 const site=atlas.sites.find(s=>s.kind==='reliquia' && directions.some(([dq,dr])=>{
  const n=atlas.get(s.q+dq,s.r+dr);return n && n.category==='terra' && atlasDistance(n,{q:0,r:0})>5
 }));
 assert.ok(site);
 const neighbor=directions.map(([dq,dr])=>atlas.get(site.q+dq,site.r+dr)).find(n=>n?.category==='terra'&&atlasDistance(n,{q:0,r:0})>5);
 const w=startAt(neighbor);
 assert.equal(w.discoveries,undefined);
 const result=applyProposal(w,proposal(w,[{type:'mover',q:site.q,r:site.r}],{type:'observar'},'relic_test'));
 assert.ok(result.discoveries.includes(site.id));
 assert.ok(result.events.some(e=>e.kind==='discovery' && e.q===site.q && e.r===site.r));
 assert.equal(validateWorld(result),true);
});