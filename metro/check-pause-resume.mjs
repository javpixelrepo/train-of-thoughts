import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makePassengers} from './passengers.js';
import {createWalker} from '../habitat/locomotion.js?v=3';

const root=new T.Group(),cars=[0,1,2].map(i=>{const c=new T.Group();c.userData.car=i;root.add(c);return c;});
const residents=await makePassengers({cars},{loadSource:async name=>{
 const bytes=await fs.readFile(new URL(`../habitat/assets/people/${name}.glb`,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}});
let samples=0;
for(const direction of [-1,1])for(const scale of [.89,.94]){
 const floor=new T.Group();floor.rotation.y=Math.PI/2;root.add(floor);
 const a=residents.createHuman(floor,direction<0?0:1),b=residents.createHuman(floor,direction<0?0:1);
 a.root.scale.setScalar(scale);b.root.scale.setScalar(scale);
 const options={hallX:.3,route:{start:-12,speed:direction*.8}},wa=createWalker(a,options),wb=createWalker(b,options);
 for(let i=0;i<180;i++){
  const previous=a.root.getWorldPosition(new T.Vector3()),ground=floor.getWorldPosition(new T.Vector3());
  floor.position.x=i*.09;wa.update(1/60);wb.update(1/60);
  if(i%30===0){
   const before=JSON.stringify(wa.inspect());
   for(let j=0;j<10;j++)wa.update(0);
   assert.equal(JSON.stringify(wa.inspect()),before,'Pausing must preserve heading, contacts and gait phase');
  }
  const heading=new T.Vector3(0,0,1).applyQuaternion(a.root.quaternion);
  assert.ok(heading.z*direction>.999,'Residents must face their travel direction');
  const relative=a.root.getWorldPosition(new T.Vector3()).sub(previous).sub(floor.getWorldPosition(new T.Vector3()).sub(ground));
  const facing=new T.Vector3(0,0,1).applyQuaternion(a.root.getWorldQuaternion(new T.Quaternion()));
  assert.ok(relative.dot(facing)>0,'Walking must advance forwards relative to the moving pavement, before and after pause');
  for(const name of Object.keys(a.bones)){
   assert.ok(a.bones[name].getWorldPosition(new T.Vector3()).distanceTo(b.bones[name].getWorldPosition(new T.Vector3()))<1e-7,'Pause/resume must match uninterrupted walking');
  }
  samples++;
 }
 const meshes=[];a.body.traverse(m=>{if(m.isSkinnedMesh)meshes.push(m);});
 assert.equal(new Set(meshes.map(m=>m.skeleton)).size,1,'One identical palette per resident');
}
console.log({samples,directions:[-1,1],pause:'same heading, contacts, phase and pose after resume',groundMotion:'always forwards relative to the pavement',palettes:'one per resident'});
