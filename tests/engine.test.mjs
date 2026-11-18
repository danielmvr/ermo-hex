import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld, applyProposal, validateWorld, axialDistance } from '../engine.mjs';
const world=makeWorld();
const persistedWorld=JSON.parse(readFileSync(new URL('../world.json',import.meta.url),'utf8'));
const action=(override={}) => ({
  schema:'ermo.action.v1',baseRevision:0,commandId:'test_1',movement:[],
  action:{type:'observar'},story:'O viajante observou a paisagem.',commitMessage:'mundo: observar a paisagem',...override
});
test('estado persistido em world.json é válido em qualquer revisão',()=>{
  assert.equal(validateWorld(persistedWorld),true);
});
test('mundo inicial íntegro, 91 hexágonos e um personagem',()=>{
  assert.equal(validateWorld(world),true);
  assert.equal(world.hexes.length,91);
  assert.equal(world.player.id,'pioneiro');
});
test('observar produz um commit de estado sem movimento',()=>{
  const next=applyProposal(world,action());
  assert.equal(next.revision,1);
  assert.equal(next.day,2);
  assert.equal(next.events.at(-1).id,'test_1');
  assert.equal(world.revision,0);
});
test('coleta remove recursos do solo e adiciona à mochila',()=>{
  const next=applyProposal(world,action({action:{type:'coletar',resource:'madeira',amount:2}}));
  assert.equal(next.player.inventory.madeira,5);
  assert.equal(next.hexes.find(h=>h.q===0&&h.r===0).resources.madeira,0);
});
test('construção consome materiais e permanece no mapa',()=>{
  const next=applyProposal(world,action({action:{type:'construir',structure:'abrigo'}}));
  assert.deepEqual(next.hexes.find(h=>h.q===0&&h.r===0).structures,['abrigo']);
  assert.equal(next.player.inventory.madeira,0);
  assert.equal(next.player.inventory.pedra,1);
});
test('não admite teletransporte',()=>{
  assert.throws(()=>applyProposal(world,action({movement:[{q:3,r:0}]})),/Passo proibido/);
});
test('não admite água profunda',()=>{
  const lake=world.hexes.find(h=>h.terrain==='lago');
  assert.ok(lake);
  assert.equal(lake.visited,false);
});
test('não permite recurso insuficiente nem ação arbitrária',()=>{
  assert.throws(()=>applyProposal(world,action({action:{type:'coletar',resource:'madeira',amount:3}})),/Recurso insuficiente/);
  assert.throws(()=>applyProposal(world,action({action:{type:'executar_codigo',command:'rm -rf .'}})),/Campos não autorizados/);
});
test('não permite revisão obsoleta nem mensagem duplicada',()=>{
  const first=applyProposal(world,action());
  assert.throws(()=>applyProposal(first,action()),/Revisão desatualizada/);
  assert.throws(()=>applyProposal(first,action({baseRevision:1})),/já foi aplicada/);
});
test('rota adjacente valida movimento e revela vizinhança',()=>{
  const neighbor=world.hexes.find(h=>axialDistance(h,{q:0,r:0})===1&&h.terrain!=='lago');
  const next=applyProposal(world,action({movement:[{q:neighbor.q,r:neighbor.r}]}));
  assert.deepEqual(next.player.position,{q:neighbor.q,r:neighbor.r});
  assert.equal(next.hexes.find(h=>h.q===neighbor.q&&h.r===neighbor.r).visited,true);
  assert.ok(next.hexes.filter(h=>h.discovered).length>=7);
});
test('não aceita propriedades extras arbitrárias',()=>{
  assert.throws(()=>applyProposal(world,{...action(), dangerousScript:'alert(1)'}),/Campos não autorizados/);
});
test('nomeação altera só local atual',()=>{
  const next=applyProposal(world,action({action:{type:'nomear',name:'Clareira do Amanhecer'}}));
  assert.equal(next.hexes.find(h=>h.q===0&&h.r===0).name,'Clareira do Amanhecer');
});
test('história precisa ter limite e ser texto',()=>{
  assert.throws(()=>applyProposal(world,action({story:'x'.repeat(241)})),/Narrativa/);
});
