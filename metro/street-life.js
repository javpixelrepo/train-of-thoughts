import * as T from 'three';
import {makeTrafficCar} from './model.js?v=38';
import {createWalker} from '../characters/locomotion.js?v=4';

// Vehicles and residents have their own clocks; none is baked into a scenery
// segment. A supplied RNG makes long-run spacing/contact checks reproducible.
export function makeStreetLife(model,residents,{random=Math.random}={}){
 const between=(a,b)=>a+(b-a)*random(),traffic=new T.Group();
 traffic.name='two-way-street-traffic';model.root.add(traffic);
 const template=makeTrafficCar(new T.Group()),vehicles=[];
 let time=0,lastDistance=0,carArrivals=0,pedestrianArrivals=0;
 const limit=96,minGap=22,laneNextArrival=[0,0];
 for(let lane=0;lane<2;lane++)for(let i=0;i<3;i++){
  const root=template.clone(true),direction=lane===0?1:-1;
  root.position.set(-68+i*68+between(-10,10),.04,lane===0?3.65:6.35);
  root.rotation.y=direction>0?Math.PI:0;traffic.add(root);
  const wheels=[];root.traverse(o=>{if(o.name==='traffic-wheel')wheels.push(o);});
  const cruise=between(7.2,10);
  vehicles.push({root,wheels,lane,direction,speed:cruise,cruise,headway:between(28,38),entryGap:between(36,50),wait:0,active:true});
 }
 const staging=new T.Group();staging.visible=false;model.root.add(staging);
 const people=Array.from({length:14},(_,i)=>{
  const p=residents.createHuman(staging,i+6);
  // Train passengers remain the 1:1 reference. Scale before shoe calibration.
  p.root.scale.setScalar(.94);
  const neutral=Object.values(p.bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
  p.root.visible=false;return {p,neutral,active:false,walker:null,bridge:null};
 });
 const bridges=model.bridges.map((b,id)=>{
  const frame=new T.Group();frame.position.y=.13;frame.rotation.y=Math.PI/2;b.frame.add(frame);
  return {...b,id,walkFrame:frame,occupants:new Set(),wait:between(3,20),lastX:b.frame.getWorldPosition(new T.Vector3()).x,speeds:[between(.68,.92),between(.68,.92)]};
 });
 // Calibrate shoes during loading, not on a pedestrian's first arrival.
 for(const {p}of people)createWalker(p,{hallX:0,route:{start:0,speed:.8}});
 function retire(person){
  person.bridge?.occupants.delete(person);person.active=false;person.p.root.visible=false;
  staging.add(person.p.root);person.bridge=null;person.walker=null;
 }
 function spawn(bridge,direction,initialPosition=null){
  const person=people.find(p=>!p.active);if(!person||bridge.occupants.size>=3||Math.abs(bridge.lastX)>(initialPosition===null?65:95))return false;
  const occupied=bridges.filter(b=>b.occupants.size).length;
  if(!bridge.occupants.size&&occupied>=8)return false;
  const start=initialPosition??-direction*(bridge.length/2+.45);
  // Keep a headway in each walking lane; opposite directions use separate sides.
  if([...bridge.occupants].some(p=>p.direction===direction&&Math.abs(p.p.root.position.z-start)<2.3))return false;
  bridge.walkFrame.add(person.p.root);person.p.mixer.stopAllAction();
  for(const r of person.neutral){r.b.position.copy(r.p);r.b.quaternion.copy(r.q);r.b.scale.copy(r.s);}
  person.p.root.visible=true;person.active=true;person.bridge=bridge;person.direction=direction;
  person.walker=createWalker(person.p,{hallX:direction*.30,stepSeconds:between(.53,.63),route:{start,speed:direction*bridge.speeds[direction>0?0:1]}});
  person.walker.update(between(.1,.8));bridge.occupants.add(person);pedestrianArrivals++;return true;
 }
 function populateBridge(bridge){
  // Seed crossings already underway, outside the view, using the same pool.
  // Starting only at hidden endpoints left long bridges empty as they passed.
  const count=1+Number(random()<.7)+Number(random()<.2),direction=random()<.5?1:-1;
  for(let i=0;i<count;i++)spawn(bridge,i%2?-direction:direction,between(-bridge.length*.28,bridge.length*.28));
 }
 // Populate only a subset, at different points in their crossing, on first view.
 const nearestCrossing=bridges.filter(b=>b.length>20).sort((a,b)=>Math.abs(a.lastX)-Math.abs(b.lastX))[0];
 const chosen=[{b:nearestCrossing},...bridges.filter(b=>b!==nearestCrossing&&Math.abs(b.lastX)<65).map(b=>({b,order:random()})).sort((a,b)=>a.order-b.order).slice(0,6)];
 chosen.forEach(({b})=>populateBridge(b));
 const sidewalkFrame=new T.Group();sidewalkFrame.position.y=.095;sidewalkFrame.rotation.y=Math.PI/2;model.root.add(sidewalkFrame);
 let sidewalkArrivals=0;
 const sidewalkPeople=Array.from({length:10},(_,i)=>{
  const p=residents.createHuman(staging,i+2),neutral=Object.values(p.bones).map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
  p.root.scale.setScalar(.89);
  p.root.visible=false;return {p,neutral,active:false,walker:null,wait:between(8,22),direction:1,promenade:i>=5};
 });
 for(const {p}of sidewalkPeople)createWalker(p,{hallX:0,route:{start:0,speed:.8}});
 function spawnSidewalk(person,x){
  if(sidewalkPeople.some(other=>other.active&&other.promenade===person.promenade&&Math.abs(other.p.root.position.z+lastDistance-x)<6))return false;
  sidewalkFrame.add(person.p.root);person.p.mixer.stopAllAction();
  for(const r of person.neutral){r.b.position.copy(r.p);r.b.quaternion.copy(r.q);r.b.scale.copy(r.s);}
  person.direction=random()<.5?-1:1;person.active=true;person.p.root.visible=true;
  const laneZ=person.promenade?-3.9+person.direction*.3:(person.direction>0?10.24:9.76);
  person.walker=createWalker(person.p,{hallX:-laneZ,stepSeconds:between(.55,.65),route:{start:x-lastDistance,speed:person.direction*between(.65,.90)}});
  sidewalkArrivals++;return true;
 }
 sidewalkPeople.slice(0,4).forEach((person,i)=>spawnSidewalk(person,-48+i*29+between(-5,5)));
 sidewalkPeople.slice(5,9).forEach((person,i)=>spawnSidewalk(person,-45+i*28+between(-5,5)));
 // Independent clocks prevent the first half of the pool starving the other
 // sidewalk. Each reuses its five existing residents indefinitely.
 const nextSidewalkArrival=[between(5,12),between(5,12)];
 function stepTraffic(dt,sceneryDelta){
  for(let lane=0;lane<2;lane++){
   const members=vehicles.filter(v=>v.lane===lane),direction=lane===0?1:-1;
   const ordered=members.filter(v=>v.active).sort((a,b)=>direction*(b.root.position.x-a.root.position.x));
   let leader=null;
   for(const car of ordered){
    const x=car.root.position.x,gap=leader?direction*(leader.previousX-x):Infinity;
    // Match a slower leader early, before a visible queue can compress.
    const desired=leader?Math.min(car.cruise,Math.max(0,leader.speed+(gap-car.headway)*.35)):car.cruise;
    car.speed=T.MathUtils.damp(car.speed,desired,1.4,dt);car.previousX=x;
    let next=x+sceneryDelta+direction*car.speed*dt;
    if(leader&&direction*(leader.root.position.x-next)<minGap){
     next=leader.root.position.x-direction*minGap;
     car.speed=Math.max(0,direction*(next-x-sceneryDelta)/dt);
    }
    car.root.position.x=next;
    // All wheel assemblies use the car's local axle, independent of direction.
    for(const wheel of car.wheels)wheel.rotation.z+=car.speed*dt/(.325*.8);
    if(Math.abs(next)>limit){car.active=false;car.root.visible=false;car.wait=between(9,22);car.entryGap=between(36,50);}
    else leader=car;
   }
   for(const car of members){
    if(car.active)continue;car.wait-=dt;if(car.wait>0||time<laneNextArrival[lane])continue;
    const entry=-direction*(limit-1);
    if(members.some(v=>v.active&&Math.abs(v.root.position.x-entry)<car.entryGap)){car.wait=between(3,7);continue;}
    car.root.position.x=entry;car.speed=car.cruise=between(7.2,10);car.headway=between(28,38);
    car.active=true;car.root.visible=true;carArrivals++;
    laneNextArrival[lane]=time+between(5,11);
   }
  }
 }
 function update(dt,distance,visible){
  if(dt<=0){for(const person of [...people,...sidewalkPeople])if(person.active&&!person.p.root.visible&&(!visible||visible(person.p.root)))person.walker.update(0);return;}
  time+=dt;const delta=distance-lastDistance;lastDistance=distance;
  sidewalkFrame.position.x=distance;
  for(const person of sidewalkPeople){
   if(person.active){
    person.walker.update(dt,visible);
    if(person.p.root.position.z+distance>96){person.active=false;person.p.root.visible=false;staging.add(person.p.root);person.wait=between(10,25);}
   }else{
    person.wait-=dt;
   }
  }
  for(let side=0;side<2;side++){
   if(time<nextSidewalkArrival[side])continue;
   const available=sidewalkPeople.filter(p=>!p.active&&p.wait<=0&&Number(p.promenade)===side);
   const person=available[Math.floor(random()*available.length)];
   if(person&&spawnSidewalk(person,-95))nextSidewalkArrival[side]=time+between(9,17);
  }
  // Bound motion increments for long frames without changing the random schedule.
  const steps=Math.max(1,Math.ceil(dt/(1/30)));
  for(let i=0;i<steps;i++)stepTraffic(dt/steps,delta/steps);
  const entering=[];
  for(const b of bridges){
   const x=b.frame.getWorldPosition(new T.Vector3()).x;
   if(Math.abs(x-b.lastX)>80){
    for(const person of [...b.occupants])retire(person);
    b.wait=between(2,16);b.speeds=[between(.68,.92),between(.68,.92)];
   }
   if(Math.abs(x)>80)for(const person of [...b.occupants])retire(person);
   if(b.lastX<-80&&x>=-80&&x<0)entering.push(b);
   b.lastX=x;b.wait-=dt;
  }
  // Release outgoing slots before populating incoming segments. Some bridges
  // stay empty; populated ones get varied positions and both walking directions.
  for(const b of entering)if(random()<(b.length>20?.9:.55))populateBridge(b);
  for(const b of bridges)if(b.wait<=0){
   if(b.occupants.size&&b.length<20)spawn(b,random()<.5?-1:1);
   b.wait=between(5,22);
  }
  for(const person of people){
   if(!person.active)continue;
   person.walker.update(dt,visible);
   if(person.direction*person.p.root.position.z>person.bridge.length/2+.55)retire(person);
  }
 }
 function inspect(){return {time,carArrivals,pedestrianArrivals,sidewalkArrivals,
  vehicles:vehicles.filter(v=>v.active).map(v=>({lane:v.lane,direction:v.direction,x:v.root.position.x,z:v.root.position.z,speed:v.speed})),
  walkers:people.filter(p=>p.active).map(p=>({bridge:p.bridge.id,direction:p.direction,position:p.p.root.position.toArray(),length:p.bridge.length,pose:p.walker.inspect()})),
  sidewalkWalkers:sidewalkPeople.filter(p=>p.active).map(p=>({direction:p.direction,x:p.p.root.position.z+lastDistance,z:-p.p.root.position.x})),
  occupiedBridges:bridges.filter(b=>b.occupants.size).length};}
 return {update,inspect,vehicles,people,sidewalkPeople,bridges,sidewalkFrame};
}
