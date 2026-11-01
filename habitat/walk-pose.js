import * as T from 'three';
import { WALK_CYCLE } from './assets/people/walk-cycle.js';
import { turnBone, relaxFingers } from './human-detail.js';

const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const up=new T.Vector3(0,1,0),right=new T.Vector3(1,0,0);
const clamp=T.MathUtils.clamp;
function sample(phase){
  const index=((phase%1)+1)%1*WALK_CYCLE.count,i=Math.floor(index),a=WALK_CYCLE.frames[i],b=WALK_CYCLE.frames[i+1],u=index-i;
  return {offset:V().fromArray(a.offset).lerp(V().fromArray(b.offset),u),
    rotation:n=>Q().fromArray(a.rotations[n]).slerp(Q().fromArray(b.rotations[n]),u),
    direction:(side,part)=>V().fromArray(a.arms[side][part]).lerp(V().fromArray(b.arms[side][part]),u).normalize()};
}
export function capturedSwing(u){
  const index=clamp(u,0,1)*60,i=Math.min(59,Math.floor(index)),a=WALK_CYCLE.arc[i],b=WALK_CYCLE.arc[i+1];
  return a.map((v,k)=>T.MathUtils.lerp(v,b[k],index-i));
}
function orient(bone,world){bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(world));bone.updateWorldMatrix(false,true);}

