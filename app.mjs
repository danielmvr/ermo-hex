import { makeWorld, axialDistance, tileKey, TERRAINS, COSTS, ENERGY_MAX, MAX_JOURNEY, ACTION_ENERGY, energyOf, validateWorld, simulateJourney } from './engine.mjs';
import { cachedWorld, cacheWorld, saveDraft, clearDraft, restoreDraft, CONFLICT_KEY } from './persistence.mjs';
import { buildInterpreterPrompt, chatDestination } from './chat-link.mjs';

const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const SIZE = 31.5;
const TERRAIN_STYLE = {
  campina: { fill:'#6f8e68', symbol:'✿' },
  floresta: { fill:'#315f4f', symbol:'♠' },
  colinas: { fill:'#857b5d', symbol:'◆' },
  montanha: { fill:'#65767d', symbol:'▲' },
  lago: { fill:'#316f84', symbol:'≈' },
  ruinas: { fill:'#896c69', symbol:'⌂' },
};
let base;
let world;
let journey = [];
let storage;
try {storage = window.localStorage;} catch {storage = null;}
const stepsCount = () => journey.filter(e=>e.type==='mover').length;
const restCount = () => journey.filter(e=>e.type==='descansar').length;
let hoveredKey = null;
let messageId = '';
const chars = s => [...s].length;
const dom = (tag, attrs = {}, text = '') => {
  const el = document.createElementNS(svgNS,tag);
  for (const [key,val] of Object.entries(attrs)) el.setAttribute(key, String(val));
  if (text) el.textContent = text;
  return el;
};
const coords = ({q,r}) => ({ x: 415 + Math.sqrt(3)*SIZE*(q+r/2), y: 311 + 1.5*SIZE*r });
const points = ({x,y},radius=SIZE-1.7) => Array.from({length:6},(_,i) => {
  const t = (Math.PI / 180)*(60*i-30);
  return `${(x+radius*Math.cos(t)).toFixed(2)},${(y+radius*Math.sin(t)).toFixed(2)}`;
}).join(' ');
const getHex = p => world.hexes.find(h => h.q === p.q && h.r === p.r);
const isAdjacent = h => axialDistance(h, world.player.position) === 1;

