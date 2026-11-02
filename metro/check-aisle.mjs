import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeWorld} from './model.js';
import {makePassengers} from './passengers.js';
const model=makeWorld();
const residents=await makePassengers(model,{loadSource:async name=>{
 const bytes=await fs.readFile(new URL(`../characters/assets/people/${name}.glb`,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}});
const person=residents.people.find(p=>p.role==='aisle-walker'),car=model.cars[person.car];
const obstacles=car.userData.grabObstacles.map(o=>({...o,a:new T.Vector3(...o.a),b:new T.Vector3(...o.b)}));
// Closest distance between two finite segments, including parallel segments.
function distance(p1,q1,p2,q2){
 const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),r=p1.clone().sub(p2),a=d1.lengthSq(),e=d2.lengthSq(),f=d2.dot(r),c=d1.dot(r),b=d1.dot(d2),den=a*e-b*b;
 let s=a>1e-10?(e>1e-10&&den>1e-10?T.MathUtils.clamp((b*f-c*e)/den,0,1):T.MathUtils.clamp(-c/a,0,1)):0;
 let t=e>1e-10?(b*s+f)/e:0;
 if(t<0){t=0;s=a>1e-10?T.MathUtils.clamp(-c/a,0,1):0;}else if(t>1){t=1;s=a>1e-10?T.MathUtils.clamp((b-c)/a,0,1):0;}
 return p1.clone().addScaledVector(d1,s).distanceTo(p2.clone().addScaledVector(d2,t));
}
const capsules=[['head','head',.14],['pelvis','neck_01',.19]];
for(const side of ['l','r'])for(const [a,b,r]of [['upperarm','lowerarm',.055],['lowerarm','hand',.045],['hand','middle_03',.05],['thigh','calf',.075],['calf','foot',.055]])capsules.push([`${a}_${side}`,`${b}_${side}`,r]);
let clearance=Infinity,extents=[Infinity,-Infinity];
for(let frame=0;frame<900;frame++){
 person.walker.update(1/30);model.root.updateMatrixWorld(true);
 const position=car.worldToLocal(person.root.getWorldPosition(new T.Vector3()));extents=[Math.min(extents[0],position.x),Math.max(extents[1],position.x)];
 for(const [a,b,r]of capsules){
  const p=car.worldToLocal(person.bones[a].getWorldPosition(new T.Vector3())),q=car.worldToLocal(person.bones[b].getWorldPosition(new T.Vector3()));
  for(const obstacle of obstacles){const gap=distance(p,q,obstacle.a,obstacle.b)-r-obstacle.r;clearance=Math.min(clearance,gap);assert.ok(gap>0,`${a} intersects a handhold at ${frame/30}s: ${gap}`);}
 }
}
assert.ok(extents[0]<-2.6&&extents[1]>2.6,'check must include the complete aisle and both turns');
console.log(JSON.stringify({seconds:30,minimumBodyClearance:clearance,aisleExtents:extents,passengers:residents.count,carriages:model.cars.length}));
