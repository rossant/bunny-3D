import { BABYLON } from './babylon.js';
import './levels.js';

window.BABYLON = BABYLON;


// ---- Formerly app1.js ----

const $ = id => document.getElementById(id);
const SAVE_KEY = 'petit-lapin-3d-save-v3';
const LEGACY_SAVE_KEYS = ['petit-lapin-3d-save-v2','petit-lapin-3d-save-v1'];
const BUNNY_ROOT = '/models/';
const BUNNY_FILE = 'Elpy.glb';
const BOSS_FILE = 'Goblin.glb';
const MAX_LEVEL = Array.isArray(window.CAMPAIGN) ? window.CAMPAIGN.length : 24;
const shopItems = [
  {id:'necklace',name:'Collier rouge',price:8,type:'necklace',icon:'📿'},
  {id:'carrotHat',name:'Chapeau carotte',price:12,type:'hat',icon:'🥕'},
  {id:'berryHat',name:'Chapeau fraise',price:18,type:'hat',icon:'🍓'},
  {id:'cheeseHat',name:'Chapeau fromage',price:20,type:'hat',icon:'🧀'}
];

function freshSave(){ return {level:1,bank:0,owned:[],equippedHat:null,equippedNecklace:null}; }
function loadSave(){
  try{
    let raw=localStorage.getItem(SAVE_KEY);
    if(!raw){for(const k of LEGACY_SAVE_KEYS){raw=localStorage.getItem(k);if(raw)break;}}
    return Object.assign(freshSave(),raw?JSON.parse(raw):{});
  }catch{return freshSave();}
}
let save = loadSave();
save.level=Math.min(MAX_LEVEL,Math.max(1,Number(save.level)||1));
function persist(){
  localStorage.setItem(SAVE_KEY,JSON.stringify(save));
  try{localStorage.setItem('petit-lapin-3d-save-latest',JSON.stringify(save));}catch{}
}
function creditCoins(value){
  const n=Math.max(0,Number(value)||0);
  state.runCoins+=n;
  save.bank+=n;
  persist();
  menuRefresh();
}
function showOnly(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); if(id) $(id).classList.remove('hidden'); }
function flash(text,ms=850){ const m=$('message');m.textContent=text;m.classList.add('show');clearTimeout(flash.t);flash.t=setTimeout(()=>m.classList.remove('show'),ms); }
function menuRefresh(){ $('menuLevel').textContent=save.level;$('menuCoins').textContent=save.bank;$('shopCoins').textContent=save.bank;renderShop(); }
function renderShop(){
  const grid=$('shopGrid');grid.innerHTML='';
  for(const it of shopItems){
    const owned=save.owned.includes(it.id);const equipped=it.type==='hat'?save.equippedHat===it.id:save.equippedNecklace===it.id;
    const d=document.createElement('div');d.className='shopItem'+(equipped?' equipped':'');
    d.innerHTML=`<h3>${it.icon} ${it.name}</h3><div class="muted">Cosmétique uniquement</div>`;
    const b=document.createElement('button');b.className='shopBtn';
    if(!owned){b.textContent=`Acheter — ${it.price} 🪙`;b.disabled=save.bank<it.price;b.onclick=()=>{if(save.bank<it.price)return;save.bank-=it.price;save.owned.push(it.id);persist();menuRefresh();};}
    else{b.textContent=equipped?'Équipé':'Équiper';b.onclick=()=>{if(it.type==='hat')save.equippedHat=equipped?null:it.id;else save.equippedNecklace=equipped?null:it.id;persist();menuRefresh();};}
    d.appendChild(b);grid.appendChild(d);
  }
}
$('shopOpenBtn').onclick=()=>{menuRefresh();showOnly('shop');};
$('shopBackBtn').onclick=()=>{menuRefresh();showOnly('menu');};

const canvas=$('renderCanvas');
const engine=new BABYLON.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,antialias:true});
const G=10,CELL=1.35,ORIGIN=-(G-1)*CELL/2;
const START={x:4,y:9},BOSS_CELL={x:4,y:0};
const CAMERA_BACK=5.5,CAMERA_HEIGHT=4.6,CAMERA_AHEAD=2.4;
let scene,camera,player,boss,bossSplash,waterMesh=null,cameraTargetSmooth=null,accessories=[];
let playerAnimations=[],bossAnimations=[],playerVisual=null,bossVisual=null;
let sharedMaterials={},sharedTextures={};

const state={
  running:false,inputLocked:false,loading:false,paused:false,level:1,hp:100,bossHp:50,bossHpMax:50,runCoins:0,cubesOpened:0,
  playerCell:{...START},layout:null,revealedTraps:new Set(),coins:[],cubes:[],pickups:[],fireballs:[],telegraphs:[],
  moving:false,moveFrom:null,moveTo:null,moveElapsed:0,moveDuration:.18,queuedMove:null,shield:false,scanner:0,
  waterMode:'wide',attacking:false,lastFire:0,lastTime:0,volley:0
};
function levelSpec(){return window.CAMPAIGN?.[Math.max(0,Math.min(MAX_LEVEL-1,state.level-1))]||null;}
const gpos=(x,y)=>new BABYLON.Vector3(ORIGIN+x*CELL,0,ORIGIN+y*CELL);
const key=(x,y)=>x+','+y;
function randInt(n){return Math.floor(Math.random()*n);}
function rand(a,b){return a+Math.random()*(b-a);}
function mat(name,r,g,b){const m=new BABYLON.StandardMaterial(name,scene);m.diffuseColor=new BABYLON.Color3(r,g,b);return m;}
function damp(alphaPerSecond,dt){return 1-Math.exp(-alphaPerSecond*dt);}
function setLoading(on){state.loading=on;$('loading3d').classList.toggle('hidden',!on);}
function sharedMat(id,builder){if(sharedMaterials[id])return sharedMaterials[id];const m=new BABYLON.StandardMaterial(id,scene);builder(m);sharedMaterials[id]=m;return m;}

function getTreeMaterials(){
  return {
    bark: sharedMat('bark',m=>{m.diffuseColor=new BABYLON.Color3(.45,.28,.12);m.specularColor=new BABYLON.Color3(.08,.06,.03);}),
    barkDark: sharedMat('bark-dark',m=>{m.diffuseColor=new BABYLON.Color3(.31,.18,.08);m.specularColor=new BABYLON.Color3(.05,.04,.02);}),
    leafA: sharedMat('leaf-a',m=>{m.diffuseColor=new BABYLON.Color3(.11,.46,.16);m.specularColor=new BABYLON.Color3(.08,.14,.08);}),
    leafB: sharedMat('leaf-b',m=>{m.diffuseColor=new BABYLON.Color3(.17,.56,.19);m.specularColor=new BABYLON.Color3(.08,.18,.08);}),
    leafC: sharedMat('leaf-c',m=>{m.diffuseColor=new BABYLON.Color3(.23,.52,.15);m.specularColor=new BABYLON.Color3(.09,.16,.08);}),
    pineA: sharedMat('pine-a',m=>{m.diffuseColor=new BABYLON.Color3(.08,.37,.16);m.specularColor=new BABYLON.Color3(.05,.1,.05);}),
    pineB: sharedMat('pine-b',m=>{m.diffuseColor=new BABYLON.Color3(.12,.44,.20);m.specularColor=new BABYLON.Color3(.05,.12,.05);}),
  };
}

function makeBroadleafTree(x,z,scale=1){
  const mats=getTreeMaterials();
  const root=new BABYLON.TransformNode('tree',scene);root.position.set(x,0,z);root.rotation.y=Math.random()*Math.PI*2;
  const trunk=BABYLON.MeshBuilder.CreateCylinder('tree-trunk',{height:1.65*scale,diameterTop:.18*scale,diameterBottom:.3*scale,tessellation:8},scene);
  trunk.parent=root;trunk.position.y=.82*scale;trunk.material=Math.random()<.5?mats.bark:mats.barkDark;
  const canopyRoot=new BABYLON.TransformNode('tree-canopy',scene);canopyRoot.parent=root;canopyRoot.position.y=1.55*scale;
  const leafMats=[mats.leafA,mats.leafB,mats.leafC];
  const blobs=[
    [0,.06,0,.95,.78,.95],[.38,-.02,.12,.62,.52,.62],[-.38,-.03,.1,.58,.50,.58],[.12,.18,-.32,.55,.45,.55],[-.12,.16,-.34,.52,.44,.52],[0,.12,.28,.68,.55,.68]
  ];
  blobs.forEach((b,i)=>{const s=BABYLON.MeshBuilder.CreateSphere('leaf',{diameter:1,segments:10},scene);s.parent=canopyRoot;s.position.set(b[0]*scale,b[1]*scale,b[2]*scale);s.scaling.set(b[3]*scale,b[4]*scale,b[5]*scale);s.material=leafMats[i%leafMats.length];});
  const rootBulge=BABYLON.MeshBuilder.CreateCylinder('tree-root',{height:.12*scale,diameterTop:.52*scale,diameterBottom:.68*scale,tessellation:8},scene);
  rootBulge.parent=root;rootBulge.position.y=.06*scale;rootBulge.material=mats.barkDark;
  return root;
}

function makePineTree(x,z,scale=1){
  const mats=getTreeMaterials();
  const root=new BABYLON.TransformNode('pine',scene);root.position.set(x,0,z);root.rotation.y=Math.random()*Math.PI*2;
  const trunk=BABYLON.MeshBuilder.CreateCylinder('pine-trunk',{height:1.95*scale,diameterTop:.16*scale,diameterBottom:.26*scale,tessellation:8},scene);
  trunk.parent=root;trunk.position.y=.97*scale;trunk.material=mats.bark;
  const layers=[
    {y:1.1,dTop:0,dBot:1.18,h:1.15,mat:mats.pineA},
    {y:1.55,dTop:0,dBot:.92,h:.95,mat:mats.pineB},
    {y:1.95,dTop:0,dBot:.66,h:.75,mat:mats.pineA}
  ];
  for(const l of layers){const cone=BABYLON.MeshBuilder.CreateCylinder('pine-layer',{height:l.h*scale,diameterTop:l.dTop,diameterBottom:l.dBot*scale,tessellation:10},scene);cone.parent=root;cone.position.y=l.y*scale;cone.material=l.mat;}
  return root;
}

