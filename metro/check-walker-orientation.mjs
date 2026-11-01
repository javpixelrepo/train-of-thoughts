import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makePassengers} from './passengers.js';
import {createWalker} from '../habitat/locomotion.js';

const root=new T.Group(),cars=[0,1,2].map(i=>{const c=new T.Group();c.userData.car=i;root.add(c);return c;});
const residents=await makePassengers({cars},{loadSource:async name=>{
 const bytes=await fs.readFile(new URL(`../habitat/assets/people/${name}.glb`,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}});
let comparisons=0,pauses=0,restores=0,maxPositionError=0;
for(const variant of [0,1])for(const route of [null,{start:0,speed:-.8}]){
 const floor=new T.Group();floor.rotation.y=Math.PI/2;floor.position.set(0,18,0);root.add(floor);
 const a=residents.createHuman(floor,variant),b=residents.createHuman(floor,variant);
 const options={hallX:0,variant:1,route};
 const wa=createWalker(a,options),wb=createWalker(b,options);
 for(let frame=0;frame<1440;frame++){
  wa.update(1/60);wb.update(1/60);
  if(frame%120===119){
   // A recording restore writes a quaternion. Its Euler representation may
   // change to X=PI/Z=PI even when the orientation itself is unchanged.
   if(frame%240===239){
    for(const o of [a.root,a.body,...Object.values(a.bones)])o.quaternion.copy(o.quaternion.clone());
    restores++;
   }
   for(let pausedFrame=0;pausedFrame<15;pausedFrame++)wa.update(0);
   pauses++;
  }
  for(const name of ['pelvis','spine_01','spine_03','head','upperarm_l','hand_l','upperarm_r','hand_r','foot_l','foot_r']){
   const error=a.bones[name].getWorldPosition(new T.Vector3()).distanceTo(b.bones[name].getWorldPosition(new T.Vector3()));
   maxPositionError=Math.max(maxPositionError,error);
   assert.ok(error<1e-7,`Pose changed at frame ${frame}, ${route?'street':'aisle'}, ${name}: ${error}`);
   comparisons++;
  }
  assert.ok(new T.Vector3(0,1,0).applyQuaternion(a.root.quaternion).dot(new T.Vector3(0,1,0))>.999999,'Walker must stay upright');
 }
}
console.log({comparisons,pauses,restores,maxPositionError,secondsPerRoute:24});
