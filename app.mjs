import { makeWorld, axialDistance, tileKey, TERRAINS, ENERGY_MAX, MAX_JOURNEY, energyOf, validateWorld, simulateJourney } from './engine.mjs';
import { cachedWorld, cacheWorld, saveDraft, clearDraft, restoreDraft } from './persistence.mjs';
import { buildInterpreterPrompt, chatDestination } from './chat-link.mjs';

const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const SIZE = 31.5;
const TERRAIN_STYLE = {
  campina: {
    fill: 'url(#fill-campina)', icon: 'campina', title: 'Clareira do Despertar',
    tags:['planície aberta','visibilidade alta','fronteira tranquila']
  },
  floresta: {
    fill: 'url(#fill-floresta)', icon: 'floresta', title: 'Bosque do Sussurro',
    tags:['floresta densa','sinais de recursos','sombras vivas']
  },
  colinas: {
    fill: 'url(#fill-colinas)', icon: 'colinas', title: 'Colinas do Eco',
    tags:['altitude moderada','pedra exposta','rotas observáveis']
  },
  montanha: {
    fill: 'url(#fill-montanha)', icon: 'montanha', title: 'Espinha da Serra',
    tags:['ar rarefeito','risco de subida','pedra abundante']
  },
  lago: {
    fill: 'url(#fill-lago)', icon: 'lago', title: 'Margem Silenciosa',
    tags:['águas profundas','não caminhável','fonte de alimento']
  },
  ruinas: {
    fill: 'url(#fill-ruinas)', icon: 'ruinas', title: 'Ruínas Cobertas',
    tags:['vestígios antigos','história adormecida','pedra trabalhada']
  }
};
const TERRAIN_TEXT = {
  campina: 'Uma campina viva e aberta. O vento corre livre, revelando trilhas suaves e oportunidades de exploração rápida.',
  floresta: 'Árvores densas abafam o som do mundo. Há abrigo, madeira e a sensação de que algo observa além da mata.',
  colinas: 'Ondulações de terra e pedra ampliam a visão do entorno. Um bom ponto para enxergar caminhos e perigos.',
  montanha: 'Paredões frios e altos dominam o horizonte. Cada passo exige cautela, mas a pedra aqui é abundante.',
  lago: 'Água calma à distância, refletindo a luz baixa. Belo à vista, mas ainda inalcançável para travessia.',
  ruinas: 'Vestígios de um passado esquecido surgem entre pedras e sombras. Há sinais de uso antigo e material reaproveitável.'
};
let base;
let world;
let journey = [];
let storage;
let messageId = '';
let toastTimer = 0;
try { storage = window.localStorage; } catch { storage = null; }

const stepsCount = () => journey.filter(e => e.type === 'mover').length;
const restCount = () => journey.filter(e => e.type === 'descansar').length;
const chars = s => [...s].length;
const dom = (tag, attrs = {}, text = '') => {
  const el = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text) el.textContent = text;
  return el;
};
const coords = ({ q, r }) => ({ x: 415 + Math.sqrt(3) * SIZE * (q + r / 2), y: 311 + 1.5 * SIZE * r });
const points = ({ x, y }, radius = SIZE - 1.7) => Array.from({ length: 6 }, (_, i) => {
  const t = (Math.PI / 180) * (60 * i - 30);
  return `${(x + radius * Math.cos(t)).toFixed(2)},${(y + radius * Math.sin(t)).toFixed(2)}`;
}).join(' ');
const getHex = p => world.hexes.find(h => h.q === p.q && h.r === p.r);
const isAdjacent = h => axialDistance(h, world.player.position) === 1;

function persistDraft() {
  if (!saveDraft(storage, base, journey, $('dialogue').value, messageId)) {
    $('status').textContent = 'salvamento local indisponível';
    $('status').classList.add('offline');
  }
}

function flash(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}