function addEnvironment(){
  const trunkMat = sharedMat('log-bark',m=>{m.diffuseColor=new BABYLON.Color3(.37,.22,.1);m.specularColor=new BABYLON.Color3(.06,.04,.03);});
  for(let i=0;i<30;i++){
    const a=i/30*Math.PI*2+rand(-.08,.08),r=8.5+Math.random()*3.7,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(Math.random()<.55)makeBroadleafTree(x,z,rand(.9,1.25)); else makePineTree(x,z,rand(1,1.32));
  }
  for(let i=0;i<8;i++){
    const log=BABYLON.MeshBuilder.CreateCylinder('log',{height:1.1,diameterTop:.18,diameterBottom:.24,tessellation:8},scene);
    const a=Math.random()*Math.PI*2,r=8.1+Math.random()*3.2;log.position.set(Math.cos(a)*r,.18,Math.sin(a)*r);log.rotation.z=Math.PI/2;log.rotation.y=Math.random()*Math.PI;log.material=trunkMat;
  }
}

function applyLevelTheme(theme='meadow'){
  const palettes={meadow:[[.51,.80,1],[.51,.80,1],[.72,.88,.65]],forest:[[.28,.55,.42],[.28,.55,.42],[.48,.72,.42]],cave:[[.16,.25,.48],[.16,.25,.48],[.32,.45,.50]],desert:[[.96,.63,.30],[.96,.63,.30],[.82,.68,.35]],night:[[.05,.09,.24],[.05,.09,.24],[.16,.25,.38]],sky:[[.48,.74,.98],[.48,.74,.98],[.62,.83,.72]],finale:[[.30,.12,.42],[.30,.12,.42],[.42,.28,.48]]};
  const [clear,fog,ground]=palettes[theme]||palettes.meadow;
  scene.clearColor=new BABYLON.Color4(...clear,1);scene.fogColor=new BABYLON.Color3(...fog);
  const grass=scene.getMeshByName('grass');if(grass?.material?.diffuseColor)grass.material.diffuseColor=new BABYLON.Color3(...ground);
}

function getFireTexture(){
  if(sharedTextures.fire) return sharedTextures.fire;
  const size=256,dt=new BABYLON.DynamicTexture('fire-tex',{width:size,height:size},scene,false),ctx=dt.getContext();
  dt.hasAlpha=true;ctx.clearRect(0,0,size,size);
  const outer=new Path2D();
  outer.moveTo(size*.5,size*.04);
  outer.bezierCurveTo(size*.86,size*.22,size*.93,size*.66,size*.52,size*.96);
  outer.bezierCurveTo(size*.15,size*.72,size*.19,size*.28,size*.5,size*.04);
  const g1=ctx.createLinearGradient(0,size*.04,0,size*.96);
  g1.addColorStop(0,'rgba(255,248,190,0.92)');
  g1.addColorStop(.22,'rgba(255,210,60,0.98)');
  g1.addColorStop(.55,'rgba(255,112,16,0.95)');
  g1.addColorStop(.88,'rgba(214,20,0,0.72)');
  g1.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g1;ctx.fill(outer);
  const inner=new Path2D();
  inner.moveTo(size*.5,size*.18);
  inner.bezierCurveTo(size*.69,size*.35,size*.72,size*.62,size*.52,size*.82);
  inner.bezierCurveTo(size*.34,size*.64,size*.36,size*.36,size*.5,size*.18);
  const g2=ctx.createLinearGradient(0,size*.16,0,size*.84);
  g2.addColorStop(0,'rgba(255,255,255,0.96)');
  g2.addColorStop(.32,'rgba(255,246,163,0.95)');
  g2.addColorStop(.7,'rgba(255,176,38,0.88)');
  g2.addColorStop(1,'rgba(255,91,0,0)');
  ctx.fillStyle=g2;ctx.fill(inner);
  dt.update();
  sharedTextures.fire=dt;
  return dt;
}

function getFireSpriteMaterial(id='fire-sprite',alpha=.98){
  return sharedMat(id,m=>{
    const tex=getFireTexture();
    m.diffuseTexture=tex;m.opacityTexture=tex;m.useAlphaFromDiffuseTexture=true;
    m.emissiveColor=new BABYLON.Color3(1,.44,.05);m.disableLighting=true;m.backFaceCulling=false;m.alpha=alpha;
  });
}

async function createScene(){
  const s=new BABYLON.Scene(engine);scene=s;sharedMaterials={};sharedTextures={};
  s.clearColor=new BABYLON.Color4(.51,.80,1,1);s.fogMode=BABYLON.Scene.FOGMODE_LINEAR;s.fogStart=15;s.fogEnd=31;s.fogColor=new BABYLON.Color3(.51,.80,1);
  camera=new BABYLON.FreeCamera('camera',new BABYLON.Vector3(0,4.6,6),s);camera.inputs.clear();camera.fov=.88;camera.minZ=.1;
  const hemi=new BABYLON.HemisphericLight('hemi',new BABYLON.Vector3(0,1,0),s);hemi.intensity=1.08;
  const sun=new BABYLON.DirectionalLight('sun',new BABYLON.Vector3(-.45,-1,-.35),s);sun.position=new BABYLON.Vector3(8,14,8);sun.intensity=.94;
  const ground=BABYLON.MeshBuilder.CreateGround('grass',{width:25,height:25},s);
  const groundMat=mat('grass',.34,.67,.28);groundMat.specularColor=new BABYLON.Color3(.06,.08,.03);ground.material=groundMat;
  for(let y=0;y<G;y++)for(let x=0;x<G;x++){
    const tile=BABYLON.MeshBuilder.CreateBox(`tile-${x}-${y}`,{width:1.18,depth:1.18,height:.16},s),p=gpos(x,y);
    tile.position.set(p.x,.08,p.z);
    const m=mat(`tilemat-${x}-${y}`,(x+y)%2?.47:.54,(x+y)%2?.75:.81,(x+y)%2?.37:.43);m.specularColor=new BABYLON.Color3(.1,.12,.08);tile.material=m;
  }
  addEnvironment();
  await Promise.all([makePlayer(),makeBoss()]);
  return s;
}

function parentImported(result,holder){const nodes=[...(result.meshes||[]),...(result.transformNodes||[])],set=new Set(nodes);for(const n of nodes){if(!n.parent||!set.has(n.parent))n.parent=holder;}}
function animationByName(groups,name){return groups.find(g=>g.name.toLowerCase()===name.toLowerCase());}
function playAnim(groups,name,loop=true,speed=1){
  const target=animationByName(groups,name);if(!target)return false;
  for(const g of groups){if(g!==target&&g.isPlaying)g.stop();}
  if(target.isPlaying)target.stop();target.start(loop,speed);return true;
}

async function makePlayer(){
  player=new BABYLON.TransformNode('rabbit',scene);playerAnimations=[];playerVisual=null;
  try{
    const result=await BABYLON.SceneLoader.ImportMeshAsync('',BUNNY_ROOT,BUNNY_FILE,scene);
    playerVisual=new BABYLON.TransformNode('rabbit-glb-holder',scene);playerVisual.parent=player;playerVisual.scaling.setAll(.35);playerVisual.rotation.y=Math.PI;
    parentImported(result,playerVisual);
    playerAnimations=result.animationGroups||[];playAnim(playerAnimations,'Idle',true,1);
  }catch(err){console.warn('Bunny GLB unavailable, fallback mesh used',err);makeFallbackPlayer();}
  applyCosmetics();
}
function makeFallbackPlayer(){
  const white=mat('rabbit-white',.98,.98,.98),pink=mat('rabbit-pink',1,.55,.7),dark=mat('rabbit-dark',.04,.04,.04);
  const torso=BABYLON.MeshBuilder.CreateCapsule('rabbit-body',{radius:.26,height:.82,tessellation:12},scene);torso.parent=player;torso.position.y=.55;torso.rotation.x=Math.PI/2;torso.material=white;
  const head=BABYLON.MeshBuilder.CreateSphere('rabbit-head',{diameter:.52,segments:16},scene);head.parent=player;head.position.set(0,.95,-.28);head.material=white;
  for(const sx of[-1,1]){const ear=BABYLON.MeshBuilder.CreateCapsule('rabbit-ear',{radius:.06,height:.58,tessellation:10},scene);ear.parent=player;ear.position.set(.13*sx,1.4,-.25);ear.rotation.z=-.12*sx;ear.material=white;}
  for(const sx of[-1,1]){const eye=BABYLON.MeshBuilder.CreateSphere('rabbit-eye',{diameter:.055,segments:8},scene);eye.parent=player;eye.position.set(.10*sx,1,-.51);eye.material=dark;}
  const nose=BABYLON.MeshBuilder.CreateSphere('rabbit-nose',{diameter:.06,segments:8},scene);nose.parent=player;nose.position.set(0,.9,-.56);nose.material=pink;
}

// ---- Formerly app2.js ----
function applyCosmetics(){
  accessories.forEach(a=>a.dispose());accessories=[];if(!player)return;
  if(save.equippedNecklace==='necklace'){const tor=BABYLON.MeshBuilder.CreateTorus('necklace',{diameter:.48,thickness:.045,tessellation:20},scene);tor.parent=player;tor.position.set(0,.83,-.12);tor.rotation.x=Math.PI/2;tor.material=mat('necklace-red',.88,.06,.09);accessories.push(tor);}
  if(save.equippedHat==='carrotHat'){const h=BABYLON.MeshBuilder.CreateCylinder('carrotHat',{diameterTop:.03,diameterBottom:.22,height:.5,tessellation:12},scene);h.parent=player;h.position.set(0,1.48,-.08);h.rotation.z=.12;h.material=mat('carrot-hat',1,.35,.03);accessories.push(h);}
  else if(save.equippedHat==='berryHat'){const h=BABYLON.MeshBuilder.CreateSphere('berryHat',{diameter:.36,segments:12},scene);h.scaling.y=.72;h.parent=player;h.position.set(0,1.42,-.08);h.material=mat('berry-hat',.9,.05,.12);accessories.push(h);}
  else if(save.equippedHat==='cheeseHat'){const h=BABYLON.MeshBuilder.CreateBox('cheeseHat',{size:.32},scene);h.parent=player;h.position.set(0,1.42,-.08);h.rotation.z=.18;h.material=mat('cheese-hat',1,.74,.08);accessories.push(h);}
}

