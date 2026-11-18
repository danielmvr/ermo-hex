/** Persistência de rascunho local. Não substitui os commits oficiais do GitHub. */
import { validateWorld, simulateJourney } from './engine.mjs';
export const WORLD_KEY = 'ermo.hex.solo.v03.world';
export const DRAFT_KEY = 'ermo.hex.solo.v03.draft';
export const CONFLICT_KEY = 'ermo.hex.solo.v03.conflict';
export function cachedWorld(storage) {
  try {
    const data=storage?.getItem(WORLD_KEY);
    if (!data) return null;
    const world=JSON.parse(data);
    validateWorld(world);
    return world;
  } catch {return null;}
}
export function cacheWorld(storage, world) {
  try {validateWorld(world);storage?.setItem(WORLD_KEY,JSON.stringify(world));return !!storage;} catch {return false;}
}
export function saveDraft(storage, base, journey, dialogue='', commandId='') {
  try {
    if (!storage) return false;
    if (!journey.length && !dialogue.trim()) {storage.removeItem(DRAFT_KEY);return true;}
    const data={schema:'ermo.local.v1',baseRevision:base.revision,journey,dialogue,commandId};
    storage.setItem(DRAFT_KEY,JSON.stringify(data));return true;
  } catch {return false;}
}
export function clearDraft(storage) {
  try {storage?.removeItem(DRAFT_KEY);return true;}catch {return false;}
}
export function restoreDraft(storage, base) {
  const blank={world:structuredClone(base),journey:[],dialogue:'',commandId:'',status:'empty'};
  if (!storage) return {...blank,status:'unavailable'};
  let saved;
  try {const data=storage.getItem(DRAFT_KEY);if(!data)return blank;saved=JSON.parse(data);}catch {return {...blank,status:'unreadable'};}
  if (!saved || saved.schema!=='ermo.local.v1' || !Array.isArray(saved.journey) || typeof saved.dialogue!=='string' || [...saved.dialogue].length>100 || typeof saved.commandId!=='string') return {...blank,status:'invalid'};
  if (saved.baseRevision !== base.revision) {
    if (saved.commandId && base.events.some(e=>e.id===saved.commandId)) {
      clearDraft(storage);
      return {...blank,status:'committed'};
    }
    try {storage.setItem(CONFLICT_KEY,JSON.stringify(saved));storage.removeItem(DRAFT_KEY);}catch {}
    return {...blank,status:'conflict'};
  }
  try {
    const preview=simulateJourney(base,saved.journey).world;
    return {world:preview,journey:saved.journey,dialogue:saved.dialogue,commandId:saved.commandId,status:'restored'};
  } catch {return {...blank,status:'invalid'};}
}