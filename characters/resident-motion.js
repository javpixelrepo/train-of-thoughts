import * as T from 'three';
import { MotionSpring, turnBone, relaxFingers } from './human-detail.js';
import { createActivityCapture } from './activity-capture.js';

const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
const local=(p,x,y,z)=>p.root.localToWorld(new T.Vector3(x,y,z));

// Two-bone analytic IK with a pole defining the relaxed elbow/knee plane.
export function reach(upper,lower,end,target,pole,independent=false){
  upper.updateWorldMatrix(true,true);end.updateWorldMatrix(true,false);
  const a=upper.getWorldPosition(V()),b=lower.getWorldPosition(V()),c=end.getWorldPosition(V());
  const ab=b.clone().sub(a),bc=c.clone().sub(b),l1=ab.length(),l2=bc.length();
  const direction=target.clone().sub(a),distance=T.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+.001,l1+l2-.002);direction.normalize();
  const side=pole.clone().sub(a);side.addScaledVector(direction,-side.dot(direction)).normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const joint=a.clone().addScaledVector(direction,along).addScaledVector(side,height);
  const rotation=Q().setFromUnitVectors(ab.normalize(),joint.clone().sub(a).normalize()),orientation=end.getWorldQuaternion(Q());
  turnBone(upper,rotation);
  const lowerDirection=independent?bc.applyQuaternion(rotation):end.getWorldPosition(V()).sub(lower.getWorldPosition(V()));
  turnBone(lower,Q().setFromUnitVectors(lowerDirection.normalize(),target.clone().sub(joint).normalize()));
  if(independent){end.position.copy(end.parent.worldToLocal(target.clone()));end.quaternion.copy(end.parent.getWorldQuaternion(Q()).invert().multiply(orientation));end.updateWorldMatrix(false,true);}
}
function aimHand(p,side,towards,palmNormal){
  const hand=p.bones[`hand_${side}`],first=p.bones[`middle_01_${side}`];
  const lower=p.bones[`lowerarm_${side}`],axis=hand.getWorldPosition(V()).sub(lower.getWorldPosition(V())).normalize();
  const from=first.getWorldPosition(V()).sub(hand.getWorldPosition(V())).normalize();
  turnBone(hand,Q().setFromUnitVectors(from,towards.clone().sub(hand.getWorldPosition(V())).normalize()));
  const forward=first.getWorldPosition(V()).sub(hand.getWorldPosition(V())).normalize();
  const across=p.bones[`index_01_${side}`].getWorldPosition(V()).sub(p.bones[`pinky_01_${side}`].getWorldPosition(V())).normalize();
  const normal=V().crossVectors(forward,across).normalize().multiplyScalar(side==='l'?1:-1);
  const desired=palmNormal.clone().addScaledVector(forward,-palmNormal.dot(forward)).normalize();
  const angle=Math.atan2(forward.dot(V().crossVectors(normal,desired)),normal.dot(desired));
  const desiredWorld=Q().setFromAxisAngle(forward,angle).multiply(hand.getWorldQuaternion(Q()));
  turnBone(lower,Q().setFromAxisAngle(axis,angle*.78));
  hand.quaternion.copy(hand.parent.getWorldQuaternion(Q()).invert().multiply(desiredWorld));hand.updateWorldMatrix(false,true);
}
export function arm(p,side,target,pole,towards,curl=.2,palmNormal=new T.Vector3(0,-1,0)){
  const b=p.bones;reach(b[`upperarm_${side}`],b[`lowerarm_${side}`],b[`hand_${side}`],target,pole);
  if(towards)aimHand(p,side,towards,palmNormal);relaxFingers(p,side,curl);
}

function mug(material){
  const g=new T.Group();g.name='ceramic-coffee-cup';
  const profile=[[0,-.05],[.033,-.05],[.038,-.043],[.044,.048],[.041,.055],[.036,.052],[.032,-.036],[0,-.036]].map(([x,y])=>new T.Vector2(x,y));
  g.add(new T.Mesh(new T.LatheGeometry(profile,24),material(0xf0f0f0)));
  const coffee=new T.Mesh(new T.CircleGeometry(.035,24),material(0x353535));coffee.rotation.x=-Math.PI/2;coffee.position.y=.038;g.add(coffee);
  const handle=new T.Mesh(new T.TorusGeometry(.028,.007,8,24),material(0xdadada));handle.position.set(.05,0,0);g.add(handle);
  return g;
}

