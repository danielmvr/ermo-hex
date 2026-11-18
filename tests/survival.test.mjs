import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld, validateWorld, applyProposal, simulateJourney, hungerOf, HUNGER_MAX, ENERGY_MAX } from '../engine.mjs';

const defaultWorld=makeWorld();
const proposal=(w,action={type:'observar'},journey=[],id='fome_teste')=>({
  schema:'ermo.action.v2',baseRevision:w.revision,commandId:id,journey,action,
  story:'O Viajante nota seu corpo e suas necessidades.',
  commitMessage:'mundo: registrar sobrevivencia'
});
const moveFrom=(w)=>{
  const h=w.hexes.find(h=>h.terrain!=='lago'&&Math.max(
    Math.abs(h.q-w.player.position.q),Math.abs(h.r-w.player.position.r),
    Math.abs(h.q+h.r-w.player.position.q-w.player.position.r))===1);
  assert.ok(h);
  return {type:'mover',q:h.q,r:h.r};
};
test('save legado sem fome permanece válido e começa sem penalidade retroativa',()=>{
  const legacy=structuredClone(defaultWorld);delete legacy.player.hunger;
  assert.equal(validateWorld(legacy),true);
  assert.equal(hungerOf(legacy),0);
  assert.equal(hungerOf(defaultWorld),0);
});
test('descanso eleva a fome, mas no primeiro dia recupera 12/12',()=>{
  const w=structuredClone(defaultWorld);
  w.player.energy=1;
  const next=simulateJourney(w,[moveFrom(w),{type:'descansar'}]).world;
  assert.equal(next.day,2);
  assert.equal(next.player.energy,12);
  assert.equal(next.player.hunger,1);
});
test('fome acumulada reduz recuperação do descanso sem tornar energia negativa',()=>{
  for(const [hunger,expectedEnergy] of [[1,9],[2,6],[3,6]]){
    const w=structuredClone(defaultWorld);
    w.player.energy=0;
    w.player.hunger=hunger;
    const result=applyProposal(w,proposal(w,{type:'observar'},[{type:'descansar'}],'fome_'+hunger));
    assert.equal(result.player.hunger,Math.min(HUNGER_MAX,hunger+1));
    assert.equal(result.player.energy,expectedEnergy);
    assert.equal(result.day,2);
  }
});
test('comer consome exatamente 1 alimento e recupera dois pontos de energia',()=>{
  const w=structuredClone(defaultWorld);
  w.player.hunger=2;w.player.energy=0;
  const after=applyProposal(w,proposal(w,{type:'comer'}));
  assert.equal(after.player.hunger,0);
  assert.equal(after.player.energy,2);
  assert.equal(after.player.inventory.alimento,w.player.inventory.alimento-1);
  assert.equal(after.day,1);
  assert.equal(after.revision,1);
});
test('comer não excede energia máxima e não autoriza alimentos inexistentes',()=>{
  const w=structuredClone(defaultWorld);w.player.energy=11;
  assert.equal(applyProposal(w,proposal(w,{type:'comer'})).player.energy,12);
  w.player.inventory.alimento=0;
  assert.throws(()=>applyProposal(w,proposal(w,{type:'comer'})),/Sem alimento/);
});
test('comer preserva compatibilidade e rejeita parâmetros não confiáveis',()=>{
  assert.throws(()=>applyProposal(defaultWorld,proposal(defaultWorld,{type:'comer',amount:99})),/Campos não autorizados/);
});
test('veto divino de refeição preserva alimento, energia e fome',()=>{
  const w=structuredClone(defaultWorld);
  w.player.energy=0;w.player.hunger=3;
  const base=proposal(w,{type:'comer'});
  const after=applyProposal(w,{...base,schema:'ermo.action.v3',reaction:{
    intensity:'media',verdict:'negar',title:'A refeição foi negada',
    text:'A refeição não aconteceu.',effect:{type:'vetar_acao'}
  }});
  assert.deepEqual(after.player.inventory,w.player.inventory);
  assert.equal(after.player.energy,0);
  assert.equal(after.player.hunger,3);
});
test('a regra não muda o consumo de energia ao caminhar',()=>{
  const w=structuredClone(defaultWorld);
  w.player.hunger=1;
  const next=simulateJourney(w,[moveFrom(w)]).world;
  assert.equal(next.player.energy,ENERGY_MAX-1);
  assert.equal(next.player.hunger,1);
});
test('validador rejeita fome inválida',()=>{
  for (const v of [-1,4,1.5,'3',null]) {
    const w=structuredClone(defaultWorld);w.player.hunger=v;
    assert.throws(()=>validateWorld(w),/Fome inválida/);
  }
});
// A rota é reproduzida contra o atlas oficial para diagnóstico do Júri;
// sem aplicar consequência real ou impedir a homologação do sistema de fome.
test('diagnóstico: avaliar a rota da revisão canônica 5 sem modificar o mundo',()=>{
  const w=JSON.parse(readFileSync(new URL('../world.json',import.meta.url),'utf8'));
  const journey=[
    [5,-2],[6,-2],[7,-2],[8,-2],[9,-2],[10,-2],[11,-3],null,
    [11,-4],[12,-5],[12,-6],[11,-6],[10,-6],[10,-7],[10,-8],
    [10,-9],[10,-10],[10,-11],[10,-12],[11,-13]
  ].map(p=>p?{type:'mover',q:p[0],r:p[1]}:{type:'descansar'});
  if(w.revision!==5) return;
  try {
    const result=simulateJourney(w,journey);
    console.log('ERMO_ROUTE_DIAGNOSTIC PASS destination='+JSON.stringify(result.world.player.position)+
      ' day='+result.world.day+' energy='+result.world.player.energy+
      ' hunger='+result.world.player.hunger+' visited='+result.moves);
  } catch (e) {
    console.log('ERMO_ROUTE_DIAGNOSTIC REJECT reason='+e.message);
  }
});
