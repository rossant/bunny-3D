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
  const interval=Math.max(1100,2300-(state.level-1)*15);if(now-state.lastFire<interval||state.inputLocked)return;state.lastFire=now;state.volley++;
  makeWarning({...state.playerCell});
  const doubleShot=state.level>=40||(state.level>=20&&state.volley%3===0);if(doubleShot){const offset=Math.random()<.5?-1:1;makeWarning({x:Math.max(0,Math.min(G-1,state.playerCell.x+offset)),y:state.playerCell.y},.78);}
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
  state.fireballs.push({visual:v,node:v.root,dir,speed:3.2+Math.min(1.5,state.level*.015),damage:12+Math.floor((state.level-1)/20)*2,age:0,spin:(Math.random()-.5)*3});
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
  if(state.inputLocked)return;state.inputLocked=true;state.attacking=false;clearWater();playAnim(bossAnimations,'Death',false,1.1);
  if(save.level<100)save.level++;persist();$('victoryCoins').textContent=state.runCoins;$('victoryTitle').textContent=state.level>=100?'🏆 Jeu terminé !':'🎉 Boss vaincu !';$('nextBtn').textContent=state.level>=100?'Rejouer niveau 100':'Niveau suivant';
  setTimeout(()=>{state.running=false;$('hud').classList.add('hidden');$('controls').classList.add('hidden');$('modeBadge').classList.add('hidden');showOnly('victory');menuRefresh();state.layout=null;state.revealedTraps=new Set();},900);
}

$('playBtn').onclick=()=>{state.layout=null;startLevel(true);};
$('nextBtn').onclick=()=>{state.layout=null;startLevel(true);};
$('menuBtn').onclick=()=>{state.running=false;state.layout=null;$('hud').classList.add('hidden');$('controls').classList.add('hidden');$('modeBadge').classList.add('hidden');menuRefresh();showOnly('menu');};
$('modeBtn').onclick=e=>{e.preventDefault();toggleMode();};
for(const b of document.querySelectorAll('[data-dir]'))b.addEventListener('click',e=>{e.preventDefault();requestMove(b.dataset.dir);});
function holdWater(){const b=$('waterBtn');b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);state.attacking=true;});for(const ev of['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,e=>{e.preventDefault();state.attacking=false;clearWater();});}
holdWater();
const held=new Set();function keyDir(k){if(k==='ArrowUp'||k==='w'||k==='W')return'up';if(k==='ArrowDown'||k==='s'||k==='S')return'down';if(k==='ArrowLeft'||k==='a'||k==='A')return'left';if(k==='ArrowRight'||k==='d'||k==='D')return'right';return null;}
addEventListener('keydown',e=>{const d=keyDir(e.key);if(d||e.key===' '||e.key==='m'||e.key==='M')e.preventDefault();if(d){if(held.has(d))return;held.add(d);requestMove(d);return;}if(e.key===' ')state.attacking=true;else if((e.key==='m'||e.key==='M')&&!e.repeat)toggleMode();});
addEventListener('keyup',e=>{const d=keyDir(e.key);if(d)held.delete(d);if(e.key===' '){state.attacking=false;clearWater();}});

engine.runRenderLoop(()=>{
  if(!scene)return;const now=performance.now(),dt=Math.min(.05,(now-state.lastTime||16)/1000);state.lastTime=now;
  if(state.running&&!state.inputLocked){tickMovement(dt);followCamera(dt);bossFire(now);telegraphTick(dt);fireTick(dt);waterTick(dt);}else clearWater();
  for(const c of scene.meshes.filter(m=>m.name==='coin'&&!m.isDisposed())){c.rotation.y+=dt*2.3;c.position.y=.46+Math.sin(now*.004+c.position.x)*.06;}
  scene.render();
});
addEventListener('resize',()=>engine.resize());
menuRefresh();showOnly('menu');
