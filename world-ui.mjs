/** Interface do atlas: revela somente o conhecimento comprovado do Viajante. */
import { buildAtlas, CONTINENTS, CULTURES, BIOMES } from './world-geography.mjs';
import { knownEnvironment, discoverySummary } from './world-view.mjs';
const SVG_NS='http://www.w3.org/2000/svg';
const el=(tag,attrs={})=>{const n=document.createElementNS(SVG_NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n};
const nameFor=(id,list)=>list.find(x=>x.id===id)?.name||'Território não catalogado';
export function updateWorldPanel(world){
 const summary=discoverySummary(world);
 const $=id=>document.getElementById(id);
 if($('atlas-count'))$('atlas-count').textContent=`${summary.charted.toLocaleString('pt-BR')} de ${summary.total.toLocaleString('pt-BR')} hexágonos`;
 if($('atlas-progress'))$('atlas-progress').textContent=`${summary.percent.toFixed(2).replace('.',',')}% cartografado`;
 if($('atlas-sites'))$('atlas-sites').textContent=String(summary.sites);
 const env=knownEnvironment(world,world.player.position.q,world.player.position.r);
 if(!env)return;
 if($('atlas-region'))$('atlas-region').textContent=nameFor(env.region,CONTINENTS)||'Ilha';
 if($('atlas-biome'))$('atlas-biome').textContent=nameFor(env.biome,BIOMES);
 if($('atlas-culture'))$('atlas-culture').textContent=env.culture?nameFor(env.culture,CULTURES):'Nenhum vestígio cultural identificado';
 if($('atlas-fauna'))$('atlas-fauna').textContent=env.ecology.fauna.length?env.ecology.fauna.join(' · '):'Sem espécies catalogadas neste habitat';
 if($('atlas-flora'))$('atlas-flora').textContent=env.ecology.flora.length?env.ecology.flora.join(' · '):'Sem espécies catalogadas neste habitat';
 if($('atlas-find'))$('atlas-find').textContent=env.site?`Descoberto: ${env.site.name}`:'Nenhuma descoberta singular registrada aqui';
 if($('atlas-vessel'))$('atlas-vessel').textContent=world.player.vessel==='jangada'?'Jangada disponível · navegação: 2 energia':'Sem embarcação · jangada exige 5 madeiras e 1 pedra perto da água';
}
export function drawWorldAtlas(world){
 const svg=document.getElementById('world-atlas');
 if(!svg)return;
 svg.replaceChildren();
 svg.setAttribute('viewBox','0 0 760 640');
 const center={x:380,y:320};
 const pos=({q,r})=>({x:center.x+5.8*(q+r/2),y:center.y+5.03*r});
 const outline=[{q:60,r:0},{q:60,r:-60},{q:0,r:-60},{q:-60,r:0},{q:-60,r:60},{q:0,r:60}];
 const polygon=el('polygon',{points:outline.map(p=>{const c=pos(p);return `${c.x},${c.y}`}).join(' '),fill:'#15201a',stroke:'#98784b','stroke-width':1.6,'stroke-dasharray':'4 4',opacity:.87});
 svg.append(polygon);
 const fog=el('text',{x:center.x,y:80,'text-anchor':'middle',fill:'#7b917c','font-size':16,'letter-spacing':3});fog.textContent='TERRITÓRIO INEXPLORADO';svg.append(fog);
 const known=world.hexes.filter(h=>h.discovered);
 for(const h of known){
  const p=pos(h);
  const color=h.visited?'#f3cb80':h.terrain==='oceano'||h.terrain==='lago'?'#5ca4b7':'#73a77d';
  const dot=el('circle',{cx:p.x,cy:p.y,r:h.visited?3.4:2.8,fill:color,opacity:.85});
  const title=el('title');title.textContent=`${h.q}, ${h.r}: ${h.terrain}`;dot.append(title);svg.append(dot);
 }
 const player=pos(world.player.position);
 svg.append(el('circle',{cx:player.x,cy:player.y,r:9,fill:'none',stroke:'#f3d68d','stroke-width':1.8,opacity:.85}));
 svg.append(el('circle',{cx:player.x,cy:player.y,r:4.6,fill:'#ffdf9b',stroke:'#402d13','stroke-width':1.4}));
 const summary=discoverySummary(world);
 const label=el('text',{x:center.x,y:600,'text-anchor':'middle',fill:'#d7c7a0','font-size':14});
 label.textContent=`${summary.charted.toLocaleString('pt-BR')} / 10.981 áreas reveladas · O restante permanece em segredo`;
 svg.append(label);
}
export function bindWorldAtlas(getWorld){
 const button=document.getElementById('open-atlas'),panel=document.getElementById('atlas-dialog'),close=document.getElementById('close-atlas');
 if(!button||!panel||!close)return;
 const hide=()=>{panel.hidden=true;button.focus()};
 button.addEventListener('click',()=>{drawWorldAtlas(getWorld());panel.hidden=false;close.focus()});
 close.addEventListener('click',hide);
 panel.addEventListener('click',ev=>{if(ev.target===panel)hide()});
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!panel.hidden)hide()});
}