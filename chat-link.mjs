/** Link curto do ChatGPT: só fala, jornada local e URL do contexto oficial. */
export const CHATGPT_BASE_URL = 'https://chatgpt.com/';
export const WORLD_CONTEXT_URL = 'https://github.com/danielmvr/ermo-hex/blob/main/WORLD_CONTEXT.md';
export const CHATGPT_URL_LIMIT = 7000;
export const MAX_MESSAGE_CHARS = 100;
export const MAX_LOCAL_EVENTS = 60;

/** Nunca bloqueia a abertura da aba: link direto se curto, link básico com cópia caso exceda o limite. */
export function chatDestination(prompt, maxLength = CHATGPT_URL_LIMIT) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Mensagem vazia.');
  const url = CHATGPT_BASE_URL + '?q=' + encodeURIComponent(prompt);
  return url.length <= maxLength
    ? { url, direct:true, length:url.length }
    : { url:CHATGPT_BASE_URL, direct:false, length:url.length };
}

/** Não transmite inventário, bioma, recursos nem eventos: o GitHub mantém a fonte oficial. */
export function buildInterpreterPrompt({ base, journey, dialogue, commandId }) {
  if (typeof dialogue !== 'string' || !dialogue.trim() || [...dialogue.trim()].length > MAX_MESSAGE_CHARS) {
    throw new Error('Digite uma fala de 1 a 100 caracteres.');
  }
  if (!Number.isInteger(base?.revision) || base.revision<0) throw new Error('Revisão do mundo indisponível.');
  if (typeof commandId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(commandId)) throw new Error('Identificador de jornada inválido.');
  if (!Array.isArray(journey) || journey.length>MAX_LOCAL_EVENTS) throw new Error('Jornada excede o limite de 60 eventos.');
  for(const event of journey) {
    if(!event || typeof event!=='object' ||
      !['mover','navegar','descansar'].includes(event.type)) throw new Error('Evento desconhecido na jornada.');
  }
  const record = { baseRevision:base.revision, commandId, journey };
  return [
    'ERMO: consulte o contexto oficial e siga o contrato JSON nele descrito.',
    'CONTEXTO: '+WORLD_CONTEXT_URL,
    'FALA: '+JSON.stringify(dialogue.trim()),
    'JORNADA: '+JSON.stringify(record),
    'Se o contexto não puder ser acessado, informe sem inventar dados ou afirmar commit.'
  ].join('\n');
}
