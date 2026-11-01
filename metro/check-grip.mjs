import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makePassengers} from './passengers.js';
const root=new T.Group();root.position.y=17.33;
const cars=[0,1,2].map(i=>{const c=new T.Group();c.userData.car=i;c.position.x=(i-1)*8.9;root.add(c);return c;});
const passengers=await makePassengers({cars},{loadSource:async name=>{const b=await fs.readFile(new URL(`../habitat/assets/people/${name}.glb`,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}});
const measurements=[];
for(const time of [0,1,3]){
 passengers.update(time);root.updateMatrixWorld(true);
 for(const p of passengers.people.filter(p=>p.gripPole)){
  let clearance=Infinity,samples=0;
  p.body.traverse(m=>{
   if(!m.isSkinnedMesh||m.name==='human-outline')return;m.skeleton.update();
   const ids=m.geometry.attributes.skinIndex,weights=m.geometry.attributes.skinWeight;
   for(let i=0;i<ids.count;i++){
    let handWeight=0;for(let j=0;j<4;j++)if(/^(hand|index|middle|ring|pinky|thumb).*_l$/.test(m.skeleton.bones[ids.array[i*4+j]].name))handWeight+=weights.array[i*4+j];
    if(handWeight<.6)continue;
    const v=m.localToWorld(m.getVertexPosition(i,new T.Vector3()));if(Math.abs(v.y-p.gripPole.y)>.14)continue;
    clearance=Math.min(clearance,Math.hypot(v.x-p.gripPole.x,v.z-p.gripPole.z)-.025);samples++;
   }
  });
  measurements.push({person:p.root.name,time,samples,clearance});
 }
 const driver=passengers.people.find(p=>p.role==='motorman');
 for(const [side,sign]of [['l',1],['r',-1]]){
  const elbow=driver.bones[`lowerarm_${side}`].getWorldPosition(new T.Vector3()),wrist=driver.bones[`hand_${side}`].getWorldPosition(new T.Vector3()),knuckle=driver.bones[`middle_01_${side}`].getWorldPosition(new T.Vector3());
  const target=cars[0].localToWorld(new T.Vector3(-4.11,1.575,sign*.345));
  const wristError=wrist.distanceTo(target),wristAngle=elbow.clone().sub(wrist).negate().angleTo(knuckle.clone().sub(wrist))*180/Math.PI;
  assert.ok(wristError<.005,`driver hand cannot reach controller: ${wristError}`);
  assert.ok(wristAngle<18,`driver wrist bends too far from forearm: ${wristAngle}`);
  const car=cars[0],a=car.localToWorld(new T.Vector3(-4.22,1.505,sign*.29)),b=car.localToWorld(new T.Vector3(-4.22,1.695,sign*.29)),handle=new T.Line3(a,b);
  let clearance=Infinity,samples=0;
  driver.body.traverse(m=>{
   if(!m.isSkinnedMesh||m.name==='human-outline')return;m.skeleton.update();
   const ids=m.geometry.attributes.skinIndex,weights=m.geometry.attributes.skinWeight;
   for(let i=0;i<ids.count;i++){
    let weight=0;for(let j=0;j<4;j++)if(new RegExp(`^(hand|index|middle|ring|pinky|thumb).*_${side}$`).test(m.skeleton.bones[ids.array[i*4+j]].name))weight+=weights.array[i*4+j];
    if(weight<.6)continue;
    const v=m.localToWorld(m.getVertexPosition(i,new T.Vector3()));
    clearance=Math.min(clearance,v.distanceTo(handle.closestPointToPoint(v,true,new T.Vector3()))-.022);samples++;
   }
  });
  measurements.push({person:`motorman-${side}`,time,samples,clearance,wristAngle,wristError});
 }
}
console.log(JSON.stringify(measurements));
assert.ok(measurements.every(m=>m.samples>100&&m.clearance>=0),'hand skin must remain outside the pole');