function revealNeighbors(pos) {
  for (const h of world.hexes) if (axialDistance(h,pos) <= 1) h.discovered = true;
}
function drawMap() {
  const map = $('hexmap'); map.replaceChildren();
  const paths = dom('g');
  for (const h of world.hexes) {
    const p = coords(h);
    const active = h.q === world.player.position.q && h.r === world.player.position.r;
    const adjacent = isAdjacent(h);
    const fg = dom('g', {class: ['tile',h.discovered?'known':'unknown',adjacent?'adjacent':'',active?'active':''].join(' '),tabindex:0,role:'button','aria-label': `${h.discovered ? (h.name||TERRAINS[h.terrain].name) : 'Terreno não descoberto'}, coordenadas ${h.q}, ${h.r}`});
    const poly = dom('polygon', {points:points(p), fill: h.discovered ? TERRAIN_STYLE[h.terrain].fill : '#17282b', stroke: active ? '#e9bf78' : adjacent ? '#adbb9b' : '#354b4c', 'stroke-width':active?3:adjacent?1.7:1 });
    fg.append(poly);
    if (h.discovered) {
      fg.append(dom('text',{x:p.x, y:p.y+6,'text-anchor':'middle','font-size':h.terrain==='floresta'?25:22,fill:h.terrain==='montanha'?'#dae0d4':'#e9e6ce','pointer-events':'none',opacity:.86},TERRAIN_STYLE[h.terrain].symbol));
      if (h.structures.length) fg.append(dom('circle',{cx:p.x+17,cy:p.y-18,r:5,fill:'#efc47d',stroke:'#24332c','stroke-width':1.2}));
      if (h.visited) fg.append(dom('circle',{cx:p.x-17,cy:p.y+18,r:2.8,fill:'#dbd3ac',opacity:.8}));
    } else {
      fg.append(dom('text',{x:p.x,y:p.y+6,'text-anchor':'middle','font-size':20,fill:adjacent?'#a8bcae':'#455b57','pointer-events':'none'},'?'));
    }
    const title = dom('title');
    title.textContent = h.discovered ? `${h.name || TERRAINS[h.terrain].name} (${h.q}, ${h.r})` : `Desconhecido (${h.q}, ${h.r})`;
    fg.append(title);
    fg.addEventListener('click',()=>chooseHex(h));
    fg.addEventListener('keydown', e=>{if(e.key==='Enter'||e.key===' ') {e.preventDefault(); chooseHex(h);}});
    fg.addEventListener('mouseenter',()=>{hoveredKey=tileKey(h); showHexInfo(h);});
    fg.addEventListener('mouseleave',()=>{hoveredKey=null; showHexInfo(getHex(world.player.position));});
    paths.append(fg);
  }
  map.append(paths);
  const pos = coords(world.player.position);
  const pulse = dom('circle',{cx:pos.x,cy:pos.y,r:17,fill:'none',stroke:'#f2cb8a','stroke-width':2,class:'hero-pulse','pointer-events':'none'});
  map.append(pulse);
  map.append(dom('circle',{cx:pos.x,cy:pos.y,r:11,fill:'#f4d6a1',stroke:'#2a2c27','stroke-width':3,'pointer-events':'none'}));
  map.append(dom('text',{x:pos.x,y:pos.y+4.5,fill:'#28332c','font-size':14,'font-weight':'900','text-anchor':'middle','pointer-events':'none'},'✦'));
}
function recordJourney(nextEvent, message) {
  try {
    const result=simulateJourney(base,[...journey,nextEvent]);
    journey=[...journey,nextEvent];
    world=result.world;
    messageId='';
    persistDraft();
    drawAll();
    flash(message);
  } catch(error) {flash(error.message);}
}
function chooseHex(h) {
  if (h.q === world.player.position.q && h.r === world.player.position.r) {showHexInfo(h);return;}
  if (!isAdjacent(h)) {flash('Escolha um hexágono vizinho para caminhar.');return;}
  if (!TERRAINS[h.terrain].walkable) {flash('Água profunda. Não é possível atravessar este hexágono.');return;}
  if (energyOf(world)===0) {flash('Sem energia. Use Descansar para iniciar um novo dia.');return;}
  if (journey.length>=MAX_JOURNEY) {flash('Limite da jornada atingido. Registre o progresso no GitHub.');return;}
  recordJourney({type:'mover',q:h.q,r:h.r},`Território: ${h.name || TERRAINS[h.terrain].name}. Exploração salva neste navegador.`);
}
function restDay() {
  if (energyOf(world)!==0) {flash('Descanso disponível somente quando a energia chega a zero.');return;}
  if (journey.length>=MAX_JOURNEY) {flash('Registre a jornada atual antes de continuar.');return;}
  recordJourney({type:'descansar'},'Descanso concluído: um novo dia começou. Progresso salvo no navegador.');
}
function persistDraft() {
  if (!saveDraft(storage,base,journey,$('dialogue').value,messageId)) {
    $('status').textContent='SALVAMENTO LOCAL INDISPONÍVEL';
    $('status').classList.add('offline');
  }
}