async function makeBoss(){
  boss=new BABYLON.TransformNode('boss',scene);bossAnimations=[];bossVisual=null;
  try{
    const result=await BABYLON.SceneLoader.ImportMeshAsync('',BUNNY_ROOT,BOSS_FILE,scene);
    bossVisual=new BABYLON.TransformNode('boss-glb-holder',scene);bossVisual.parent=boss;bossVisual.scaling.setAll(.61);bossVisual.position.y=-.55;
    parentImported(result,bossVisual);
    bossAnimations=result.animationGroups||[];playAnim(bossAnimations,'Idle',true,1);
  }catch(err){console.warn('Boss GLB unavailable, fallback mesh used',err);makeFallbackBoss();}
  bossSplash=BABYLON.MeshBuilder.CreateSphere('boss-splash',{diameter:1.55,segments:12},scene);bossSplash.parent=boss;bossSplash.position.y=.8;const sm=mat('boss-splash-mat',.05,.55,1);sm.emissiveColor=new BABYLON.Color3(.02,.28,.75);sm.alpha=.18;bossSplash.material=sm;bossSplash.isVisible=false;
}
function makeFallbackBoss(){
  const bodyMat=mat('boss-fallback',.42,.07,.11),hornMat=mat('boss-horn',.15,.02,.02),eyeMat=mat('boss-eye',1,.72,.04);
  const torso=BABYLON.MeshBuilder.CreateCapsule('boss-body',{radius:.45,height:1.4,tessellation:12},scene);torso.parent=boss;torso.position.y=.75;torso.material=bodyMat;
  for(const sx of[-1,1]){const h=BABYLON.MeshBuilder.CreateCylinder('boss-horn',{diameterTop:0,diameterBottom:.18,height:.48,tessellation:8},scene);h.parent=boss;h.position.set(.28*sx,1.45,0);h.rotation.z=.25*sx;h.material=hornMat;const e=BABYLON.MeshBuilder.CreateSphere('boss-eye',{diameter:.13,segments:8},scene);e.parent=boss;e.position.set(.18*sx,1.02,.43);e.material=eyeMat;}
}

function freeCell(used,forbidNearStart=false){
  for(let i=0;i<700;i++){const p={x:randInt(G),y:randInt(G)},kk=key(p.x,p.y);if(used.has(kk))continue;if(forbidNearStart&&Math.abs(p.x-START.x)+Math.abs(p.y-START.y)<=2)continue;used.add(kk);return p;}return{x:1,y:5};
}
function pathExists(blocked){
  const q=[{...START}],seen=new Set([key(START.x,START.y)]);
  while(q.length){const p=q.shift();if(p.x===BOSS_CELL.x&&p.y===BOSS_CELL.y)return true;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,kk=key(x,y);if(x<0||y<0||x>=G||y>=G||blocked.has(kk)||seen.has(kk))continue;seen.add(kk);q.push({x,y});}}
  return false;
}
function generateLayout(){
  const spec=levelSpec();
  if(spec?.layout)return {traps:(spec.layout.traps||[]).map(p=>({...p})),cubes:(spec.layout.cubes||[]).map(p=>({dead:false,value:3,...p})),looseCoins:(spec.layout.coins||[]).map(p=>({value:1,...p})),pickups:(spec.layout.pickups||[]).map(p=>({...p}))};
  const usedBase=new Set([key(START.x,START.y),key(BOSS_CELL.x,BOSS_CELL.y)]);const trapCount=spec?.trapCount??Math.min(4+Math.floor((state.level-1)/5),12);let traps=[],used;
  for(let attempt=0;attempt<300;attempt++){
    used=new Set(usedBase);traps=[];for(let i=0;i<trapCount;i++)traps.push(freeCell(used,true));
    if(pathExists(new Set(traps.map(t=>key(t.x,t.y)))))break;
  }
  const cubes=[];for(let i=0;i<(spec?.cubeCount??10);i++){const p=freeCell(used);cubes.push({...p,dead:Math.random()<.08,value:2+randInt(4)});}
  const looseCoins=[];const coinCount=spec?.coinCount??Math.min(3+Math.floor((state.level-1)/4),7);for(let i=0;i<coinCount;i++){const p=freeCell(used);looseCoins.push({...p,value:(spec?.theme==='night'?2:1)*(1+randInt(2))});}
  const pickupType=spec?.theme==='cave'||spec?.theme==='sky'?'shield':spec?.theme==='desert'?'scanner':'carrot';
  const pickup=freeCell(used,true);
  return {traps,cubes,looseCoins,pickups:[{...pickup,type:pickupType}]};
}

function makeCoin(x,y,value){const c=BABYLON.MeshBuilder.CreateCylinder('coin',{diameter:.36,height:.08,tessellation:20},scene);c.rotation.x=Math.PI/2;const p=gpos(x,y);c.position.set(p.x,.46,p.z);const m=mat('coinmat-'+x+'-'+y,1,.72,.05);m.specularColor=new BABYLON.Color3(1,.9,.4);c.material=m;c.metadata={x,y,value};return c;}
function makePickup(x,y,type){
  const p=gpos(x,y),root=new BABYLON.TransformNode(`pickup-${type}`,scene);root.position.set(p.x,.18,p.z);let mesh;
  if(type==='carrot'){mesh=BABYLON.MeshBuilder.CreateCylinder('carrot-pickup',{diameterTop:.04,diameterBottom:.2,height:.46,tessellation:10},scene);mesh.rotation.z=Math.PI;mesh.position.y=.3;mesh.material=mat('carrot-pickup-mat',1,.35,.03);for(const side of[-1,1]){const leaf=BABYLON.MeshBuilder.CreateSphere('carrot-leaf',{diameter:.16,segments:8},scene);leaf.parent=root;leaf.position.set(.07*side,.58,0);leaf.material=mat('carrot-leaf-mat',.15,.7,.12);}}
  else if(type==='shield'){mesh=BABYLON.MeshBuilder.CreateTorus('shield-pickup',{diameter:.52,thickness:.08,tessellation:18},scene);mesh.position.y=.37;mesh.rotation.x=Math.PI/2;mesh.material=mat('shield-pickup-mat',.20,.85,1);}
  else{mesh=BABYLON.MeshBuilder.CreateSphere('scanner-pickup',{diameter:.35,segments:12},scene);mesh.position.y=.36;mesh.material=mat('scanner-pickup-mat',.78,.38,1);}
  mesh.parent=root;return root;
}
function makeCube(x,y){
  const root=new BABYLON.TransformNode('crate-root',scene),p=gpos(x,y);root.position.set(p.x,.1,p.z);
  const wood=mat('crate-wood-'+x+'-'+y,.52,.29,.09),wood2=mat('crate-wood2-'+x+'-'+y,.68,.4,.12),metal=mat('crate-metal-'+x+'-'+y,.2,.18,.15),gold=mat('crate-lock-'+x+'-'+y,.95,.64,.08);
  const core=BABYLON.MeshBuilder.CreateBox('crate-wood-core',{width:.66,height:.58,depth:.66},scene);core.parent=root;core.position.y=.32;core.material=wood;
  for(const z of[-.34,.34]){const slat=BABYLON.MeshBuilder.CreateBox('crate-wood-slat',{width:.72,height:.1,depth:.08},scene);slat.parent=root;slat.position.set(0,.33,z);slat.material=wood2;}
  for(const xoff of[-.34,.34]){const post=BABYLON.MeshBuilder.CreateBox('crate-metal-post',{width:.075,height:.62,depth:.075},scene);post.parent=root;post.position.set(xoff,.32,-.34);post.material=metal;const post2=post.clone('crate-metal-post');post2.parent=root;post2.position.z=.34;}
  const lid=BABYLON.MeshBuilder.CreateBox('crate-wood-lid',{width:.74,height:.12,depth:.74},scene);lid.parent=root;lid.position.y=.67;lid.material=wood2;
  const lock=BABYLON.MeshBuilder.CreateBox('crate-lock',{width:.18,height:.18,depth:.07},scene);lock.parent=root;lock.position.set(0,.42,-.37);lock.material=gold;
  const q=BABYLON.MeshBuilder.CreatePlane('crate-question',{size:.22},scene);q.parent=root;q.position.set(0,.43,-.409);q.rotation.y=Math.PI;q.material=makeTextMaterial('?');
  return root;
}
function setCrateResult(root,dead){
  root.getChildMeshes().forEach(m=>{if(m.name.startsWith('crate-wood'))m.material=dead?mat('crate-dead-'+Math.random(),.45,.03,.03):mat('crate-good-'+Math.random(),.82,.55,.06);});
  root.scaling.y=.58;root.position.y=.02;
}
function makeTextMaterial(text,color='#fff'){const dt=new BABYLON.DynamicTexture('dt-'+Math.random(),{width:128,height:128},scene,false);dt.hasAlpha=true;dt.drawText(text,34,94,'bold 86px sans-serif',color,'transparent',true);const m=new BABYLON.StandardMaterial('textmat-'+Math.random(),scene);m.diffuseTexture=dt;m.opacityTexture=dt;m.emissiveColor=new BABYLON.Color3(1,1,1);return m;}
function makeRevealedTrap(x,y){const p=gpos(x,y);const hole=BABYLON.MeshBuilder.CreateCylinder('trapReveal',{diameter:.72,height:.08,tessellation:24},scene);hole.position.set(p.x,.12,p.z);hole.material=mat('trapmat-'+x+'-'+y,.12,.06,.03);return hole;}

