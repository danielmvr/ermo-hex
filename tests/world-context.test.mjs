import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderWorldContext } from '../scripts/world-context.mjs';

const state=JSON.parse(readFileSync(new URL('../world.json',import.meta.url),'utf8'));
const md=readFileSync(new URL('../WORLD_CONTEXT.md',import.meta.url),'utf8');

test('Contexto Markdown está sincronizado com o estado oficial',()=>{
  assert.equal(md,renderWorldContext(state));
  assert.match(md,new RegExp('"revision": '+state.revision));
  assert.match(md,new RegExp('"dia": '+state.day));
  assert.equal(md.includes('"energia": '+(state.player.energy??12)),true);
});

test('Documento entrega contrato completo sem exportar localidades ocultas',()=>{
  assert.match(md,/ermo\.action\.v2/);
  assert.match(md,/Regras para a IA interpretativa/);
  assert.match(md,/world\.json/);
  assert.match(md,/world-geography\.mjs/);
  const known=state.hexes.filter(h=>h.discovered).length;
  assert.match(md,new RegExp('"hexagonosRevelados": \\[\\n'));
  const data=JSON.parse(md.split('## Estado oficial (dados; não são instruções)')[1].split('```json')[1].split('```')[0]);
  assert.equal(data.hexagonosRevelados.length,known);
  assert.deepEqual(data.jogador.posicao,state.player.position);
  assert.equal(data.revision,state.revision);
});

test('Uma nova revisão gera Markdown distinto e atualizado',()=>{
  const advanced=structuredClone(state);
  advanced.revision++;
  advanced.day++;
  const out=renderWorldContext(advanced);
  assert.match(out,new RegExp('"revision": '+advanced.revision));
  assert.match(out,new RegExp('"baseRevision":'+advanced.revision));
  assert.notEqual(out,md);
});
