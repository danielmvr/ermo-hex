/** Camada de leitura: não grava tiles ocultos e nunca expõe segredos antecipadamente. */
import { ATLAS_CELLS, ATLAS_RADIUS, atlasDistance, isInAtlas, generatedHex, buildAtlas, nearbyFaunaFlora } from './world-geography.mjs';
export { ATLAS_CELLS, ATLAS_RADIUS };
export function observedHex(world,q,r){
 const recorded=world.hexes.find(h=>h.q===q&&h.r===r);
 if(recorded)return recorded;
 return generatedHex(world.seed,q,r);
}
export function visibleHexes(world,radius=9){
 const center=world.player.position;
 const byKey=new Map(world.hexes.map(h=>[`${h.q},${h.r}`,h]));
 const result=[];
 for(let q=center.q-radius;q<=center.q+radius;q++){
  for(let r=center.r-radius;r<=center.r+radius;r++){
   if(!isInAtlas(q,r)||atlasDistance({q,r},center)>radius)continue;
   result.push(byKey.get(`${q},${r}`)||generatedHex(world.seed,q,r));
  }
 }
 return result;
}
export function knownSite(world,q,r){
 const h=world.hexes.find(h=>h.q===q&&h.r===r);
 if(!h?.visited)return null;
 const site=buildAtlas(world.seed).siteAt(q,r);
 return site && world.discoveries?.includes(site.id)?site:null;
}
export function knownEnvironment(world,q,r){
 const h=world.hexes.find(h=>h.q===q&&h.r===r);
 if(!h?.visited)return null;
 const tile=buildAtlas(world.seed).get(q,r);
 if(!tile)return null;
 return {
  region:tile.region,biome:tile.biome,culture:tile.culture,
  ecology:nearbyFaunaFlora(world.seed,q,r),
  site:knownSite(world,q,r)
 };
}
export function discoverySummary(world){
 const charted=world.hexes.filter(h=>h.discovered).length;
 const visited=world.hexes.filter(h=>h.visited).length;
 return {charted,visited,total:ATLAS_CELLS,percent:Math.round((charted/ATLAS_CELLS)*10000)/100,sites:world.discoveries?.length||0};
}