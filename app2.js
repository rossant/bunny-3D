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
  const usedBase=new Set([key(START.x,START.y),key(BOSS_CELL.x,BOSS_CELL.y)]);const trapCount=Math.min(4+Math.floor((state.level-1)/5),12);let traps=[],used;
  for(let attempt=0;attempt<300;attempt++){
    used=new Set(usedBase);traps=[];for(let i=0;i<trapCount;i++)traps.push(freeCell(used,true));
    if(pathExists(new Set(traps.map(t=>key(t.x,t.y)))))break;
  }
  const cubes=[];for(let i=0;i<10;i++){const p=freeCell(used);cubes.push({...p,dead:Math.random()<.10,value:2+randInt(4)});}
  const looseCoins=[];const coinCount=Math.min(3+Math.floor((state.level-1)/4),7);for(let i=0;i<coinCount;i++){const p=freeCell(used);looseCoins.push({...p,value:1+randInt(2)});}
  return {traps,cubes,looseCoins};
}

function makeCoin(x,y,value){const c=BABYLON.MeshBuilder.CreateCylinder('coin',{diameter:.36,height:.08,tessellation:20},scene);c.rotation.x=Math.PI/2;const p=gpos(x,y);c.position.set(p.x,.46,p.z);const m=mat('coinmat-'+x+'-'+y,1,.72,.05);m.specularColor=new BABYLON.Color3(1,.9,.4);c.material=m;c.metadata={x,y,value};return c;}
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
  state.running=false;state.inputLocked=true;state.hp=100;state.runCoins=0;state.cubesOpened=0;state.attacking=false;state.moving=false;state.queuedMove=null;state.fireballs=[];state.telegraphs=[];state.level=save.level;state.volley=0;
  if(newLayout||!state.layout){state.layout=generateLayout();state.revealedTraps=new Set();}
  if(scene)scene.dispose();
  try{await createScene();}catch(err){console.error(err);setLoading(false);showOnly('menu');flash('Erreur de chargement 3D');return;}
  state.bossHpMax=50+Math.min(130,(state.level-1)*3);state.bossHp=state.bossHpMax;state.playerCell={...START};
  state.coins=state.layout.looseCoins.map(c=>({...c,taken:false,mesh:makeCoin(c.x,c.y,c.value)}));
  state.cubes=state.layout.cubes.map(c=>({...c,opened:false,mesh:makeCube(c.x,c.y)}));
  for(const t of state.layout.traps){if(state.revealedTraps.has(key(t.x,t.y)))makeRevealedTrap(t.x,t.y);}
  const pp=gpos(START.x,START.y);player.position.set(pp.x,0,pp.z);player.rotation.y=0;
  const bp=gpos(BOSS_CELL.x,BOSS_CELL.y);boss.position.set(bp.x,0,bp.z);boss.rotation.y=0;
  snapCamera();updateModeUI();updateHud();state.lastFire=performance.now()+700;state.lastTime=performance.now();
  setLoading(false);state.running=true;state.inputLocked=false;$('hud').classList.remove('hidden');$('controls').classList.remove('hidden');$('modeBadge').classList.remove('hidden');flash(`Niveau ${state.level}`);
}
function restartAttempt(){startLevel(false);}
function updateHud(){$('levelLabel').textContent=state.level;$('runCoins').textContent=state.runCoins;$('cubeCount').textContent=state.cubesOpened;$('hpText').textContent=Math.max(0,Math.ceil(state.hp));$('hpBar').style.width=Math.max(0,state.hp)+'%';$('bossHpText').textContent=Math.max(0,Math.ceil(state.bossHp));$('bossHpMax').textContent=state.bossHpMax;$('bossHpBar').style.width=Math.max(0,100*state.bossHp/state.bossHpMax)+'%';}
function updateModeUI(){$('modeText').textContent=state.waterMode==='wide'?'LARGE':'PRÉCIS';$('modeBtnText').textContent=state.waterMode==='wide'?'LARGE':'PRÉCIS';}
function toggleMode(){state.waterMode=state.waterMode==='wide'?'focus':'wide';updateModeUI();flash(state.waterMode==='wide'?'Jet large : facile, 5 dégâts/s':'Jet précis : même colonne, 10 dégâts/s',650);}

function requestMove(dir){
  if(!state.running||state.inputLocked)return;if(state.moving){if(!state.queuedMove)state.queuedMove=dir;return;}
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
  const trap=state.layout.traps.find(t=>t.x===state.playerCell.x&&t.y===state.playerCell.y);if(trap){state.revealedTraps.add(key(trap.x,trap.y));return lose('Trappe !');}
  const coin=state.coins.find(c=>!c.taken&&c.x===state.playerCell.x&&c.y===state.playerCell.y);if(coin){coin.taken=true;creditCoins(coin.value);if(coin.mesh)coin.mesh.dispose();flash(`🪙 +${coin.value} — sauvegardé`,500);updateHud();}
  const cube=state.cubes.find(c=>!c.opened&&c.x===state.playerCell.x&&c.y===state.playerCell.y);if(cube)openCube(cube);
}
function openCube(c){c.opened=true;state.cubesOpened++;setCrateResult(c.mesh,c.dead);if(c.dead){flash('💀 Mauvaise caisse !',500);updateHud();setTimeout(()=>lose('La caisse était mortelle !'),350);}else{creditCoins(c.value);flash(`📦 +${c.value} pièces — sauvegardées`,650);updateHud();}}
function lose(reason){if(state.inputLocked)return;state.inputLocked=true;state.attacking=false;clearWater();playAnim(playerAnimations,'Death',false,1.15);flash(`${reason} — pièces conservées`,1050);setTimeout(restartAttempt,1050);}
