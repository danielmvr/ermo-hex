/** ERMO | Mundo Vivo v0.5: atlas determinístico, independente de NPCs e serviços externos. */
export const ATLAS_VERSION = 'ermo.atlas.v1';
export const ATLAS_RADIUS = 60;
export const ATLAS_CELLS = 1 + 3 * ATLAS_RADIUS * (ATLAS_RADIUS + 1);
export const LAND_TARGET = 4392;
export const FRESH_TARGET = 299;
export const OCEAN_TARGET = 6290;

export const CONTINENTS = Object.freeze([
  { id:'origem', name:'Terras de Origem', center:{q:-9,r:-8}, span:[24,21], land:1550, lakes:105, cultures:['guardadores-das-trilhas','casas-do-vale'] },
  { id:'arido', name:'Terras Áridas', center:{q:30,r:-28}, span:[20,18], land:1100, lakes:80, cultures:['povos-do-oasis','navegantes-do-sal'] },
  { id:'frio', name:'Terras Frias', center:{q:-31,r:30}, span:[18,17], land:800, lakes:50, cultures:['clas-da-neve','vigias-da-pedra'] },
  { id:'umido', name:'Terras Úmidas', center:{q:32,r:18}, span:[16,14], land:450, lakes:38, cultures:['teceloes-da-mata','filhos-das-mares'] }
]);
export const ARCHIPELAGOS = Object.freeze([
  {id:'velas',name:'Ilhas das Velas',center:{q:-2,r:-42},land:115,lakes:6},
  {id:'lume',name:'Arquipélago de Lume',center:{q:43,r:-7},land:105,lakes:6},
  {id:'brumas',name:'Ilhas das Brumas',center:{q:-45,r:5},land:85,lakes:4},
  {id:'coroas',name:'Coroas do Sul',center:{q:8,r:44},land:75,lakes:4},
  {id:'passagem',name:'Ilhas da Passagem',center:{q:45,r:4},land:62,lakes:3},
  {id:'orvalho',name:'Ilhas do Orvalho',center:{q:-24,r:48},land:50,lakes:3}
]);
export const CULTURES = Object.freeze([
  {id:'guardadores-das-trilhas',name:'Guardadores das Trilhas',region:'origem',theme:'cartografia e caminhos antigos'},
  {id:'casas-do-vale',name:'Casas do Vale',region:'origem',theme:'cultivo e arquitetura de madeira'},
  {id:'povos-do-oasis',name:'Povos do Oásis',region:'arido',theme:'água e técnicas de conservação'},
  {id:'navegantes-do-sal',name:'Navegantes do Sal',region:'arido',theme:'rotas marítimas e comércio'},
  {id:'clas-da-neve',name:'Clãs da Neve',region:'frio',theme:'abrigo e sobrevivência no gelo'},
  {id:'vigias-da-pedra',name:'Vigias da Pedra',region:'frio',theme:'monumentos e observação'},
  {id:'teceloes-da-mata',name:'Tecelões da Mata',region:'umido',theme:'fibras e conhecimento botânico'},
  {id:'filhos-das-mares',name:'Filhos das Marés',region:'umido',theme:'rios, litoral e marés'}
]);
export const BIOMES = Object.freeze([
  {id:'campina',name:'Campina',terrain:'campina'},
  {id:'floresta-temperada',name:'Floresta temperada',terrain:'floresta'},
  {id:'floresta-tropical',name:'Floresta tropical',terrain:'floresta'},
  {id:'savana',name:'Savana',terrain:'campina'},
  {id:'colinas-rochosas',name:'Colinas rochosas',terrain:'colinas'},
  {id:'montanhas-alpinas',name:'Montanhas alpinas',terrain:'montanha'},
  {id:'taiga',name:'Taiga',terrain:'floresta'},
  {id:'tundra',name:'Tundra',terrain:'campina'},
  {id:'deserto',name:'Deserto',terrain:'campina'},
  {id:'estepe-arida',name:'Estepe árida',terrain:'colinas'},
  {id:'pantano',name:'Pântano',terrain:'floresta'},
  {id:'vulcanico',name:'Terreno vulcânico',terrain:'montanha'}
]);
export const SITE_QUOTAS = Object.freeze({maravilha:12,ruina:18,reliquia:8,misterio:24,regional:300});
export const SPECIES_QUOTAS = Object.freeze({fauna:36,flora:60});
const NEIGHBORS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export const isInAtlas=(q,r)=>Number.isInteger(q)&&Number.isInteger(r)&&Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=ATLAS_RADIUS;
export const atlasKey=(q,r)=>`${q},${r}`;
export const atlasDistance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function hash(seed,...values) {
  let h=2166136261;
  for(const ch of [seed,...values].join('|')) {h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  h^=h>>>16;h=Math.imul(h,2246822507);h^=h>>>13;
  return (h>>>0)/4294967296;
}
function smooth(t){return t*t*(3-2*t)}
function noise(seed,x,y,scale=10){
  x/=scale;y/=scale;
  const a=Math.floor(x),b=Math.floor(y),u=smooth(x-a),v=smooth(y-b);
  const n=(i,j)=>hash(seed,i,j);
  return (n(a,b)*(1-u)+n(a+1,b)*u)*(1-v)+(n(a,b+1)*(1-u)+n(a+1,b+1)*u)*v;
}
function ellipseMetric(cell,c,span){
 const x=(cell.q-c.q)+(cell.r-c.r)/2;
 const y=.8660254038*(cell.r-c.r);
 return (x/span[0])**2+(y/span[1])**2;
}
function terrainForCore(seed,q,r){
 let h=2166136261;
 for (const ch of `${seed}|${q}|${r}`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
 h^=h>>>16;h=Math.imul(h,2246822507);h^=h>>>13;
 const value=(h>>>0)/4294967296;
 let terrain=value<.31?'campina':value<.57?'floresta':value<.78?'colinas':value<.87?'montanha':value<.95?'lago':'ruinas';
 if(atlasDistance({q,r},{q:0,r:0})<=1 && terrain==='lago')terrain='campina';
 if(q===0&&r===0)terrain='campina';
 return terrain;
}
function biomeFor(seed,cell,group){
 const elevation=noise(seed+'e',cell.q,cell.r,8)*.65+noise(seed+'E',cell.q,cell.r,21)*.35;
 const humidity=noise(seed+'h',cell.q,cell.r,13)*.7+noise(seed+'H',cell.q,cell.r,29)*.3;
 const warm=group==='arido'?.85:group==='umido'?.9:group==='frio'?.1:.53;
 if(elevation>.83)return warm>.6?'vulcanico':'montanhas-alpinas';
 if(group==='frio')return elevation>.66?'montanhas-alpinas':humidity>.52?'taiga':'tundra';
 if(group==='arido')return elevation>.73?'colinas-rochosas':humidity<.38?'deserto':humidity<.57?'estepe-arida':'savana';
 if(group==='umido')return elevation>.73?'vulcanico':humidity>.67?'pantano':humidity>.33?'floresta-tropical':'savana';
 if(elevation>.77)return 'montanhas-alpinas';
 if(elevation>.65)return 'colinas-rochosas';
 if(humidity>.7)return 'pantano';
 if(humidity>.51)return 'floresta-temperada';
 if(humidity<.3)return 'colinas-rochosas';
 return 'campina';
}
function coreBiome(terrain){
 return ({campina:'campina',floresta:'floresta-temperada',colinas:'colinas-rochosas',montanha:'montanhas-alpinas',ruinas:'colinas-rochosas',lago:'lago'})[terrain];
}
function species(seed,type){
 const faunaA=['Cervo','Lobo','Raposa','Coruja','Falcão','Lebre','Javali','Cabra','Garça','Peixe','Lagarto','Besouro'];
 const faunaB=['cinzento','do vale','das brumas','do crepúsculo','da mata','do gelo','dourado','da rocha','das marés','do deserto','do orvalho','das colinas'];
 const floraA=['Samambaia','Musgo','Orquídea','Lírio','Junco','Cedro','Arbusto','Flor','Raiz','Cacto','Pinheiro','Videira'];
 const floraB=['azul','de âmbar','das névoas','do vale','das marés','da montanha','do luar','de pedra','de inverno','de sal','vermelho','de orvalho'];
 const count=type==='fauna'?36:60;
 const a=type==='fauna'?faunaA:floraA,b=type==='fauna'?faunaB:floraB;
 return Array.from({length:count},(_,i)=>({
   id:`${type}-${String(i+1).padStart(2,'0')}`,
   name:`${a[(i*7+Math.floor(i/12))%a.length]} ${b[(i*5+Math.floor(i/9))%b.length]}`,
   biome:BIOMES[(i*7+Math.floor(i/5))%BIOMES.length].id,
   rarity:i%13===0?'rara':i%4===0?'incomum':'comum'
 }));
}
export const FAUNA=Object.freeze(species('ermo','fauna'));
export const FLORA=Object.freeze(species('ermo','flora'));
const cache=new Map();
const landBiomes=new Map(BIOMES.map(b=>[b.id,b]));

/** Constrói a cartografia inteira uma vez por seed; nenhuma alteração do jogador participa da geração. */
export function buildAtlas(seed='ermo-001'){
 if(cache.has(seed))return cache.get(seed);
 const cells=[];
 for(let q=-ATLAS_RADIUS;q<=ATLAS_RADIUS;q++)
  for(let r=Math.max(-ATLAS_RADIUS,-q-ATLAS_RADIUS);r<=Math.min(ATLAS_RADIUS,-q+ATLAS_RADIUS);r++)
   cells.push({q,r,key:atlasKey(q,r),category:'oceano',region:'oceano'});
 const byKey=new Map(cells.map(c=>[c.key,c]));
 const occupied=new Set();
 const assignGroup=(group,archipelago=false)=>{
   const quota=group.land+group.lakes;
   const radius=archipelago?[8.5,8]:group.span;
   const score=c=>{
     const base=ellipseMetric(c,group.center,radius);
     const waves=(noise(seed+'c'+group.id,c.q,c.r,7)-.5)*.19+(noise(seed+'C'+group.id,c.q,c.r,17)-.5)*.16;
     const ridges=archipelago?(noise(seed+'i'+group.id,c.q,c.r,4)-.5)*.30:0;
     return base+waves+ridges;
   };
   const required=group.id==='origem'?cells.filter(c=>atlasDistance(c,{q:0,r:0})<=5):[];
   const forbidden=new Set();
   for(const key of occupied){
     const cell=byKey.get(key);
     for(const [dq,dr] of NEIGHBORS)forbidden.add(atlasKey(cell.q+dq,cell.r+dr));
   }
   const chosen=new Set(required.map(c=>c.key));
   for(const c of required)if(occupied.has(c.key))throw new Error('Região inicial ocupada indevidamente.');
   if(archipelago){
     const centers=[
       {q:group.center.q-7,r:group.center.r+2},
       {q:group.center.q+6,r:group.center.r-4},
       {q:group.center.q+2,r:group.center.r+6}
     ];
     const amounts=[Math.floor(quota*.45),Math.floor(quota*.32)];
     amounts.push(quota-amounts[0]-amounts[1]);
     for(let i=0;i<centers.length;i++){
       const sub=centers[i];
       const choices=cells.filter(c=>!occupied.has(c.key)&&!chosen.has(c.key)&&!forbidden.has(c.key));
       choices.sort((a,b)=>ellipseMetric(a,sub,[6.2,5.7])+(noise(seed+'i'+group.id+i,a.q,a.r,5)-.5)*.18
         -(ellipseMetric(b,sub,[6.2,5.7])+(noise(seed+'i'+group.id+i,b.q,b.r,5)-.5)*.18)||a.q-b.q||a.r-b.r);
       const count=amounts[i];
       if(choices.length<count)throw new Error(`Arquipélago pequeno demais: ${group.id}.`);
       const island=choices.slice(0,count);
       for(const c of island)chosen.add(c.key);
       for(const c of island)for(const [dq,dr] of NEIGHBORS)forbidden.add(atlasKey(c.q+dq,c.r+dr));
     }
   } else {
     const options=cells.filter(c=>!occupied.has(c.key));
     options.sort((a,b)=>score(a)-score(b)||a.q-b.q||a.r-b.r);
     for(const c of options){if(chosen.size>=quota)break;chosen.add(c.key)}
   }
   if(chosen.size!==quota)throw new Error(`Não há células suficientes para ${group.id}.`);
   for(const key of chosen){const c=byKey.get(key);c.category='terra';c.region=group.id;occupied.add(key)}
   // Bacias interiores selecionadas por afinidade espacial. Core histórico nunca é reescrito.
   const coreLakes=[...chosen].map(key=>byKey.get(key)).filter(c=>group.id==='origem'&&atlasDistance(c,{q:0,r:0})<=5&&terrainForCore(seed,c.q,c.r)==='lago');
   const lakes=new Set(coreLakes.map(c=>c.key));
   const candidates=[...chosen].map(key=>byKey.get(key)).filter(c=>
     !(group.id==='origem'&&atlasDistance(c,{q:0,r:0})<=5)&&!lakes.has(c.key));
   const basins=[{q:group.center.q+7,r:group.center.r-4},{q:group.center.q-8,r:group.center.r+4},{q:group.center.q+2,r:group.center.r+10},{q:group.center.q-4,r:group.center.r-9}];
   const basinScore=c=>Math.min(...basins.map(p=>ellipseMetric(c,p,[5.4,4.6])))+(noise(seed+'lake'+group.id,c.q,c.r,4)-.5)*.16;
   candidates.sort((a,b)=>basinScore(a)-basinScore(b)||a.q-b.q||a.r-b.r);
   for(const c of candidates){if(lakes.size>=group.lakes)break;lakes.add(c.key)}
   if(lakes.size!==group.lakes)throw new Error(`Lagos insuficientes em ${group.id}`);
   for(const key of lakes)byKey.get(key).category='agua-doce';
 };
 for(const c of CONTINENTS)assignGroup(c);
 for(const a of ARCHIPELAGOS)assignGroup(a,true);
 for(const c of cells){
   if(c.category==='agua-doce') {c.terrain='lago';c.biome='lago';}
   else if(c.category==='oceano'){c.terrain='oceano';c.biome='oceano';}
   else if(atlasDistance(c,{q:0,r:0})<=5){
     c.terrain=terrainForCore(seed,c.q,c.r);
     c.biome=coreBiome(c.terrain);
     if(c.terrain==='lago')c.category='agua-doce';
   } else {
     c.biome=biomeFor(seed,c,c.region);
     c.terrain=landBiomes.get(c.biome).terrain;
   }
   c.culture=null;
 }
 // Tradições culturais são geografia e arqueologia, não agentes vivos.
 for(const c of cells){
   const group=CONTINENTS.find(g=>g.id===c.region);
   if(group&&c.category==='terra')c.culture=group.cultures[hash(seed+'culture',c.q,c.r)>.48?1:0];
 }
 const sites=[];
 const selected=new Set();
 for(const [kind,amount] of Object.entries(SITE_QUOTAS)){
   const candidates=cells.filter(c=>c.category==='terra'&&atlasDistance(c,{q:0,r:0})>5&&!selected.has(c.key));
   candidates.sort((a,b)=>hash(seed+'poi'+kind,a.q,a.r)-hash(seed+'poi'+kind,b.q,b.r));
   for(const c of candidates){
     if(sites.filter(s=>s.kind!=='regional').length && kind!=='regional' &&
       sites.some(s=>s.kind!=='regional'&&atlasDistance(c,s)<4))continue;
     selected.add(c.key);
     const group=c.region;
     const index=sites.filter(s=>s.kind===kind).length+1;
     const titles={maravilha:'Maravilha Natural',ruina:'Complexo de Ruínas',reliquia:'Relíquia Singular',misterio:'Mistério Antigo',regional:'Vestígio Regional'};
     const site={id:`${kind}-${String(index).padStart(3,'0')}`,kind,q:c.q,r:c.r,name:`${titles[kind]} ${String(index).padStart(2,'0')}`,region:group,culture:c.culture};
     sites.push(site);
     if(index===amount)break;
   }
   if(sites.filter(s=>s.kind===kind).length!==amount)throw new Error(`Falha ao alocar sítios: ${kind}`);
 }
 const siteByKey=new Map(sites.map(s=>[atlasKey(s.q,s.r),s]));
 const get=(q,r)=>byKey.get(atlasKey(q,r))??null;
 const statistics={
   total:cells.length,
   land:cells.filter(c=>c.category==='terra').length,
   ocean:cells.filter(c=>c.category==='oceano').length,
   fresh:cells.filter(c=>c.category==='agua-doce').length,
   regionLand:Object.fromEntries([...CONTINENTS,...ARCHIPELAGOS].map(c=>[c.id,cells.filter(t=>t.region===c.id&&t.category==='terra').length])),
   sites:Object.fromEntries(Object.keys(SITE_QUOTAS).map(k=>[k,sites.filter(s=>s.kind===k).length]))
 };
 if(statistics.total!==ATLAS_CELLS||statistics.land!==LAND_TARGET||statistics.ocean!==OCEAN_TARGET||statistics.fresh!==FRESH_TARGET)
   throw new Error(`Falha de distribuição do atlas: ${JSON.stringify(statistics)}`);
 const result={version:ATLAS_VERSION,seed,radius:ATLAS_RADIUS,cells,sites,statistics,biomes:BIOMES,cultures:CULTURES,fauna:FAUNA,flora:FLORA,get,siteAt:(q,r)=>siteByKey.get(atlasKey(q,r))??null};
 cache.set(seed,result);
 return result;
}

export function generatedHex(seed,q,r){
 const a=buildAtlas(seed), c=a.get(q,r);
 if(!c)return null;
 const resources=({campina:{madeira:2,pedra:1,alimento:5},floresta:{madeira:7,pedra:1,alimento:2},colinas:{madeira:2,pedra:5,alimento:1},montanha:{madeira:0,pedra:7,alimento:0},lago:{madeira:0,pedra:0,alimento:3},oceano:{madeira:0,pedra:0,alimento:0},ruinas:{madeira:1,pedra:3,alimento:0}})[c.terrain];
 return {q,r,terrain:c.terrain,biome:c.biome,region:c.region,discovered:false,visited:false,name:'',resources:{...resources},structures:[]};
}
export function nearbyFaunaFlora(seed,q,r){
 const tile=buildAtlas(seed).get(q,r);
 if(!tile||tile.category!=='terra')return {fauna:[],flora:[]};
 return {
  fauna:FAUNA.filter(a=>a.biome===tile.biome).slice(0,3).map(a=>a.name),
  flora:FLORA.filter(a=>a.biome===tile.biome).slice(0,5).map(a=>a.name)
 };
}