async function startLevel(newLayout=false){
  if(state.loading)return;setLoading(true);showOnly(null);$('hud').classList.add('hidden');$('controls').classList.add('hidden');$('modeBadge').classList.add('hidden');
  state.running=false;state.inputLocked=true;state.paused=false;state.hp=100;state.runCoins=0;state.cubesOpened=0;state.attacking=false;state.moving=false;state.queuedMove=null;state.fireballs=[];state.telegraphs=[];state.level=save.level;state.volley=0;state.shield=false;state.scanner=0;
  if(newLayout||!state.layout){state.layout=generateLayout();state.revealedTraps=new Set(state.layout.traps.map(t=>key(t.x,t.y)));}
  if(scene)scene.dispose();
  try{await createScene();}catch(err){console.error(err);setLoading(false);showOnly('menu');flash('Erreur de chargement 3D');return;}
  const spec=levelSpec();state.bossHpMax=spec?.bossHp??50+Math.min(130,(state.level-1)*3);state.bossHp=state.bossHpMax;state.playerCell={...START};
  state.coins=state.layout.looseCoins.map(c=>({...c,taken:false,mesh:makeCoin(c.x,c.y,c.value)}));
  state.cubes=state.layout.cubes.map(c=>({...c,opened:false,mesh:makeCube(c.x,c.y)}));
  state.pickups=(state.layout.pickups||[]).map(p=>({...p,taken:false,mesh:makePickup(p.x,p.y,p.type)}));
  for(const t of state.layout.traps){if(state.revealedTraps.has(key(t.x,t.y)))makeRevealedTrap(t.x,t.y);}
  const pp=gpos(START.x,START.y);player.position.set(pp.x,0,pp.z);player.rotation.y=0;
  const bp=gpos(BOSS_CELL.x,BOSS_CELL.y);boss.position.set(bp.x,0,bp.z);boss.rotation.y=0;
  state.moveDuration=spec?.theme==='desert'?.22:spec?.theme==='sky'?.15:.18;
  applyLevelTheme(spec?.theme);snapCamera();updateModeUI();updateHud();state.lastFire=performance.now()+700;state.lastTime=performance.now();
  setLoading(false);state.running=true;state.inputLocked=false;$('hud').classList.remove('hidden');$('controls').classList.remove('hidden');$('modeBadge').classList.remove('hidden');$('pauseBtn').classList.remove('hidden');showBossIntro(spec);v8StartMusic?.(spec?.theme);flash(spec?.tutorial||spec?.title||`Niveau ${state.level}`,1800);
}
function restartAttempt(){startLevel(false);}
function updateHud(){const spec=levelSpec(),scannerBtn=$('scannerBtn');$('levelLabel').textContent=state.level;$('levelTotal').textContent=MAX_LEVEL;$('levelTitle').textContent=spec?.title||`Niveau ${state.level}`;$('objectiveText').textContent=spec?.tutorial||'Évite les trappes, ramasse les pièces et bats le boss !';$('runCoins').textContent=state.runCoins;$('cubeCount').textContent=state.cubesOpened;$('hpText').textContent=Math.max(0,Math.ceil(state.hp));$('hpBar').style.width=Math.max(0,state.hp)+'%';$('bossHpText').textContent=Math.max(0,Math.ceil(state.bossHp));$('bossHpMax').textContent=state.bossHpMax;$('bossHpBar').style.width=Math.max(0,100*state.bossHp/state.bossHpMax)+'%';if($('shieldStatus'))$('shieldStatus').textContent=state.shield?'🛡️ Bouclier prêt':'Pas de bouclier';if(scannerBtn){scannerBtn.disabled=state.scanner<1;scannerBtn.classList.toggle('hidden',state.scanner<1);$('scannerLabel').textContent=`Scanner × ${state.scanner}`;}}
function showBossIntro(spec){const overlay=$('bossIntro');if(!overlay)return;state.inputLocked=true;$('bossIntroTitle').textContent=`${spec?.title||'Le boss'} !`;$('bossIntroText').textContent=spec?.theme==='desert'?'Le sable brûlant te ralentit.' : spec?.theme==='sky'?'Le vent te donne de la vitesse.' : spec?.theme==='cave'?'Les cristaux donnent un bouclier.' : 'Observe les avertissements rouges, puis esquive !';overlay.classList.remove('hidden');clearTimeout(showBossIntro.t);showBossIntro.t=setTimeout(()=>{overlay.classList.add('hidden');if(state.running)state.inputLocked=false;},1800);}
function updateModeUI(){$('modeText').textContent=state.waterMode==='wide'?'LARGE':'PRÉCIS';$('modeBtnText').textContent=state.waterMode==='wide'?'LARGE':'PRÉCIS';}
function toggleMode(){state.waterMode=state.waterMode==='wide'?'focus':'wide';updateModeUI();flash(state.waterMode==='wide'?'Jet large : facile, 5 dégâts/s':'Jet précis : même colonne, 10 dégâts/s',650);}

function requestMove(dir){
  if(!state.running||state.inputLocked||state.paused)return;if(state.moving){if(!state.queuedMove)state.queuedMove=dir;return;}
  const map={up:[0,-1],down:[0,1],left:[1,0],right:[-1,0]},[dx,dy]=map[dir];
  const nx=state.playerCell.x+dx,ny=state.playerCell.y+dy;if(nx<0||ny<0||nx>=G||ny>=G)return;
  state.playerCell={x:nx,y:ny};state.moving=true;state.moveElapsed=0;state.moveFrom=player.position.clone();state.moveTo=gpos(nx,ny);playAnim(playerAnimations,'Walk',true,1.15);
}
function tickMovement(dt){
  if(!state.moving)return;state.moveElapsed+=dt;const t=Math.min(1,state.moveElapsed/state.moveDuration),u=t*t*(3-2*t);
  player.position.x=state.moveFrom.x+(state.moveTo.x-state.moveFrom.x)*u;player.position.z=state.moveFrom.z+(state.moveTo.z-state.moveFrom.z)*u;
  if(!playerAnimations.length)player.position.y=Math.sin(Math.PI*t)*.13;
  if(t>=1){player.position.copyFrom(state.moveTo);state.moving=false;state.moveFrom=null;state.moveTo=null;arrive();if(!state.inputLocked&&state.queuedMove){const q=state.queuedMove;state.queuedMove=null;requestMove(q);}else playAnim(playerAnimations,'Idle',true,1);}
}
function cameraPose(){return{pos:new BABYLON.Vector3(player.position.x,player.position.y+CAMERA_HEIGHT,player.position.z+CAMERA_BACK),target:new BABYLON.Vector3(player.position.x,player.position.y+.72,player.position.z-CAMERA_AHEAD)};}
function snapCamera(){const p=cameraPose();camera.position.copyFrom(p.pos);cameraTargetSmooth=p.target.clone();camera.setTarget(cameraTargetSmooth);}
function followCamera(dt){const p=cameraPose(),a=damp(5.4,dt),b=damp(6.8,dt);camera.position=BABYLON.Vector3.Lerp(camera.position,p.pos,a);cameraTargetSmooth=BABYLON.Vector3.Lerp(cameraTargetSmooth,p.target,b);camera.setTarget(cameraTargetSmooth);}

function arrive(){
  const trap=state.layout.traps.find(t=>t.x===state.playerCell.x&&t.y===state.playerCell.y);if(trap){state.revealedTraps.add(key(trap.x,trap.y));if(state.shield){state.shield=false;flash('🛡️ Bouclier utilisé : trappe bloquée !',850);updateHud();return;}return lose('Trappe !');}
  const coin=state.coins.find(c=>!c.taken&&c.x===state.playerCell.x&&c.y===state.playerCell.y);if(coin){coin.taken=true;creditCoins(coin.value);if(coin.mesh)coin.mesh.dispose();flash(`🪙 +${coin.value} — sauvegardé`,500);updateHud();}
  const pickup=state.pickups.find(p=>!p.taken&&p.x===state.playerCell.x&&p.y===state.playerCell.y);if(pickup)takePickup(pickup);
  const cube=state.cubes.find(c=>!c.opened&&c.x===state.playerCell.x&&c.y===state.playerCell.y);if(cube)openCube(cube);
}
function takePickup(p){p.taken=true;p.mesh?.dispose();if(p.type==='carrot'){const healed=Math.min(100-state.hp,30);state.hp+=30;flash(`🥕 +${healed} PV`,750);}else if(p.type==='shield'){state.shield=true;flash('🛡️ Bouclier trouvé !',750);}else{state.scanner++;flash('🔎 Scanner trouvé !',750);}v8SfxPickup?.(p.type);updateHud();}
function openCube(c){c.opened=true;state.cubesOpened++;setCrateResult(c.mesh,c.dead);if(c.dead){if(state.shield){state.shield=false;flash('🛡️ Bouclier : caisse dangereuse bloquée !',700);updateHud();}else{flash('💀 Mauvaise caisse !',500);updateHud();setTimeout(()=>lose('La caisse était mortelle !'),350);}}else{creditCoins(c.value);flash(`📦 +${c.value} pièces — sauvegardées`,650);updateHud();}}
function activateScanner(){if(!state.scanner||state.inputLocked||state.paused)return;state.scanner--;for(const c of state.cubes.filter(c=>c.dead&&!c.opened)){for(const m of c.mesh.getChildMeshes())if(m.name.startsWith('crate-wood')){const danger=mat(`scanner-danger-${Math.random()}`,.75,.04,.10);danger.emissiveColor=new BABYLON.Color3(.45,0,.02);m.material=danger;}}flash('🔎 Les caisses dangereuses brillent en rouge !',1500);v8SfxScanner?.();updateHud();}
function lose(reason){if(state.inputLocked)return;state.inputLocked=true;state.attacking=false;clearWater();v8StopMusic?.();playAnim(playerAnimations,'Death',false,1.15);flash(`${reason} — pièces conservées`,1050);setTimeout(restartAttempt,1050);}

// ---- Formerly app3.js ----
function waterCanHit(){const dy=state.playerCell.y-BOSS_CELL.y;if(dy<=0)return false;const dx=Math.abs(state.playerCell.x-BOSS_CELL.x);if(state.waterMode==='wide')return dy<=8&&dx<=2;return dx===0&&dy<=10;}
function drawWideWater(){clearWater();const start=player.position.add(new BABYLON.Vector3(0,.65,-.38)),range=8*CELL,half=2.25*CELL;const verts=[start.x,start.y,start.z,start.x-half,start.y,start.z-range,start.x+half,start.y,start.z-range],mesh=new BABYLON.Mesh('water-wide',scene),vd=new BABYLON.VertexData();vd.positions=verts;vd.indices=[0,2,1];vd.normals=[0,1,0,0,1,0,0,1,0];vd.applyToMesh(mesh);const m=mat('water-wide-mat',.08,.55,1);m.emissiveColor=new BABYLON.Color3(.04,.25,.55);m.alpha=.42;mesh.material=m;mesh.isPickable=false;waterMesh=mesh;}
function drawFocusWater(){clearWater();const a=player.position.add(new BABYLON.Vector3(0,.65,-.3)),b=new BABYLON.Vector3(a.x,a.y,a.z-10*CELL);waterMesh=BABYLON.MeshBuilder.CreateTube('water-focus',{path:[a,b],radius:.065,tessellation:8},scene);const m=mat('water-focus-mat',.05,.58,1);m.emissiveColor=new BABYLON.Color3(.02,.35,.8);m.alpha=.92;waterMesh.material=m;}
function clearWater(){if(waterMesh){waterMesh.dispose();waterMesh=null;}$('waterBtn').classList.remove('hitting');}
function waterTick(dt){
  if(!state.attacking||state.inputLocked){clearWater();boss.scaling.setAll(1);if(bossSplash)bossSplash.isVisible=false;return;}
  if(state.waterMode==='wide')drawWideWater();else drawFocusWater();
  const hit=waterCanHit();$('waterBtn').classList.toggle('hitting',hit);
  if(hit){const dps=state.waterMode==='wide'?5:10;state.bossHp-=dps*dt;boss.scaling.setAll(1.025);if(bossSplash){bossSplash.isVisible=true;bossSplash.scaling.setAll(1+.08*Math.sin(performance.now()*.03));}updateHud();if(state.bossHp<=0)win();}
  else{boss.scaling.setAll(1);if(bossSplash)bossSplash.isVisible=false;}
}