function buildDefs() {
  const defs = dom('defs');
  const gradients = {
    campina: ['#b3d671', '#4d7c33'],
    floresta: ['#2f8a56', '#153f2b'],
    colinas: ['#ba9868', '#735331'],
    montanha: ['#c7d0d7', '#5d6671'],
    lago: ['#53c9db', '#135569'],
    ruinas: ['#b29a84', '#5a473c']
  };
  for (const [name, [a, b]] of Object.entries(gradients)) {
    const lg = dom('linearGradient', { id: `fill-${name}`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
    lg.append(dom('stop', { offset: '0%', 'stop-color': a }));
    lg.append(dom('stop', { offset: '100%', 'stop-color': b }));
    defs.append(lg);
  }
  const fog = dom('radialGradient', { id: 'fill-unknown', cx: '50%', cy: '45%', r: '68%' });
  fog.append(dom('stop', { offset: '0%', 'stop-color': '#566059', 'stop-opacity': '.45' }));
  fog.append(dom('stop', { offset: '100%', 'stop-color': '#1a211d', 'stop-opacity': '.95' }));
  defs.append(fog);
  const glow = dom('filter', { id: 'hex-glow', x: '-40%', y: '-40%', width: '180%', height: '180%' });
  glow.append(dom('feDropShadow', { dx: '0', dy: '0', stdDeviation: '4', 'flood-color': '#ffcb73', 'flood-opacity': '.45' }));
  defs.append(glow);
  return defs;
}

function addTerrainGlyph(group, terrain, p) {
  const make = (tag, attrs = {}) => dom(tag, { 'pointer-events': 'none', ...attrs });
  const glyph = dom('g', { opacity: '.88' });
  if (terrain === 'campina') {
    glyph.append(make('path', { d: `M ${p.x - 16} ${p.y + 8} Q ${p.x} ${p.y - 8} ${p.x + 16} ${p.y + 8}`, fill: 'none', stroke: '#f7f3d4', 'stroke-width': '2' }));
    glyph.append(make('circle', { cx: p.x - 10, cy: p.y - 7, r: '2.8', fill: '#fff3ca' }));
  } else if (terrain === 'floresta') {
    for (const dx of [-10, 0, 10]) {
      glyph.append(make('path', { d: `M ${p.x + dx} ${p.y - 14} L ${p.x + dx - 8} ${p.y + 3} L ${p.x + dx + 8} ${p.y + 3} Z`, fill: '#f4efd1', opacity: '.92' }));
      glyph.append(make('line', { x1: p.x + dx, y1: p.y + 3, x2: p.x + dx, y2: p.y + 10, stroke: '#f4efd1', 'stroke-width': '2' }));
    }
  } else if (terrain === 'colinas') {
    glyph.append(make('path', { d: `M ${p.x - 16} ${p.y + 5} Q ${p.x - 7} ${p.y - 7} ${p.x + 3} ${p.y + 1} Q ${p.x + 11} ${p.y + 10} ${p.x + 17} ${p.y + 1}`, fill: 'none', stroke: '#f7efd0', 'stroke-width': '2.2' }));
    glyph.append(make('path', { d: `M ${p.x - 14} ${p.y + 12} Q ${p.x - 1} ${p.y + 1} ${p.x + 15} ${p.y + 10}`, fill: 'none', stroke: '#f7efd0', 'stroke-width': '1.8', opacity: '.8' }));
  } else if (terrain === 'montanha') {
    glyph.append(make('path', { d: `M ${p.x - 17} ${p.y + 10} L ${p.x - 6} ${p.y - 12} L ${p.x + 1} ${p.y + 2} L ${p.x + 8} ${p.y - 8} L ${p.x + 18} ${p.y + 10} Z`, fill: 'rgba(255,255,255,.9)' }));
  } else if (terrain === 'lago') {
    for (const offset of [-8, 0, 8]) glyph.append(make('path', { d: `M ${p.x - 14} ${p.y + offset / 2} Q ${p.x - 6} ${p.y - 4 + offset / 2} ${p.x + 2} ${p.y + offset / 2} T ${p.x + 16} ${p.y + offset / 2}`, fill: 'none', stroke: '#effefb', 'stroke-width': '2' }));
  } else if (terrain === 'ruinas') {
    glyph.append(make('path', { d: `M ${p.x - 14} ${p.y + 10} L ${p.x - 14} ${p.y - 8} L ${p.x - 4} ${p.y - 8} L ${p.x - 4} ${p.y + 10} M ${p.x + 4} ${p.y + 10} L ${p.x + 4} ${p.y - 8} L ${p.x + 14} ${p.y - 8} L ${p.x + 14} ${p.y + 10} M ${p.x - 4} ${p.y - 8} Q ${p.x} ${p.y - 15} ${p.x + 4} ${p.y - 8}`, fill: 'none', stroke: '#fbf3d6', 'stroke-width': '2' }));
  }
  group.append(glyph);
}

function drawMap() {
  const map = $('hexmap');
  map.replaceChildren();
  map.append(buildDefs());
  const layer = dom('g');

  for (const h of world.hexes) {
    const p = coords(h);
    const active = h.q === world.player.position.q && h.r === world.player.position.r;
    const adjacent = isAdjacent(h);
    const tile = dom('g', {
      class: ['tile', h.discovered ? 'known' : 'unknown', adjacent ? 'adjacent' : '', active ? 'active' : ''].join(' ').trim(),
      tabindex: 0,
      role: 'button',
      'aria-label': `${h.discovered ? (h.name || TERRAINS[h.terrain].name) : 'Terreno não descoberto'}, coordenadas ${h.q}, ${h.r}`
    });

    const basePoly = dom('polygon', {
      points: points(p),
      fill: h.discovered ? TERRAIN_STYLE[h.terrain].fill : 'url(#fill-unknown)',
      stroke: active ? '#ffd791' : adjacent ? '#8ef0a9' : h.discovered ? '#5e6d61' : '#49524d',
      'stroke-width': active ? '2.8' : adjacent ? '2.2' : '1.1',
      opacity: h.discovered ? 1 : .92
    });
    tile.append(basePoly);

    // Art terrain is clipped inside each hex. The texture is decorative;
    // discovery, movement and resources still depend solely on world.json.
    if (h.discovered) {
      const clipId = `hex-clip-${h.q + 10}-${h.r + 10}`;
      const clip = dom('clipPath', { id: clipId });
      clip.append(dom('polygon', { points: points(p, SIZE - 2.8) }));
      map.firstChild.append(clip);
      const variant = ((h.q * 37 + h.r * 29) % 5 + 5) % 5;
      const texture = dom('image', {
        href: `./assets/hex-${h.terrain}.webp`,
        x: p.x - SIZE + 1, y: p.y - SIZE + 1,
        width: (SIZE - 1) * 2, height: (SIZE - 1) * 2,
        preserveAspectRatio: 'xMidYMid slice',
        'clip-path': `url(#${clipId})`,
        opacity: variant % 2 ? '.94' : '.99',
        'pointer-events': 'none'
      });
      tile.append(texture);
      const shade = dom('polygon', {
        points: points(p, SIZE - 2.8), fill: 'rgba(5,14,9,.13)',
        stroke: 'none', 'pointer-events': 'none'
      });
      tile.append(shade);
    }

    if (h.discovered) {
      const sheen = dom('polygon', {
        points: points({ x: p.x, y: p.y - 1 }, SIZE - 9),
        fill: 'rgba(255,255,255,.08)',
        stroke: 'none',
        opacity: '.55'
      });
      tile.append(sheen);
      addTerrainGlyph(tile, h.terrain, p);
      if (adjacent && !active) tile.append(dom('polygon', { points: points(p, SIZE - 4.7), fill: 'rgba(126,255,175,.12)', stroke: 'rgba(146,255,192,.55)', 'stroke-width': '1.2', 'stroke-dasharray': '4 4' }));
      if (h.structures.length) tile.append(dom('circle', { cx: p.x + 17, cy: p.y - 18, r: 5.2, fill: '#f4c56d', stroke: '#2f2815', 'stroke-width': 1.2 }));
      if (h.visited) tile.append(dom('circle', { cx: p.x - 17, cy: p.y + 18, r: 3, fill: '#f5eed2', opacity: .86 }));
      if (h.name) tile.append(dom('circle', { cx: p.x + 16, cy: p.y + 18, r: 3.2, fill: '#8ff5b3', opacity: .8 }));
    } else {
      tile.append(dom('text', { x: p.x, y: p.y + 7, 'text-anchor': 'middle', 'font-size': 20, fill: adjacent ? '#dce3d7' : '#677269', 'font-family': 'Inter, sans-serif', 'font-weight': '800' }, '?'));
      if (adjacent) tile.append(dom('polygon', { points: points(p, SIZE - 4.7), fill: 'rgba(130,172,142,.08)', stroke: 'rgba(157,204,174,.45)', 'stroke-width': '1.1', 'stroke-dasharray': '4 4' }));
    }

    const title = dom('title');
    title.textContent = h.discovered ? `${h.name || TERRAINS[h.terrain].name} (${h.q}, ${h.r})` : `Desconhecido (${h.q}, ${h.r})`;
    tile.append(title);
    tile.addEventListener('click', () => chooseHex(h));
    tile.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        chooseHex(h);
      }
    });
    tile.addEventListener('mouseenter', () => showHexInfo(h));
    tile.addEventListener('mouseleave', () => showHexInfo(getHex(world.player.position)));
    layer.append(tile);
  }

  map.append(layer);
  const pos = coords(world.player.position);
  const aura = dom('circle', { cx: pos.x, cy: pos.y, r: 18, fill: 'none', stroke: '#ffcf7e', 'stroke-width': 2.4, class: 'hero-pulse', filter: 'url(#hex-glow)', 'pointer-events': 'none' });
  const inner = dom('polygon', { points: points(pos, 16), fill: 'rgba(255,206,126,.18)', stroke: '#ffd486', 'stroke-width': 2.3, filter: 'url(#hex-glow)', 'pointer-events': 'none' });
  const core = dom('circle', { cx: pos.x, cy: pos.y, r: 9, fill: '#ffdd9d', stroke: '#2b2416', 'stroke-width': 2.6, 'pointer-events': 'none' });
  const icon = dom('text', { x: pos.x, y: pos.y + 4.5, fill: '#2a1c09', 'font-size': 13.5, 'font-family': 'Inter, sans-serif', 'font-weight': '900', 'text-anchor': 'middle', 'pointer-events': 'none' }, '✦');
  map.append(aura, inner, core, icon);
}

