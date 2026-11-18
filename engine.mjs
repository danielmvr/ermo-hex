/** ERMO: regras determinísticas compartilhadas pelo navegador e pelo validador de commits. */
export const SCHEMA = 'ermo.world.v1';
export const PROPOSAL_SCHEMA = 'ermo.action.v1';
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
    player: { id: 'pioneiro', name: 'Viajante', position: { q:0, r:0 }, inventory: { madeira: 3, pedra: 2, alimento: 2 } },
    hexes, events: [{ id: 'origem', day: 1, title: 'O primeiro despertar', text: 'Um viajante acordou em uma terra sem nome. O resto ainda não aconteceu.', q: 0, r: 0 }]
  };
}
export function validateWorld(world) {
  if (!world || world.schema !== SCHEMA || !integer(world.revision) || world.revision < 0 || !integer(world.day) || !integer(world.radius)) throw new Error('world.json inválido.');
  if (!Array.isArray(world.hexes) || !world.player?.position || !world.player?.inventory || !Array.isArray(world.events)) throw new Error('Estrutura do mundo inválida.');
  const seen = new Set();
  for (const hex of world.hexes) {
    const k = tileKey(hex);
    if (!integer(hex.q) || !integer(hex.r) || seen.has(k) || axialDistance(hex,{q:0,r:0}) > world.radius || !TERRAINS[hex.terrain]) throw new Error(`Hexágono inválido: ${k}`);
    seen.add(k);
    if (typeof hex.discovered !== 'boolean' || typeof hex.visited !== 'boolean' || !Array.isArray(hex.structures) || typeof hex.name !== 'string') throw new Error(`Dados de hexágono inválidos: ${k}`);
    for (const res of Object.keys(TERRAINS.campina.resources)) if (!integer(hex.resources?.[res]) || hex.resources[res] < 0) throw new Error(`Recursos inválidos: ${k}`);
  }
  if (!seen.has(tileKey(world.player.position))) throw new Error('Jogador fora do mapa.');
  for (const res of ['madeira','pedra','alimento']) if (!integer(world.player.inventory[res]) || world.player.inventory[res] < 0) throw new Error('Inventário inválido.');
  return true;
}
function exactKeys(obj, allowed) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Objeto malformado.');
  const extra = Object.keys(obj).filter(k => !allowed.includes(k));
  if (extra.length) throw new Error(`Campos não autorizados: ${extra.join(', ')}`);
}
/** Aplica somente uma ação declarativa, nunca executa código recebido de IA. */
export function applyProposal(original, proposal) {
  validateWorld(original);
  exactKeys(proposal, ['schema','baseRevision','commandId','movement','action','story','commitMessage']);
  if (proposal.schema !== PROPOSAL_SCHEMA) throw new Error('Versão do contrato de ação inválida.');
  if (proposal.baseRevision !== original.revision) throw new Error(`Revisão desatualizada. Esperada ${original.revision}; recebida ${proposal.baseRevision}. Reabra o jogo e refaça a mensagem.`);
  if (!cleanText(proposal.commandId, 64) || !/^[A-Za-z0-9_-]+$/.test(proposal.commandId)) throw new Error('commandId inválido.');
  if (original.events.some(e => e.id === proposal.commandId)) throw new Error('Esta ação já foi aplicada.');
  if (!Array.isArray(proposal.movement) || proposal.movement.length > 30) throw new Error('Rota inválida: máximo 30 passos.');
  if (!cleanText(proposal.story, 240) || !cleanText(proposal.commitMessage, 72)) throw new Error('Narrativa ou mensagem de commit inválida.');
  exactKeys(proposal.action, ['type','resource','amount','structure','name']);
  const world = structuredClone(original);
  const byKey = new Map(world.hexes.map(h => [tileKey(h),h]));
  let position = world.player.position;
  for (const step of proposal.movement) {
    exactKeys(step, ['q','r']);
    if (!integer(step.q) || !integer(step.r)) throw new Error('Coordenada de movimento inválida.');
    const hex = byKey.get(tileKey(step));
    if (!hex || axialDistance(position, step) !== 1 || !TERRAINS[hex.terrain].walkable) throw new Error(`Passo proibido: ${tileKey(step)}.`);
    hex.discovered = true; hex.visited = true;
    // Ao se movimentar, visualiza a vizinhança, mas não a visita.
    for (const neighbor of world.hexes) if (axialDistance(step,neighbor) <= 1) neighbor.discovered = true;
    position = {q: step.q,r:step.r};
  }
  world.player.position = { ...position };
  const here = byKey.get(tileKey(position));
  const action = proposal.action;
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
  } else if (action.type !== 'observar') {
    throw new Error('Ação não permitida. Use coletar, construir, nomear ou observar.');
  }
  world.revision += 1;
  world.day += 1; // Dia avança por interação confirmada, não em tempo real.
  world.events.push({ id: proposal.commandId, day: world.day, title: proposal.commitMessage.trim(), text: proposal.story.trim(), q:position.q, r:position.r });
  if (world.events.length > 100) world.events = [world.events[0], ...world.events.slice(-99)];
  validateWorld(world);
  return world;
}
