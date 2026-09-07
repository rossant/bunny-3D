'use strict';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'petit-lapin-3d-save-v3';
const LEGACY_SAVE_KEYS = ['petit-lapin-3d-save-v2','petit-lapin-3d-save-v1'];
const BUNNY_ROOT = 'https://raw.githubusercontent.com/tech-leads-club/nj-mmo/master/client/public/models/monsters/';
const BUNNY_FILE = 'Elpy.glb';
const BOSS_FILE = 'Goblin.glb';
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
  running:false,inputLocked:false,loading:false,level:1,hp:100,bossHp:50,bossHpMax:50,runCoins:0,cubesOpened:0,
  playerCell:{...START},layout:null,revealedTraps:new Set(),coins:[],cubes:[],fireballs:[],telegraphs:[],
  moving:false,moveFrom:null,moveTo:null,moveElapsed:0,moveDuration:.18,queuedMove:null,
  waterMode:'wide',attacking:false,lastFire:0,lastTime:0,volley:0
};
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