function describeHex(h) {
  if (!h.discovered) return 'A névoa ainda cobre este hexágono. Caminhe até ele para transformar incerteza em mapa.';
  const baseText = TERRAIN_TEXT[h.terrain];
  const structureText = h.structures.length ? ` Estruturas erguidas aqui: ${h.structures.join(', ')}.` : ' Nenhuma estrutura foi erguida aqui até agora.';
  return `${baseText}${structureText}`;
}

function resourceText(h) {
  return h.discovered
    ? `Madeira ${h.resources.madeira} · Pedra ${h.resources.pedra} · Alimento ${h.resources.alimento}`
    : 'Recursos desconhecidos';
}

function renderTags(h) {
  const row = $('tile-tags');
  row.replaceChildren();
  const tags = !h.discovered
    ? ['névoa de guerra', 'sem reconhecimento', 'aproximação necessária']
    : [...TERRAIN_STYLE[h.terrain].tags, h.structures.length ? `${h.structures.length} estrutura(s)` : 'sem estruturas'];
  for (const label of tags.slice(0, 4)) {
    const item = document.createElement('span');
    item.className = 'tag';
    item.textContent = label;
    row.append(item);
  }
}

function showHexInfo(h) {
  if (!h) return;
  $('tile-card').dataset.terrain = h.discovered ? h.terrain : 'unknown';
  $('tile-title').textContent = h.discovered ? (h.name || TERRAINS[h.terrain].name) : 'Névoa da Jornada';
  $('tile-coords').textContent = `HEX ${h.q >= 0 ? '+' : ''}${h.q} / ${h.r >= 0 ? '+' : ''}${h.r}`;
  $('tile-desc').textContent = describeHex(h);
  $('tile-resources').textContent = resourceText(h);
  renderTags(h);
}

