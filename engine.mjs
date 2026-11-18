import { ATLAS_RADIUS, isInAtlas, generatedHex, buildAtlas, atlasDistance } from './world-geography.mjs';
/** ERMO: regras determinísticas compartilhadas pelo navegador e pelo validador de commits. */
export const SCHEMA = 'ermo.world.v1';
export const PROPOSAL_SCHEMA = 'ermo.action.v3';
export const V2_PROPOSAL_SCHEMA = 'ermo.action.v2';
export const LEGACY_PROPOSAL_SCHEMA = 'ermo.action.v1';
export const ENERGY_MAX = 12;
export const HUNGER_MAX = 3;
export const MAX_JOURNEY = 60;
export const ACTION_ENERGY = Object.freeze({ coletar: 1, construir: 2, nomear: 1, observar: 0, comer: 0 });
/** Primeira noite sem refeição conserva o vigor; fome acumulada compromete o próximo descanso. */
export const REST_ENERGY = Object.freeze([12, 12, 9, 6]);
export const TERRAINS = {
  campina: { name: 'Campina', resources: { madeira: 2, pedra: 1, alimento: 5 }, walkable: true },
  floresta: { name: 'Floresta', resources: { madeira: 7, pedra: 1, alimento: 2 }, walkable: true },
  colinas: { name: 'Colinas', resources: { madeira: 2, pedra: 5, alimento: 1 }, walkable: true },
  montanha: { name: 'Montanha', resources: { madeira: 0, pedra: 7, alimento: 0 }, walkable: true },
  lago: { name: 'Lago', resources: { madeira: 0, pedra: 0, alimento: 3 }, walkable: false },
  oceano: { name: 'Oceano', resources: { madeira: 0, pedra: 0, alimento: 0 }, walkable: false },
  ruinas: { name: 'Ruínas', resources: { madeira: 1, pedra: 3, alimento: 0 }, walkable: true }
};
export const COSTS = {
  abrigo: { madeira: 3, pedra: 1 },
  fogueira: { madeira: 1, pedra: 1 },
  marco: { pedra: 2 },
  horta: { madeira: 1, alimento: 1 },
  jangada: { madeira: 5, pedra: 1 }
};
export const tileKey = ({ q, r }) => `${q},${r}`;
export const axialDistance = (a, b) => Math.max(Math.abs(a.q-b.q), Math.abs(a.r-b.r), Math.abs((a.q+a.r)-(b.q+b.r)));
const integer = x => Number.isInteger(x);
const cleanText = (v, max) => typeof v === 'string' && v.trim().length > 0 && [...v.trim()].length <= max && !/[\u0000-\u001F\u007F]/.test(v);
function exactKeys(obj, allowed) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Objeto malformado.');
  const extra = Object.keys(obj).filter(k => !allowed.includes(k));
  if (extra.length) throw new Error(`Campos não autorizados: ${extra.join(', ')}`);
}
function hash(q, r, seed) {
  let h = 2166136261;
  for (const c of `${seed}|${q}|${r}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
export function makeWorld(seed = 'ermo-001', radius = 5) {
  const hexes = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q-radius); r <= Math.min(radius, -q+radius); r++) {
      const h = hash(q,r,seed);
      let terrain = h < .31 ? 'campina' : h < .57 ? 'floresta' : h < .78 ? 'colinas' : h < .87 ? 'montanha' : h < .95 ? 'lago' : 'ruinas';
      if (axialDistance({q,r},{q:0,r:0}) <= 1 && terrain === 'lago') terrain = 'campina';
      if (q === 0 && r === 0) terrain = 'campina';
      hexes.push({ q, r, terrain, discovered: axialDistance({q,r},{q:0,r:0}) <= 1, visited: q === 0 && r === 0, name: '', resources: { ...TERRAINS[terrain].resources }, structures: [] });
    }
  }
  return {
    schema: SCHEMA, revision: 0, day: 1, seed, radius,
    player: { id: 'pioneiro', name: 'Viajante', position: { q:0, r:0 }, energy: ENERGY_MAX, hunger: 0, inventory: { madeira: 3, pedra: 2, alimento: 2 } },
    hexes, events: [{ id: 'origem', day: 1, title: 'O primeiro despertar', text: 'Um viajante acordou em uma terra sem nome. O resto ainda não aconteceu.', q: 0, r: 0 }]
  };
}
/** Mundo legado (antes da energia) começa com a barra cheia sem modificar outras informações. */
export function energyOf(world) { return world.player.energy === undefined ? ENERGY_MAX : world.player.energy; }
export function hungerOf(world) { return world.player.hunger === undefined ? 0 : world.player.hunger; }
export function validateWorld(world) {
  if (!world || world.schema !== SCHEMA || !integer(world.revision) || world.revision < 0 || !integer(world.day) || world.day < 1 || !integer(world.radius) || world.radius < 1) throw new Error('world.json inválido.');
  if (!Array.isArray(world.hexes) || !world.player?.position || !world.player?.inventory || !Array.isArray(world.events)) throw new Error('Estrutura do mundo inválida.');
  const seen = new Set();
  for (const hex of world.hexes) {
    const k = tileKey(hex);
    if (!integer(hex.q) || !integer(hex.r) || seen.has(k) || axialDistance(hex,{q:0,r:0}) > Math.max(world.radius,ATLAS_RADIUS) || !TERRAINS[hex.terrain]) throw new Error(`Hexágono inválido: ${k}`);
    seen.add(k);
    if (axialDistance(hex,{q:0,r:0}) > world.radius) {
      const canonical=buildAtlas(world.seed).get(hex.q,hex.r);
      if (!canonical || canonical.terrain!==hex.terrain || canonical.biome!==hex.biome ||
          canonical.region!==hex.region) throw new Error('Geografia externa divergente do atlas canônico.');
    }
    if (typeof hex.discovered !== 'boolean' || typeof hex.visited !== 'boolean' || !Array.isArray(hex.structures) || typeof hex.name !== 'string') throw new Error(`Dados de hexágono inválidos: ${k}`);
    for (const res of Object.keys(TERRAINS.campina.resources)) if (!integer(hex.resources?.[res]) || hex.resources[res] < 0) throw new Error(`Recursos inválidos: ${k}`);
  }
  if (!integer(world.player.position.q) || !integer(world.player.position.r) || !seen.has(tileKey(world.player.position))) throw new Error('Jogador fora do mapa.');
  if (!integer(energyOf(world)) || energyOf(world) < 0 || energyOf(world) > ENERGY_MAX) throw new Error('Energia inválida.');
  if (!integer(hungerOf(world)) || hungerOf(world) < 0 || hungerOf(world) > HUNGER_MAX) throw new Error('Fome inválida.');
  for (const res of ['madeira','pedra','alimento']) if (!integer(world.player.inventory[res]) || world.player.inventory[res] < 0) throw new Error('Inventário inválido.');
  if (world.player.vessel !== undefined && world.player.vessel !== 'jangada') throw new Error('Embarcação não autorizada.');
  if (world.discoveries !== undefined) {
    if (!Array.isArray(world.discoveries)) throw new Error('Catálogo de descobertas inválido.');
    const ids=new Set();
    const atlas=buildAtlas(world.seed);
    for (const id of world.discoveries) {
      if (typeof id!=='string' || ids.has(id)) throw new Error('Descoberta duplicada ou inválida.');
      ids.add(id);
      const site=atlas.sites.find(s=>s.id===id);
      if (!site || !world.hexes.some(h=>h.q===site.q && h.r===site.r && h.visited)) throw new Error('Descoberta sem visita verificada.');
    }
  }
  if (world.manifestations !== undefined) {
    if (!Array.isArray(world.manifestations) || world.manifestations.length > world.hexes.length) throw new Error('Manifestações inválidas.');
    const locations = new Set();
    const ids = new Set();
    for (const site of world.manifestations) {
      if (!site || !cleanText(site.id, 90) || !cleanText(site.name, 36) ||
          !integer(site.day) || site.day < 1 || site.day > world.day ||
          !integer(site.q) || !integer(site.r) || !seen.has(tileKey(site)) ||
          ids.has(site.id) || locations.has(tileKey(site))) throw new Error('Manifestação persistida inválida.');
      ids.add(site.id); locations.add(tileKey(site));
      if (!world.hexes.find(h => tileKey(h) === tileKey(site)).discovered) throw new Error('Manifestação em terreno oculto.');
    }
  }
  return true;
}

/** Prévia idêntica à aplicação final; jamais aceita que o navegador invente energia/dias. */
export function simulateJourney(original, journey) {
  validateWorld(original);
  if (!Array.isArray(journey) || journey.length > MAX_JOURNEY) throw new Error(`Jornada inválida: máximo ${MAX_JOURNEY} eventos por commit.`);
  const world = structuredClone(original);
  world.player.energy = energyOf(original);
  const byKey = new Map(world.hexes.map(h => [tileKey(h),h]));
  const ensureHex=(q,r)=>{
    const key=tileKey({q,r});
    if(byKey.has(key))return byKey.get(key);
    if(!isInAtlas(q,r))return null;
    const created=generatedHex(world.seed,q,r);
    world.hexes.push(created);byKey.set(key,created);
    return created;
  };
  let position = { ...world.player.position };
  const rests = [];
  const discoveredSites=[];
  let moves = 0;
  for (const event of journey) {
    if (event?.type === 'mover' || event?.type === 'navegar') {
      exactKeys(event, ['type','q','r']);
      if (!integer(event.q) || !integer(event.r)) throw new Error('Coordenada de movimento inválida.');
      const key=tileKey(event);
      const source=byKey.get(tileKey(position));
      let hex=byKey.get(key);
      if(!hex && isInAtlas(event.q,event.r))hex=generatedHex(world.seed,event.q,event.r);
      if (!hex || axialDistance(position,event)!==1) throw new Error(`Passo proibido: ${key}.`);
      const water=!TERRAINS[hex.terrain].walkable;
      if (event.type==='navegar') {
        if (world.player.vessel!=='jangada') throw new Error('Navegação exige jangada construída.');
        if (!water && TERRAINS[source.terrain].walkable) throw new Error('Navegação exige águas adjacentes.');
      } else if (water) throw new Error(`Passo proibido: ${key}.`);
      const energyCost=event.type==='navegar'?2:1;
      if (world.player.energy < energyCost) throw new Error('Energia esgotada. Descanse antes de caminhar.');
      const reached=ensureHex(event.q,event.r);
      world.player.energy-=energyCost;
      reached.discovered=true;
      reached.visited=true;
      for(const near of world.hexes)if(axialDistance(event,near)<=1)near.discovered=true;
      for(const [dq,dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const neighbor=ensureHex(event.q+dq,event.r+dr);
        if(neighbor)neighbor.discovered=true;
      }
      const site=buildAtlas(world.seed).siteAt(event.q,event.r);
      if(site && !world.discoveries?.includes(site.id)){
        world.discoveries ??=[];
        world.discoveries.push(site.id);
        discoveredSites.push(site);
      }
      position={q:event.q,r:event.r};
      moves+=1;
    } else if (event?.type === 'descansar') {
      exactKeys(event, ['type']);
      if (world.player.energy !== 0) throw new Error('Descanso permitido somente com energia esgotada.');
      world.day += 1;
      world.player.hunger = Math.min(HUNGER_MAX, hungerOf(world) + 1);
      world.player.energy = REST_ENERGY[world.player.hunger];
      rests.push({day:world.day,q:position.q,r:position.r,hunger:world.player.hunger,energy:world.player.energy});
    } else {
      throw new Error('Evento de jornada não autorizado. Use mover ou descansar.');
    }
  }
  world.player.position = position;
  validateWorld(world);
  return {world, rests, moves, discoveredSites};
}
/** As reações são decisões do agente executor, nunca código livre enviado pelo jogador. */
const INTENSITIES = ['sutil', 'media', 'alta'];
const VERDICTS = ['conceder', 'negar', 'surpreender'];
function validateReaction(reaction) {
  exactKeys(reaction, ['intensity','verdict','title','text','effect']);
  if (!INTENSITIES.includes(reaction.intensity) || !VERDICTS.includes(reaction.verdict) ||
      !cleanText(reaction.title, 68) || !cleanText(reaction.text, 240)) {
    throw new Error('Reação divina inválida: intensidade, veredito ou narrativa.');
  }
  const fx = reaction.effect;
  exactKeys(fx, ['type','resource','amount','q','r','name']);
  const allowed = {
    nenhum:['type'], recurso:['type','resource','amount'],
    energia:['type','amount'], revelar:['type','q','r'],
    manifestar:['type','name'], vetar_acao:['type']
  };
  if (!Object.hasOwn(allowed, fx.type)) throw new Error('Efeito divino não autorizado.');
  exactKeys(fx, allowed[fx.type]);
  if (reaction.intensity === 'sutil' && fx.type !== 'nenhum') throw new Error('Reação sutil não pode alterar recursos ou mapa.');
  if (reaction.intensity !== 'alta' && fx.type === 'manifestar') throw new Error('Manifestação exige intensidade alta.');
  if (fx.type === 'vetar_acao' && (reaction.intensity === 'sutil' || reaction.verdict !== 'negar')) {
    throw new Error('Veto exige reação média/alta e veredito negar.');
  }
  if (fx.type === 'recurso' || fx.type === 'energia') {
    const limit = reaction.intensity === 'alta' ? 3 : 2;
    if (!integer(fx.amount) || fx.amount === 0 || Math.abs(fx.amount) > limit) throw new Error('Quantidade do efeito divino fora do limite.');
    if (fx.type === 'recurso' && !['madeira','pedra','alimento'].includes(fx.resource)) throw new Error('Recurso divino desconhecido.');
  }
  if (fx.type === 'revelar' && (!integer(fx.q) || !integer(fx.r))) throw new Error('Coordenada de revelação inválida.');
  if (fx.type === 'manifestar' && !cleanText(fx.name, 36)) throw new Error('Nome de manifestação inválido.');
  return reaction;
}
function applyReactionEffect(world, reaction, commandId, actionType) {
  const fx = reaction.effect;
  if (fx.type === 'nenhum' || fx.type === 'vetar_acao') return;
  if (fx.type === 'recurso') {
    const total = world.player.inventory[fx.resource] + fx.amount;
    if (total < 0) throw new Error('A reação divina não pode gerar inventário negativo.');
    world.player.inventory[fx.resource] = total;
  } else if (fx.type === 'energia') {
    const total = world.player.energy + fx.amount;
    if (total < 0 || total > ENERGY_MAX) throw new Error('Energia da reação fora dos limites do mundo.');
    world.player.energy = total;
  } else if (fx.type === 'revelar') {
    const tile = world.hexes.find(h => h.q === fx.q && h.r === fx.r);
    const radius = reaction.intensity === 'alta' ? 2 : 1;
    if (!tile || axialDistance(world.player.position, tile) > radius) throw new Error('Revelação divina fora de alcance.');
    tile.discovered = true;
  } else if (fx.type === 'manifestar') {
    const here = world.hexes.find(h => tileKey(h) === tileKey(world.player.position));
    if (world.manifestations?.some(s => tileKey(s) === tileKey(here))) throw new Error('Este local já possui uma manifestação.');
    world.manifestations ??= [];
    world.manifestations.push({
      id: commandId + '_manifestacao', name: fx.name.trim(),
      day: world.day, q: here.q, r: here.r
    });
  }
}

/** Aplica somente ação declarativa, nunca executa código de IA ou do armazenamento local. */
export function applyProposal(original, proposal) {
  validateWorld(original);
  if (proposal?.schema === LEGACY_PROPOSAL_SCHEMA) {
    exactKeys(proposal, ['schema','baseRevision','commandId','movement','action','story','commitMessage']);
  } else if (proposal?.schema === V2_PROPOSAL_SCHEMA) {
    exactKeys(proposal, ['schema','baseRevision','commandId','journey','action','story','commitMessage']);
  } else {
    exactKeys(proposal, ['schema','baseRevision','commandId','journey','action','story','commitMessage','reaction']);
  }
  if (![PROPOSAL_SCHEMA,V2_PROPOSAL_SCHEMA,LEGACY_PROPOSAL_SCHEMA].includes(proposal.schema)) throw new Error('Versão do contrato de ação inválida.');
  if (proposal.baseRevision !== original.revision) throw new Error(`Revisão desatualizada. Esperada ${original.revision}; recebida ${proposal.baseRevision}. Reabra o jogo e refaça a mensagem.`);
  if (!cleanText(proposal.commandId, 64) || !/^[A-Za-z0-9_-]+$/.test(proposal.commandId)) throw new Error('commandId inválido.');
  if (original.events.some(e => e.id === proposal.commandId)) throw new Error('Esta ação já foi aplicada.');
  if (!cleanText(proposal.story, 240) || !cleanText(proposal.commitMessage, 72)) throw new Error('Narrativa ou mensagem de commit inválida.');
  const reaction = proposal.schema === PROPOSAL_SCHEMA ? validateReaction(proposal.reaction) : null;
  const legacy = proposal.schema === LEGACY_PROPOSAL_SCHEMA;
  if (legacy && (!Array.isArray(proposal.movement) || proposal.movement.length > 30)) throw new Error('Rota inválida: máximo 30 passos.');
  const journey = legacy ? proposal.movement.map(step => {
    exactKeys(step,['q','r']);
    return {type:'mover',q:step.q,r:step.r};
  }) : proposal.journey;
  const {world, rests, discoveredSites} = simulateJourney(original,journey);
  const action = proposal.action;
  exactKeys(action, ['type','resource','amount','structure','name']);
  if (!Object.hasOwn(ACTION_ENERGY,action.type)) throw new Error('Ação não permitida.');
  const validParams = {
    coletar: ['type','resource','amount'], construir:['type','structure'], nomear:['type','name'], observar:['type'], comer:['type']
  };
  exactKeys(action,validParams[action.type]);
  const energyCost = ACTION_ENERGY[action.type];
  if (world.player.energy < energyCost) throw new Error(`Energia insuficiente para ${action.type}.`);
  const here = world.hexes.find(h => tileKey(h) === tileKey(world.player.position));
  const inventory = world.player.inventory;
  const beforeAction = reaction?.effect.type === 'vetar_acao' ? {
    inventory: structuredClone(inventory), resources: structuredClone(here.resources),
    structures: [...here.structures], name: here.name, energy: world.player.energy,
    vessel:world.player.vessel, hunger:hungerOf(world)
  } : null;
  if (action.type === 'coletar') {
    if (!['madeira','pedra','alimento'].includes(action.resource) || !integer(action.amount) || action.amount < 1 || action.amount > 3) throw new Error('Coleta inválida: recurso e quantidade de 1 a 3 exigidos.');
    if (here.resources[action.resource] < action.amount) throw new Error('Recurso insuficiente neste hexágono.');
    here.resources[action.resource] -= action.amount;
    inventory[action.resource] += action.amount;
  } else if (action.type === 'construir') {
    if (!Object.hasOwn(COSTS, action.structure)) throw new Error('Construção não permitida.');
    if (here.structures.includes(action.structure)) throw new Error('Estrutura já existe neste local.');
    if (action.structure === 'horta' && !['campina','floresta'].includes(here.terrain)) throw new Error('Horta exige campina ou floresta.');
    if (action.structure === 'jangada') {
      const coast=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]
        .some(([dq,dr])=>{
          const neighbor=world.hexes.find(h=>h.q===here.q+dq&&h.r===here.r+dr);
          const kind=neighbor?.terrain ?? buildAtlas(world.seed).get(here.q+dq,here.r+dr)?.terrain;
          return kind==='oceano'||kind==='lago';
        });
      if(!coast)throw new Error('Jangada só pode ser construída próximo de água.');
      if(world.player.vessel==='jangada')throw new Error('O Viajante já possui uma jangada.');
    }
    for (const [resource, amount] of Object.entries(COSTS[action.structure])) if (inventory[resource] < amount) throw new Error(`Falta ${resource} para construir.`);
    for (const [resource, amount] of Object.entries(COSTS[action.structure])) inventory[resource] -= amount;
    here.structures.push(action.structure);
    if(action.structure==='jangada')world.player.vessel='jangada';
  } else if (action.type === 'nomear') {
    if (!cleanText(action.name, 36)) throw new Error('Nome do local inválido (até 36 caracteres).');
    here.name = action.name.trim();
  } else if (action.type === 'comer') {
    if (inventory.alimento < 1) throw new Error('Sem alimento para fazer uma refeição.');
    inventory.alimento -= 1;
    world.player.hunger = 0;
    world.player.energy = Math.min(ENERGY_MAX, world.player.energy + 2);
  }
  world.player.energy -= energyCost;
  const veto = !!beforeAction;
  if (veto) {
    world.player.inventory = beforeAction.inventory;
    world.player.energy = beforeAction.energy;
    world.player.hunger = beforeAction.hunger;
    here.resources = beforeAction.resources;
    here.structures = beforeAction.structures;
    here.name = beforeAction.name;
    if(beforeAction.vessel===undefined)delete world.player.vessel;
    else world.player.vessel=beforeAction.vessel;
  } else if (reaction) {
    applyReactionEffect(world, reaction, proposal.commandId, action.type);
  }
  world.revision += 1;
  rests.forEach((rest,i) => world.events.push({
    id:`${proposal.commandId}_descanso_${i+1}`,day:rest.day,
    title:'Descanso concluído',
    text:rest.hunger >= 2
      ? 'O Viajante descansou, mas a fome acumulada reduziu seu fôlego a ' + rest.energy + '/12.'
      : 'O Viajante descansou e iniciou um novo dia. A fome agora é ' + rest.hunger + '/3.',
    q:rest.q,r:rest.r
  }));
  discoveredSites.forEach((site,i)=>world.events.push({
    id:`${proposal.commandId}_descoberta_${i+1}`,day:world.day,
    title:'Descoberta: '+site.name,
    text:'Um vestígio foi encontrado e registrado no atlas do ERMO.',
    q:site.q,r:site.r,kind:'discovery'
  }));
  world.events.push({
    id:proposal.commandId, day:world.day,
    title: veto ? 'Intenção contrariada pelo mundo' : proposal.commitMessage.trim(),
    text: veto ? 'O Viajante tentou ' + action.type + ', mas o efeito foi negado. ' + reaction.text.trim() : proposal.story.trim(),
    q:world.player.position.q,r:world.player.position.r
  });
  if (reaction) world.events.push({
    id:proposal.commandId + '_reacao',day:world.day,
    title:reaction.title.trim(),text:reaction.text.trim(),
    q:world.player.position.q,r:world.player.position.r,
    kind:'divine',intensity:reaction.intensity,verdict:reaction.verdict,
    effect:reaction.effect.type
  });
  if (world.events.length > 100) world.events = [world.events[0],...world.events.slice(-99)];
  validateWorld(world);
  return world;
}