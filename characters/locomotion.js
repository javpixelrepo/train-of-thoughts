import * as T from 'three';
import { MotionSpring } from './human-detail.js';
import { createWalkPose, capturedSwing } from './walk-pose.js';

// Contact-driven indoor locomotion. Feet are planned in floor coordinates and
// stay there while supporting weight; the skeleton follows via constant-length
// leg IK. No moving-root/in-place-animation velocity mismatch or idle pivots.
const UP=new T.Vector3(0,1,0),RIGHT=new T.Vector3(1,0,0);
const clamp=T.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
const mix=T.MathUtils.lerp;
const vec=()=>new T.Vector3();
const quat=()=>new T.Quaternion();
const point=(x,y,z)=>new T.Vector3(x,y,z);

function turnWorld(bone,rotation){
  const q=bone.getWorldQuaternion(quat());
  bone.quaternion.copy(bone.parent.getWorldQuaternion(quat()).invert().multiply(rotation).multiply(q));
  bone.updateWorldMatrix(false,true);
}
function setWorldPosition(bone,p){bone.position.copy(bone.parent.worldToLocal(p.clone()));bone.updateWorldMatrix(false,true);}

export function createWalker(person,{hallX,variant=0,route=null,stepSeconds=.58}={}){
  const {root,body,bones,mixer,actions}=person;
  mixer.stopAllAction();actions.Idle_Standing.play();actions.Idle_Standing.time=0;mixer.update(0);
  // Rebuild from a neutral pose on every frame: IK and secondary motion never
  // accumulate rotations into the AnimationMixer's cached constant tracks.
  const rest=Object.values(bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
  const parent=root.parent;
  root.position.set(hallX,0,0);root.rotation.set(0,0,0);root.updateWorldMatrix(true,true);
  const parentQ=parent.getWorldQuaternion(quat()),inverseParentQ=parentQ.clone().invert();
  const feet=['l','r'].map((side,i)=>{
    const hip=bones[`thigh_${side}`],knee=bones[`calf_${side}`],ankle=bones[`foot_${side}`];
    const a=hip.getWorldPosition(vec()),b=knee.getWorldPosition(vec()),c=ankle.getWorldPosition(vec());
    const local=parent.worldToLocal(c.clone());
    return {side,sign:i===0?1:-1,hip,knee,ankle,l1:a.distanceTo(b),l2:b.distanceTo(c),
      endInKnee:knee.worldToLocal(c.clone()),restRotation:inverseParentQ.clone().multiply(ankle.getWorldQuaternion(quat())),
      height:local.y,heel:.07,toe:.19,sole:Infinity,back:Infinity,front:-Infinity,
      anchor:point(hallX+(i===0?.095:-.095),0,-2.65),yaw:0,from:null,target:null,
      posePosition:vec(),poseRotation:quat(),pivot:vec(),contact:true,pitch:0};
  });
  // Calibrate roll pivots against each model's actual shoe, including scale.
  // Using one arbitrary foot size causes heels to sink or hover on the other rig.
  // updateWorldMatrix above updates bone/world transforms but bypasses the
  // SkinnedMesh.updateMatrixWorld override that refreshes bindMatrixInverse.
  // Refresh attached skin bindings before reading posed vertices; otherwise a
  // translated floor is counted twice and becomes a negative ankle height.
  root.updateMatrixWorld(true);
  if(!person.walkCalibration)body.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.name.toLowerCase().includes('shoes')||mesh.name==='human-outline')return;
    mesh.skeleton.update();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      const p=parent.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i,vec())));
      const f=feet[p.x>hallX?0:1];
      f.sole=Math.min(f.sole,p.y);f.back=Math.min(f.back,p.z);f.front=Math.max(f.front,p.z);
    }
  });
  for(const [i,f] of feet.entries()){
    const ankle=parent.worldToLocal(f.ankle.getWorldPosition(vec()));
    if(Number.isFinite(f.sole)){
      f.height-=f.sole;f.heel=ankle.z-f.back;f.toe=f.front-ankle.z;
    }
    f.height+=.002;
    if(person.walkCalibration)Object.assign(f,person.walkCalibration[i]);
  }
  person.walkCalibration??=feet.map(({height,heel,toe})=>({height,heel,toe}));
  // CMU cycle starts with the right foot preparing to swing.
  feet.reverse();
  const capturedPose=createWalkPose(person);
  const stepDuration=stepSeconds,stepsAcross=variant?14:12,turnSteps=4;
  const travel=stepsAcross*stepDuration,turn=turnSteps*stepDuration,half=travel+turn;
  const lift=.12,land=.88;
  let time=0,stepIndex=-1,pelvisCorrection=0,actualSpeed=0;
  let springTick=0;
  const motion={};for(const name of ['lean','look','weight'])motion[name]=new MotionSpring();
  function secondary(t,dt){
    const p=trajectory(t),amount=p.turning?.38:clamp(p.speed/.82,0,1);
    motion.weight.step(p.turning?.38:clamp(p.speed/.82,.12,1),dt,.09);
    motion.lean.step(.014*amount+p.acceleration*.014,dt,.12);
    motion.look.step(clamp(trajectory(t+.25).yaw-p.yaw,-.3,.3),dt,.10);
  }
  function trajectory(t){
    // Outdoor routes are one-way crossings. Contacts remain in the moving
    // bridge's local frame, so scrolling/parallax cannot slide the planted feet.
    if(route)return {z:route.start+route.speed*Math.max(0,t),yaw:route.speed<0?Math.PI:0,speed:Math.abs(route.speed),acceleration:0,turning:false};
    const lap=Math.floor(Math.max(0,t)/half),u=Math.max(0,t)%half,back=lap%2===1;
    const direction=back?-1:1,start=back?2.65:-2.65,baseYaw=lap*Math.PI;
    if(u>=travel)return {z:-start,yaw:baseYaw+Math.PI*smooth((u-travel)/turn),speed:0,acceleration:0,turning:true};
    const ramp=stepDuration*1.5,maxSpeed=5.3/(travel-ramp);
    // Integral of a cubic smoothstep speed ramp: continuous acceleration at
    // departure and arrival, with an ordinary constant-speed middle section.
    let distance,speed,acceleration;
    if(u<ramp){const a=u/ramp;distance=maxSpeed*ramp*(a*a*a-.5*a*a*a*a);speed=maxSpeed*a*a*(3-2*a);acceleration=maxSpeed/ramp*6*a*(1-a);}
    else if(u>travel-ramp){const a=(travel-u)/ramp;distance=5.3-maxSpeed*ramp*(a*a*a-.5*a*a*a*a);speed=maxSpeed*a*a*(3-2*a);acceleration=-maxSpeed/ramp*6*a*(1-a);}
    else {distance=maxSpeed*(u-ramp/2);speed=maxSpeed;acceleration=0;}
    return {z:start+direction*distance,yaw:baseYaw,speed,acceleration,turning:false};
  }
  function placement(t,foot){
    const path=trajectory(t),heading=path.yaw;
    // A landing leads the centre of mass by half a step. At a turn it becomes
    // a short repositioning step around the centre, never a planted-foot spin.
    const lead=path.speed*stepDuration*.48;
    return {position:point(hallX+Math.cos(heading)*foot.sign*.095+Math.sin(heading)*lead,0,
      path.z-Math.sin(heading)*foot.sign*.095+Math.cos(heading)*lead),yaw:heading-foot.sign*.035};
  }
  function beginStep(index){
    if(stepIndex>=0){const previous=feet[stepIndex%2];previous.anchor.copy(previous.target.position);previous.yaw=previous.target.yaw;}
    stepIndex=index;
    const f=feet[index%2];f.from={position:f.anchor.clone(),yaw:f.yaw};
    f.target=placement((index+land)*stepDuration,f);
  }
  function footPose(f,index,u){
    const swinging=index===stepIndex%2;
    let position=f.anchor.clone(),yaw=f.yaw,pitch=0,pivotZ=0,height=0;
    if(swinging){
      if(u<lift){pitch=.25*smooth(stepIndex===0?u/lift:(u+.20)/(lift+.20));pivotZ=f.toe;}
      else if(u<land){
        const a=(u-lift)/(land-lift),arc=capturedSwing(a),s=arc[0];
        position.lerpVectors(f.from.position,f.target.position,s);yaw=mix(f.from.yaw,f.target.yaw,s);
        pitch=a<.55?mix(.25,-.07,smooth(a/.55)):mix(-.07,-.14,smooth((a-.55)/.45));
        pivotZ=mix(f.toe,-f.heel,s);
        height=arc[1]*(trajectory(time).turning?.50:1.10);
      }else{
        position.copy(f.target.position);yaw=f.target.yaw;
        pitch=-.14*(1-smooth((u-land)/.24));pivotZ=-f.heel;
      }
    }else{
      pitch=-.14*(1-smooth((u+1-land)/.24));pivotZ=-f.heel;
      if(stepIndex===0)pitch=0;
      if(u>.80){pitch=.25*smooth((u-.80)/(lift+.20));pivotZ=f.toe;}
    }
    f.contact=!swinging||u<=lift||u>=land;f.pitch=pitch;
    const yawQ=quat().setFromAxisAngle(UP,yaw),pitchQ=quat().setFromAxisAngle(RIGHT,pitch);
    const pivot=point(0,0,pivotZ);
    f.posePosition.copy(point(0,f.height,0).sub(pivot).applyQuaternion(pitchQ).add(pivot).applyQuaternion(yawQ).add(position));
    f.posePosition.y+=height;
    f.poseRotation.copy(yawQ).multiply(pitchQ).multiply(f.restRotation);
    f.pivot.copy(pivot.applyQuaternion(yawQ).add(position));
  }
  function solveLeg(f,worldTarget,heading){
    const a=f.hip.getWorldPosition(vec()),b=f.knee.getWorldPosition(vec());
    const direction=worldTarget.clone().sub(a),distance=clamp(direction.length(),Math.abs(f.l1-f.l2)+.001,f.l1+f.l2-.001);
    direction.normalize();
    const kneeDirection=point(Math.sin(heading)+Math.cos(heading)*f.sign*.04,-.22,Math.cos(heading)-Math.sin(heading)*f.sign*.04).applyQuaternion(parentQ);
    kneeDirection.addScaledVector(direction,-kneeDirection.dot(direction)).normalize();
    const along=(f.l1*f.l1-f.l2*f.l2+distance*distance)/(2*distance);
    const bend=Math.sqrt(Math.max(0,f.l1*f.l1-along*along));
    const joint=a.clone().addScaledVector(direction,along).addScaledVector(kneeDirection,bend);
    turnWorld(f.hip,quat().setFromUnitVectors(b.sub(a).normalize(),joint.clone().sub(a).normalize()));
    const lowerDirection=f.knee.localToWorld(f.endInKnee.clone()).sub(f.knee.getWorldPosition(vec())).normalize();
    turnWorld(f.knee,quat().setFromUnitVectors(lowerDirection,worldTarget.clone().sub(joint).normalize()));
    setWorldPosition(f.ankle,worldTarget);
    f.ankle.quaternion.copy(f.ankle.parent.getWorldQuaternion(quat()).invert().multiply(parentQ).multiply(f.poseRotation));
    f.ankle.updateWorldMatrix(false,true);
  }
  function pose(){
    for(const r of rest){r.b.position.copy(r.p);r.b.quaternion.copy(r.q);r.b.scale.copy(r.s);}
    const path=trajectory(time),u=time/stepDuration-stepIndex;
    actualSpeed=path.speed;
    // Quaternion restoration can express the same heading with X/Z = PI.
    // Set the complete upright orientation instead of retaining those axes.
    root.position.set(hallX,0,path.z);root.rotation.set(0,path.yaw,0);root.updateWorldMatrix(true,true);
    feet.forEach((f,i)=>footPose(f,i,u));
    const movement=motion.weight.value;
    const right=RIGHT.clone().applyAxisAngle(UP,path.yaw).applyQuaternion(parentQ);
    const up=UP.clone().applyQuaternion(parentQ);
    const bodyOffset=capturedPose.body(time/(2*stepDuration),movement);
    const hips=bones.pelvis.getWorldPosition(vec()).addScaledVector(right,bodyOffset.x*.75).addScaledVector(up,bodyOffset.y*.65-.014);
    setWorldPosition(bones.pelvis,hips);
    // Centre-of-mass correction is limited by actual leg reach, not a rigid
    // vertical bob that stretches knees when the stride gets longer.
    pelvisCorrection=0;
    const targets=feet.map(f=>parent.localToWorld(f.posePosition.clone()));
    feet.forEach((f,i)=>{
      const hip=f.hip.getWorldPosition(vec()),target=targets[i],delta=hip.clone().sub(target);
      const vertical=delta.dot(up),horizontalSq=Math.max(0,delta.lengthSq()-vertical*vertical);
      const maxLength=(f.l1+f.l2)*.996;
      const allowed=Math.sqrt(Math.max(.01,maxLength*maxLength-horizontalSq));
      pelvisCorrection=Math.max(pelvisCorrection,vertical-allowed);
    });
    if(pelvisCorrection>0)setWorldPosition(bones.pelvis,bones.pelvis.getWorldPosition(vec()).addScaledVector(up,-pelvisCorrection));
    const anticipation=motion.look.value;
    turnWorld(bones.spine_01,quat().setFromAxisAngle(right,motion.lean.value));
    turnWorld(bones.spine_03,quat().setFromAxisAngle(up,anticipation*.35));
    turnWorld(bones.neck_01,quat().setFromAxisAngle(right,-motion.lean.value*.75));
    turnWorld(bones.head,quat().setFromAxisAngle(up,anticipation*.55+.008*Math.sin(time*.7)));
    feet.forEach((f,i)=>solveLeg(f,targets[i],path.yaw));
    capturedPose.arms();
    root.updateWorldMatrix(true,true);
  }
  if(route)for(const f of feet){const start=placement(0,f);f.anchor.copy(start.position);f.yaw=start.yaw;}
  secondary(0,10);beginStep(0);pose();
  function update(dt,visible){
    // Bound internal intervals so a long frame never skips a support change.
    let remaining=Math.max(0,dt);
    while(remaining>1e-8){
      const advance=Math.min(remaining,1/60);time+=advance;remaining-=advance;
      const next=Math.floor((time+1e-9)/stepDuration);
      while(stepIndex<next)beginStep(stepIndex+1);
    }
    // A fixed spring clock makes the same secondary motion at 30, 60 or 120 fps.
    while((springTick+1)/120<=time+1e-9){springTick++;secondary(springTick/120,1/120);}
    // Advance contacts and springs offscreen, then solve the exact current pose
    // before drawing an entering character. No reduced animation rate or LOD.
    const path=trajectory(time);root.position.set(hallX,0,path.z);root.rotation.set(0,path.yaw,0);
    if(!visible||visible(root))pose();
  }
  function inspect(){return {time,stepDuration,stepIndex,speed:actualSpeed,pelvisCorrection,arms:capturedPose.inspect(),
    position:root.position.clone(),yaw:root.rotation.y,
    feet:feet.map(f=>({side:f.side,contact:f.contact,pitch:f.pitch,pivot:f.pivot.clone(),
      ankle:parent.worldToLocal(f.ankle.getWorldPosition(vec())),height:f.height,
      reach:f.hip.getWorldPosition(vec()).distanceTo(f.ankle.getWorldPosition(vec()))/(f.l1+f.l2)}))};}
  return {update,inspect};
}
