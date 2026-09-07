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

const v8RequestMoveBase=requestMove;
requestMove=function(dir){const was=state.moving,oldX=state.playerCell.x,oldY=state.playerCell.y;v8RequestMoveBase(dir);if(!was&&state.moving&&(oldX!==state.playerCell.x||oldY!==state.playerCell.y))v8SfxStep();};
const v8ArriveBase=arrive;
arrive=function(){const before=state.runCoins;v8ArriveBase();if(state.runCoins>before)v8SfxCoin();};
const v8WinBase=win;
win=function(){if(!state.inputLocked)v8SfxVictory();v8WinBase();};

document.addEventListener('pointerdown',()=>v8EnsureAudio(),{once:true});
const sb=$('soundBtn');if(sb){sb.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();v8SoundOn=!v8SoundOn;sb.textContent=v8SoundOn?'🔊':'🔇';if(!v8SoundOn){v8StopWaterAudio();if(v8Master&&v8Audio)v8Master.gain.setTargetAtTime(.0001,v8Audio.currentTime,.02);}else{v8EnsureAudio();if(v8Master&&v8Audio)v8Master.gain.setTargetAtTime(.52,v8Audio.currentTime,.03);if(state.attacking)v8StartWaterAudio(state.waterMode);}});}
