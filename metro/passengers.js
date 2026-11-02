import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {celMaterial,outlineMaterial} from '../characters/people.js';
import {refineHumanAsset,MotionSpring,turnBone} from '../characters/human-detail.js';
import {createActivity,reach,arm} from '../characters/resident-motion.js?v=3';
import {CAB_VIEW} from './narrative.js?v=5';
import {tailorMaleShirt} from './human-fit.js';
import {shareSkeletons} from './rig-performance.js';
import {createWalker} from '../characters/locomotion.js?v=4';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const local=(p,x,y,z)=>p.root.localToWorld(V(x,y,z));
// Coordinated monochrome outfits. Hair and clothing vary independently of
// the two anatomical meshes; each resident keeps the same look when recycled.
const looks=[
 {hair:0x242424,top:0xf2f2f2,bottom:0x3e3e3e,shoes:0x444444},
 {hair:0xcacaca,top:0x444444,bottom:0xb0b0b0,shoes:0x333333},
 {hair:0x7d7d7d,top:0xb8b8b8,bottom:0x303030,shoes:0xe1e1e1},
 {hair:0x222222,top:0x797979,bottom:0xe1e1e1,shoes:0x363636},
 {hair:0xdcdcdc,top:0x414141,bottom:0xa2a2a2,shoes:0xeeeeee},
 {hair:0x575757,top:0xf3f3f3,bottom:0x7b7b7b,shoes:0x343434},
 {hair:0xababab,top:0x929292,bottom:0x414141,shoes:0xe2e2e2},
 {hair:0x888888,top:0x303030,bottom:0xc8c8c8,shoes:0x4b4b4b},
 {hair:0x484848,top:0xdadada,bottom:0x777777,shoes:0x3b3b3b},
 {hair:0xe4e4e4,top:0x6e6e6e,bottom:0x303030,shoes:0xd0d0d0}
];
function residentMaterial(name,variant){
 const mat=celMaterial(name,variant),look=looks[variant%looks.length];
 mat.name=name;
 if(/ponytail|short01|hair roots/i.test(name))mat.color.setHex(look.hair);
 else if(/eyebrow/i.test(name))mat.color.setHex(look.hair).multiplyScalar(.65);
 else if(/trousers|bottom/i.test(name))mat.color.setHex(look.bottom);
 else if(/shoes/i.test(name))mat.color.setHex(look.shoes);
 else if(/top/i.test(name))mat.color.setHex(look.top);
 if(/Sam.*original top/.test(name)){
  const compile=mat.onBeforeCompile;
  mat.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('float cel = 0.38 + 0.29 * smoothstep(-0.12, 0.04, lightFacing) + 0.33 * smoothstep(0.48, 0.60, lightFacing);','float cel = 0.64 + 0.36 * smoothstep(-0.35, 0.85, lightFacing);');};
  mat.customProgramCacheKey=()=> 'metro-tailored-shirt-v1';
 }
 return mat;
}
function gripPole(p,parent,grip){
 const center=parent.localToWorld(V(...grip)),b=p.bones;
 // Wrist behind the palm; the pole sits in the cavity formed by the flexed
 // fingers, never at the wrist joint. Finger segments keep their real lengths.
 const wrist=center.clone().add(V(.077,0,.088));
 arm(p,'l',wrist,local(p,.39,1.08,.05),wrist.clone().add(V(0,0,-.15)),0,V(-1,0,0));
 for(const name of ['index','middle','ring','pinky','thumb']){
  const direction=name==='thumb'?1:-1;
  for(let j=1;j<=3;j++){
   const bone=b[`${name}_0${j}_l`],next=b[`${name}_0${j+1}_l`];
   if(!bone)continue;
   const a=bone.getWorldPosition(V()),tip=next?next.getWorldPosition(V()):bone.localToWorld(V(0,.018,0));
   const length=a.distanceTo(tip),dx=a.x-center.x,dz=a.z-center.z,r=Math.hypot(dx,dz),radius=name==='thumb'?.048:.043;
   const cosine=T.MathUtils.clamp((r*r+radius*radius-length*length)/(2*r*radius),-1,1);
   const angle=Math.atan2(dz,dx)+direction*Math.acos(cosine);
   const target=V(center.x+Math.cos(angle)*radius,a.y,center.z+Math.sin(angle)*radius);
   turnBone(bone,new T.Quaternion().setFromUnitVectors(tip.sub(a).normalize(),target.sub(a).normalize()));
  }
 }
 p.gripPole=center;p.root.updateMatrixWorld(true);
}
export async function makePassengers(model,{loadSource}={}){
 const loader=new GLTFLoader();
 const sources=await Promise.all(['maya','sam'].map(n=>loadSource?loadSource(n):loader.loadAsync(new URL(`../characters/assets/people/${n}.glb`,import.meta.url).href)));
 sources.forEach(refineHumanAsset);
 tailorMaleShirt(sources[1]);
 const people=[],updates=[];
 let residentId=0;
 function human(parent,variant,passenger=true){
  const source=sources[variant%2],root=new T.Group(),body=clone(source.scene);
  parent.add(root);root.add(body);root.name=passenger?`metro-passenger-${people.length}`:`bridge-pedestrian-${residentId++}`;
  const meshes=[];body.traverse(o=>{if(o.isMesh)meshes.push(o);});
  for(const mesh of meshes){
   const name=mesh.material.name;mesh.material=residentMaterial(name,variant);mesh.frustumCulled=false;
   if(!/eyebrow|eyelash|low-poly|ankle/i.test(name)){
    const edge=mesh.clone(false);edge.material=outlineMaterial();edge.name='human-outline';edge.raycast=()=>{};edge.frustumCulled=false;
    edge.skeleton=mesh.skeleton;edge.bindMatrix.copy(mesh.bindMatrix);edge.bindMatrixInverse.copy(mesh.bindMatrixInverse);mesh.parent.add(edge);
   }
  }
  shareSkeletons(body);
  const mixer=new T.AnimationMixer(body),actions=Object.fromEntries(source.animations.map(a=>[a.name,mixer.clipAction(a)]));
  let car=parent;while(car&&car.userData.car===undefined)car=car.parent;
  const p={root,body,mixer,actions,bones:{},time:variant*.93,car:car?.userData.car??0};
  body.traverse(o=>{if(o.isBone)p.bones[o.name]=o;});
  if(passenger){root.userData.passenger=people.length;people.push(p);}
  return p;
 }
 function seated(parent,x,z,yaw,variant){
  const p=human(parent,variant),b=p.bones;
  p.role='seated';
  const activity=createActivity(p,{mode:'relax',x,z,yaw,seat:.36,floor:0,solveArms:false,solveLegs:false});
  // Keep the feet planted in line with each hip, with a small relaxed opening.
  // The source pose's wide ankles and root-relative knee poles pulled knees in.
  const contacts=['l','r'].map((side,i)=>{
   const hip=p.root.worldToLocal(b[`thigh_${side}`].getWorldPosition(V()));
   const foot=p.root.worldToLocal(b[`foot_${side}`].getWorldPosition(V()));
   foot.x=hip.x+(i===0?1:-1)*.04;
   return foot;
  });
  updates.push(dt=>{
   const visible=!poseVisibility||poseVisibility(p.root);
   activity.update(dt,visible);if(!visible)return;
   for(const [i,side]of ['l','r'].entries()){
    const hip=p.root.worldToLocal(b[`thigh_${side}`].getWorldPosition(V()));
    const pole=V(contacts[i].x,hip.y-.05,hip.z+.8);
    reach(b[`thigh_${side}`],b[`calf_${side}`],b[`foot_${side}`],p.root.localToWorld(contacts[i].clone()),p.root.localToWorld(pole),true);
   }
   for(const [side,sign]of [['l',1],['r',-1]]){
    const thigh=b[`thigh_${side}`].getWorldPosition(V()),knee=b[`calf_${side}`].getWorldPosition(V());
    const hand=thigh.lerp(knee,.60).add(V(0,.095,0));
    const forward=V(0,0,1).transformDirection(p.root.matrixWorld);
    // Bend below each actual shoulder, close to the ribs. A fixed wide pole
    // made the larger Sam mesh flare its elbows out like an armrest pose.
    const shoulder=p.root.worldToLocal(b[`upperarm_${side}`].getWorldPosition(V()));
    const elbow=p.root.localToWorld(shoulder.add(V(sign*.025,-.28,-.04)));
    arm(p,side,hand,elbow,hand.clone().addScaledVector(forward,.14),.10);
   }
  });
 }
 function standing(parent,x,z,yaw,variant,grip=null){
  const p=human(parent,variant),b=p.bones;
  const action=p.actions.Idle_Standing;action.play();action.time=0;action.paused=true;p.mixer.update(0);
  p.root.position.set(x,0,z);p.root.rotation.y=yaw;p.root.updateMatrixWorld(true);
  const rest=Object.values(b).map(b=>({b,q:b.quaternion.clone(),p:b.position.clone()}));
  const sway=new MotionSpring();let time=variant,clock=0;
  updates.push(dt=>{
   time+=dt;clock+=dt;while(clock>=1/120){sway.step(Math.sin(time*.81+variant)*.012,1/120,.18);clock-=1/120;}
   if(poseVisibility&&!poseVisibility(p.root))return;
   for(const r of rest){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);}
   p.root.updateWorldMatrix(true,true);
   turnBone(b.spine_01,new T.Quaternion().setFromAxisAngle(V(0,0,1),sway.value));
   turnBone(b.spine_03,new T.Quaternion().setFromAxisAngle(V(1,0,0),Math.sin(time*1.25)*.006));
   turnBone(b.head,new T.Quaternion().setFromAxisAngle(V(0,1,0),Math.sin(time*.29+variant)*.07));
   for(const [side,sign]of [['l',1],['r',-1]]){
    if(grip&&side==='l'){
     gripPole(p,parent,grip);
    }else{
     arm(p,side,local(p,sign*.24,.82,.04),local(p,sign*.30,1.04,-.08),local(p,sign*.24,.65,.08),.17,V(-sign,0,0).transformDirection(p.root.matrixWorld));
    }
   }
  });
 }
 model.cars.forEach((car,i)=>{
  const floor=new T.Group();floor.position.y=.79;car.add(floor);
  seated(floor,0,.89,Math.PI,i*3);
  seated(floor,3.4,-.89,0,i*3+1);
  standing(floor,-2.20,.70,Math.PI,i*3+2,[-2.75,1.32,.42]);
  if(i===1){
   // Reuse Habitat's captured gait, planted-foot IK and spring-driven turns.
   const aisle=new T.Group();aisle.rotation.y=Math.PI/2;aisle.position.z=-.25;floor.add(aisle);
   const person=human(aisle,9);person.role='aisle-walker';
   const walker=createWalker(person,{hallX:0,variant:1});person.walker=walker;updates.push(dt=>walker.update(dt,poseVisibility));
  }
 });
 const cabFloor=new T.Group();cabFloor.position.y=.79;model.cars[0].add(cabFloor);
 const driver=human(cabFloor,11),seatX=model.cab?.seatX??-3.80;
 driver.view=CAB_VIEW;driver.role='motorman';driver.root.userData.car=CAB_VIEW;
 const driving=createActivity(driver,{mode:'relax',x:seatX,z:0,yaw:-Math.PI/2,seat:model.cab?.seatHeight??.465,floor:0,solveArms:false});
 updates.push(dt=>{
  const visible=!poseVisibility||poseVisibility(driver.root);
  driving.update(dt,visible);if(!visible)return;
  // Both wrists stay on the control grips while breathing and head motion
  // continue through the captured seated pose and the existing arm solver.
  for(const [side,sign]of [['l',1],['r',-1]]){
   const center=cabFloor.localToWorld(V(-4.22,.81,sign*.29));
   const wrist=center.clone().add(V(.11,-.025,sign*.055));
   // A low, upright controller allows a neutral wrist and a hanging elbow.
   // The thumb is above the grip and opposes the four flexed fingers.
   arm(driver,side,wrist,cabFloor.localToWorld(V(-3.80,.74,sign*.30)),wrist.clone().add(V(-.16,0,0)),0,V(0,0,-sign));
   for(const name of ['index','middle','ring','pinky','thumb'])for(let j=1;j<=3;j++){
    const bone=driver.bones[`${name}_0${j}_${side}`],next=driver.bones[`${name}_0${j+1}_${side}`];if(!bone)continue;
    const a=bone.getWorldPosition(V()),tip=next?next.getWorldPosition(V()):bone.localToWorld(V(0,.018,0));
    const length=a.distanceTo(tip),dx=a.x-center.x,dz=a.z-center.z,r=Math.hypot(dx,dz),radius=name==='thumb'?.048:.044;
    const cosine=T.MathUtils.clamp((r*r+radius*radius-length*length)/(2*r*radius),-1,1);
    const angle=Math.atan2(dz,dx)+(name==='thumb'?-sign:sign)*Math.acos(cosine);
    const target=V(center.x+Math.cos(angle)*radius,a.y,center.z+Math.sin(angle)*radius);
    turnBone(bone,new T.Quaternion().setFromUnitVectors(tip.sub(a).normalize(),target.sub(a).normalize()));
   }
  }
 });
 let poseVisibility=null;
 updates.forEach(f=>f(0));
 return {count:people.length,update(dt,visible){poseVisibility=visible;updates.forEach(f=>f(dt));},people,createHuman:(parent,variant)=>human(parent,variant,false)};
}