function drawHistory() {
  const list = $('history');
  list.replaceChildren();
  const source = base.events.slice(-5).reverse();
  for (const event of source) {
    const article = document.createElement('article');
    article.className = 'event';
    const day = document.createElement('span');
    day.textContent = `Dia ${event.day}`;
    const title = document.createElement('strong');
    title.textContent = event.title;
    const detail = document.createElement('p');
    detail.textContent = event.text;
    article.append(day, title, detail);
    list.append(article);
  }
  if (journey.length) {
    const article = document.createElement('article');
    article.className = 'event';
    const day = document.createElement('span');
    day.textContent = 'Rascunho local';
    const title = document.createElement('strong');
    title.textContent = `${stepsCount()} passo(s) e ${restCount()} descanso(s) aguardando commit`;
    const detail = document.createElement('p');
    detail.textContent = 'Seu navegador está preservando a jornada atual. Use o Chat-Commit quando quiser torná-la oficial no GitHub.';
    article.append(day, title, detail);
    list.prepend(article);
  }
}

function drawAll() {
  drawMap();
  showHexInfo(getHex(world.player.position));
  $('player-name').textContent = world.player.name;
  $('day').textContent = `Dia ${world.day}`;
  $('revision').textContent = `r${base.revision}`;
  $('official-revision').textContent = `Revisão ${base.revision} ${journey.length ? '· rascunho ativo' : '· sem pendências'}`;
  $('pending-rests').textContent = String(restCount());
  $('discovered').textContent = String(world.hexes.filter(h => h.discovered).length).padStart(2, '0');
  $('total').textContent = String(world.hexes.length);
  $('steps').textContent = String(stepsCount());
  $('position').textContent = `${world.player.position.q}, ${world.player.position.r}`;
  const energy = energyOf(world);
  $('energy-value').textContent = `${energy}/${ENERGY_MAX}`;
  $('energy-meter').value = energy;
  $('energy-meter').max = ENERGY_MAX;
  $('rest-btn').disabled = energy !== 0 || journey.length >= MAX_JOURNEY;
  $('save-journey').hidden = journey.length === 0;
  for (const key of ['madeira', 'pedra', 'alimento']) $(key).textContent = world.player.inventory[key];
  $('local-warning').hidden = journey.length === 0;
  $('local-warning').textContent = journey.length
    ? `↳ ${stepsCount()} passo(s) e ${restCount()} descanso(s) salvos neste navegador, mas ainda sem commit. Registre o progresso para sincronizar outros dispositivos.`
    : '';
  $('day-note').textContent = restCount()
    ? `${restCount()} descanso(s) ainda sem commit no GitHub.`
    : 'Somente o descanso avança o calendário.';
  drawHistory();
}

