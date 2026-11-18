import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorld, simulateJourney, energyOf} from '../engine.mjs';
import {cacheWorld,cachedWorld,saveDraft,clearDraft,restoreDraft,DRAFT_KEY,CONFLICT_KEY} from '../persistence.mjs';
function mem() {const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
const origin=makeWorld();
const step={type:'mover',q:1,r:0};
test('autosave restaura posição, hexágonos e energia após refresh',()=>{
  const storage=mem();
  const valid=simulateJourney(origin,[step]).world;
  assert.equal(saveDraft(storage,origin,[step],'Procuro lenha','acao_a'),true);
  const r=restoreDraft(storage,origin);
  assert.equal(r.status,'restored');
  assert.deepEqual(r.world.player.position,{q:1,r:0});
  assert.equal(energyOf(r.world),11);
  assert.equal(r.world.hexes.filter(h=>h.discovered).length,valid.hexes.filter(h=>h.discovered).length);
  assert.equal(r.dialogue,'Procuro lenha');
  assert.equal(r.commandId,'acao_a');
});
test('cache oficial permite recuperar mundo anterior offline',()=>{
  const storage=mem();
  cacheWorld(storage,origin);
  assert.equal(cachedWorld(storage).revision,0);
});
test('restauro inclui dia avançado pelo descanso, mesmo offline',()=>{
  const storage=mem(),w=structuredClone(origin);
  w.player.energy=1;
  const journey=[step,{type:'descansar'}];
  saveDraft(storage,w,journey);
  const state=restoreDraft(storage,w);
  assert.equal(state.world.day,2);
  assert.equal(state.world.player.energy,12);
  assert.deepEqual(state.world.player.position,{q:1,r:0});
});
test('depois do commit, rascunho reconhecido é limpo automaticamente',()=>{
  const storage=mem();saveDraft(storage,origin,[step],'','acao_abc');
  const updated=simulateJourney(origin,[step]).world;
  updated.revision=1;
  updated.events.push({id:'acao_abc',day:1,title:'ação',text:'ação',q:1,r:0});
  const state=restoreDraft(storage,updated);
  assert.equal(state.status,'committed');
  assert.equal(storage.getItem(DRAFT_KEY),null);
  assert.equal(state.world.revision,1);
});
test('revisão divergente nunca sobrepõe mundo online e preserva backup',()=>{
  const storage=mem();saveDraft(storage,origin,[step],'','acao_pendente');
  const newer=structuredClone(origin);newer.revision=10;
  const state=restoreDraft(storage,newer);
  assert.equal(state.status,'conflict');
  assert.equal(state.world.revision,10);
  assert.ok(storage.getItem(CONFLICT_KEY));
  assert.equal(storage.getItem(DRAFT_KEY),null);
});
test('rascunho adulterado não faz teletransporte nem altera mapa',()=>{
  const storage=mem();
  storage.setItem(DRAFT_KEY,JSON.stringify({schema:'ermo.local.v1',baseRevision:0,journey:[{type:'mover',q:5,r:0}],dialogue:'',commandId:''}));
  const state=restoreDraft(storage,origin);
  assert.equal(state.status,'invalid');
  assert.deepEqual(state.world.player.position,{q:0,r:0});
});
test('limpar progresso local não altera o mundo em memória',()=>{
  const storage=mem();saveDraft(storage,origin,[step]);clearDraft(storage);
  assert.equal(storage.getItem(DRAFT_KEY),null);
  assert.equal(restoreDraft(storage,origin).status,'empty');
});