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
  for(const f of state.fireballs){if(!f.node||f.node.isDisposed())continue;f.age+=dt;f.node.position.addInPlace(f.dir.scale(f.speed*dt));f.node.rotation.z+=f.spin*dt;const pulse=1+.16*Math.sin(f.age*24);if(f.visual.core)f.visual.core.scaling.setAll(pulse);if(f.visual.shell)f.visual.shell.scaling.setAll(1.1+.2*Math.sin(f.age*18));if(f.visual.flameA){f.visual.flameA.scaling.y=1.05+.18*Math.sin(f.age*20);f.visual.flameB.scaling.x=1+.13*Math.cos(f.age*17);}if(BABYLON.Vector3.Distance(f.node.position,playerHitPos)<.5){state.hp-=f.damage;v8FireImpact(playerHitPos);f.visual.dispose();updateHud();flash(`🔥 -${f.damage} PV`,400);if(state.hp<=0)return lose('Plus de PV !');}else if(BABYLON.Vector3.Distance(f.node.position,boss.position)>23)f.visual.dispose();}
  state.fireballs=state.fireballs.filter(f=>f.node&&!f.node.isDisposed());
};

const v8FollowCameraBase=followCamera;
followCamera=function(dt){v8FollowCameraBase(dt);if(v8CameraShake>0.002){camera.position.x+=rand(-v8CameraShake,v8CameraShake);camera.position.y+=rand(-v8CameraShake*.35,v8CameraShake*.35);camera.position.z+=rand(-v8CameraShake,v8CameraShake);v8CameraShake*=Math.exp(-12*dt);}else v8CameraShake=0;};
