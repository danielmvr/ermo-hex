import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld, applyProposal, validateWorld, axialDistance, energyOf, ENERGY_MAX, simulateJourney, MAX_JOURNEY } from '../engine.mjs';
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
  assert.equal(next.day,1);
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

const v2=(journey=[],action={type:'observar'},override={})=>({
  schema:'ermo.action.v2',baseRevision:0,commandId:'test_v2',journey,action,
  story:'O viajante registra as consequências de sua jornada.',commitMessage:'mundo: registrar jornada',...override
});
function neighborRoute(origin, count) {
  const steps=[];let pos=origin.player.position;
  for(let i=0;i<count;i++) {
    const hex=origin.hexes.find(h=>h.terrain!=='lago' && axialDistance(h,pos)===1 && !(steps.length && h.q===steps.at(-1).q && h.r===steps.at(-1).r));
    if(!hex)throw new Error('Sem hexágono vizinho');
    steps.push({type:'mover',q:hex.q,r:hex.r});
    pos=hex;
  }
  return steps;
}
test('energia inicial e migração de save legado preservam o mundo',()=>{
  assert.equal(energyOf(world),ENERGY_MAX);
  const old=structuredClone(world);delete old.player.energy;
  assert.equal(validateWorld(old),true);
  const updated=applyProposal(old,v2());
  assert.equal(updated.player.energy,ENERGY_MAX);
  assert.equal(updated.player.position.q,0);
  assert.equal(updated.day,1);
});
test('cada passo gasta uma energia e não aumenta o dia',()=>{
  const step=neighborRoute(world,1);
  const next=applyProposal(world,v2(step));
  assert.equal(next.player.energy,ENERGY_MAX-1);
  assert.equal(next.day,1);
  assert.deepEqual(next.player.position,{q:step[0].q,r:step[0].r});
  assert.equal(next.revision,1);
});
test('descanso não funciona antes de energia zero',()=>{
  assert.throws(()=>simulateJourney(world,[{type:'descansar'}]),/Descanso permitido/);
});
test('energia zero impede caminhada; descanso recupera e avança um dia',()=>{
  const w=structuredClone(world);w.player.energy=1;
  const [first]=neighborRoute(w,1);
  assert.throws(()=>simulateJourney(w,[first,first]),/Passo proibido/);
  const tired=simulateJourney(w,[first]).world;
  assert.equal(tired.player.energy,0);
  assert.throws(()=>simulateJourney(tired,[{type:'mover',q:0,r:0}]),/Energia esgotada/);
  const rested=simulateJourney(w,[first,{type:'descansar'}]).world;
  assert.equal(rested.day,2);
  assert.equal(rested.player.energy,ENERGY_MAX);
  assert.deepEqual(rested.player.position,tired.player.position);
  const confirmed=applyProposal(w,v2([first,{type:'descansar'}]));
  assert.equal(confirmed.day,2);
  assert.equal(confirmed.events.filter(e=>e.title==='Descanso concluído').length,1);
});
test('a mesma jornada pode atravessar dias e registrar descansos',()=>{
  const w=structuredClone(world);w.player.energy=2;
  const steps=neighborRoute(w,3);
  const journey=[...steps.slice(0,2),{type:'descansar'},steps[2]];
  const result=applyProposal(w,v2(journey));
  assert.equal(result.day,2);
  assert.equal(result.player.energy,ENERGY_MAX-1);
  assert.deepEqual(result.player.position,{q:steps[2].q,r:steps[2].r});
});
test('coletar custa 1, construir custa 2, observar custa zero',()=>{
  const collected=applyProposal(world,v2([],{type:'coletar',resource:'madeira',amount:1}));
  assert.equal(collected.player.energy,ENERGY_MAX-1);
  const built=applyProposal(world,v2([],{type:'construir',structure:'abrigo'}));
  assert.equal(built.player.energy,ENERGY_MAX-2);
  const observed=applyProposal(world,v2());
  assert.equal(observed.player.energy,ENERGY_MAX);
  assert.equal(observed.day,1);
});
test('não admite ação após esgotamento de energia',()=>{
  const w=structuredClone(world);w.player.energy=0;
  assert.throws(()=>applyProposal(w,v2([],{type:'coletar',resource:'madeira',amount:1})),/Energia insuficiente/);
  assert.equal(applyProposal(w,v2()).player.energy,0);
});
test('jornada recusa eventos arbitrários e descanso com energia positiva',()=>{
  assert.throws(()=>applyProposal(world,v2([{type:'descansar'}])),/Descanso permitido/);
  assert.throws(()=>applyProposal(world,v2([{type:'executar',shell:'rm -rf /'}])),/não autorizado/);
  assert.throws(()=>applyProposal(world,v2(Array(MAX_JOURNEY+1).fill({type:'descansar'}))),/máximo/);
});
test('proposta v1 mantém compatibilidade sem gastar um dia por ação',()=>{
  const r=applyProposal(world,action({action:{type:'nomear',name:'Vale Inicial'}}));
  assert.equal(r.day,1);
  assert.equal(r.player.energy,ENERGY_MAX-1);
});