export function createWalkPose(person){
  const {root,bones}=person;
  root.updateWorldMatrix(true,true);
  const invRoot=root.getWorldQuaternion(Q()).invert();
  const base=Object.fromEntries(['pelvis','spine_01','spine_02','spine_03','neck_01','head'].map(n=>[n,invRoot.clone().multiply(bones[n].getWorldQuaternion(Q()))]));
  let current=sample(0),amount=1,minClearance=1,maxCorrection=0;
  const armData={};
  for(const side of ['l','r']){
    const upper=bones[`upperarm_${side}`],lower=bones[`lowerarm_${side}`],hand=bones[`hand_${side}`];
    armData[side]={upper,lower,hand};
  }
  function body(phase,weight){
    current=sample(phase);amount=weight;const heading=root.getWorldQuaternion(Q());
    // Global deltas from the source reference pose avoid applying spine twist
    // several times through the hierarchy. Limb lengths stay those of each rig.
    for(const n of Object.keys(base))orient(bones[n],heading.clone().multiply(Q().slerp(current.rotation(n),weight)).multiply(base[n]));
    return current.offset.clone().multiplyScalar(weight);
  }
  function neutralWrist(side,twistForearm=true){
    const {lower,hand}=armData[side],sign=side==='l'?1:-1;
    const forearm=hand.getWorldPosition(V()).sub(lower.getWorldPosition(V())).normalize();
    const middle=bones[`middle_01_${side}`];
    const fingers=middle.getWorldPosition(V()).sub(hand.getWorldPosition(V())).normalize();
    // The hand continues the forearm; no pose inherited from an idle gesture.
    turnBone(hand,Q().setFromUnitVectors(fingers,forearm));
    const across=bones[`index_01_${side}`].getWorldPosition(V()).sub(bones[`pinky_01_${side}`].getWorldPosition(V())).normalize();
    const normal=V().crossVectors(forearm,across).normalize().multiplyScalar(sign);
    const desired=right.clone().multiplyScalar(-sign).applyQuaternion(root.getWorldQuaternion(Q()));
    desired.addScaledVector(forearm,-desired.dot(forearm)).normalize();
    const angle=Math.atan2(forearm.dot(V().crossVectors(normal,desired)),normal.dot(desired));
    // Distribute axial rotation through the forearm and wrist instead of
    // twisting the hand alone. Thumbs face forward, palms face the thighs.
    if(twistForearm)turnBone(lower,Q().setFromAxisAngle(forearm,angle*.78));
    turnBone(hand,Q().setFromAxisAngle(forearm,angle*(twistForearm?.22:1)));
  }
  function obstacles(){
    const result=[];
    for(const side of ['l','r'])result.push({a:bones[`thigh_${side}`].getWorldPosition(V()),b:bones[`calf_${side}`].getWorldPosition(V()),r0:.115,r1:.075});
    result.push({a:bones.thigh_l.getWorldPosition(V()).addScaledVector(up,.025),b:bones.thigh_r.getWorldPosition(V()).addScaledVector(up,.025),r0:.105,r1:.105});
    return result;
  }
  function separation(side,capsules){
    const sign=side==='l'?1:-1,outward=right.clone().multiplyScalar(sign).applyQuaternion(root.getWorldQuaternion(Q()));
    let shift=0,clearance=Infinity;
    for(const name of ['hand','middle_01','middle_03','index_03','pinky_02','thumb_02']){
      const p=bones[`${name}_${side}`].getWorldPosition(V()),radius=name==='hand'?.036:.026;
      for(const c of capsules){
        const segment=c.b.clone().sub(c.a),t=clamp(p.clone().sub(c.a).dot(segment)/segment.lengthSq(),0,1),center=c.a.clone().addScaledVector(segment,t);
        const diff=p.clone().sub(center),limit=T.MathUtils.lerp(c.r0,c.r1,t)+radius+.012;
        clearance=Math.min(clearance,diff.length()-limit);
        const lateral=diff.dot(outward),crossSq=Math.max(0,diff.lengthSq()-lateral*lateral);
        if(crossSq<limit*limit&&lateral<Math.sqrt(limit*limit-crossSq))shift=Math.max(shift,Math.sqrt(limit*limit-crossSq)-lateral);
      }
    }
    return {shift,clearance,outward};
  }
  function arms(){
    const heading=root.getWorldQuaternion(Q()),capsules=obstacles();maxCorrection=0;minClearance=Infinity;
    for(const side of ['l','r']){
      const sign=side==='l'?1:-1,{upper,lower,hand}=armData[side];
      // Captured elbow flexion and shoulder swing are preserved, including
      // the slight asymmetry and delay absent from a sinusoidal pendulum.
      // The source is a brisk walk; reduce amplitude for these shorter indoor
      // strides without changing the recorded timing or left/right relationship.
      const armWeight=amount*.76;
      const upperDir=V().set(sign*.11,-.99,0).lerp(current.direction(side,'upper'),armWeight).normalize().applyQuaternion(heading);
      const lowerDir=V().set(sign*.02,-.985,.17).lerp(current.direction(side,'lower'),armWeight).normalize().applyQuaternion(heading);
      turnBone(upper,Q().setFromUnitVectors(lower.getWorldPosition(V()).sub(upper.getWorldPosition(V())).normalize(),upperDir));
      turnBone(lower,Q().setFromUnitVectors(hand.getWorldPosition(V()).sub(lower.getWorldPosition(V())).normalize(),lowerDir));
      neutralWrist(side);relaxFingers(person,side,.13);
      const original=hand.getWorldPosition(V());
      // Whole-hand clearance, including fingers, against both moving thighs
      // and the pelvis. Correct the arm chain, never teleport a hand bone.
      for(let i=0;i<7;i++){
        const result=separation(side,capsules);if(result.shift<.0001)break;
        const drop=upper.getWorldPosition(V()).sub(hand.getWorldPosition(V())).dot(up);
        const angle=Math.min(.14,(result.shift+.0003)/Math.max(.2,drop));
        // Small shoulder abduction preserves the captured elbow bend and
        // avoids IK pole singularities when the relaxed arm is nearly straight.
        turnBone(upper,Q().setFromAxisAngle(new T.Vector3(0,0,1).applyQuaternion(heading),sign*angle));
        neutralWrist(side,false);
      }
      maxCorrection=Math.max(maxCorrection,original.distanceTo(hand.getWorldPosition(V())));
      minClearance=Math.min(minClearance,separation(side,capsules).clearance);
    }
  }
  return {body,arms,inspect:()=>({minClearance,maxCorrection})};
}
