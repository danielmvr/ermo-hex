import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld } from '../engine.mjs';
import { buildInterpreterPrompt, chatDestination, CHATGPT_BASE_URL, WORLD_CONTEXT_URL } from '../chat-link.mjs';

const base=makeWorld();
const dialogue='Recolho madeira para o abrigo.';
const commandId='acao_test_123';
const getPrompt=(journey=[],s=dialogue)=>buildInterpreterPrompt({base,world:base,journey,dialogue:s,commandId});

test('Link inclui apenas URL do contexto, fala e identificadores com jornada',()=>{
  const p=getPrompt();
  assert.match(p, /https:\/\/github.com\/danielmvr\/ermo-hex\/blob\/main\/WORLD_CONTEXT\.md/);
  assert.match(p, /FALA: "Recolho madeira para o abrigo\."/);
  assert.match(p, /"baseRevision":0/);
  assert.match(p, /"commandId":"acao_test_123"/);
  for(const hidden of ['inventario','recursosAtuais','energiaAtual','eventosRecentes','terrenoAtual','biomaConhecido']){
    assert.equal(p.includes(hidden),false,hidden+' vazou para a URL');
  }
  assert.equal(p.split('\n').length,5);
  const dest=chatDestination(p);
  assert.equal(dest.direct,true);
  assert.ok(dest.url.startsWith(CHATGPT_BASE_URL+'?q='));
  assert.equal(decodeURIComponent(dest.url.split('?q=')[1]),p);
  assert.equal(WORLD_CONTEXT_URL,'https://github.com/danielmvr/ermo-hex/blob/main/WORLD_CONTEXT.md');
});

test('Jornada de até 60 passos mantém eventos integrais e tem URL curta',()=>{
  const journey=Array.from({length:60},(_,i)=>i%9===8?{type:'descansar'}:{type:i%4?'mover':'navegar',q:(i%2?-60:60),r:(i%3?-60:60)});
  const prompt=getPrompt(journey,'Exploro o horizonte.');
  const line=prompt.split('\n').find(x=>x.startsWith('JORNADA: '));
  const payload=JSON.parse(line.slice('JORNADA: '.length));
  assert.deepEqual(payload.journey,journey);
  assert.equal(payload.baseRevision,0);
  assert.equal(payload.commandId,commandId);
  const dest=chatDestination(prompt);
  assert.equal(dest.direct,true,'jornada máxima deve caber no link');
  assert.ok(dest.length<7000);
});

test('Mesmo mundo gigantesco não torna o link longo',()=>{
  const world=structuredClone(base);
  world.hexes.forEach(h=>{h.discovered=true;h.name='Local da floresta com uma grande história';});
  world.events.push(...Array.from({length:100},(_,i)=>({id:'e'+i,day:i,title:'histórico',text:'a'.repeat(180)})));
  const p=buildInterpreterPrompt({base,world,journey:[],dialogue,commandId});
  assert.equal(p,getPrompt());
});

test('Recusa mensagens ou jornadas fora do contrato',()=>{
  assert.throws(()=>getPrompt([],' '),/Digite uma fala/);
  assert.throws(()=>getPrompt([],'a'.repeat(101)),/100 caracteres/);
  assert.throws(()=>getPrompt(Array.from({length:61},()=>({type:'descansar'}))),/60 eventos/);
  assert.throws(()=>getPrompt([{type:'executar_codigo'}]),/Evento desconhecido/);
});

test('Se link externo exceder tamanho permitido, abre ChatGPT básico e preserva cópia',()=>{
  const long='x'.repeat(10000);
  const x=chatDestination(long);
  assert.equal(x.direct,false);
  assert.equal(x.url,CHATGPT_BASE_URL);
});

test('Botão é link nativo preparado antes do clique, sem abrir popup assíncrono',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
  assert.match(html, /<a id="open-chat"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(app, /function refreshChatHref\(/);
  assert.match(app, /anchor\.href=destination\.url/);
  assert.match(app, /refreshChatHref\(\);/);
  assert.match(app, /addEventListener\('click',prepareChatLink\)/);
  const click=app.slice(app.indexOf('function prepareChatLink(event)'),app.indexOf('function openChatFromKeyboard'));
  assert.doesNotMatch(click,/buildPrompt\(/);
  assert.doesNotMatch(click,/window\.open/);
});