function showHexInfo(h) {
  if (!h) return;
  $('tile-title').textContent = h.discovered ? (h.name||TERRAINS[h.terrain].name) : 'Terra desconhecida';
  $('tile-coords').textContent = `HEX ${h.q >= 0 ? '+' : ''}${h.q} / ${h.r >= 0 ? '+' : ''}${h.r}`;
  $('tile-desc').textContent = !h.discovered ? 'Caminhe até este local para revelar a região.' : h.structures.length ? `Estruturas: ${h.structures.join(', ')}.` : 'Ainda não há construções registradas neste hexágono.';
  $('tile-resources').textContent = h.discovered ? `Madeira ${h.resources.madeira}  ·  Pedra ${h.resources.pedra}  ·  Alimento ${h.resources.alimento}` : 'Recursos não identificados';
}
function drawAll() {
  drawMap();
  showHexInfo(getHex(world.player.position));
  $('day').textContent=`Dia ${world.day}`;
  $('revision').textContent = `r${base.revision}`;
  $('discovered').textContent=String(world.hexes.filter(h=>h.discovered).length).padStart(2,'0');
  $('total').textContent=String(world.hexes.length);
  $('steps').textContent=String(stepsCount());
  $('position').textContent=`${world.player.position.q}, ${world.player.position.r}`;
  const energy=energyOf(world);
  $('energy-value').textContent=`${energy}/${ENERGY_MAX}`;
  $('energy-meter').value=energy;
  $('energy-meter').max=ENERGY_MAX;
  $('rest-btn').disabled=energy!==0 || journey.length>=MAX_JOURNEY;
  $('save-journey').hidden=journey.length===0;
  for (const k of ['madeira','pedra','alimento']) $(k).textContent=world.player.inventory[k];
  $('local-warning').hidden=journey.length===0;
  $('local-warning').textContent=journey.length ? `↳ ${stepsCount()} passos e ${restCount()} descansos salvos neste navegador, mas ainda sem commit. Registre o progresso para sincronizar outros dispositivos.` : '';
  $('day-note').textContent=restCount() ? `${restCount()} descanso(s) ainda sem commit no GitHub.` : 'Somente o descanso avança o calendário.';
  drawHistory();
}