function makeFireBillboard(name,size,parent,y=0){
  const p=BABYLON.MeshBuilder.CreatePlane(name,{size},scene);p.parent=parent;p.position.y=y;p.billboardMode=BABYLON.Mesh.BILLBOARDMODE_ALL;p.material=getFireSpriteMaterial();return p;
}
function makeWarning(target,delay=.62){
  const p=gpos(target.x,target.y),root=new BABYLON.TransformNode('warning-root',scene);root.position.set(p.x,0,p.z);
  const disc=BABYLON.MeshBuilder.CreateDisc('warning-disc',{radius:.38,tessellation:32},scene);disc.parent=root;disc.rotation.x=Math.PI/2;disc.position.y=.125;const dm=mat('warning-disc-mat-'+Math.random(),1,.15,.01);dm.emissiveColor=new BABYLON.Color3(1,.05,0);dm.alpha=.26;disc.material=dm;
  const ring=BABYLON.MeshBuilder.CreateTorus('warning-ring',{diameter:.78,thickness:.075,tessellation:28},scene);ring.parent=root;ring.position.y=.15;const rm=mat('warning-ring-mat-'+Math.random(),1,.28,.01);rm.emissiveColor=new BABYLON.Color3(1,.12,0);ring.material=rm;
  const flame=makeFireBillboard('warning-flame',.52,root,.45);flame.rotation.y=Math.random()*Math.PI;
  const mark=BABYLON.MeshBuilder.CreatePlane('warning-mark',{size:.28},scene);mark.parent=root;mark.rotation.x=Math.PI/2;mark.position.y=.175;mark.material=makeTextMaterial('!','#ffe08a');
  state.telegraphs.push({root,target,elapsed:0,delay,flame,ring,disc});
}
function bossFire(now){
  const spec=levelSpec(),interval=spec?.bossFireInterval??Math.max(1100,2300-(state.level-1)*15);if(now-state.lastFire<interval||state.inputLocked)return;state.lastFire=now;state.volley++;
  makeWarning({...state.playerCell});
  if(spec?.pattern==='cross'){for(const offset of[-1,1])makeWarning({x:Math.max(0,Math.min(G-1,state.playerCell.x+offset)),y:state.playerCell.y},.78);}
  else if(spec?.doubleShot){const offset=Math.random()<.5?-1:1;makeWarning({x:Math.max(0,Math.min(G-1,state.playerCell.x+offset)),y:state.playerCell.y},.78);}
}
function bossAttackAnim(){
  if(!playAnim(bossAnimations,'Bite_Front',false,1.2))playAnim(bossAnimations,'Punch',false,1.2);
  clearTimeout(bossAttackAnim.t);bossAttackAnim.t=setTimeout(()=>playAnim(bossAnimations,'Idle',true,1),650);
}
function createFireballVisual(start){
  const root=new BABYLON.TransformNode('fireball-root',scene);root.position.copyFrom(start);
  const core=BABYLON.MeshBuilder.CreateSphere('fire-core',{diameter:.26,segments:10},scene);core.parent=root;const cm=mat('fire-core-mat-'+Math.random(),1,.32,.04);cm.emissiveColor=new BABYLON.Color3(1,.18,.02);core.material=cm;
  const shell=BABYLON.MeshBuilder.CreateSphere('fire-shell',{diameter:.42,segments:10},scene);shell.parent=root;const sm=mat('fire-shell-mat-'+Math.random(),1,.56,.06);sm.emissiveColor=new BABYLON.Color3(1,.35,.02);sm.alpha=.28;shell.material=sm;
  const flameA=makeFireBillboard('fire-flame-a',.72,root,.03);
  const flameB=makeFireBillboard('fire-flame-b',.58,root,.08);flameB.rotation.z=.28;
  const sparks=new BABYLON.ParticleSystem('fire-sparks',36,scene);sparks.particleTexture=getFireTexture();sparks.emitter=root;sparks.minEmitBox=new BABYLON.Vector3(0,0,0);sparks.maxEmitBox=new BABYLON.Vector3(0,0,0);sparks.color1=new BABYLON.Color4(1,.86,.42,.95);sparks.color2=new BABYLON.Color4(1,.32,.06,.75);sparks.colorDead=new BABYLON.Color4(.24,.02,0,0);sparks.minSize=.05;sparks.maxSize=.18;sparks.minLifeTime=.15;sparks.maxLifeTime=.28;sparks.emitRate=60;sparks.blendMode=BABYLON.ParticleSystem.BLENDMODE_ADD;sparks.gravity=new BABYLON.Vector3(0,.6,0);sparks.direction1=new BABYLON.Vector3(-.15,.25,-.15);sparks.direction2=new BABYLON.Vector3(.15,.65,.15);sparks.minEmitPower=.15;sparks.maxEmitPower=.4;sparks.updateSpeed=.014;sparks.start();
  return {
    root,core,shell,flameA,flameB,sparks,
    dispose(){if(this.dead)return;this.dead=true;sparks.stop();setTimeout(()=>{try{sparks.dispose();}catch{}},250);root.dispose();}
  };
}
function spawnFireball(target){
  bossAttackAnim();
  const start=boss.position.add(new BABYLON.Vector3(0,.82,.15)),tp=gpos(target.x,target.y).add(new BABYLON.Vector3(0,.48,0)),dir=tp.subtract(start).normalize();
  const v=createFireballVisual(start);
  state.fireballs.push({visual:v,node:v.root,dir,speed:3.2+Math.min(1.5,state.level*.015),damage:levelSpec()?.bossDamage??12+Math.floor((state.level-1)/20)*2,age:0,spin:(Math.random()-.5)*3});
}
function telegraphTick(dt){
  for(const t of state.telegraphs){
    t.elapsed+=dt;const pulse=1+.18*Math.sin(t.elapsed*24);t.root.scaling.setAll(pulse);
    if(t.flame){t.flame.scaling.y=1+.15*Math.sin(t.elapsed*18);t.flame.position.y=.45+.03*Math.sin(t.elapsed*11);}
    if(t.ring)t.ring.scaling.setAll(1+.08*Math.sin(t.elapsed*14));
    if(t.elapsed>=t.delay){spawnFireball(t.target);t.root.dispose();t.done=true;}
  }
  state.telegraphs=state.telegraphs.filter(t=>!t.done);
}
function fireTick(dt){
  const playerHitPos=player.position.add(new BABYLON.Vector3(0,.65,0));
  for(const f of state.fireballs){
    if(!f.node||f.node.isDisposed())continue;
    f.age+=dt;f.node.position.addInPlace(f.dir.scale(f.speed*dt));f.node.rotation.z+=f.spin*dt;
    const pulse=1+.16*Math.sin(f.age*24);if(f.visual.core)f.visual.core.scaling.setAll(pulse);if(f.visual.shell)f.visual.shell.scaling.setAll(1.1+.2*Math.sin(f.age*18));
    if(f.visual.flameA){f.visual.flameA.scaling.y=1.05+.18*Math.sin(f.age*20);f.visual.flameB.scaling.x=1+.13*Math.cos(f.age*17);}
    if(BABYLON.Vector3.Distance(f.node.position,playerHitPos)<.5){state.hp-=f.damage;f.visual.dispose();updateHud();flash(`🔥 -${f.damage} PV`,400);if(state.hp<=0)return lose('Plus de PV !');}
    else if(BABYLON.Vector3.Distance(f.node.position,boss.position)>23)f.visual.dispose();
  }
  state.fireballs=state.fireballs.filter(f=>f.node&&!f.node.isDisposed());
}

function win(){
  if(state.inputLocked)return;state.inputLocked=true;state.attacking=false;clearWater();v8StopMusic?.();playAnim(bossAnimations,'Death',false,1.1);
  const finished=save.level>=MAX_LEVEL;if(!finished)save.level++;persist();$('victoryCoins').textContent=state.runCoins;$('victoryTitle').textContent=finished?'🏆 Grande aventure terminée !':'🎉 Boss vaincu !';$('nextBtn').textContent=finished?'Rejouer le grand final':'Niveau suivant';
  setTimeout(()=>{state.running=false;$('hud').classList.add('hidden');$('controls').classList.add('hidden');$('modeBadge').classList.add('hidden');$('pauseBtn').classList.add('hidden');showOnly('victory');menuRefresh();state.layout=null;state.revealedTraps=new Set();},900);
}