export function createActivity(p,{mode,x,z,yaw=0,seat=.47,floor=0,material,solveArms=true,solveLegs=true}){
  const {root,bones,mixer,actions}=p,seated=['relax','coffee','typing'].includes(mode);
  mixer.stopAllAction();const action=seated?actions.Sit_Stand:actions.Idle_Standing;action.play();action.time=seated?3:0;action.paused=true;mixer.update(0);
  root.rotation.y=yaw;root.updateWorldMatrix(true,true);
  const hips=root.worldToLocal(bones.pelvis.getWorldPosition(V()));
  const seatOffset=seated?seat-.47:0;
  const correction=seated?new T.Vector3(-hips.x,0,-hips.z).applyAxisAngle(new T.Vector3(0,1,0),yaw):V();
  root.position.set(x+correction.x,floor+seatOffset,z+correction.z);root.updateWorldMatrix(true,true);
  if(seated)for(const [side,sign]of [['l',1],['r',-1]]){
    const foot=bones[`foot_${side}`],target=foot.getWorldPosition(V());target.y-=seatOffset;
    reach(bones[`thigh_${side}`],bones[`calf_${side}`],foot,target,local(p,sign*.2,.45,.5),true);
  }
  const rest=Object.values(bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
  const footTargets=['l','r'].map(side=>root.worldToLocal(bones[`foot_${side}`].getWorldPosition(V())));
  const capture=createActivityCapture(p,mode);
  let time=p.time,tick=0;const lift=new MotionSpring(0),gaze=new MotionSpring(0);
  let startTime=time;
  if(mode==='coffee'){p.cup=mug(material);root.add(p.cup);}
  if(mode==='painting'){
    p.brush=new T.Mesh(new T.CylinderGeometry(.004,.004,.14,8),material(0x353535));p.brush.name='paintbrush';p.brush.rotation.x=Math.PI/2;root.add(p.brush);
  }
  function targetLift(t){const s=t%12;return s<2?0:s<4.2?smooth((s-2)/2.2):s<6?1:s<8.4?1-smooth((s-6)/2.4):0;}
  function secondary(t,dt){const hand=capture?.sample(t).hand('Right');lift.step(mode==='coffee'?smooth((hand.y+.10)/.40):targetLift(t),dt,.075);gaze.step(Math.sin(t*.27)*.12,dt,.20);}
  secondary(time,10);
  function pose(){
    for(const r of rest){r.b.position.copy(r.p);r.b.quaternion.copy(r.q);r.b.scale.copy(r.s);}
    root.updateWorldMatrix(true,true);
    const recorded=capture?.sample(time);recorded?.body();
    const up=new T.Vector3(0,1,0).transformDirection(root.matrixWorld),right=new T.Vector3(1,0,0).transformDirection(root.matrixWorld),forward=new T.Vector3(0,0,1).transformDirection(root.matrixWorld);
    const breath=Math.sin(time*1.12)*.007;
    turnBone(bones.spine_01,Q().setFromAxisAngle(right,breath+(mode==='typing'?.045:mode==='painting'?.018:0)));
    turnBone(bones.spine_03,Q().setFromAxisAngle(up,gaze.value*.2));
    turnBone(bones.neck_01,Q().setFromAxisAngle(right,-breath*.65));
    turnBone(bones.head,Q().setFromAxisAngle(up,gaze.value*(mode==='typing'?.2:mode==='painting'?.15:1)));
    for(const [side,sign]of [['l',1],['r',-1]])turnBone(bones[`clavicle_${side}`],Q().setFromAxisAngle(forward,-sign*.018));
    if(mode==='coffee'){
      const a=lift.value,head=root.worldToLocal(bones.head.getWorldPosition(V()));
      const hand=recorded.hand('Right'),cupPosition=new T.Vector3(.17,.90,.12).lerp(new T.Vector3(.025,head.y-.037,head.z+.15),a);
      cupPosition.x+=(-hand.x-.20)*.07*(1-a);cupPosition.z+=(hand.z-.12)*.12*(1-a);
      p.cup.position.copy(cupPosition);p.cup.rotation.set(-.25*a,1.3*(1-a),0);p.cup.updateWorldMatrix(true,true);
      // Thumb above the handle, fingers forward and curled inward. The wrist
      // is behind the knuckles, not on the opposite side of the cup.
      const grip=p.cup.localToWorld(new T.Vector3(.157,-.058,.035));
      const cupPalm=new T.Vector3(0,0,-1).transformDirection(p.cup.matrixWorld);
      arm(p,'l',grip,local(p,.34,.70+.08*a,-.31),p.cup.localToWorld(new T.Vector3(.075,.016,.035)),.15,cupPalm);
      for(const [name,y]of [['index',.020],['middle',-.003],['ring',-.026],['pinky',-.045]]){
        reach(bones[`${name}_01_l`],bones[`${name}_02_l`],bones[`${name}_03_l`],p.cup.localToWorld(new T.Vector3(.064,y,-.008)),p.cup.localToWorld(new T.Vector3(.075,y,.07)));
      }
      reach(bones.thumb_01_l,bones.thumb_02_l,bones.thumb_03_l,
        p.cup.localToWorld(new T.Vector3(.069,.037,.018)),p.cup.localToWorld(new T.Vector3(.11,.08,.04)));
      arm(p,'r',local(p,-.16,.57,.025),local(p,-.34,.70,-.20),local(p,-.15,.55,.15),.09);
      turnBone(bones.head,Q().setFromAxisAngle(right,-.055*a));
    }else if(mode==='relax'&&solveArms){
      for(const [side,sign]of [['l',1],['r',-1]])arm(p,side,local(p,sign*.15,.57+(sign<0?.015:0),.025),local(p,sign*.34,.73,-.23),local(p,sign*.14,.55,.16),.09);
    }else if(mode==='typing'){
      for(const [side,sign,label]of [['l',1,'Left'],['r',-1,'Right']]){
        const h=recorded.hand(label),e=recorded.elbow(label),xx=sign*.13+(h.x-sign*.13)*.45,yy=.885+(h.y-.05)*.25,zz=.12+(h.z-.22)*.25;
        arm(p,side,local(p,xx,yy,zz),local(p,sign*.29+(e.x-sign*.2)*.12,.85,-.17),local(p,xx,.85,zz+.15),.15);
        // CMU records the wrist, not individual finger joints. Small contact
        // taps supplement that capture, without moving the hand through keys.
        for(const [i,name]of ['index','middle','ring','pinky'].entries()){
          const first=bones[`${name}_01_${side}`],middle=bones[`${name}_02_${side}`],last=bones[`${name}_03_${side}`];
          const target=root.parent.worldToLocal(last.getWorldPosition(V()));
          target.y=(name==='pinky'?.839:.845)+.003*Math.max(0,Math.sin(time*(6.1+i*.6)+sign+i*2));
          reach(first,middle,last,root.parent.localToWorld(target),middle.getWorldPosition(V()));
        }
      }
      turnBone(bones.head,Q().setFromAxisAngle(right,.035));
    }else if(mode==='painting'){
      const h=recorded.hand('Right'),e=recorded.elbow('Right'),across=(-h.x-.2)*.75,stroke=(h.y-.20)*.55;
      arm(p,'l',local(p,.21+across,1.27+stroke,.32),local(p,.43+(-e.x-.2)*.2,1.07+(e.y-.1)*.25,.10),local(p,.25+across,1.30+stroke,.50),.72,right.clone().negate());
      const pinch=bones.index_02_l.getWorldPosition(V()).addScaledVector(right,-.008);
      reach(bones.thumb_01_l,bones.thumb_02_l,bones.thumb_03_l,pinch,local(p,.20+across,1.34+stroke,.42));
      const contact=root.worldToLocal(pinch),brushStart=contact.clone().add(new T.Vector3(0,0,-.025)),brushEnd=contact.clone();brushEnd.z=.533;
      p.brush.position.copy(brushStart).lerp(brushEnd,.5);
      p.brush.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),brushEnd.clone().sub(brushStart).normalize());p.brush.scale.y=brushStart.distanceTo(brushEnd)/.14;
      arm(p,'r',local(p,-.23,.88,.04),local(p,-.36,1.05,-.16),local(p,-.21,.77,.07),.2);
    }else if(mode==='view'){
      // Hands rest on the balcony rail, shoulder blades and gaze move subtly.
      for(const [side,sign]of [['l',1],['r',-1]])arm(p,side,local(p,sign*.23,.90,.28),local(p,sign*.36,1.10,.02),local(p,sign*.23,.85,.42),.24);
    }
    // Source foot controls are independent of the leg chain. Lock both the
    // controls and knees to the same world contacts for every activity.
    if(solveLegs)for(const [i,side]of ['l','r'].entries())reach(bones[`thigh_${side}`],bones[`calf_${side}`],bones[`foot_${side}`],root.localToWorld(footTargets[i].clone()),local(p,side==='l'?.2:-.2,.45,.6),true);
    root.updateWorldMatrix(true,true);
  }
  function update(dt,solvePose=true){time+=Math.max(0,dt);while(startTime+(tick+1)/120<=time+1e-9){tick++;secondary(startTime+tick/120,1/120);}if(solvePose)pose();}
  function seek(t){time=startTime=t;tick=0;secondary(t,10);pose();}
  pose();return {update,seek,inspect:()=>({mode,time,source:capture?.source,lift:lift.value,grip:mode==='coffee'?new T.Vector3(.157,-.058,.035):null,feet:footTargets.map(v=>v.clone())})};
}
