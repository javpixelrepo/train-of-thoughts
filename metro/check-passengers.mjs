import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makePassengers} from './passengers.js';
const root=new T.Group();root.position.y=17.33;
const cars=[0,1,2].map(i=>{const c=new T.Group();c.userData.car=i;c.position.x=(i-1)*8.9;root.add(c);return c;});
const passengers=await makePassengers({cars},{loadSource:async name=>{
 const bytes=await fs.readFile(new URL(`../characters/assets/people/${name}.glb`,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}});
const v=()=>new T.Vector3();
let maxJump=0,minFoot=Infinity,maxFoot=-Infinity,maxSeatedElbowFlare=0,maxHandRestError=0;
const previous=new Map();
for(let frame=0;frame<1200;frame++){
 passengers.update(1/60);root.updateMatrixWorld(true);
 for(const p of passengers.people){
  for(const [name,b]of Object.entries(p.bones)){
   const pos=b.getWorldPosition(v());assert.ok(pos.toArray().every(Number.isFinite),`${name}: non-finite pose`);
   const key=p.root.name+name;
   if(previous.has(key))maxJump=Math.max(maxJump,pos.distanceTo(previous.get(key)));
   previous.set(key,pos);
  }
  for(const side of ['l','r']){
   const ankle=p.bones[`foot_${side}`].getWorldPosition(v());
   const h=ankle.y-18.12;minFoot=Math.min(minFoot,h);maxFoot=Math.max(maxFoot,h);
   assert.ok(h>-.08&&h<.85,`ankle off floor/seat: ${h}`);
   if(p.role==='seated'){
    const hip=p.root.worldToLocal(p.bones[`thigh_${side}`].getWorldPosition(v()));
    const knee=p.root.worldToLocal(p.bones[`calf_${side}`].getWorldPosition(v()));
    const foot=p.root.worldToLocal(ankle.clone()),sign=side==='l'?1:-1;
    assert.ok((knee.x-hip.x)*sign>=-.01,'seated knees must not collapse inward');
    assert.ok(Math.abs(knee.x-foot.x)<.055,'seated knees must track over their own feet');
    const shoulder=p.root.worldToLocal(p.bones[`upperarm_${side}`].getWorldPosition(v()));
    const elbow=p.root.worldToLocal(p.bones[`lowerarm_${side}`].getWorldPosition(v()));
    const flare=(elbow.x-shoulder.x)*(side==='l'?1:-1);maxSeatedElbowFlare=Math.max(maxSeatedElbowFlare,flare);
    assert.ok(flare<.065&&elbow.y<shoulder.y-.15,'seated elbows must hang beside the torso');
    const target=p.bones[`thigh_${side}`].getWorldPosition(v()).lerp(p.bones[`calf_${side}`].getWorldPosition(v()),.60).add(new T.Vector3(0,.095,0));
    const error=p.bones[`hand_${side}`].getWorldPosition(v()).distanceTo(target);maxHandRestError=Math.max(maxHandRestError,error);
    assert.ok(error<.005,'relaxed elbows must preserve hand contact with the thigh');
   }
  }
  if(frame%300===0){
   const bounds=new T.Box3();p.body.traverse(mesh=>{if(!mesh.isSkinnedMesh||mesh.name==='human-outline')return;mesh.skeleton.update();for(let k=0;k<mesh.geometry.attributes.position.count;k+=7)bounds.expandByPoint(mesh.localToWorld(mesh.getVertexPosition(k,v())));});
   const size=bounds.getSize(v());assert.ok(size.y<2.15&&size.x<2.1&&size.z<2.1,`skin stretched: ${size.toArray()}`);
   assert.ok(bounds.min.y>18.04,`shoe below carriage floor: ${bounds.min.y}`);
  }
 }
}
assert.ok(maxJump<.16,`discontinuous bone jump: ${maxJump}`);
console.log(JSON.stringify({passengers:passengers.count,seconds:20,maxBoneFrameDisplacement:maxJump,ankleHeightRange:[minFoot,maxFoot],maxSeatedElbowFlare,maxHandRestError}));
