import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const app = readFileSync(new URL('app.mjs', root), 'utf8');
const css = readFileSync(new URL('styles.css', root), 'utf8');
const build = readFileSync(new URL('scripts/build-site.mjs', root), 'utf8');
const world = JSON.parse(readFileSync(new URL('world.json', root), 'utf8'));

test('Modelo 03 mantém todos os controles essenciais do jogador', () => {
  const ids = ['hexmap', 'day', 'day-note', 'status', 'revision', 'tile-title', 'tile-desc',
    'tile-coords', 'tile-resources', 'madeira', 'pedra', 'alimento', 'energy-value',
    'energy-meter', 'rest-btn', 'dialogue', 'counter', 'open-chat', 'copy-prompt',
    'save-journey', 'reset-path', 'refresh-world', 'history', 'local-warning', 'toast'];
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `${id} ausente`);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test('Hexágonos utilizam artes de bioma com corte SVG e mantendo links', () => {
  assert.match(app, /hex-clip-/);
  assert.match(app, /hex-\$\{h.terrain/);
  assert.match(app, /chooseHex\(h\)/);
  assert.match(app, /simulateJourney/);
  assert.match(app, /chatDestination/);
  for (const terrain of ['campina','floresta','colinas','montanha','lago','ruinas']) {
    assert.ok(existsSync(new URL(`assets/hex-${terrain}.webp`,root)), `arte ${terrain} ausente`);
  }
});

test('Build publica os recursos visuais e preserva o world.json oficial', () => {
  assert.match(build, /cp\(path\.join\(root,'assets'\)/);
  assert.match(build, /'world\.json'/);
  assert.equal(world.schema, 'ermo.world.v1');
  assert.ok(world.events.length > 0);
  assert.match(css, /Sobrevivência Imersiva|\.theme-immersive|\.map-vignette/);
});
test('reações divinas persistidas aparecem no mapa e no histórico com texto seguro',()=>{
  assert.match(app, /world\.manifestations\?\.find/);
  assert.match(app, /event\.kind === 'divine'/);
  assert.match(app, /\.textContent = event\.text/);
  assert.match(css, /\.event\.divine-event/);
});

test('sobrevivência mantém medidor e opção segura de refeição por Chat-Commit',()=>{
  for(const id of ['hunger-value','hunger-note','meal-btn']) assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,/hungerOf\(world\)/);
  assert.match(app,/function copyMeal\(/);
  assert.match(app,/action: \{ type: 'comer' \}/);
  assert.match(app,/addEventListener\('click', copyMeal\)/);
});
