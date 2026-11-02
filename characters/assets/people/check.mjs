import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from '../../../three-deps/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../../../three-deps/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { FLOORS } from '../../typologies.js';
import { makeResidents } from '../../people.js';

GLTFLoader.prototype.loadAsync=async function(url){
  const bytes=await fs.readFile(new URL(url));
  return this.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const building=new T.Group(),rooms=[];
const levels=FLOORS.map((floor,l)=>{
  const level=new T.Group();level.position.y=l*3.15;building.add(level);
  const structure=new T.Group();structure.name='structure';level.add(structure);
  rooms[l]=floor.rooms.map(s=>{
    const room=new T.Group();room.position.set(s.x,0,s.z);room.parts={contents:new T.Group()};room.add(room.parts.contents);level.add(room);return room;
  });return level;
});
const people=await makeResidents({levels,rooms},FLOORS);
assert.equal(people.count,8);
assert.equal(people.residents.filter(p=>p.mode==='coffee').length,2);
assert.ok(!building.getObjectByName('reading-book'),'Remove the reading prop and activity');
const humans=[];building.traverse(o=>{if(/^resident-\d+$/.test(o.name))humans.push(o);});
function signature(root){const a=[];root.traverse(o=>{if(o.isBone||o.name.startsWith('resident-'))a.push(...o.position.toArray(),...o.quaternion.toArray());});return a;}
const before=signature(building);
const poses=people.residents.map(p=>signature(p.root));
const contacts=people.residents.filter(p=>p.activity).map(p=>({p,feet:['l','r'].map(s=>p.root.worldToLocal(p.bones[`foot_${s}`].getWorldPosition(new T.Vector3())))}));
let maxContactDrift=0,maxGripError=0,gripDiagnostic,minCoffeeWristDot=1,minThumbHeight=Infinity;
const keyHeight=[Infinity,-Infinity],keyZ=[Infinity,-Infinity];
const previousArms=new Map();let maxActivityArmStep=0,wristDiagnostic,stepDiagnostic;
const cupHeights=new Map(people.residents.filter(p=>p.cup).map(p=>[p,[Infinity,-Infinity]]));
for(let frame=0;frame<660;frame++){
  people.update(1/30,true);building.updateMatrixWorld(true);
  for(const p of humans){
    assert.ok(signature(p).every(Number.isFinite),'Every animated transform must remain finite');
    if(p.userData.activity==='walk'){
      assert.ok(p.position.z>=-2.651&&p.position.z<=2.651,'Walker must stay inside the clear gallery route');
      const l=levels.indexOf(p.parent.parent);assert.equal(p.position.x,FLOORS[l].hall.x);
    }
  }
  for(const {p,feet}of contacts)for(const [i,s]of ['l','r'].entries())maxContactDrift=Math.max(maxContactDrift,feet[i].distanceTo(p.root.worldToLocal(p.bones[`foot_${s}`].getWorldPosition(new T.Vector3()))));
  for(const p of people.residents.filter(p=>['coffee','painting','typing'].includes(p.mode))){
    assert.match(p.activity.inspect().source,/^CMU 79_\d+/,'Requested activities must use their recorded source');
    for(const side of ['l','r']){
      const q=p.bones[`lowerarm_${side}`].getWorldQuaternion(new T.Quaternion()),key=`${p.root.name}-${side}`;
      if(previousArms.has(key)&&q.angleTo(previousArms.get(key))>maxActivityArmStep){maxActivityArmStep=q.angleTo(previousArms.get(key));stepDiagnostic={key,mode:p.mode,time:p.activity.inspect().time};}
      previousArms.set(key,q);
    }
    if(p.mode==='typing')for(const side of ['l','r'])for(const finger of ['index','middle']){
      const tip=p.root.parent.worldToLocal(p.bones[`${finger}_03_${side}`].getWorldPosition(new T.Vector3()));
      keyHeight[0]=Math.min(keyHeight[0],tip.y);keyHeight[1]=Math.max(keyHeight[1],tip.y);
      keyZ[0]=Math.min(keyZ[0],tip.z);keyZ[1]=Math.max(keyZ[1],tip.z);
    }
  }
  for(const [p,range]of cupHeights){
    range[0]=Math.min(range[0],p.cup.position.y);range[1]=Math.max(range[1],p.cup.position.y);
    const grip=p.cup.localToWorld(p.activity.inspect().grip),hand=p.bones.hand_l.getWorldPosition(new T.Vector3()),error=hand.distanceTo(grip);
    if(error>maxGripError){maxGripError=error;gripDiagnostic={floor:p.floor,time:p.activity.inspect().time,hand:p.root.worldToLocal(hand).toArray(),target:p.root.worldToLocal(grip).toArray(),arm:['upperarm_l','lowerarm_l','hand_l'].map(n=>({name:n,parent:p.bones[n].parent.name,scale:p.bones[n].getWorldScale(new T.Vector3()).toArray()}))};}
    const wrist=p.bones.hand_l.getWorldPosition(new T.Vector3()),forearm=wrist.clone().sub(p.bones.lowerarm_l.getWorldPosition(new T.Vector3())).normalize(),fingers=p.bones.middle_01_l.getWorldPosition(new T.Vector3()).sub(wrist).normalize();
    if(forearm.dot(fingers)<minCoffeeWristDot){minCoffeeWristDot=forearm.dot(fingers);wristDiagnostic={floor:p.floor,time:p.activity.inspect().time,shoulder:p.root.worldToLocal(p.bones.upperarm_l.getWorldPosition(new T.Vector3())).toArray(),head:p.root.worldToLocal(p.bones.head.getWorldPosition(new T.Vector3())).toArray(),forearm:p.root.worldToLocal(p.bones.lowerarm_l.getWorldPosition(new T.Vector3())).toArray(),wrist:p.root.worldToLocal(wrist).toArray()};}
    const thumb=p.cup.worldToLocal(p.bones.thumb_03_l.getWorldPosition(new T.Vector3()));
    const index=p.cup.worldToLocal(p.bones.index_03_l.getWorldPosition(new T.Vector3()));
    minThumbHeight=Math.min(minThumbHeight,thumb.y-index.y);
  }
}
assert.ok(maxContactDrift<1e-6,'Activity feet must remain fixed to the floor');
assert.ok(minCoffeeWristDot>.80,'Cup grip must not reverse or sharply fold the wrist');
assert.ok(minThumbHeight>0,'The thumb must remain above the hooked index finger');
assert.ok(maxActivityArmStep<.13,'Activity arms must remain continuous at 30 fps, including loop boundaries');
assert.ok(keyHeight[0]>.815&&keyHeight[1]<.855,'Typing finger joints must stay above the keyboard without floating far from the keys');
assert.ok(keyZ[0]>-.35&&keyZ[1]<-.175,'Typing fingers must remain over the actual keyboard footprint');
if(maxGripError>=.005)console.log(gripDiagnostic);
assert.ok(maxGripError<.005,`The cup handle must stay within the gripping hand (${maxGripError})`);
for(const range of cupHeights.values())assert.ok(range[1]-range[0]>.25,'Every coffee resident must lift and lower the cup');
people.residents.forEach((p,i)=>assert.notDeepEqual(signature(p.root),poses[i],`${p.mode} must animate`));
building.traverse(o=>{if(o.isSkinnedMesh){const w=o.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-4,'Refined skin weights remain normalized');}});
assert.notDeepEqual(signature(building),before,'Active characters must actually animate');
people.update(0,false);
const paused=signature(building);
people.update(1,false);
const after=signature(building);
assert.ok(paused.every((x,i)=>Math.abs(x-after[i])<1e-9),'Pause must preserve every pose');
levels.forEach(l=>l.visible=false);
const hidden=signature(building);
assert.equal(people.update(1,true),false);
assert.deepEqual(signature(building),hidden,'Hidden characters must not tick');
const owned=new Set();
for(const p of humans){const mats=new Set();p.traverse(o=>{if(o.material)mats.add(o.material);});for(const m of mats){assert.ok(!owned.has(m),'Floor fading must not share materials between residents');owned.add(m);}}
console.log({maxContactDrift,maxGripError,minCoffeeWristDot,minThumbHeight,keyHeight,keyZ,maxActivityArmStep,wristDiagnostic,stepDiagnostic});
console.log('PASS: 8 residents; all activities animate; stable foot and cup contacts; normalized skin weights; no reading prop; finite IK; bounded walking; pause; hidden floors; independent fade materials.');
