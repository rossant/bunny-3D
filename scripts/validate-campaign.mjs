import { CAMPAIGN } from '../src/levels.js';

const required=['title','theme','trapCount','cubeCount','coinCount','bossHp','bossFireInterval','bossDamage'];
if(CAMPAIGN.length!==24)throw new Error(`Expected 24 levels, found ${CAMPAIGN.length}.`);
for(const [index,level] of CAMPAIGN.entries()){
  for(const key of required)if(level[key]===undefined)throw new Error(`Level ${index+1} is missing ${key}.`);
  for(const key of ['trapCount','cubeCount','coinCount','bossHp','bossFireInterval','bossDamage'])if(!Number.isFinite(level[key])||level[key]<0)throw new Error(`Level ${index+1} has an invalid ${key}.`);
  if(level.layout){
    const occupied=new Set(),traps=new Set((level.layout.traps||[]).map(p=>`${p.x},${p.y}`));
    for(const [kind,items] of Object.entries({trap:level.layout.traps||[],cube:level.layout.cubes||[],coin:level.layout.coins||[],pickup:level.layout.pickups||[]}))for(const p of items){const cell=`${p.x},${p.y}`;if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>9||p.y<0||p.y>9)throw new Error(`Level ${index+1} has an out-of-bounds ${kind}.`);if(occupied.has(cell))throw new Error(`Level ${index+1} overlaps entities at ${cell}.`);occupied.add(cell);}
    const todo=[[4,9]],seen=new Set(['4,9']);while(todo.length){const [x,y]=todo.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=[x+dx,y+dy],cell=next.join(',');if(next[0]>=0&&next[0]<10&&next[1]>=0&&next[1]<10&&!traps.has(cell)&&!seen.has(cell)){seen.add(cell);todo.push(next);}}}
    if(!seen.has('4,0'))throw new Error(`Level ${index+1} has no safe route to the boss.`);
  }
}
console.log(`Campaign validated: ${CAMPAIGN.length} levels.`);