function drawHistory() {
  const list=$('history');list.replaceChildren();
  for (const event of base.events.slice(-3).reverse()) {
    const article=document.createElement('article');article.className='event';
    const title=document.createElement('strong');title.textContent=event.title;
    const detail=document.createElement('p');detail.textContent=event.text;
    const day=document.createElement('span');day.textContent=`DIA ${event.day}`;
    article.append(day,title,detail);list.append(article);
  }
}
function flash(message) {
  $('toast').textContent=message;
  $('toast').classList.add('show');
}
function dialogValue() {return $('dialogue').value.trim();}
function ensureMessageId() {
  if (!messageId) {
    messageId=`acao_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
    persistDraft();
  }
  return messageId;
}
function buildPrompt() {
  const dialogue=dialogValue();
  if (!dialogue) {flash('Escreva o que seu personagem deseja fazer.');return null;}
  if (chars(dialogue)>100) {flash('A mensagem precisa ter no máximo 100 caracteres.');return null;}
  const id=ensureMessageId();
  return buildInterpreterPrompt({base, world, journey, dialogue, commandId:id});
}
function journeyProposal() {
  if (!journey.length) return null;
  const moves=stepsCount(),rests=restCount();
  const summary=[moves ? `${moves} passo(s)` : '',rests ? `${rests} descanso(s)` : ''].filter(Boolean).join(' e ');
  return {
    schema:'ermo.action.v2',baseRevision:base.revision,commandId:ensureMessageId(),
    journey,action:{type:'observar'},
    story:`O viajante registrou sua jornada: ${summary}.`,
    commitMessage:`mundo: registrar jornada com ${moves} passos e ${rests} descansos`
  };
}
async function copyText(text) {
  try {await navigator.clipboard.writeText(text);return true;}
  catch {
    try {const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();document.execCommand('copy');t.remove();return true;}
    catch {return false;}
  }
}
async function copyJourney() {
  const proposal=journeyProposal();
  if (!proposal) {flash('Explore ou descanse antes de registrar uma jornada.');return;}
  const copied=await copyText(JSON.stringify(proposal,null,2));
  flash(copied?'JSON de jornada copiado. Cole no Chat-Commit para salvar no GitHub.':'Não foi possível copiar automaticamente.');
}

async function copyPrompt() {
  const prompt=buildPrompt();if(!prompt)return;
  flash(await copyText(prompt)?'Contexto copiado. Você pode colá-lo no ChatGPT.':'Não foi possível copiar o contexto.');
}
/** Usa um link real para que o clique abra a aba sem depender de pop-ups. */
function prepareChatLink(event) {
  const prompt=buildPrompt();
  if (!prompt) {event.preventDefault();return;}
  const destination=chatDestination(prompt);
  event.currentTarget.href=destination.url;
  if (destination.direct) {
    flash('ChatGPT aberto com o contexto. Confira e envie a mensagem se necessário.');
  } else {
    // O navegador abre o ChatGPT pelo link nativo, mesmo quando o contexto excede a URL.
    copyText(prompt).then(ok=>flash(ok
      ? 'ChatGPT aberto. Contexto extenso copiado: cole com Ctrl+V e envie.'
      : 'ChatGPT aberto, mas a cópia foi bloqueada. Use “Copiar contexto completo” e cole.'));
  }
}
function openChatFromKeyboard() {
  const prompt=buildPrompt();if(!prompt)return;
  const destination=chatDestination(prompt);
  // Chamado diretamente por um evento de teclado do usuário.
  window.open(destination.url,'_blank','noopener,noreferrer');
  if (destination.direct) flash('ChatGPT aberto com o contexto. Confira e envie a mensagem se necessário.');
  else copyText(prompt).then(ok=>flash(ok
    ? 'ChatGPT aberto. Contexto extenso copiado: cole com Ctrl+V e envie.'
    : 'ChatGPT aberto. Use “Copiar contexto completo” e cole.'));
}
function resetLocal() {
  clearDraft(storage);
  world=structuredClone(base);
  journey=[];messageId='';$('dialogue').value='';$('counter').textContent='0/100';
  drawAll();flash('Rascunho descartado. Estado restaurado do último commit do GitHub.');
}
async function refreshWorld() {
  let remote;
  let online=false;
  try {
    const res=await fetch(`./world.json?v=${Date.now()}`,{cache:'no-store'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    remote=await res.json();
    validateWorld(remote);
    cacheWorld(storage,remote);
    online=true;
  } catch {
    remote=cachedWorld(storage) || makeWorld();
  }
  base=remote;
  const restored=restoreDraft(storage,base);
  world=restored.world;
  journey=restored.journey;
  messageId=restored.commandId;
  $('dialogue').value=restored.dialogue;
  $('counter').textContent=`${chars(restored.dialogue)}/100`;
  $('status').textContent=online?'MUNDO ONLINE / GITHUB':'MUNDO EM CACHE / OFFLINE';
  $('status').classList.toggle('offline',!online);
  drawAll();
  if (restored.status==='conflict') flash('O mundo avançou no GitHub. O rascunho antigo foi guardado como backup, sem ser aplicado por cima.');
  else if(restored.status==='invalid') flash('Rascunho local inválido. O mundo oficial foi preservado.');
  else if(restored.status==='committed') flash('Commit reconhecido. Seu progresso já está no mundo oficial!');
  else if(restored.status==='restored') flash('Exploração e energia restauradas deste navegador.');
  else if(!online) flash('Sem conexão com world.json. Estado em cache local, ainda sem sincronização.');
  else flash(`Mundo online carregado na revisão ${base.revision}.`);
}

$('dialogue').addEventListener('input',()=>{
  const len=chars($('dialogue').value);
  $('counter').textContent=`${len}/100`;
  $('counter').classList.toggle('over',len>100);
  messageId='';
  persistDraft();
});
$('open-chat').addEventListener('click',prepareChatLink);
$('copy-prompt').addEventListener('click',copyPrompt);
$('reset-path').addEventListener('click',resetLocal);
$('rest-btn').addEventListener('click',restDay);
$('save-journey').addEventListener('click',copyJourney);
$('refresh-world').addEventListener('click',refreshWorld);
$('dialogue').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();openChatFromKeyboard();}});
await refreshWorld();