function recordJourney(nextEvent, message) {
  try {
    const result = simulateJourney(base, [...journey, nextEvent]);
    journey = [...journey, nextEvent];
    world = result.world;
    messageId = '';
    persistDraft();
    drawAll();
    flash(message);
  } catch (error) {
    flash(error.message);
  }
}

function chooseHex(h) {
  if (h.q === world.player.position.q && h.r === world.player.position.r) {
    showHexInfo(h);
    return;
  }
  if (!isAdjacent(h)) {
    flash('Escolha um hexágono vizinho para caminhar.');
    return;
  }
  if (!TERRAINS[h.terrain].walkable) {
    flash('Água profunda. Não é possível atravessar este hexágono.');
    return;
  }
  if (energyOf(world) === 0) {
    flash('Sem energia. Use Descansar para iniciar um novo dia.');
    return;
  }
  if (journey.length >= MAX_JOURNEY) {
    flash('Limite da jornada atingido. Registre o progresso no GitHub.');
    return;
  }
  recordJourney({ type: 'mover', q: h.q, r: h.r }, `Território: ${h.name || TERRAINS[h.terrain].name}. Exploração salva neste navegador.`);
}

function restDay() {
  if (energyOf(world) !== 0) {
    flash('Descanso disponível somente quando a energia chega a zero.');
    return;
  }
  if (journey.length >= MAX_JOURNEY) {
    flash('Registre a jornada atual antes de continuar.');
    return;
  }
  recordJourney({ type: 'descansar' }, 'Descanso concluído: um novo dia começou. Progresso salvo no navegador.');
}

function dialogValue() {
  return $('dialogue').value.trim();
}

