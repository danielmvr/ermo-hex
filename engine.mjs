/** ERMO: regras determinísticas compartilhadas pelo navegador e pelo validador de commits. */
export const SCHEMA = 'ermo.world.v1';
export const PROPOSAL_SCHEMA = 'ermo.action.v2';
export const LEGACY_PROPOSAL_SCHEMA = 'ermo.action.v1';
export const ENERGY_MAX = 12;
export const MAX_JOURNEY = 60;
export const ACTION_ENERGY = Object.freeze({ coletar: 1, construir: 2, nomear: 1, observar: 0 });
export const TERRAINS = {
  campina: { name: 'Campina', resources: { madeira: 2, pedra: 1, alimento: 5 }, walkable: true },
  floresta: { name: 'Floresta', resources: { madeira: 7, pedra: 1, alimento: 2 }, walkable: true },
  colinas: { name: 'Colinas', resources: { madeira: 2, pedra: 5, alimento: 1 }, walkable: true },
  montanha: { name: 'Montanha', resources: { madeira: 0, pedra: 7, alimento: 0 }, walkable: true },
  lago: { name: 'Lago', resources: { madeira: 0, pedra: 0, alimento: 3 }, walkable: false },
  ruinas: { name: 'Ruínas', resources: { madeira: 1, pedra: 3, alimento: 0 }, walkable: true }
};
export const COSTS = {
  abrigo: { madeira: 3, pedra: 1 },
  fogueira: { madeira: 1, pedra: 1 },
  marco: { pedra: 2 },
  horta: { madeira: 1, alimento: 1 }
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
    player: { id: 'pioneiro', name: 'Viajante', position: { q:0, r:0 }, energy: ENERGY_MAX, inventory: { madeira: 3, pedra: 2, alimento: 2 } },
    hexes, events: [{ id: 'origem', day: 1, title: 'O primeiro despertar', text: 'Um viajante acordou em uma terra sem nome. O resto ainda não aconteceu.', q: 0, r: 0 }]
  };
}
/** Mundo legado (antes da energia) começa com a barra cheia sem modificar outras informações. */
export function energyOf(world) { return world.player.energy === undefined ? ENERGY_MAX : world.player.energy; }
export function validateWorld(world) {
  if (!world || world.schema !== SCHEMA || !integer(world.revision) || world.revision < 0 || !integer(world.day) || world.day < 1 || !integer(world.radius) || world.radius < 1) throw new Error('world.json inválido.');
  if (!Array.isArray(world.hexes) || !world.player?.position || !world.player?.inventory || !Array.isArray(world.events)) throw new Error('Estrutura do mundo inválida.');
  const seen = new Set();
  for (const hex of world.hexes) {
    const k = tileKey(hex);
    if (!integer(hex.q) || !integer(hex.r) || seen.has(k) || axialDistance(hex,{q:0,r:0}) > world.radius || !TERRAINS[hex.terrain]) throw new Error(`Hexágono inválido: ${k}`);
    seen.add(k);
    if (typeof hex.discovered !== 'boolean' || typeof hex.visited !== 'boolean' || !Array.isArray(hex.structures) || typeof hex.name !== 'string') throw new Error(`Dados de hexágono inválidos: ${k}`);
    for (const res of Object.keys(TERRAINS.campina.resources)) if (!integer(hex.resources?.[res]) || hex.resources[res] < 0) throw new Error(`Recursos inválidos: ${k}`);
  }
  if (!integer(world.player.position.q) || !integer(world.player.position.r) || !seen.has(tileKey(world.player.position))) throw new Error('Jogador fora do mapa.');
  if (!integer(energyOf(world)) || energyOf(world) < 0 || energyOf(world) > ENERGY_MAX) throw new Error('Energia inválida.');
  for (const res of ['madeira','pedra','alimento']) if (!integer(world.player.inventory[res]) || world.player.inventory[res] < 0) throw new Error('Inventário inválido.');
  return true;
}

