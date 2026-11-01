import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWalker } from '../../locomotion.js';
import { refineHumanAsset } from '../../human-detail.js';

async function setup(name,{offset=[0,0,0],yaw=0}={}){
  const bytes=await fs.readFile(new URL(`./${name}.glb`,import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  refineHumanAsset(gltf);
  const floor=new T.Group(),root=new T.Group();floor.position.fromArray(offset);floor.rotation.y=yaw;floor.add(root);root.add(gltf.scene);
  const mixer=new T.AnimationMixer(gltf.scene),bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
  const actions=Object.fromEntries(gltf.animations.map(a=>[a.name,mixer.clipAction(a)]));
  return {floor,root,bones,body:gltf.scene,walker:createWalker({root,body:gltf.scene,bones,mixer,actions},{hallX:0,variant:name==='maya'?1:0})};
}
// Reproduce the actual upstairs instance, not just a rig at the world origin.
for(const name of ['sam','maya']){
  const p=await setup(name,{offset:[3,6.3,-2],yaw:.4});
  for(const foot of p.walker.inspect().feet)assert.ok(foot.height>0&&foot.height<.2,`${name}: calibrated ankle height must be floor-local, got ${foot.height}`);
  for(const height of [6.3,9.3,6.3]){
    p.floor.position.y=height;p.walker.update(.7);p.floor.updateMatrixWorld(true);
    const bounds=new T.Box3();
    p.body.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
      for(let i=0;i<mesh.geometry.attributes.position.count;i++)bounds.expandByPoint(p.floor.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i,new T.Vector3()))));
    });
    const size=bounds.getSize(new T.Vector3());
    assert.ok(bounds.min.y>-.012&&bounds.max.y>1.5&&bounds.max.y<2.1,`${name}: deformed mesh must stay on its floor at human height: ${bounds.min.y}..${bounds.max.y}`);
    assert.ok(size.x<1.1&&size.z<1.3,`${name}: rendered skin must not stretch outside the character`);
  }
}
for(const name of ['sam','maya']){
  const {walker,root,body,bones}=await setup(name);
  const shoes=[];body.traverse(o=>{if(o.isSkinnedMesh&&o.name.toLowerCase().includes('shoes'))shoes.push(o);});
  let previous=walker.inspect(),maxFlatSlip=0,maxReach=0,maxCorrection=0,minShoeY=Infinity,maxFootJump=0,minHandClearance=Infinity,maxArmCorrection=0,maxArmFrameAngle=0;
  const armNames=['upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r'];
  const lastArms=armNames.map(n=>bones[n].quaternion.clone().normalize());
  for(let i=0;i<2400;i++){
    walker.update(1/60);const state=walker.inspect();
    assert.ok(Math.abs(state.position.z)<=2.650001);
    assert.ok(Math.abs(state.yaw-previous.yaw)<.05,'Heading must stay continuous across turn boundaries');
    for(let f=0;f<2;f++){
      const foot=state.feet[f],old=previous.feet[f];
      if(foot.contact&&old.contact&&Math.abs(foot.pitch)<1e-6&&Math.abs(old.pitch)<1e-6)
        maxFlatSlip=Math.max(maxFlatSlip,foot.ankle.distanceTo(old.ankle));
      maxReach=Math.max(maxReach,foot.reach);
      maxFootJump=Math.max(maxFootJump,foot.ankle.distanceTo(old.ankle));
      assert.ok(foot.ankle.toArray().every(Number.isFinite));
    }
    maxCorrection=Math.max(maxCorrection,state.pelvisCorrection);
    minHandClearance=Math.min(minHandClearance,state.arms.minClearance);maxArmCorrection=Math.max(maxArmCorrection,state.arms.maxCorrection);
    armNames.forEach((n,j)=>{const q=bones[n].quaternion.clone().normalize(),angle=q.angleTo(lastArms[j]);maxArmFrameAngle=Math.max(maxArmFrameAngle,angle);lastArms[j].copy(q);});
    for(const side of ['l','r']){
      const hand=bones[`hand_${side}`].getWorldPosition(new T.Vector3()),lower=bones[`lowerarm_${side}`].getWorldPosition(new T.Vector3());
      const finger=bones[`middle_01_${side}`].getWorldPosition(new T.Vector3()).sub(hand).normalize(),forearm=hand.clone().sub(lower).normalize();
      const across=bones[`index_01_${side}`].getWorldPosition(new T.Vector3()).sub(bones[`pinky_01_${side}`].getWorldPosition(new T.Vector3())).normalize();
      const normal=new T.Vector3().crossVectors(finger,across).normalize().multiplyScalar(side==='l'?1:-1);
      const medial=new T.Vector3(side==='l'?-1:1,0,0).applyQuaternion(root.getWorldQuaternion(new T.Quaternion()));medial.addScaledVector(finger,-medial.dot(finger)).normalize();
      assert.ok(finger.dot(forearm)>.995,'Wrists must continue the forearm without unnatural lateral bending');
      assert.ok(normal.dot(medial)>.995,'Palms must face inward, not face forward or twist backward');
    }
    if(i%15===0){
      root.updateWorldMatrix(true,true);
      for(const mesh of shoes){mesh.skeleton.update();for(let v=0;v<mesh.geometry.attributes.position.count;v++){
        const p=mesh.localToWorld(mesh.getVertexPosition(v,new T.Vector3()));minShoeY=Math.min(minShoeY,p.y);
      }}
    }
    previous=state;
  }
  console.log(name,{maxFlatSlip,maxReach,maxCorrection,minShoeY,maxFootJump,minHandClearance,maxArmCorrection,maxArmFrameAngle});
  assert.ok(maxArmFrameAngle<.10,'No forearm/wrist flips when clearance constraints activate or a turn starts');
  assert.ok(minHandClearance>-.001,'Palms, thumbs and fingertips must clear moving thigh/pelvis collision volumes');
  assert.ok(maxArmCorrection<.13,'Clearance correction must not distort the captured arm swing');
  assert.ok(maxFlatSlip<1e-6,'A flat supporting foot must not slide');
  assert.ok(maxReach<1,'Legs must not hyperextend');
  assert.ok(maxCorrection<.08,'Avoid a crouched corrective posture');
  assert.ok(minShoeY>-.009,'Shoe geometry must remain above the floor');
  assert.ok(maxFootJump<.09,'No teleporting feet at phase/loop boundaries');
  const slow=await setup(name),fast=await setup(name);
  for(let i=0;i<600;i++)slow.walker.update(1/30);
  for(let i=0;i<2400;i++)fast.walker.update(1/120);
  const a=slow.walker.inspect(),b=fast.walker.inspect();
  assert.ok(a.position.distanceTo(b.position)<1e-7);
  for(let i=0;i<2;i++)assert.ok(a.feet[i].ankle.distanceTo(b.feet[i].ankle)<1e-6,'Gait must not depend on frame rate');
  for(const name of ['clavicle_l','upperarm_l','lowerarm_r','hand_l','head']){
    const qa=slow.body.getObjectByName(name).quaternion,qb=fast.body.getObjectByName(name).quaternion;
    assert.ok(qa.clone().normalize().angleTo(qb.clone().normalize())<1e-6,`Spring-driven ${name} must also be frame-rate independent: ${qa.angleTo(qb)}`);
  }
}
console.log('PASS: both rigs on translated/rotated upper floors; full deformed-mesh bounds through floor movement; forward/return/turn cycles; grounded shoes; planted feet; leg reach; palm/finger clearance; inward palms; neutral wrists; continuous arms; 30/120 fps equivalence.');