function ensureMessageId() {
  if (!messageId) {
    messageId = `acao_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    persistDraft();
  }
  return messageId;
}

function buildPrompt() {
  const dialogue = dialogValue();
  if (!dialogue) {
    flash('Escreva o que seu personagem deseja fazer.');
    return null;
  }
  if (chars(dialogue) > 100) {
    flash('A mensagem precisa ter no máximo 100 caracteres.');
    return null;
  }
  const id = ensureMessageId();
  return buildInterpreterPrompt({ base, world, journey, dialogue, commandId: id });
}

function journeyProposal() {
  if (!journey.length) return null;
  const moves = stepsCount();
  const rests = restCount();
  const summary = [moves ? `${moves} passo(s)` : '', rests ? `${rests} descanso(s)` : ''].filter(Boolean).join(' e ');
  return {
    schema: 'ermo.action.v2',
    baseRevision: base.revision,
    commandId: ensureMessageId(),
    journey,
    action: { type: 'observar' },
    story: `O viajante registrou sua jornada: ${summary}.`,
    commitMessage: `mundo: registrar jornada com ${moves} passos e ${rests} descansos`
  };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      return true;
    } catch {
      return false;
    }
  }
}

async function copyJourney() {
  const proposal = journeyProposal();
  if (!proposal) {
    flash('Explore ou descanse antes de registrar uma jornada.');
    return;
  }
  const copied = await copyText(JSON.stringify(proposal, null, 2));
  flash(copied
    ? 'JSON de jornada copiado. Cole no Chat-Commit para salvar no GitHub.'
    : 'Não foi possível copiar automaticamente.');
}

async function copyPrompt() {
  const prompt = buildPrompt();
  if (!prompt) return;
  flash(await copyText(prompt)
    ? 'Contexto copiado. Você pode colá-lo no ChatGPT.'
    : 'Não foi possível copiar o contexto.');
}

function prepareChatLink(event) {
  const prompt = buildPrompt();
  if (!prompt) {
    event.preventDefault();
    return;
  }
  const destination = chatDestination(prompt);
  event.currentTarget.href = destination.url;
  if (destination.direct) {
    flash('ChatGPT aberto com o contexto. Confira e envie a mensagem se necessário.');
  } else {
    copyText(prompt).then(ok => flash(ok
      ? 'ChatGPT aberto. Contexto extenso copiado: cole com Ctrl+V e envie.'
      : 'ChatGPT aberto, mas a cópia foi bloqueada. Use “Copiar contexto completo” e cole.'));
  }
}

function openChatFromKeyboard() {
  const prompt = buildPrompt();
  if (!prompt) return;
  const destination = chatDestination(prompt);
  window.open(destination.url, '_blank', 'noopener,noreferrer');
  if (destination.direct) {
    flash('ChatGPT aberto com o contexto. Confira e envie a mensagem se necessário.');
  } else {
    copyText(prompt).then(ok => flash(ok
      ? 'ChatGPT aberto. Contexto extenso copiado: cole com Ctrl+V e envie.'
      : 'ChatGPT aberto. Use “Copiar contexto completo” e cole.'));
  }
}

function resetLocal() {
  clearDraft(storage);
  world = structuredClone(base);
  journey = [];
  messageId = '';
  $('dialogue').value = '';
  $('counter').textContent = '0/100';
  drawAll();
  flash('Rascunho descartado. Estado restaurado do último commit do GitHub.');
}

async function refreshWorld() {
  let remote;
  let online = false;
  try {
    const res = await fetch(`./world.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    remote = await res.json();
    validateWorld(remote);
    cacheWorld(storage, remote);
    online = true;
  } catch {
    remote = cachedWorld(storage) || makeWorld();
  }
  base = remote;
  const restored = restoreDraft(storage, base);
  world = restored.world;
  journey = restored.journey;
  messageId = restored.commandId;
  $('dialogue').value = restored.dialogue;
  $('counter').textContent = `${chars(restored.dialogue)}/100`;
  $('status').textContent = online ? 'mundo online · estável' : 'mundo em cache · offline';
  $('status').classList.toggle('offline', !online);
  drawAll();

  if (restored.status === 'conflict') flash('O mundo avançou no GitHub. O rascunho antigo foi guardado como backup, sem ser aplicado por cima.');
  else if (restored.status === 'invalid') flash('Rascunho local inválido. O mundo oficial foi preservado.');
  else if (restored.status === 'committed') flash('Commit reconhecido. Seu progresso já está no mundo oficial!');
  else if (restored.status === 'restored') flash('Exploração, energia e descanso restaurados deste navegador.');
  else if (!online) flash('Sem conexão com world.json. Estado em cache local, ainda sem sincronização.');
  else flash(`Mundo online carregado na revisão ${base.revision}.`);
}

$('dialogue').addEventListener('input', () => {
  const len = chars($('dialogue').value);
  $('counter').textContent = `${len}/100`;
  $('counter').classList.toggle('over', len > 100);
  messageId = '';
  persistDraft();
});
$('open-chat').addEventListener('click',prepareChatLink);
$('copy-prompt').addEventListener('click', copyPrompt);
$('reset-path').addEventListener('click', resetLocal);
$('rest-btn').addEventListener('click', restDay);
$('save-journey').addEventListener('click', copyJourney);
$('refresh-world').addEventListener('click', refreshWorld);
$('dialogue').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    openChatFromKeyboard();
  }
});

await refreshWorld();