/** Prévia idêntica à aplicação final; jamais aceita que o navegador invente energia/dias. */
export function simulateJourney(original, journey) {
  validateWorld(original);
  if (!Array.isArray(journey) || journey.length > MAX_JOURNEY) throw new Error(`Jornada inválida: máximo ${MAX_JOURNEY} eventos por commit.`);
  const world = structuredClone(original);
  world.player.energy = energyOf(original);
  const byKey = new Map(world.hexes.map(h => [tileKey(h),h]));
  let position = { ...world.player.position };
  const rests = [];
  let moves = 0;
  for (const event of journey) {
    if (event?.type === 'mover') {
      exactKeys(event, ['type','q','r']);
      if (!integer(event.q) || !integer(event.r)) throw new Error('Coordenada de movimento inválida.');
      const hex = byKey.get(tileKey(event));
      if (!hex || axialDistance(position,event) !== 1 || !TERRAINS[hex.terrain].walkable) throw new Error(`Passo proibido: ${tileKey(event)}.`);
      if (world.player.energy < 1) throw new Error('Energia esgotada. Descanse antes de caminhar.');
      world.player.energy -= 1;
      hex.discovered = true;
      hex.visited = true;
      for (const near of world.hexes) if (axialDistance(event,near) <= 1) near.discovered = true;
      position = {q:event.q,r:event.r};
      moves += 1;
    } else if (event?.type === 'descansar') {
      exactKeys(event, ['type']);
      if (world.player.energy !== 0) throw new Error('Descanso permitido somente com energia esgotada.');
      world.day += 1;
      world.player.energy = ENERGY_MAX;
      rests.push({day:world.day,q:position.q,r:position.r});
    } else {
      throw new Error('Evento de jornada não autorizado. Use mover ou descansar.');
    }
  }
  world.player.position = position;
  validateWorld(world);
  return {world, rests, moves};
}
/** Aplica somente ação declarativa, nunca executa código de IA ou do armazenamento local. */
export function applyProposal(original, proposal) {
  validateWorld(original);
  if (proposal?.schema === LEGACY_PROPOSAL_SCHEMA) {
    exactKeys(proposal, ['schema','baseRevision','commandId','movement','action','story','commitMessage']);
  } else {
    exactKeys(proposal, ['schema','baseRevision','commandId','journey','action','story','commitMessage']);
  }
  if (![PROPOSAL_SCHEMA,LEGACY_PROPOSAL_SCHEMA].includes(proposal.schema)) throw new Error('Versão do contrato de ação inválida.');
  if (proposal.baseRevision !== original.revision) throw new Error(`Revisão desatualizada. Esperada ${original.revision}; recebida ${proposal.baseRevision}. Reabra o jogo e refaça a mensagem.`);
  if (!cleanText(proposal.commandId, 64) || !/^[A-Za-z0-9_-]+$/.test(proposal.commandId)) throw new Error('commandId inválido.');
  if (original.events.some(e => e.id === proposal.commandId)) throw new Error('Esta ação já foi aplicada.');
  if (!cleanText(proposal.story, 240) || !cleanText(proposal.commitMessage, 72)) throw new Error('Narrativa ou mensagem de commit inválida.');
  const legacy = proposal.schema === LEGACY_PROPOSAL_SCHEMA;
  if (legacy && (!Array.isArray(proposal.movement) || proposal.movement.length > 30)) throw new Error('Rota inválida: máximo 30 passos.');
  const journey = legacy ? proposal.movement.map(step => {
    exactKeys(step,['q','r']);
    return {type:'mover',q:step.q,r:step.r};
  }) : proposal.journey;
  const {world, rests} = simulateJourney(original,journey);
  const action = proposal.action;
  exactKeys(action, ['type','resource','amount','structure','name']);
  if (!Object.hasOwn(ACTION_ENERGY,action.type)) throw new Error('Ação não permitida.');
  const validParams = {
    coletar: ['type','resource','amount'], construir:['type','structure'], nomear:['type','name'], observar:['type']
  };
  exactKeys(action,validParams[action.type]);
  const energyCost = ACTION_ENERGY[action.type];
  if (world.player.energy < energyCost) throw new Error(`Energia insuficiente para ${action.type}.`);
  const here = world.hexes.find(h => tileKey(h) === tileKey(world.player.position));
  const inventory = world.player.inventory;
  if (action.type === 'coletar') {
    if (!['madeira','pedra','alimento'].includes(action.resource) || !integer(action.amount) || action.amount < 1 || action.amount > 3) throw new Error('Coleta inválida: recurso e quantidade de 1 a 3 exigidos.');
    if (here.resources[action.resource] < action.amount) throw new Error('Recurso insuficiente neste hexágono.');
    here.resources[action.resource] -= action.amount;
    inventory[action.resource] += action.amount;
  } else if (action.type === 'construir') {
    if (!Object.hasOwn(COSTS, action.structure)) throw new Error('Construção não permitida.');
    if (here.structures.includes(action.structure)) throw new Error('Estrutura já existe neste local.');
    if (action.structure === 'horta' && !['campina','floresta'].includes(here.terrain)) throw new Error('Horta exige campina ou floresta.');
    for (const [resource, amount] of Object.entries(COSTS[action.structure])) if (inventory[resource] < amount) throw new Error(`Falta ${resource} para construir.`);
    for (const [resource, amount] of Object.entries(COSTS[action.structure])) inventory[resource] -= amount;
    here.structures.push(action.structure);
  } else if (action.type === 'nomear') {
    if (!cleanText(action.name, 36)) throw new Error('Nome do local inválido (até 36 caracteres).');
    here.name = action.name.trim();
  }
  world.player.energy -= energyCost;
  world.revision += 1;
  rests.forEach((rest,i) => world.events.push({id:`${proposal.commandId}_descanso_${i+1}`,day:rest.day,title:'Descanso concluído',text:'O viajante recuperou as forças e um novo dia começou.',q:rest.q,r:rest.r}));
  world.events.push({id:proposal.commandId,day:world.day,title:proposal.commitMessage.trim(),text:proposal.story.trim(),q:world.player.position.q,r:world.player.position.r});
  if (world.events.length > 100) world.events = [world.events[0],...world.events.slice(-99)];
  validateWorld(world);
  return world;
}