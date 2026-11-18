import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld } from '../engine.mjs';
import { buildInterpreterPrompt, chatDestination, CHATGPT_BASE_URL } from '../chat-link.mjs';

const base=makeWorld();
const commandId='acao_test_123';
const makePrompt=(world=base,journey=[],dialogue='Recolho madeira para o abrigo.') =>
  buildInterpreterPrompt({base,world,journey,dialogue,commandId});

test('o contexto cabe na URL do ChatGPT em uma interação simples',()=>{
  const prompt=makePrompt();
  const destination=chatDestination(prompt);
  assert.equal(destination.direct,true);
  assert.ok(destination.url.startsWith('https://chatgpt.com/?q='));
  assert.equal(decodeURIComponent(destination.url.split('?q=')[1]),prompt);
  assert.match(prompt,/ermo.action.v2/);
  assert.match(prompt,/"commandId":"acao_test_123"/);
});

test('contexto compacto não cresce proporcionalmente a todos os hexágonos descobertos',()=>{
  const world=structuredClone(base);
  for (const h of world.hexes) h.discovered=true;
  const dialogue='Observo as mudanças no terreno.';
  const prompt=makePrompt(world,[],dialogue);
  assert.match(prompt,/"hexagonosDescobertos":91/);
  assert.match(prompt,/"falaDoJogador":"Observo as mudanças no terreno."/);
  assert.equal(chatDestination(prompt).direct,true);
});

test('jornada com 60 eventos é preservada integralmente no JSON',()=>{
  const world=structuredClone(base);
  const journey=Array.from({length:60},(_,i)=>i%12===11?{type:'descansar'}:{type:'mover',q:i%5,r:0});
  const prompt=makePrompt(world,journey);
  const start=prompt.indexOf('ESTADO CONTEXTUAL (JSON):\n')+'ESTADO CONTEXTUAL (JSON):\n'.length;
  const end=prompt.indexOf('\n\nEscolha UMA ação válida:',start);
  const state=JSON.parse(prompt.slice(start,end));
  assert.deepEqual(state.journey,journey);
  assert.equal(state.baseRevision,0);
  assert.equal(state.commandId,commandId);
});

test('URL excessiva abre ChatGPT simples em vez de não abrir nada; conteúdo não é truncado',()=>{
  const longPrompt='contexto '.repeat(2000);
  const destination=chatDestination(longPrompt);
  assert.equal(destination.direct,false);
  assert.equal(destination.url,CHATGPT_BASE_URL);
  assert.ok(destination.length>7000);
});

test('navegação usa link real com nova aba e cópia de contingência',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
  assert.match(html,/<a id="open-chat"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(app,/addEventListener\('click',prepareChatLink\)/);
  assert.match(app,/copyText\(prompt\)\.then/);
  assert.doesNotMatch(app,/if \(link\.length>7800\)/);
});