$('playBtn').onclick=()=>{state.layout=null;startLevel(true);};
$('nextBtn').onclick=()=>{state.layout=null;startLevel(true);};
$('menuBtn').onclick=goToMenu;
function goToMenu(){state.running=false;state.paused=false;state.layout=null;v8StopMusic?.();$('hud').classList.add('hidden');$('controls').classList.add('hidden');$('modeBadge').classList.add('hidden');$('pauseBtn').classList.add('hidden');menuRefresh();showOnly('menu');}
function setPaused(paused){if(!state.running)return;state.paused=paused;state.attacking=false;clearWater();if(paused)v8StopMusic?.();else v8StartMusic?.(levelSpec()?.theme);$('pauseScreen').classList.toggle('hidden',!paused);$('pauseScreen').setAttribute('aria-hidden',String(!paused));if(paused)$('resumeBtn').focus();}
$('pauseBtn').onclick=()=>setPaused(true);
$('resumeBtn').onclick=()=>setPaused(false);
$('pauseMenuBtn').onclick=goToMenu;
$('settingsBtn').onclick=()=>$('settingsPanel').classList.toggle('hidden');
$('settingsSoundBtn').onclick=()=>{$('soundBtn').click();$('settingsSoundBtn').textContent=v8SoundOn?'🔊 Son activé':'🔇 Son coupé';};
$('scannerBtn')?.addEventListener('click',activateScanner);
$('modeBtn').onclick=e=>{e.preventDefault();toggleMode();};
for(const b of document.querySelectorAll('[data-dir]'))b.addEventListener('click',e=>{e.preventDefault();requestMove(b.dataset.dir);});
function holdWater(){const b=$('waterBtn');b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);state.attacking=true;});for(const ev of['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,e=>{e.preventDefault();state.attacking=false;clearWater();});}
holdWater();
const held=new Set();function keyDir(k){if(k==='ArrowUp'||k==='w'||k==='W')return'up';if(k==='ArrowDown'||k==='s'||k==='S')return'down';if(k==='ArrowLeft'||k==='a'||k==='A')return'left';if(k==='ArrowRight'||k==='d'||k==='D')return'right';return null;}
addEventListener('keydown',e=>{const d=keyDir(e.key);if(d||e.key===' '||e.key==='m'||e.key==='M'||e.key==='Escape')e.preventDefault();if(e.key==='Escape'){setPaused(!state.paused);return;}if(d){if(held.has(d))return;held.add(d);requestMove(d);return;}if(e.key===' ')state.attacking=!state.paused;else if((e.key==='m'||e.key==='M')&&!e.repeat)toggleMode();});
addEventListener('keyup',e=>{const d=keyDir(e.key);if(d)held.delete(d);if(e.key===' '){state.attacking=false;clearWater();}});

engine.runRenderLoop(()=>{
  if(!scene)return;const now=performance.now(),dt=Math.min(.05,(now-state.lastTime||16)/1000);state.lastTime=now;
  if(state.running&&!state.inputLocked&&!state.paused){tickMovement(dt);followCamera(dt);bossFire(now);telegraphTick(dt);fireTick(dt);waterTick(dt);}else clearWater();
  for(const c of scene.meshes.filter(m=>m.name==='coin'&&!m.isDisposed())){c.rotation.y+=dt*2.3;c.position.y=.46+Math.sin(now*.004+c.position.x)*.06;}
  scene.render();
});
addEventListener('resize',()=>engine.resize());
menuRefresh();showOnly('menu');

// ---- Formerly app4.js ----
// V8 polish layer: lighting/shadows, organic terrain, water/fire FX, crate animation and procedural audio.
let v8Shadow=null,v8Glow=null,v8CameraShake=0;
let v8WaterFx={mode:null,mesh:null,emitter:null,particles:null};
let v8LastSplash=0;
let v8Audio=null,v8Master=null,v8WaterAudio=null,v8MusicTimer=null,v8SoundOn=true;
let v8FxTextures={};

function v8FxTexture(kind){
  if(v8FxTextures[kind])return v8FxTextures[kind];
  const dt=new BABYLON.DynamicTexture('v8-'+kind+'-tex',{width:128,height:128},scene,false),ctx=dt.getContext();dt.hasAlpha=true;ctx.clearRect(0,0,128,128);
  if(kind==='water'){
    const g=ctx.createRadialGradient(64,56,3,64,64,55);g.addColorStop(0,'rgba(235,252,255,1)');g.addColorStop(.24,'rgba(100,215,255,.95)');g.addColorStop(.72,'rgba(32,151,240,.55)');g.addColorStop(1,'rgba(20,100,220,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(64,64,34,52,0,0,Math.PI*2);ctx.fill();
  }else if(kind==='smoke'){
    const g=ctx.createRadialGradient(64,64,2,64,64,58);g.addColorStop(0,'rgba(220,220,220,.8)');g.addColorStop(.45,'rgba(110,105,100,.42)');g.addColorStop(1,'rgba(40,35,32,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  }else if(kind==='spark'){
    const g=ctx.createRadialGradient(64,64,1,64,64,45);g.addColorStop(0,'rgba(255,255,230,1)');g.addColorStop(.28,'rgba(255,204,50,.95)');g.addColorStop(.72,'rgba(255,70,5,.5)');g.addColorStop(1,'rgba(255,30,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  }else if(kind==='grass'){
    ctx.strokeStyle='rgba(42,118,42,.95)';ctx.lineWidth=5;ctx.lineCap='round';for(let i=0;i<7;i++){const x=18+i*15;ctx.beginPath();ctx.moveTo(64,124);ctx.quadraticCurveTo(x,72,x+((i%2)?8:-8),20+(i%3)*10);ctx.stroke();}ctx.strokeStyle='rgba(90,160,58,.8)';ctx.lineWidth=3;for(let i=0;i<5;i++){const x=25+i*18;ctx.beginPath();ctx.moveTo(64,124);ctx.quadraticCurveTo(x,83,x,38);ctx.stroke();}
  }
  dt.update();v8FxTextures[kind]=dt;return dt;
}

function v8GrassMaterial(){return sharedMat('v8-grass-sprite',m=>{const t=v8FxTexture('grass');m.diffuseTexture=t;m.opacityTexture=t;m.useAlphaFromDiffuseTexture=true;m.emissiveColor=new BABYLON.Color3(.08,.16,.05);m.backFaceCulling=false;m.specularColor=BABYLON.Color3.Black();});}

function v8GroundTexture(){
  const dt=new BABYLON.DynamicTexture('v8-ground-tex',{width:512,height:512},scene,false),ctx=dt.getContext();
  ctx.fillStyle='#4f873c';ctx.fillRect(0,0,512,512);
  for(let i=0;i<1250;i++){const x=Math.random()*512,y=Math.random()*512,r=1+Math.random()*6;const g=80+Math.floor(Math.random()*55);ctx.fillStyle=`rgba(${35+Math.floor(Math.random()*25)},${g},${28+Math.floor(Math.random()*35)},${.05+Math.random()*.13})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  for(let i=0;i<85;i++){ctx.strokeStyle=`rgba(55,100,35,${.08+Math.random()*.08})`;ctx.lineWidth=1+Math.random()*2;ctx.beginPath();const x=Math.random()*512,y=Math.random()*512;ctx.moveTo(x,y);ctx.quadraticCurveTo(x+rand(-35,35),y+rand(-35,35),x+rand(-55,55),y+rand(-55,55));ctx.stroke();}
  dt.update();dt.uScale=2.2;dt.vScale=2.2;return dt;
}

function v8DecorateGround(){
  const ground=scene.getMeshByName('grass');if(ground){ground.receiveShadows=true;ground.material.diffuseTexture=v8GroundTexture();ground.material.diffuseColor=new BABYLON.Color3(.72,.88,.65);ground.material.specularColor=new BABYLON.Color3(.03,.04,.02);}
  const tileA=sharedMat('v8-tile-a',m=>{m.diffuseColor=new BABYLON.Color3(.43,.69,.34);m.alpha=.32;m.specularColor=BABYLON.Color3.Black();});
  const tileB=sharedMat('v8-tile-b',m=>{m.diffuseColor=new BABYLON.Color3(.46,.72,.36);m.alpha=.25;m.specularColor=BABYLON.Color3.Black();});
  for(const mesh of scene.meshes.filter(m=>m.name.startsWith('tile-'))){const parts=mesh.name.split('-'),x=Number(parts[1]),y=Number(parts[2]);mesh.scaling.x=1.12;mesh.scaling.z=1.12;mesh.scaling.y=.32;mesh.position.y=.028;mesh.material=(x+y)%2?tileA:tileB;mesh.receiveShadows=true;}

  const dirt=sharedMat('v8-dirt-path',m=>{m.diffuseColor=new BABYLON.Color3(.53,.38,.21);m.specularColor=new BABYLON.Color3(.025,.02,.012);});
  const pathX=gpos(START.x,START.y).x;
  const centers=[],left=[],right=[];let wobble=0;
  const steps=34;
  for(let i=0;i<steps;i++){
    const t=i/(steps-1),z=ORIGIN+t*(G-1)*CELL;
    wobble=wobble*.72+rand(-.12,.12);
    const x=pathX+Math.sin(t*Math.PI*2.15)*.16+wobble;
    const width=.72+.12*Math.sin(t*Math.PI*4.4)+rand(-.035,.035);
    centers.push(new BABYLON.Vector3(x,.068,z));
    left.push(new BABYLON.Vector3(x-width,.068,z));
    right.push(new BABYLON.Vector3(x+width,.068,z));
  }
  const path=BABYLON.MeshBuilder.CreateRibbon('v8-path',{pathArray:[left,right],closeArray:false,closePath:false,sideOrientation:BABYLON.Mesh.DOUBLESIDE,updatable:false},scene);
  path.material=dirt;path.receiveShadows=true;
  const colors=[];const verts=path.getTotalVertices();
  for(let i=0;i<verts;i++){const shade=.84+((i%7)/7)*.14;colors.push(.53*shade,.38*shade,.21*shade,1);}
  const vd=new BABYLON.VertexData();vd.colors=colors;vd.applyToMesh(path,true);
  dirt.useVertexColor=true;

  const gm=v8GrassMaterial();
  for(let i=0;i<62;i++){let x,z;do{x=rand(-7.2,7.2);z=rand(-7.2,7.2);}while(Math.abs(x-pathX)<1.15&&Math.abs(z)<6.5);const p=BABYLON.MeshBuilder.CreatePlane('v8-grass-tuft',{size:rand(.26,.48)},scene);p.position.set(x,.18,z);p.billboardMode=BABYLON.Mesh.BILLBOARDMODE_Y;p.material=gm;}
  const rockMat=sharedMat('v8-rock',m=>{m.diffuseColor=new BABYLON.Color3(.37,.38,.34);m.specularColor=new BABYLON.Color3(.08,.08,.07);});
  for(let i=0;i<22;i++){const r=BABYLON.MeshBuilder.CreateIcoSphere('v8-rock',{radius:rand(.09,.22),subdivisions:1},scene);const a=Math.random()*Math.PI*2,rr=rand(7.4,11);r.position.set(Math.cos(a)*rr,.12,Math.sin(a)*rr);r.scaling.y=rand(.55,.9);r.rotation.y=Math.random()*Math.PI;r.material=rockMat;r.receiveShadows=true;if(v8Shadow)v8Shadow.addShadowCaster(r);}
  const flowerCols=[[1,.68,.8],[1,.85,.18],[.75,.55,1],[1,.5,.3]];
  for(let i=0;i<18;i++){const col=flowerCols[i%flowerCols.length],stem=BABYLON.MeshBuilder.CreateCylinder('flower-stem',{height:.24,diameter:.025,tessellation:6},scene),a=Math.random()*Math.PI*2,rr=rand(6.8,9.2);stem.position.set(Math.cos(a)*rr,.12,Math.sin(a)*rr);stem.material=sharedMat('flower-stem-mat',m=>m.diffuseColor=new BABYLON.Color3(.12,.42,.1));const bloom=BABYLON.MeshBuilder.CreateSphere('flower',{diameter:.1,segments:6},scene);bloom.position.set(stem.position.x,.25,stem.position.z);bloom.material=mat('flower-'+i,...col);}
}

function v8EnableShadows(){
  const sun=scene.getLightByName('sun');if(!sun)return;
  const size=innerWidth<700?512:1024;v8Shadow=new BABYLON.ShadowGenerator(size,sun);v8Shadow.useBlurExponentialShadowMap=true;v8Shadow.blurKernel=innerWidth<700?6:12;v8Shadow.setDarkness(.3);sun.shadowMinZ=-4;sun.shadowMaxZ=28;
  for(const m of scene.meshes){if(!m||m.isDisposed())continue;if(m.name==='grass'||m.name.startsWith('tile-')||m.name.startsWith('v8-path')||m.name.startsWith('v8-grass')){m.receiveShadows=true;continue;}if(m.name.includes('tree')||m.name.includes('pine')||m.name.includes('log')||m.name.includes('rabbit')||m.name.includes('boss')||m.name==='leaf'||m.parent?.name==='tree-canopy')v8Shadow.addShadowCaster(m);}
}
function v8AddCaster(root){if(!v8Shadow||!root)return;const meshes=root.getChildMeshes?root.getChildMeshes():[root];for(const m of meshes)if(m instanceof BABYLON.AbstractMesh)v8Shadow.addShadowCaster(m);}

const v8CreateSceneBase=createScene;
createScene=async function(){
  const s=await v8CreateSceneBase();
  s.imageProcessingConfiguration.contrast=1.12;s.imageProcessingConfiguration.exposure=1.04;s.imageProcessingConfiguration.toneMappingEnabled=true;
  try{v8Glow=new BABYLON.GlowLayer('v8-glow',s,{blurKernelSize:24});v8Glow.intensity=.42;}catch(e){console.warn('Glow unavailable',e);}
  v8EnableShadows();v8DecorateGround();
  for(const m of s.meshes.filter(m=>m.name.includes('rabbit')||m.name.includes('boss')))v8Shadow?.addShadowCaster(m);
  return s;
};

const v8MakeCubeBase=makeCube;
makeCube=function(x,y){const root=v8MakeCubeBase(x,y);const lid=root.getChildMeshes().find(m=>m.name==='crate-wood-lid'),lock=root.getChildMeshes().find(m=>m.name==='crate-lock');root.metadata={...(root.metadata||{}),lid,lock,opened:false};v8AddCaster(root);return root;};

function v8Burst(pos,kind){
  const tex=v8FxTexture(kind==='dead'?'smoke':'spark'),ps=new BABYLON.ParticleSystem('v8-crate-burst',kind==='dead'?55:42,scene);ps.particleTexture=tex;ps.emitter=pos.clone();ps.minEmitBox=new BABYLON.Vector3(-.08,0,-.08);ps.maxEmitBox=new BABYLON.Vector3(.08,.12,.08);ps.minLifeTime=.25;ps.maxLifeTime=kind==='dead'?.75:.55;ps.minSize=.05;ps.maxSize=kind==='dead'?.35:.17;ps.manualEmitCount=kind==='dead'?55:42;ps.emitRate=0;ps.blendMode=kind==='dead'?BABYLON.ParticleSystem.BLENDMODE_STANDARD:BABYLON.ParticleSystem.BLENDMODE_ADD;ps.gravity=new BABYLON.Vector3(0,kind==='dead'?.5:-2.4,0);ps.direction1=new BABYLON.Vector3(-1.2,kind==='dead'?.3:1,-1.2);ps.direction2=new BABYLON.Vector3(1.2,kind==='dead'?1.7:3.2,1.2);ps.minEmitPower=.4;ps.maxEmitPower=1.3;if(kind==='dead'){ps.color1=new BABYLON.Color4(.28,.25,.23,.72);ps.color2=new BABYLON.Color4(.12,.1,.09,.5);ps.colorDead=new BABYLON.Color4(.1,.08,.07,0);}else{ps.color1=new BABYLON.Color4(1,.84,.15,1);ps.color2=new BABYLON.Color4(1,.47,.03,.9);ps.colorDead=new BABYLON.Color4(1,.2,0,0);}ps.start();setTimeout(()=>{try{ps.dispose();}catch{}},1000);
}
setCrateResult=function(root,dead){
  if(!root||root.metadata?.opened)return;if(!root.metadata)root.metadata={};root.metadata.opened=true;
  const lid=root.metadata.lid||root.getChildMeshes().find(m=>m.name==='crate-wood-lid');
  root.getChildMeshes().forEach(m=>{if(m.name.startsWith('crate-wood'))m.material=dead?mat('crate-dead-'+Math.random(),.42,.035,.025):mat('crate-good-'+Math.random(),.78,.5,.07);});
  if(lid){BABYLON.Animation.CreateAndStartAnimation('lid-open',lid,'rotation.x',60,20,lid.rotation.x,-1.25,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);BABYLON.Animation.CreateAndStartAnimation('lid-rise',lid,'position.y',60,20,lid.position.y,lid.position.y+.16,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);}
  BABYLON.Animation.CreateAndStartAnimation('crate-pop',root,'scaling',60,14,root.scaling.clone(),new BABYLON.Vector3(1.12,.92,1.12),BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,undefined,()=>{if(!root.isDisposed())BABYLON.Animation.CreateAndStartAnimation('crate-settle',root,'scaling',60,12,root.scaling.clone(),BABYLON.Vector3.One(),BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);});
  v8Burst(root.getAbsolutePosition().add(new BABYLON.Vector3(0,.45,0)),dead?'dead':'good');dead?v8SfxCrateBad():v8SfxCrateGood();
};

// ---- Formerly app5.js ----
function v8WaterTexture(){return v8FxTexture('water');}
function v8WaterMat(id,alpha){return sharedMat(id,m=>{m.diffuseColor=new BABYLON.Color3(.14,.72,1);m.emissiveColor=new BABYLON.Color3(.03,.27,.5);m.alpha=alpha;m.specularColor=new BABYLON.Color3(.9,.98,1);m.specularPower=96;m.backFaceCulling=false;});}
function v8MakeWaterParticles(mode){
  const emitter=BABYLON.MeshBuilder.CreateSphere('v8-water-emitter',{diameter:.01},scene);emitter.isVisible=false;emitter.parent=player;emitter.position.set(0,.62,-.4);
  const ps=new BABYLON.ParticleSystem('v8-water-particles',mode==='wide'?220:150,scene);ps.particleTexture=v8WaterTexture();ps.emitter=emitter;ps.minEmitBox=new BABYLON.Vector3(-.08,-.04,-.05);ps.maxEmitBox=new BABYLON.Vector3(.08,.06,.05);ps.color1=new BABYLON.Color4(.75,.95,1,.9);ps.color2=new BABYLON.Color4(.18,.68,1,.75);ps.colorDead=new BABYLON.Color4(.1,.45,1,0);ps.minSize=.025;ps.maxSize=mode==='wide'?.11:.075;ps.minLifeTime=.12;ps.maxLifeTime=mode==='wide'?.34:.28;ps.emitRate=mode==='wide'?260:190;ps.blendMode=BABYLON.ParticleSystem.BLENDMODE_STANDARD;ps.gravity=new BABYLON.Vector3(0,-1.6,0);if(mode==='wide'){ps.direction1=new BABYLON.Vector3(-1.25,.1,-5);ps.direction2=new BABYLON.Vector3(1.25,.35,-6.3);}else{ps.direction1=new BABYLON.Vector3(-.1,.05,-7.4);ps.direction2=new BABYLON.Vector3(.1,.18,-8.4);}ps.minEmitPower=.85;ps.maxEmitPower=1.25;ps.updateSpeed=.012;ps.start();return{emitter,ps};
}
function v8ClearWaterFx(){if(v8WaterFx.particles){try{v8WaterFx.particles.stop();v8WaterFx.particles.dispose();}catch{}}if(v8WaterFx.emitter&&!v8WaterFx.emitter.isDisposed())v8WaterFx.emitter.dispose();if(v8WaterFx.mesh&&!v8WaterFx.mesh.isDisposed())v8WaterFx.mesh.dispose();v8WaterFx={mode:null,mesh:null,emitter:null,particles:null};waterMesh=null;}
function v8EnsureWaterFx(mode){
  if(v8WaterFx.mode===mode&&v8WaterFx.mesh&&!v8WaterFx.mesh.isDisposed())return;
  v8ClearWaterFx();const a=new BABYLON.Vector3(0,.63,-.34);let mesh;
  if(mode==='wide'){const range=8*CELL,half=2.25*CELL,verts=[a.x,a.y,a.z,a.x-half,a.y-.18,a.z-range,a.x+half,a.y-.18,a.z-range],vd=new BABYLON.VertexData();mesh=new BABYLON.Mesh('v8-water-wide',scene);vd.positions=verts;vd.indices=[0,2,1];vd.normals=[0,1,0,0,1,0,0,1,0];vd.applyToMesh(mesh);mesh.parent=player;mesh.material=v8WaterMat('v8-water-wide-mat',.25);}else{const b=new BABYLON.Vector3(a.x,a.y-.08,a.z-10*CELL);mesh=BABYLON.MeshBuilder.CreateTube('v8-water-focus',{path:[a,b],radius:.055,tessellation:10},scene);mesh.parent=player;mesh.material=v8WaterMat('v8-water-focus-mat',.7);}
  const fx=v8MakeWaterParticles(mode);v8WaterFx={mode,mesh,emitter:fx.emitter,particles:fx.ps};waterMesh=mesh;v8StartWaterAudio(mode);
}
drawWideWater=function(){v8EnsureWaterFx('wide');};drawFocusWater=function(){v8EnsureWaterFx('focus');};
clearWater=function(){v8ClearWaterFx();v8StopWaterAudio();$('waterBtn').classList.remove('hitting');};

function v8WaterSplash(){
  const now=performance.now();if(now-v8LastSplash<150)return;v8LastSplash=now;
  const pos=boss.position.add(new BABYLON.Vector3(0,.75,.25)),ps=new BABYLON.ParticleSystem('v8-water-splash',34,scene);ps.particleTexture=v8WaterTexture();ps.emitter=pos;ps.manualEmitCount=34;ps.emitRate=0;ps.minLifeTime=.15;ps.maxLifeTime=.38;ps.minSize=.035;ps.maxSize=.14;ps.color1=new BABYLON.Color4(.8,.97,1,1);ps.color2=new BABYLON.Color4(.1,.62,1,.85);ps.colorDead=new BABYLON.Color4(.1,.4,1,0);ps.direction1=new BABYLON.Vector3(-1.7,.2,-.5);ps.direction2=new BABYLON.Vector3(1.7,2,.8);ps.minEmitPower=.5;ps.maxEmitPower=1.2;ps.gravity=new BABYLON.Vector3(0,-4.5,0);ps.start();setTimeout(()=>{try{ps.dispose();}catch{}},700);v8SfxSplash();
}
waterTick=function(dt){
  if(!state.attacking||state.inputLocked){clearWater();boss.scaling.setAll(1);if(bossSplash)bossSplash.isVisible=false;return;}
  v8EnsureWaterFx(state.waterMode);const hit=waterCanHit();$('waterBtn').classList.toggle('hitting',hit);
  if(hit){const dps=state.waterMode==='wide'?5:10;state.bossHp-=dps*dt;boss.scaling.setAll(1.025);if(bossSplash){bossSplash.isVisible=true;bossSplash.scaling.setAll(1+.08*Math.sin(performance.now()*.03));}v8WaterSplash();updateHud();if(state.bossHp<=0)win();}else{boss.scaling.setAll(1);if(bossSplash)bossSplash.isVisible=false;}
};

function v8Scorch(pos){const d=BABYLON.MeshBuilder.CreateDisc('v8-scorch',{radius:.36,tessellation:24},scene);d.rotation.x=Math.PI/2;d.position.set(pos.x,.085,pos.z);const m=mat('v8-scorch-mat-'+Math.random(),.08,.045,.025);m.alpha=.42;m.specularColor=BABYLON.Color3.Black();d.material=m;setTimeout(()=>{if(!d.isDisposed())d.dispose();},4800);}
function v8FireImpact(pos){
  v8Scorch(pos);v8CameraShake=Math.max(v8CameraShake,.11);v8SfxExplosion();
  const spark=new BABYLON.ParticleSystem('v8-impact-sparks',80,scene);spark.particleTexture=v8FxTexture('spark');spark.emitter=pos.clone();spark.manualEmitCount=80;spark.emitRate=0;spark.minLifeTime=.12;spark.maxLifeTime=.42;spark.minSize=.04;spark.maxSize=.18;spark.color1=new BABYLON.Color4(1,.8,.2,1);spark.color2=new BABYLON.Color4(1,.18,.02,.9);spark.colorDead=new BABYLON.Color4(.3,.02,0,0);spark.direction1=new BABYLON.Vector3(-2,.2,-2);spark.direction2=new BABYLON.Vector3(2,2.5,2);spark.minEmitPower=.7;spark.maxEmitPower=1.8;spark.gravity=new BABYLON.Vector3(0,-5,0);spark.blendMode=BABYLON.ParticleSystem.BLENDMODE_ADD;spark.start();
  const smoke=new BABYLON.ParticleSystem('v8-impact-smoke',34,scene);smoke.particleTexture=v8FxTexture('smoke');smoke.emitter=pos.clone();smoke.manualEmitCount=34;smoke.emitRate=0;smoke.minLifeTime=.45;smoke.maxLifeTime=1.05;smoke.minSize=.16;smoke.maxSize=.55;smoke.color1=new BABYLON.Color4(.35,.3,.26,.62);smoke.color2=new BABYLON.Color4(.16,.14,.13,.42);smoke.colorDead=new BABYLON.Color4(.08,.07,.07,0);smoke.direction1=new BABYLON.Vector3(-.5,.6,-.5);smoke.direction2=new BABYLON.Vector3(.5,1.8,.5);smoke.minEmitPower=.25;smoke.maxEmitPower=.7;smoke.gravity=new BABYLON.Vector3(0,.25,0);smoke.start();
  const light=new BABYLON.PointLight('v8-impact-light',pos.add(new BABYLON.Vector3(0,.3,0)),scene);light.diffuse=new BABYLON.Color3(1,.25,.03);light.intensity=2.5;light.range=3.5;setTimeout(()=>{try{light.dispose();spark.dispose();smoke.dispose();}catch{}},1200);
}

const v8SpawnFireBase=spawnFireball;
spawnFireball=function(target){v8SpawnFireBase(target);v8SfxFire();};
fireTick=function(dt){
  const playerHitPos=player.position.add(new BABYLON.Vector3(0,.65,0));
  for(const f of state.fireballs){if(!f.node||f.node.isDisposed())continue;f.age+=dt;f.node.position.addInPlace(f.dir.scale(f.speed*dt));f.node.rotation.z+=f.spin*dt;const pulse=1+.16*Math.sin(f.age*24);if(f.visual.core)f.visual.core.scaling.setAll(pulse);if(f.visual.shell)f.visual.shell.scaling.setAll(1.1+.2*Math.sin(f.age*18));if(f.visual.flameA){f.visual.flameA.scaling.y=1.05+.18*Math.sin(f.age*20);f.visual.flameB.scaling.x=1+.13*Math.cos(f.age*17);}if(BABYLON.Vector3.Distance(f.node.position,playerHitPos)<.5){if(state.shield){state.shield=false;v8SfxShield?.();flash('🛡️ Bouclier : attaque bloquée !',500);}else{state.hp-=f.damage;v8FireImpact(playerHitPos);flash(`🔥 -${f.damage} PV`,400);}f.visual.dispose();updateHud();if(state.hp<=0)return lose('Plus de PV !');}else if(BABYLON.Vector3.Distance(f.node.position,boss.position)>23)f.visual.dispose();}
  state.fireballs=state.fireballs.filter(f=>f.node&&!f.node.isDisposed());
};

const v8FollowCameraBase=followCamera;
followCamera=function(dt){v8FollowCameraBase(dt);if(v8CameraShake>0.002){camera.position.x+=rand(-v8CameraShake,v8CameraShake);camera.position.y+=rand(-v8CameraShake*.35,v8CameraShake*.35);camera.position.z+=rand(-v8CameraShake,v8CameraShake);v8CameraShake*=Math.exp(-12*dt);}else v8CameraShake=0;};

// ---- Formerly app6.js ----
// Procedural sound design: no external audio assets.
function v8EnsureAudio(){if(!v8SoundOn)return null;if(v8Audio&&v8Audio.state!=='closed'){if(v8Audio.state==='suspended')v8Audio.resume().catch(()=>{});return v8Audio;}const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;v8Audio=new AC();v8Master=v8Audio.createGain();v8Master.gain.value=.52;v8Master.connect(v8Audio.destination);return v8Audio;}
function v8Tone(freq,dur,type='sine',gain=.08,delay=0,endFreq=null){const a=v8EnsureAudio();if(!a||!v8Master)return;const o=a.createOscillator(),g=a.createGain(),t=a.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(v8Master);o.start(t);o.stop(t+dur+.03);}
function v8Noise(dur=.18,gain=.06,low=500,high=5000,delay=0){const a=v8EnsureAudio();if(!a||!v8Master)return;const len=Math.max(1,Math.floor(a.sampleRate*dur)),buf=a.createBuffer(1,len,a.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=Math.random()*2-1;const src=a.createBufferSource(),bp=a.createBiquadFilter(),g=a.createGain(),t=a.currentTime+delay;src.buffer=buf;bp.type='bandpass';bp.frequency.value=(low+high)/2;bp.Q.value=1.1;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);src.connect(bp);bp.connect(g);g.connect(v8Master);src.start(t);src.stop(t+dur+.02);}
function v8StartWaterAudio(mode){if(v8WaterAudio||!v8SoundOn)return;const a=v8EnsureAudio();if(!a||!v8Master)return;const seconds=1,buf=a.createBuffer(1,a.sampleRate*seconds,a.sampleRate),data=buf.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=last*.92+white*.08;data[i]=last;}const src=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();src.buffer=buf;src.loop=true;filter.type='bandpass';filter.frequency.value=mode==='wide'?1300:1900;filter.Q.value=.65;g.gain.value=mode==='wide'?.055:.045;src.connect(filter);filter.connect(g);g.connect(v8Master);src.start();v8WaterAudio={src,g};}
function v8StopWaterAudio(){if(!v8WaterAudio)return;try{const a=v8Audio,t=a?.currentTime||0;v8WaterAudio.g.gain.cancelScheduledValues(t);v8WaterAudio.g.gain.setValueAtTime(Math.max(.0001,v8WaterAudio.g.gain.value),t);v8WaterAudio.g.gain.exponentialRampToValueAtTime(.0001,t+.08);v8WaterAudio.src.stop(t+.1);}catch{}v8WaterAudio=null;}
function v8SfxStep(){v8Tone(145,.055,'sine',.025,0,105);}
function v8SfxCoin(){v8Tone(850,.09,'triangle',.07);v8Tone(1320,.11,'triangle',.055,.065);}
function v8SfxCrateGood(){v8Noise(.1,.035,400,2200);v8Tone(520,.1,'triangle',.06,.02);v8Tone(820,.13,'triangle',.065,.11);}
function v8SfxCrateBad(){v8Noise(.3,.1,80,800);v8Tone(120,.35,'sawtooth',.08,0,45);}
function v8SfxFire(){v8Noise(.14,.055,500,3600);v8Tone(260,.16,'sawtooth',.035,0,130);}
function v8SfxExplosion(){v8Noise(.34,.13,60,900);v8Tone(95,.28,'square',.06,0,42);}
function v8SfxSplash(){v8Noise(.08,.025,1000,5500);}
function v8SfxVictory(){const seq=[[523,.12,0],[659,.12,.13],[784,.14,.26],[1047,.3,.42]];for(const[n,d,t]of seq)v8Tone(n,d,'triangle',.075,t);}
function v8SfxPickup(type){if(type==='carrot'){v8Tone(660,.1,'triangle',.05);v8Tone(880,.16,'triangle',.05,.08);}else v8Tone(type==='shield'?420:740,.16,'sine',.06,0,type==='shield'?680:1100);}
function v8SfxShield(){v8Tone(280,.12,'sine',.07);v8Tone(560,.22,'triangle',.06,.05);}
function v8SfxScanner(){v8Tone(520,.08,'square',.035);v8Tone(780,.08,'square',.035,.1);v8Tone(1040,.11,'square',.035,.2);}
function v8StartMusic(theme='meadow'){if(v8MusicTimer||!v8SoundOn)return;const scales={meadow:[262,330,392,523,392,330],forest:[220,262,330,392,330,262],cave:[196,247,294,392,294,247],desert:[294,370,440,587,440,370],night:[196,233,294,349,294,233],sky:[330,392,494,659,494,392],finale:[262,330,415,523,659,523]};const notes=scales[theme]||scales.meadow;let beat=0;const play=()=>{if(!v8SoundOn||state.paused||!state.running)return;const n=notes[beat++%notes.length];v8Tone(n,.30,'triangle',.018);if(beat%2===0)v8Tone(n/2,.24,'sine',.012,.02);};play();v8MusicTimer=setInterval(play,430);}
function v8StopMusic(){if(v8MusicTimer){clearInterval(v8MusicTimer);v8MusicTimer=null;}}

const v8RequestMoveBase=requestMove;
requestMove=function(dir){const was=state.moving,oldX=state.playerCell.x,oldY=state.playerCell.y;v8RequestMoveBase(dir);if(!was&&state.moving&&(oldX!==state.playerCell.x||oldY!==state.playerCell.y))v8SfxStep();};
const v8ArriveBase=arrive;
arrive=function(){const before=state.runCoins;v8ArriveBase();if(state.runCoins>before)v8SfxCoin();};
const v8WinBase=win;
win=function(){if(!state.inputLocked)v8SfxVictory();v8WinBase();};

document.addEventListener('pointerdown',()=>v8EnsureAudio(),{once:true});
const sb=$('soundBtn');if(sb){sb.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();v8SoundOn=!v8SoundOn;sb.textContent=v8SoundOn?'🔊':'🔇';if(!v8SoundOn){v8StopWaterAudio();v8StopMusic();if(v8Master&&v8Audio)v8Master.gain.setTargetAtTime(.0001,v8Audio.currentTime,.02);}else{v8EnsureAudio();if(v8Master&&v8Audio)v8Master.gain.setTargetAtTime(.52,v8Audio.currentTime,.03);if(state.attacking)v8StartWaterAudio(state.waterMode);if(state.running&&!state.paused)v8StartMusic(levelSpec()?.theme);}});}
