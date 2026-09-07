// V8 polish layer: lighting/shadows, organic terrain, water/fire FX, crate animation and procedural audio.
let v8Shadow=null,v8Glow=null,v8CameraShake=0;
let v8WaterFx={mode:null,mesh:null,emitter:null,particles:null};
let v8LastSplash=0;
let v8Audio=null,v8Master=null,v8WaterAudio=null,v8SoundOn=true;
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
